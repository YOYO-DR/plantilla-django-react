"""Servicios de préstamos y pagos.

Toda mutación de saldo pasa por aquí. ``transaction.atomic`` +
``select_for_update`` obligatorio. Todo ``Decimal``, jamás ``float``.

Decisiones cerradas con el usuario (Fase A):
- ``Payment.total_amount`` = BRUTO (suma de TODOS los detalles, jornadas
  + abonos a préstamo). El neto entregado en efectivo se calcula, no se
  almacena.
- ``void_payment`` = soft-delete con ``voided_at`` + ``voided_by``.
- Se permite un pago que solo abona a préstamo (sin jornadas).
- Se permiten varias jornadas del mismo trabajador en la misma fecha.
"""

from __future__ import annotations

from dataclasses import dataclass
from dataclasses import field
from decimal import ROUND_HALF_UP
from decimal import Decimal
from typing import TYPE_CHECKING

from django.db import transaction
from django.db.models import Sum
from django.utils import timezone

from apps.catalogs.models import LoanStatus
from apps.catalogs.models import PaymentMethod
from apps.catalogs.models import PaymentStatus
from apps.workdays.models import Workday

from .exceptions import CrossOrganizationError
from .exceptions import InconsistentPaymentTotalError
from .exceptions import LoanOverpaymentError
from .exceptions import OverpaymentError
from .exceptions import PaymentAlreadyVoidedError
from .models import Loan
from .models import Payment
from .models import PaymentLoanDetail
from .models import PaymentWorkdayDetail

if TYPE_CHECKING:
    from datetime import date  # pragma: no cover

    from apps.users.models import User  # pragma: no cover
    from apps.users.models import WorkerProfile  # pragma: no cover


def _cents(value: Decimal | float | str) -> Decimal:
    """Redondeo a 2 decimales (HALF_UP) consistente con todos los servicios."""
    return Decimal(value).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def _loan_status(name: str) -> LoanStatus:
    """Devuelve (y crea si hace falta) el catálogo ``LoanStatus`` canónico."""
    order = {"Activo": 0, "Pagado": 1, "Condonado": 2}[name]
    status, _ = LoanStatus.objects.get_or_create(
        name=name,
        defaults={"order": order, "is_active": True},
    )
    return status


def _payment_details_sum(payment: Payment) -> Decimal:
    """Suma real de detalles (jornadas + préstamos) leída desde la BD."""
    wd_sum = PaymentWorkdayDetail.objects.filter(payment=payment).aggregate(
        t=Sum("applied_amount"),
    )["t"] or Decimal("0")
    ln_sum = PaymentLoanDetail.objects.filter(payment=payment).aggregate(
        t=Sum("paid_amount"),
    )["t"] or Decimal("0")
    return _cents(wd_sum) + _cents(ln_sum)


def _raise_if_inconsistent_total(payment: Payment) -> None:
    """Compara ``payment.total_amount`` contra la suma real desde la BD.

    Si difiere, asume corrupción y lanza ``InconsistentPaymentTotalError``.
    """
    real_total = _payment_details_sum(payment)
    if _cents(payment.total_amount) != real_total:
        msg = (
            f"TotalAmount inconsistente: payment.total_amount="
            f"{payment.total_amount}, suma real desde DB={real_total}."
        )
        raise InconsistentPaymentTotalError(msg)


def _loan_status_activo() -> LoanStatus:
    return _loan_status("Activo")


def _loan_status_pagado() -> LoanStatus:
    return _loan_status("Pagado")


def _loan_status_condonado() -> LoanStatus:
    return _loan_status("Condonado")


def _payment_status_pendiente() -> PaymentStatus:
    status, _ = PaymentStatus.objects.get_or_create(
        name="Pendiente",
        defaults={"order": 0, "is_active": True},
    )
    return status


@dataclass
class LoanAllocation:
    """Asignación de abono a un préstamo dentro de un pago.

    ``loan``: instancia ``Loan``.
    ``amount``: monto a abonar (Decimal). El servicio verifica que no exceda
    el ``outstanding_balance``.
    """

    loan: Loan
    amount: Decimal


@dataclass
class WorkerBalance:
    """Resumen de cuenta de un trabajador."""

    worker_id: int
    pendientes_count: int = 0
    adeudado_workdays: Decimal = field(default_factory=lambda: Decimal("0.00"))
    saldo_prestamos: Decimal = field(default_factory=lambda: Decimal("0.00"))
    neto_a_pagar: Decimal = field(default_factory=lambda: Decimal("0.00"))


@transaction.atomic
def create_loan(
    *,
    worker: WorkerProfile,
    amount: Decimal,
    date: date,
    reason: str = "",
    created_by: User,
) -> Loan:
    """Crea un préstamo por ``amount`` con ``outstanding_balance = amount``."""
    amount = _cents(amount)
    status = _loan_status_activo()
    return Loan.objects.create(
        worker=worker,
        status=status,
        amount=amount,
        outstanding_balance=amount,
        date=date,
        reason=reason or "",
        created_by=created_by,
    )


def _ensure_same_org(*, worker: WorkerProfile, workdays, loans) -> None:
    """Aislamiento multi-tenant: rechaza jornada/préstamo de otro ``worker``
    o de otra organización.

    Comprobaciones:
    1. ``wd.worker_id``/``loan.worker_id`` debe ser el ``worker`` del pago.
       Si difiere, la entidad pertenece a otro perfil, fuera del pago.
    2. Las organizaciones deben coincidir (``worker.user.organization_id``
       vs ``wd.worker.user.organization_id``/``loan.worker.user.organization_id``).
       Ataja el caso en que dos ``workers`` distintos compartan org
       (defensa en profundidad).
    """
    worker_org_id = worker.user.organization_id
    for wd in workdays:
        if wd.worker.user.organization_id != worker_org_id:
            msg = f"La jornada {wd.id} pertenece a otra organización."
            raise CrossOrganizationError(
                msg,
            )
        if wd.worker_id != worker.id:
            msg = f"La jornada {wd.id} pertenece a otro trabajador ({wd.worker_id})."
            raise CrossOrganizationError(
                msg,
            )

    for loan in loans:
        if loan.worker.user.organization_id != worker_org_id:
            msg = f"El préstamo {loan.id} pertenece a otra organización."
            raise CrossOrganizationError(
                msg,
            )
        if loan.worker_id != worker.id:
            msg = (
                f"El préstamo {loan.id} pertenece a otro trabajador ({loan.worker_id})."
            )
            raise CrossOrganizationError(
                msg,
            )


def _recalc_workday_status(workday: Workday) -> None:
    """Recalcula ``Workday.payment_status`` según la suma de detalles NO anulados.

    ``suma == applied_rate`` → ``Pagado``.
    ``0 < suma < applied_rate`` → ``Parcial``.
    ``suma == 0`` → ``Pendiente``.
    """
    total = PaymentWorkdayDetail.objects.filter(
        workday=workday,
        payment__voided_at__isnull=True,
    ).aggregate(t=Sum("applied_amount"))["t"] or Decimal("0")
    total = _cents(total)

    if total <= Decimal("0"):
        workday.payment_status = _payment_status_pendiente()
    elif total < _cents(workday.applied_rate):
        workday.payment_status, _ = PaymentStatus.objects.get_or_create(
            name="Parcial",
            defaults={"order": 1, "is_active": True},
        )
    else:
        workday.payment_status, _ = PaymentStatus.objects.get_or_create(
            name="Pagado",
            defaults={"order": 2, "is_active": True},
        )
    workday.save(update_fields=["payment_status"])


@dataclass
class _WorkdayAmount:
    workday: Workday
    applied_amount: Decimal


def _build_workday_amounts(
    *,
    workdays: list[Workday],
    overrides: dict[int, Decimal] | None = None,
) -> list[_WorkdayAmount]:
    if not workdays:
        return []
    pairs: list[_WorkdayAmount] = []
    overrides = overrides or {}
    for wd in workdays:
        if wd.id in overrides:
            amount = _cents(overrides[wd.id])
        else:
            amount = _cents(wd.applied_rate)
        ya_pagado = PaymentWorkdayDetail.objects.filter(
            workday=wd,
            payment__voided_at__isnull=True,
        ).aggregate(t=Sum("applied_amount"))["t"] or Decimal("0")
        ya_pagado = _cents(ya_pagado)
        if _cents(ya_pagado) + amount > _cents(wd.applied_rate):
            msg = (
                f"Jornada {wd.id}: ya pagado {ya_pagado} + nuevo {amount} "
                f"excede applied_rate {wd.applied_rate}."
            )
            raise OverpaymentError(msg)
        pairs.append(_WorkdayAmount(workday=wd, applied_amount=amount))
    return pairs


@dataclass
class _LoanAmount:
    loan: Loan
    amount: Decimal
    # Estado que tenía el préstamo ANTES de aplicar este pago. Solo es
    # información necesaria para ``void_payment``: si estaba ``Condonado``
    # hay que devolverlo a ``Condonado`` al revertir el pago. Cuando es
    # ``Activo`` se recalcula según el saldo resultante (a ``Pagado`` si
    # quedó 0).
    pre_void_status: LoanStatus | None = None


def _build_loan_amounts(
    *,
    loans_by_id: dict[int, Loan],
    allocations: list[LoanAllocation],
) -> list[_LoanAmount]:
    """Empareja abonos por id (no por posición).

    ``Loan.Meta.ordering = ["-date"]`` hace que la queryset venga
    ordenada por fecha desc — emparejar con ``zip`` corrompe saldos.
    """
    pairs: list[_LoanAmount] = []
    for alloc in allocations:
        loan = loans_by_id.get(alloc.loan.id)
        if loan is None:
            msg = f"Préstamo {alloc.loan.id} no encontrado para asignar abono."
            raise LoanOverpaymentError(msg)
        pairs.append(
            _LoanAmount(
                loan=loan,
                amount=_cents(alloc.amount),
            ),
        )
    return pairs


@transaction.atomic
def register_payment(  # noqa: PLR0913, C901 — Fase B: contrato por dominio
    *,
    worker: WorkerProfile,
    payment_method: PaymentMethod,
    payment_date: date,
    workday_ids: list[int],
    loan_allocations: list[LoanAllocation],
    created_by: User,
    workday_overrides: dict[int, Decimal] | None = None,
) -> Payment:
    """Registra un pago que cubre jornadas y/o abona a préstamos."""
    workdays = list(
        Workday.objects.select_for_update().filter(id__in=workday_ids),
    )
    # Seleccionamos los préstamos pero NO asumimos ningún orden para nada
    # que no sea emparejamiento por id.
    requested_loan_ids = [la.loan.id for la in loan_allocations]
    loans = list(
        Loan.objects.select_for_update().filter(id__in=requested_loan_ids),
    )
    loans_by_id = {loan_obj.id: loan_obj for loan_obj in loans}

    _ensure_same_org(worker=worker, workdays=workdays, loans=loans)

    workday_amounts = _build_workday_amounts(
        workdays=workdays,
        overrides=workday_overrides,
    )
    loan_amounts = _build_loan_amounts(
        loans_by_id=loans_by_id,
        allocations=loan_allocations,
    )

    status_act = _loan_status_activo()
    status_pag = _loan_status_pagado()
    status_cond = _loan_status_condonado()

    # Validar saldo + estado antes de cualquier mutación.
    allocations_by_id = {la.loan.id: la for la in loan_allocations}
    for loan in loans:
        if loan.status_id == status_pag.id:
            msg = f"El préstamo {loan.id} ya está Pagado."
            raise LoanOverpaymentError(
                msg,
            )
        if loan.status_id == status_cond.id:
            msg = f"El préstamo {loan.id} está Condonado; no admite abonos."
            raise LoanOverpaymentError(
                msg,
            )
        if loan.outstanding_balance <= Decimal("0"):
            msg = f"El préstamo {loan.id} tiene saldo 0."
            raise LoanOverpaymentError(
                msg,
            )
        alloc = allocations_by_id.get(loan.id)
        if alloc is not None and _cents(alloc.amount) > _cents(
            loan.outstanding_balance,
        ):
            msg = (
                f"Abono {alloc.amount} excede saldo {loan.outstanding_balance} "
                f"del préstamo {loan.id}."
            )
            raise LoanOverpaymentError(
                msg,
            )

    # Subtotal BRUTO = suma de detalles (jornadas + préstamos).
    total = _cents(
        sum((wa.applied_amount for wa in workday_amounts), Decimal("0"))
        + sum((la.amount for la in loan_amounts), Decimal("0")),
    )

    payment = Payment.objects.create(
        worker=worker,
        payment_method=payment_method,
        total_amount=total,
        payment_date=payment_date,
        notes="",
        created_by=created_by,
    )

    for wa in workday_amounts:
        PaymentWorkdayDetail.objects.create(
            payment=payment,
            workday=wa.workday,
            applied_amount=wa.applied_amount,
        )
    for la in loan_amounts:
        PaymentLoanDetail.objects.create(
            payment=payment,
            loan=la.loan,
            paid_amount=la.amount,
        )

    # ---- Verificación real de consistencia desde la BD ----
    # Releemos la suma de detalles ya persistidos y la comparamos contra
    # ``payment.total_amount``. Si difiere por cualquier razón (corrupción,
    # truncamiento Decimal, intervención externa), abortamos la transacción.
    _raise_if_inconsistent_total(payment)

    # Aplicar abonos a préstamos.
    for la in loan_amounts:
        nuevo_saldo = _cents(la.loan.outstanding_balance) - la.amount
        if nuevo_saldo <= Decimal("0"):
            la.loan.outstanding_balance = Decimal("0")
            la.loan.status = status_pag
        else:
            la.loan.outstanding_balance = nuevo_saldo
            la.loan.status = status_act
        la.loan.save(update_fields=["outstanding_balance", "status"])

    # Recalcular status de las jornadas afectadas.
    for wa in workday_amounts:
        _recalc_workday_status(wa.workday)

    return payment


@transaction.atomic
def void_payment(*, payment: Payment, voided_by: User) -> Payment:
    """Anula un pago (soft-delete) revirtiendo saldos.

    Campos auditables:
    - ``voided_at = timezone.now()`` (NO la fecha de creación).
    - ``voided_by`` = el ``User`` que anula, pasado como argumento.
    """
    # Refrescar desde DB por si el caller lo leyó hace varias operaciones.
    payment.refresh_from_db()
    if payment.voided_at is not None:
        msg = f"El pago {payment.id} ya está anulado."
        raise PaymentAlreadyVoidedError(
            msg,
        )

    payment.voided_at = timezone.now()
    payment.voided_by = voided_by
    payment.save(update_fields=["voided_at", "voided_by"])

    # Snapshot del estado de cada préstamo ANTES de revertir, para
    # restaurarlo correctamente en ``Condonado`` cuando aplique.
    snapshots: dict[int, LoanStatus] = {}

    # Revertir saldos de préstamos: sumar paid_amount de vuelta al saldo.
    for pld in PaymentLoanDetail.objects.filter(payment=payment):
        loan: Loan = pld.loan
        snapshots[loan.id] = loan.status
        nuevo_saldo = _cents(loan.outstanding_balance) + _cents(pld.paid_amount)
        loan.outstanding_balance = nuevo_saldo
        loan.save(update_fields=["outstanding_balance"])

    # Recalcular status según saldo y snapshot previo.
    condonado_id = _loan_status_condonado().id
    for pld in PaymentLoanDetail.objects.filter(payment=payment):
        loan: Loan = pld.loan
        snapshot_status = snapshots[loan.id]
        # Tras revertir, si el saldo vuelve a ser >0, el préstamo está
        # Activo. La única excepción es si el préstamo estaba Condonado
        # ANTES del pago que ahora anulamos: conservar Condonado.
        if (
            loan.outstanding_balance > Decimal("0")
            and snapshot_status.id != condonado_id
        ):
            loan.status = _loan_status_activo()
        else:
            loan.status = snapshot_status
        loan.save(update_fields=["status"])

    # Recalcular status de cada jornada afectada.
    affected_workday_ids = list(
        PaymentWorkdayDetail.objects.filter(payment=payment).values_list(
            "workday_id",
            flat=True,
        ),
    )
    for wd in Workday.objects.filter(id__in=affected_workday_ids):
        _recalc_workday_status(wd)

    return payment


def worker_balance(worker: WorkerProfile) -> WorkerBalance:
    """Resumen: pendientes, adeudado, saldo de préstamos, neto a pagar."""
    status_pend = _payment_status_pendiente()
    status_par, _ = PaymentStatus.objects.get_or_create(
        name="Parcial",
        defaults={"order": 1, "is_active": True},
    )

    adeudado_qs = Workday.objects.filter(worker=worker).filter(
        payment_status__in=[status_pend, status_par],
    )
    adeudado_total = Decimal("0")
    for wd in adeudado_qs:
        ya_pagado = PaymentWorkdayDetail.objects.filter(
            workday=wd,
            payment__voided_at__isnull=True,
        ).aggregate(t=Sum("applied_amount"))["t"] or Decimal("0")
        adeudado_total += _cents(wd.applied_rate) - _cents(ya_pagado)

    status_act = _loan_status_activo()
    saldo_qs = Loan.objects.filter(worker=worker, status=status_act)
    saldo_total = saldo_qs.aggregate(t=Sum("outstanding_balance"))["t"] or Decimal("0")

    pendientes_count = adeudado_qs.filter(
        payment_status=status_pend,
    ).count()

    neto = _cents(adeudado_total) + _cents(saldo_total)

    return WorkerBalance(
        worker_id=worker.id,
        pendientes_count=pendientes_count,
        adeudado_workdays=_cents(adeudado_total),
        saldo_prestamos=_cents(saldo_total),
        neto_a_pagar=neto,
    )
