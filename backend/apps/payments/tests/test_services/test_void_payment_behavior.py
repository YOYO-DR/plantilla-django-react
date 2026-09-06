"""Comportamiento: ``void_payment`` con auditoría correcta y preservación
de estado ``Condonado``.
"""

from __future__ import annotations

from datetime import date
from decimal import Decimal

import pytest
from freezegun import freeze_time

from apps.catalogs.tests.factories import PaymentMethodFactory
from apps.payments.exceptions import PaymentAlreadyVoidedError
from apps.payments.services import (
    LoanAllocation,
    create_loan,
    register_payment,
    void_payment,
)
from apps.users.tests.factories import (
    UserFactory,
    WorkerProfileFactory,
)


@pytest.mark.django_db
@freeze_time("2026-06-15")
def test_void_payment_sets_voided_at_to_now_not_created_at():
    """``voided_at`` debe ser la fecha de anulación (timezone.now()),
    NO la de creación del pago. Para que la aserción sea fiable,
    creamos el pago a las 2026-01-01 y anulamos a las 2026-06-15.
    """
    profile = WorkerProfileFactory()
    maestro = UserFactory(organization=profile.user.organization)
    loan = create_loan(
        worker=profile,
        amount=Decimal("100.00"),
        date=date(2026, 1, 1),
        created_by=maestro,
    )
    pm = PaymentMethodFactory(name="Efectivo")
    with freeze_time("2026-01-01"):
        payment = register_payment(
            worker=profile,
            payment_method=pm,
            payment_date=date(2026, 1, 16),
            workday_ids=[],
            loan_allocations=[LoanAllocation(loan=loan, amount=Decimal("100.00"))],
            created_by=maestro,
        )

    void_payment(payment=payment, voided_by=maestro)

    payment.refresh_from_db()
    # created_at se generó bajo freezegun 2026-01-01.
    # voided_at se generó bajo freezegun 2026-06-15.
    assert payment.voided_at.date() == date(2026, 6, 15)
    assert payment.voided_by_id == maestro.id


@pytest.mark.django_db
def test_void_payment_voided_by_required():
    """Sin ``voided_by`` → TypeError (kwarg obligatorio)."""
    profile = WorkerProfileFactory()
    maestro = UserFactory(organization=profile.user.organization)
    loan = create_loan(
        worker=profile,
        amount=Decimal("100.00"),
        date=date(2026, 1, 1),
        created_by=maestro,
    )
    pm = PaymentMethodFactory(name="Efectivo")
    payment = register_payment(
        worker=profile,
        payment_method=pm,
        payment_date=date(2026, 1, 16),
        workday_ids=[],
        loan_allocations=[LoanAllocation(loan=loan, amount=Decimal("100.00"))],
        created_by=maestro,
    )
    with pytest.raises(TypeError):
        void_payment(payment=payment)  # type: ignore[call-arg]


@pytest.mark.django_db
def test_void_payment_twice_raises_payment_already_voided_error():
    """Anular dos veces → ``PaymentAlreadyVoidedError``, NO
    ``InconsistentPaymentTotalError`` (que era un mal uso)."""
    profile = WorkerProfileFactory()
    maestro = UserFactory(organization=profile.user.organization)
    loan = create_loan(
        worker=profile,
        amount=Decimal("100.00"),
        date=date(2026, 1, 1),
        created_by=maestro,
    )
    pm = PaymentMethodFactory(name="Efectivo")
    payment = register_payment(
        worker=profile,
        payment_method=pm,
        payment_date=date(2026, 1, 16),
        workday_ids=[],
        loan_allocations=[LoanAllocation(loan=loan, amount=Decimal("100.00"))],
        created_by=maestro,
    )
    void_payment(payment=payment, voided_by=maestro)
    with pytest.raises(PaymentAlreadyVoidedError):
        void_payment(payment=payment, voided_by=maestro)


@pytest.mark.django_db
def test_void_payment_preserves_condonado_status():
    """Si el préstamo era ``Condonado`` antes del pago que se anula, se
    conserva ``Condonado`` (anular NO resucita un condonado)."""
    profile = WorkerProfileFactory()
    maestro = UserFactory(organization=profile.user.organization)
    loan = create_loan(
        worker=profile,
        amount=Decimal("100.00"),
        date=date(2026, 1, 1),
        created_by=maestro,
    )

    pm = PaymentMethodFactory(name="Efectivo")
    payment = register_payment(
        worker=profile,
        payment_method=pm,
        payment_date=date(2026, 1, 16),
        workday_ids=[],
        loan_allocations=[LoanAllocation(loan=loan, amount=Decimal("100.00"))],
        created_by=maestro,
    )
    loan.refresh_from_db()
    assert loan.outstanding_balance == Decimal("0.00")
    assert loan.status.name == "Pagado"

    # Forzar manualmente status a Condonado para simular "el préstamo
    # pasó a Pagado → después el maestro decide Condonarlo".
    from apps.payments.models import LoanStatus

    condonado = LoanStatus.objects.get(name="Condonado")
    loan.status = condonado
    loan.save(update_fields=["status"])

    void_payment(payment=payment, voided_by=maestro)

    loan.refresh_from_db()
    # Tras reversa: saldo vuelve a 100 (loan_amount), pero el status
    # se conserva como Condonado (no vuelve a Activo).
    assert loan.outstanding_balance == Decimal("100.00")
    assert loan.status.name == "Condonado", (
        "Anular un pago de un préstamo Condonado debe CONSERVAR "
        "el estado Condonado, no reactivarlo a Activo."
    )


@pytest.mark.django_db
def test_void_payment_active_loan_becomes_activo_after_reverse():
    """Si el préstamo estaba Activo antes del pago, tras anular vuelve a Activo con saldo pendiente."""
    profile = WorkerProfileFactory()
    maestro = UserFactory(organization=profile.user.organization)
    loan = create_loan(
        worker=profile,
        amount=Decimal("100.00"),
        date=date(2026, 1, 1),
        created_by=maestro,
    )
    pm = PaymentMethodFactory(name="Efectivo")
    payment = register_payment(
        worker=profile,
        payment_method=pm,
        payment_date=date(2026, 1, 16),
        workday_ids=[],
        loan_allocations=[LoanAllocation(loan=loan, amount=Decimal("40.00"))],
        created_by=maestro,
    )
    loan.refresh_from_db()
    assert loan.outstanding_balance == Decimal("60.00")
    assert loan.status.name == "Activo"

    void_payment(payment=payment, voided_by=maestro)
    loan.refresh_from_db()
    assert loan.outstanding_balance == Decimal("100.00")
    assert loan.status.name == "Activo"
