"""Servicios de tarifas y jornadas.

Toda mutación sobre ``WorkerRate`` o ``Workday`` pasa por aquí. Las
vistas y serializadores solo orquestan; nunca tocan ``save()`` directo.
"""

from __future__ import annotations

from datetime import date
from datetime import timedelta
from decimal import ROUND_HALF_UP
from decimal import Decimal
from typing import TYPE_CHECKING

from django.db import transaction
from django.db.models import Q

from apps.catalogs.models import PaymentStatus

from .exceptions import NoActiveRateError
from .exceptions import OverlappingRateError
from .exceptions import WorkdayAlreadyPaidError
from .models import Workday
from .models import WorkerRate

if TYPE_CHECKING:
    from apps.users.models import User  # pragma: no cover
    from apps.users.models import WorkerProfile  # pragma: no cover


def _decimal_cents(value: Decimal) -> Decimal:
    """Redondeo bancario a 2 decimales (HALF_UP) — sin drift de centavos."""
    return value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def _vigente_filter_q(reference: date) -> Q:
    """Q para ``WorkerRate`` vigente en ``reference``.

    ``valid_until`` nulo cuenta como vigente de forma indefinida.
    ``valid_from <= reference`` debe cumplirse.
    """
    return Q(valid_until__isnull=True) | Q(valid_until__gte=reference)


@transaction.atomic
def create_worker_rate(
    *,
    worker: WorkerProfile,
    amount: Decimal,
    valid_from: date,
) -> WorkerRate:
    """Crea una tarifa nueva cerrando la vigente anterior.

    Reglas:
    - ``amount`` se redondea a 2 decimales.
    - Si existe una tarifa con ``valid_from < valid_from`` (anterior) cuyo
      ``valid_until`` sea ``None`` o ``>= valid_from``, solapa.
    - La tarifa inmediatamente anterior (si la hay) se cierra poniendo
      ``valid_until = valid_from - 1 día``.
    """
    amount = _decimal_cents(Decimal(amount))

    # Encontrar la tarifa inmediatamente anterior (valid_from < nueva).
    anterior = (
        WorkerRate.objects.filter(worker=worker, valid_from__lt=valid_from)
        .order_by("-valid_from")
        .first()
    )

    # 1) Si la anterior tiene ``valid_until`` explícito que cubre o iguala
    #    ``valid_from``, hay solape verdadero → rechaza.
    if (
        anterior
        and anterior.valid_until is not None
        and anterior.valid_until >= valid_from
    ):
        msg = (
            f"Tarifa solapa con {anterior.amount} vigente desde "
            f"{anterior.valid_from} (vence {anterior.valid_until})."
        )
        raise OverlappingRateError(msg)

    # 2) Si la anterior está ABIERTA (``valid_until is None``), ciérrala
    #    poniéndole ``valid_until = valid_from - 1 día`` antes de crear
    #    la nueva.
    if anterior and anterior.valid_until is None:
        anterior.valid_until = valid_from - timedelta(days=1)
        anterior.save(update_fields=["valid_until"])

    return WorkerRate.objects.create(
        worker=worker,
        amount=amount,
        valid_from=valid_from,
        valid_until=None,
    )


def _vigente_rate_on(worker: WorkerProfile, on: date) -> WorkerRate | None:
    """Tarifa vigente del trabajador en la fecha ``on``.

    Vigente = ``valid_from <= on`` y ``valid_until`` es nulo o ``>= on``.
    Devuelve la más reciente si hay varias.
    """
    return (
        WorkerRate.objects.filter(worker=worker, valid_from__lte=on)
        .filter(_vigente_filter_q(on))
        .order_by("-valid_from")
        .first()
    )


def create_workday(  # noqa: PLR0913 — Fase B: contrato por dominio
    *,
    worker: WorkerProfile,
    workday_type,
    date: date,
    applied_rate: Decimal | None = None,
    notes: str = "",
    created_by: User,
) -> Workday:
    """Crea una jornada calculando ``applied_rate`` si no se pasa.

    Reglas:
    - Si ``applied_rate`` es ``None`` se busca la tarifa vigente del
      trabajador en ``date``. Si no hay, ``NoActiveRateError``.
    - El cálculo es ``tarifa_vigente * workday_type.factor`` redondeado
      a 2 decimales (HALF_UP).
    - El estado inicial siempre es ``Pendiente`` (idempotente vía
      ``get_or_create``; la migración 0002_seed_catalogs siembra el
      catálogo canónico).
    - ``notes`` opcional.
    """
    if applied_rate is None:
        vigente = _vigente_rate_on(worker, date)
        if vigente is None:
            msg = f"El trabajador {worker} no tiene tarifa vigente en {date}."
            raise NoActiveRateError(
                msg,
            )
        applied_rate = _decimal_cents(
            Decimal(vigente.amount) * Decimal(workday_type.factor),
        )
    else:
        applied_rate = _decimal_cents(Decimal(applied_rate))

    payment_status, _ = PaymentStatus.objects.get_or_create(
        name="Pendiente",
        defaults={"order": 0, "is_active": True},
    )
    return Workday.objects.create(
        worker=worker,
        workday_type=workday_type,
        payment_status=payment_status,
        date=date,
        applied_rate=applied_rate,
        notes=notes or "",
        created_by=created_by,
    )


def _has_payment_details(workday: Workday) -> bool:
    """¿La jornada tiene algún ``PaymentWorkdayDetail`` de un pago NO anulado?"""
    from apps.payments.models import PaymentWorkdayDetail  # noqa: PLC0415

    return PaymentWorkdayDetail.objects.filter(
        workday=workday,
        payment__voided_at__isnull=True,
    ).exists()


@transaction.atomic
def update_workday(
    *,
    workday: Workday,
    workday_type=None,
    date: date | None = None,
    notes: str | None = None,
) -> Workday:
    """Actualiza campos editables de una jornada.

    Levanta ``WorkdayAlreadyPaidError`` si la jornada ya tiene pagos
    aplicados (algun ``PaymentWorkdayDetail`` no anulado apuntándola).
    ``applied_rate`` es inmutable (fue el monto acordado ese día).
    """
    if _has_payment_details(workday):
        msg = (
            f"La jornada {workday.id} ya tiene pagos aplicados y no se puede modificar."
        )
        raise WorkdayAlreadyPaidError(msg)

    if workday_type is not None:
        workday.workday_type = workday_type
    if date is not None:
        workday.date = date
    if notes is not None:
        workday.notes = notes
    workday.save()
    return workday


@transaction.atomic
def delete_workday(*, workday: Workday) -> None:
    """Elimina una jornada si no tiene pagos aplicados."""
    if _has_payment_details(workday):
        msg = (
            f"La jornada {workday.id} ya tiene pagos aplicados y no se puede eliminar."
        )
        raise WorkdayAlreadyPaidError(msg)
    workday.delete()
