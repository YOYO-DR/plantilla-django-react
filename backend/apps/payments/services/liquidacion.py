"""Servicio transaccional para liquidar jornadas (Regla R6).

Crea una ``Liquidacion`` como snapshot inmutable, marca las jornadas
incluidas con ``liquidacion`` y, si corresponde, genera un movimiento de
abono automático contra el saldo de deuda del trabajador.
"""

from __future__ import annotations

from decimal import Decimal
from typing import TYPE_CHECKING

from django.db import transaction

from apps.catalogs.models import TipoMovimientoDeuda
from apps.payments.models import Liquidacion
from apps.payments.models import MovimientoDeuda
from apps.payments.models import PaymentWorkdayDetail
from apps.workdays.models import Workday

if TYPE_CHECKING:
    from apps.users.models import User
    from apps.users.models import WorkerProfile


_JORNADA_YA_LIQUIDADA = "Alguna jornada ya está liquidada."
_DESCUENTO_NEGATIVO = "Descuento negativo."
_MODO_INVALIDO_FMT = "Modo '{}' inválido."


def calcular_saldo_actual(worker: WorkerProfile) -> Decimal:
    """Suma ``signed_amount`` de todos los movimientos no liquidados.

    El saldo del trabajador es la diferencia entre préstamos/ajustes
    pendientes y los abonos ya aplicados. Sólo cuentan los movimientos
    que NO están vinculados a una liquidación previa.
    """
    qs = MovimientoDeuda.objects.filter(
        worker=worker,
        liquidacion__isnull=True,
    ).select_related("tipo")
    saldo = sum((m.signed_amount for m in qs), Decimal(0))
    return Decimal(max(0, float(saldo)))


def calcular_subtotal(jornadas_qs):
    """Suma ``applied_rate`` de las jornadas."""
    return sum((j.applied_rate for j in jornadas_qs), Decimal(0))


def crear_linea_detalle(
    workday: Workday,
    es_override: bool = False,  # noqa: FBT001, FBT002
) -> dict:
    """Genera una línea de snapshot para el campo JSONField ``detalle``."""
    return {
        "fecha": workday.date.isoformat(),
        "tipo": workday.workday_type.name,
        "tarifa_aplicada": float(workday.applied_rate),
        "valor": float(workday.applied_rate),
        "es_override": es_override,
    }


def _calcular_descuento(
    modo_descuento: str,
    saldo: Decimal,
    subtotal: Decimal,
    monto_manual,
) -> Decimal:
    """Resuelve el descuento a aplicar según el modo elegido."""
    if modo_descuento == "ninguno":
        return Decimal(0)
    if modo_descuento == "total":
        return min(saldo, subtotal)
    if modo_descuento == "parcial":
        manual = Decimal(str(monto_manual))
        if manual < 0:
            raise ValueError(_DESCUENTO_NEGATIVO)
        return min(saldo, subtotal, manual)
    msg = _MODO_INVALIDO_FMT.format(modo_descuento)
    raise ValueError(msg)


def liquidar(  # noqa: PLR0913
    *,
    organization,
    worker: WorkerProfile,
    periodo_inicio,
    periodo_fin,
    jornada_ids: list[int],
    modo_descuento: str,
    monto_manual,
    fecha_pago,
    observaciones: str,
    registrado_por: User,
) -> Liquidacion:
    """Ejecuta la transacción R6 de liquidación."""
    with transaction.atomic():
        # 1) Validar jornadas (FOR UPDATE para evitar doble liquidación concurrente)
        jornadas = list(
            Workday.objects.select_for_update().filter(
                id__in=jornada_ids,
                worker=worker,
                liquidacion_id__isnull=True,
            ),
        )
        if len(jornadas) != len(jornada_ids):
            raise ValueError(_JORNADA_YA_LIQUIDADA)

        # 2) Calcular saldo y subtotal
        saldo = calcular_saldo_actual(worker)
        subtotal = calcular_subtotal(jornadas)

        # 3) Calcular descuento
        descuento = _calcular_descuento(modo_descuento, saldo, subtotal, monto_manual)
        total_pagado = subtotal - descuento
        saldo_despues = max(Decimal(0), saldo - descuento)

        # 4) Consecutivo por organización
        ultimo = (
            Liquidacion.objects.filter(organization=organization)
            .order_by("-consecutivo")
            .first()
        )
        consecutivo = (ultimo.consecutivo + 1) if ultimo else 1

        # 5) Crear liquidación (snapshot)
        liq = Liquidacion.objects.create(
            organization=organization,
            worker=worker,
            consecutivo=consecutivo,
            periodo_inicio=periodo_inicio,
            periodo_fin=periodo_fin,
            jornada_ids=list(jornada_ids),
            detalle=[crear_linea_detalle(j) for j in jornadas],
            subtotal_jornadas=subtotal,
            saldo_deuda_antes=saldo,
            modo_descuento=modo_descuento,
            monto_descontado=descuento,
            total_pagado=total_pagado,
            saldo_deuda_despues=saldo_despues,
            estado="pagada",
            fecha_pago=fecha_pago,
            observaciones=observaciones or "",
            creado_por=registrado_por,
        )

        # 6) Bloquear jornadas
        Workday.objects.filter(id__in=jornada_ids).update(liquidacion_id=liq.id)

        # 7) Detalle de jornadas y movimiento de abono si hubo descuento
        PaymentWorkdayDetail.objects.bulk_create(
            [
                PaymentWorkdayDetail(
                    payment=liq,
                    workday_id=j.id,
                    applied_amount=j.applied_rate,
                )
                for j in jornadas
            ],
        )
        if descuento > 0:
            tipo_abono = TipoMovimientoDeuda.objects.get(name="Abono")
            MovimientoDeuda.objects.create(
                worker=worker,
                tipo=tipo_abono,
                monto=descuento,
                concepto=f"Descuento en liquidación #{consecutivo}",
                fecha=fecha_pago,
                liquidacion=liq,
                registrado_por=registrado_por,
            )

        return liq
