"""Comportamiento: emparejamiento por id, no por posición.

Cubre el bug crítico donde ``Loan.Meta.ordering = ["-date"]`` hacía que
``Loan.objects.select_for_update().filter(id__in=...)`` retornara los
préstamos en orden distinto a ``loan_allocations`` y un zip corrupto
silenciosamente los saldos.
"""

from __future__ import annotations

from datetime import date
from decimal import Decimal

import pytest

from apps.catalogs.tests.factories import PaymentMethodFactory
from apps.payments.exceptions import LoanOverpaymentError
from apps.payments.services import LoanAllocation
from apps.payments.services import create_loan
from apps.payments.services import register_payment
from apps.users.tests.factories import UserFactory
from apps.users.tests.factories import WorkerProfileFactory


@pytest.mark.django_db
def test_two_loans_with_different_dates_each_gets_its_own_amount():
    """Caso del bug: dos préstamos, fechas distintas, mismo pago.

    El abono de 10.00 va al préstamo viejo (enero); el de 400.00 al
    nuevo (junio). Si el zip estuviera mal, el viejo recibiría 400 y
    su ``LoanOverpaymentError`` no se dispararía porque saldo era 100
    y el monto "asignado" 400 sí lo excede — pero el chequeo
    ``loans_by_id.get(loan.id)`` da correcto, así que el chequeo pasa
    con el monto equivocado, y la mutación aplica el monto del nuevo
    al viejo, dejando el saldo del viejo en negativo.
    """
    profile = WorkerProfileFactory()
    maestro = UserFactory(organization=profile.user.organization)
    loan_viejo = create_loan(
        worker=profile,
        amount=Decimal("100.00"),
        date=date(2026, 1, 1),
        created_by=maestro,
    )
    loan_nuevo = create_loan(
        worker=profile,
        amount=Decimal("500.00"),
        date=date(2026, 6, 1),
        created_by=maestro,
    )

    pm = PaymentMethodFactory(name="Efectivo")

    payment = register_payment(
        worker=profile,
        payment_method=pm,
        payment_date=date(2026, 7, 1),
        workday_ids=[],
        loan_allocations=[
            LoanAllocation(loan=loan_viejo, amount=Decimal("10.00")),
            LoanAllocation(loan=loan_nuevo, amount=Decimal("400.00")),
        ],
        created_by=maestro,
    )

    # Saldos correctos
    loan_viejo.refresh_from_db()
    loan_nuevo.refresh_from_db()

    assert loan_viejo.outstanding_balance == Decimal("90.00"), (
        "El préstamo viejo recibió el monto equivocado (bug del zip)."
    )
    assert loan_viejo.status.name == "Activo"

    assert loan_nuevo.outstanding_balance == Decimal("100.00")
    assert loan_nuevo.status.name == "Activo"

    # Total = 10 + 400 = 410
    assert payment.total_amount == Decimal("410.00")


@pytest.mark.django_db
def test_allocation_for_nonexistent_loan_raises():
    """Pedir asignar un LoanAllocation con un Loan que no aparece en la
    queryset bloqueada (id fantasma) → ``LoanOverpaymentError``.
    """
    profile = WorkerProfileFactory()
    maestro = UserFactory(organization=profile.user.organization)
    loan_viejo = create_loan(
        worker=profile,
        amount=Decimal("100.00"),
        date=date(2026, 1, 1),
        created_by=maestro,
    )

    # LoanAllocation con un ``Loan`` cuya id NO está en la queryset.
    # En la práctica: loan_nuevo es un Loan no persistido.
    from apps.payments.models import Loan as LoanModel

    fantasma = LoanModel(
        worker=profile,
        amount=Decimal("500.00"),
        outstanding_balance=Decimal("500.00"),
        date=date(2026, 6, 1),
        created_by=maestro,
    )
    # No .save() → no tiene id real.

    pm = PaymentMethodFactory(name="Efectivo")
    with pytest.raises(LoanOverpaymentError, match="no encontrado"):
        register_payment(
            worker=profile,
            payment_method=pm,
            payment_date=date(2026, 7, 1),
            workday_ids=[],
            loan_allocations=[
                LoanAllocation(loan=loan_viejo, amount=Decimal("10.00")),
                LoanAllocation(loan=fantasma, amount=Decimal("400.00")),
            ],
            created_by=maestro,
        )
