"""Comportamiento: validación REAL de ``Payment.total_amount`` desde DB.

``register_payment`` crea los detalles, relee el agregado y compara
contra ``payment.total_amount``. Si difiere, ``InconsistentPaymentTotalError``
y la transacción hace rollback.

Estos tests verifican que la suma real desde la BD coincide con
``payment.total_amount`` tras el registro. La consistencia está
garantizada además por ``unique_together(payment, workday)`` y
``unique_together(payment, loan)`` en modelos, que impide dobles
detalles no anulados en el mismo pago.
"""

from __future__ import annotations

from datetime import date
from decimal import Decimal

import pytest
from django.db.models import Sum

from apps.catalogs.tests.factories import (
    PaymentMethodFactory,
    WorkdayTypeFactory,
)
from apps.payments.models import Payment
from apps.payments.models import PaymentWorkdayDetail
from apps.payments.services import (
    LoanAllocation,
    create_loan,
    register_payment,
)
from apps.users.tests.factories import (
    UserFactory,
    WorkerProfileFactory,
)
from apps.workdays.services import create_workday
from apps.workdays.tests.factories import WorkerRateFactory


def _cents(value: Decimal | int | float | str) -> Decimal:
    return Decimal(value).quantize(Decimal("0.01"))


@pytest.mark.django_db
def test_register_payment_persisted_sum_matches_total_workday_only():
    """Happy path jornadas: total_amount = suma real desde la BD."""
    profile = WorkerProfileFactory()
    maestro = UserFactory(organization=profile.user.organization)
    WorkerRateFactory(
        worker=profile,
        amount="60000.00",
        valid_from=date(2026, 1, 1),
        valid_until=None,
    )
    wd_type = WorkdayTypeFactory(name="Día completo", factor="1.00")
    wd = create_workday(
        worker=profile,
        workday_type=wd_type,
        date=date(2026, 3, 15),
        created_by=maestro,
    )
    pm = PaymentMethodFactory(name="Efectivo")
    payment = register_payment(
        worker=profile,
        payment_method=pm,
        payment_date=date(2026, 3, 16),
        workday_ids=[wd.id],
        loan_allocations=[],
        created_by=maestro,
    )
    wd_sum = (
        PaymentWorkdayDetail.objects.filter(payment=payment)
        .aggregate(t=Sum("applied_amount"))["t"]
    )
    assert _cents(wd_sum) == _cents(payment.total_amount)


@pytest.mark.django_db
def test_register_payment_persisted_sum_matches_total_mixed():
    """Pago mixto: total_amount = suma jornadas + préstamos desde la BD."""
    profile = WorkerProfileFactory()
    maestro = UserFactory(organization=profile.user.organization)
    WorkerRateFactory(
        worker=profile,
        amount="30000.00",
        valid_from=date(2026, 1, 1),
        valid_until=None,
    )
    wd_type = WorkdayTypeFactory(name="Día completo", factor="1.00")
    wd = create_workday(
        worker=profile,
        workday_type=wd_type,
        date=date(2026, 3, 15),
        created_by=maestro,
    )
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
        payment_date=date(2026, 3, 16),
        workday_ids=[wd.id],
        loan_allocations=[LoanAllocation(loan=loan, amount=Decimal("100.00"))],
        created_by=maestro,
    )

    real = (
        Payment.objects.filter(id=payment.id)
        .aggregate(
            wd=Sum("workday_details__applied_amount"),
            ln=Sum("loan_details__paid_amount"),
        )
    )
    real_total = (real["wd"] or Decimal("0")) + (real["ln"] or Decimal("0"))
    assert _cents(real_total) == _cents(payment.total_amount)
    assert _cents(payment.total_amount) == Decimal("30100.00")
