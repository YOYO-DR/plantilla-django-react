"""Tests de ``preview_payment``.

Lo crítico: el preview NO persiste y devuelve EXACTAMENTE lo mismo
que ``register_payment`` para el mismo input. Si divergen, la pantalla
le miente al maestro.

Contrato:
- Mismas validaciones que ``register_payment``: ``OverpaymentError``,
  ``LoanOverpaymentError`` y ``CrossOrganizationError``.
- No muta BD (Payment.count, Loan.balance, Workday.status).
- Devuelve ``PaymentBreakdown`` con subtotal_workdays,
  total_abonos_prestamos, total_amount y saldo_prestamos_despues.
"""

from __future__ import annotations

from datetime import date
from decimal import Decimal

import pytest
from django.contrib.auth.models import Group

from apps.catalogs.tests.factories import PaymentMethodFactory
from apps.catalogs.tests.factories import WorkdayTypeFactory
from apps.organizations.tests.factories import OrganizationFactory
from apps.payments.exceptions import CrossOrganizationError
from apps.payments.exceptions import LoanOverpaymentError
from apps.payments.exceptions import OverpaymentError
from apps.payments.models import Payment
from apps.payments.services import LoanAllocation
from apps.payments.services import create_loan
from apps.payments.services import preview_payment
from apps.payments.services import register_payment
from apps.users.tests.factories import UserFactory
from apps.users.tests.factories import WorkerProfileFactory
from apps.workdays.services import create_workday
from apps.workdays.tests.factories import WorkerRateFactory


def _maestro_de_org(org):
    g, _ = Group.objects.get_or_create(name="Maestro")
    u = UserFactory(organization=org)
    u.groups.add(g)
    return u


@pytest.mark.django_db
def test_preview_payment_matches_register_payment_mixed_input():
    """El test importante: preview vs register_payment para input idéntico."""
    profile = WorkerProfileFactory()
    org = profile.user.organization
    maestro = _maestro_de_org(org)
    WorkerRateFactory(
        worker=profile,
        amount="50000.00",
        valid_from=date(2026, 1, 1),
        valid_until=None,
    )
    wd_type = WorkdayTypeFactory(name="Día completo", factor="1.00")
    wds = [
        create_workday(
            worker=profile,
            workday_type=wd_type,
            date=date(2026, 3, day),
            created_by=maestro,
        )
        for day in range(1, 4)
    ]
    loan = create_loan(
        worker=profile,
        amount=Decimal("100000.00"),
        date=date(2026, 1, 1),
        created_by=maestro,
    )
    pm = PaymentMethodFactory(name="Efectivo")

    workday_ids = [w.id for w in wds]
    allocs = [LoanAllocation(loan=loan, amount=Decimal("30000.00"))]

    preview = preview_payment(
        worker=profile,
        workday_ids=workday_ids,
        loan_allocations=allocs,
    )
    # 3 * 50000 + 30000 = 180000
    assert preview.subtotal_workdays == Decimal("150000.00")
    assert preview.total_abonos_prestamos == Decimal("30000.00")
    assert preview.total_amount == Decimal("180000.00")
    assert preview.saldo_prestamos_despues == {loan.id: Decimal("70000.00")}

    payment = register_payment(
        worker=profile,
        payment_method=pm,
        payment_date=date(2026, 3, 5),
        workday_ids=workday_ids,
        loan_allocations=allocs,
        created_by=maestro,
    )
    # Mismo total entre preview y register.
    assert payment.total_amount == preview.total_amount
    loan.refresh_from_db()
    assert loan.outstanding_balance == preview.saldo_prestamos_despues[loan.id]


@pytest.mark.django_db
def test_preview_payment_does_not_persist():
    profile = WorkerProfileFactory()
    org = profile.user.organization
    maestro = _maestro_de_org(org)
    WorkerRateFactory(
        worker=profile,
        amount="50000.00",
        valid_from=date(2026, 1, 1),
        valid_until=None,
    )
    wd_type = WorkdayTypeFactory(name="Día completo", factor="1.00")
    wd = create_workday(
        worker=profile,
        workday_type=wd_type,
        date=date(2026, 3, 1),
        created_by=maestro,
    )
    loan = create_loan(
        worker=profile,
        amount=Decimal("50000.00"),
        date=date(2026, 1, 1),
        created_by=maestro,
    )

    assert Payment.objects.count() == 0
    previews_count_before = Payment.objects.count()
    loan_balance_before = loan.outstanding_balance

    preview_payment(
        worker=profile,
        workday_ids=[wd.id],
        loan_allocations=[LoanAllocation(loan=loan, amount=Decimal("20000.00"))],
    )

    assert Payment.objects.count() == previews_count_before
    loan.refresh_from_db()
    assert loan.outstanding_balance == loan_balance_before
    wd.refresh_from_db()
    assert wd.payment_status.name == "Pendiente"


@pytest.mark.django_db
def test_preview_payment_overpayment_raises():
    """Sobrepago de jornada → ``OverpaymentError`` (mapeada a 409)."""
    profile = WorkerProfileFactory()
    org = profile.user.organization
    maestro = _maestro_de_org(org)
    WorkerRateFactory(
        worker=profile,
        amount="50000.00",
        valid_from=date(2026, 1, 1),
        valid_until=None,
    )
    wd_type = WorkdayTypeFactory(name="Día completo", factor="1.00")
    wd = create_workday(
        worker=profile,
        workday_type=wd_type,
        date=date(2026, 3, 1),
        created_by=maestro,
    )
    with pytest.raises(OverpaymentError):
        preview_payment(
            worker=profile,
            workday_ids=[wd.id],
            loan_allocations=[],
            workday_overrides={wd.id: Decimal("60000.00")},  # > 50000
        )


@pytest.mark.django_db
def test_preview_payment_loan_overpayment_raises():
    """Sobrepago de préstamo → ``LoanOverpaymentError`` (mapeada a 409)."""
    profile = WorkerProfileFactory()
    org = profile.user.organization
    maestro = _maestro_de_org(org)
    loan = create_loan(
        worker=profile,
        amount=Decimal("50000.00"),
        date=date(2026, 1, 1),
        created_by=maestro,
    )
    with pytest.raises(LoanOverpaymentError):
        preview_payment(
            worker=profile,
            workday_ids=[],
            loan_allocations=[LoanAllocation(loan=loan, amount=Decimal("60000.00"))],
        )


@pytest.mark.django_db
def test_preview_payment_cross_org_workday_rejected():
    """Workday de otro worker (otra org) → ``CrossOrganizationError`` (mapeada a 404)."""
    org_a = OrganizationFactory(name="Org A preview")
    org_b = OrganizationFactory(name="Org B preview")
    worker_a = WorkerProfileFactory(user=UserFactory(organization=org_a))
    worker_b = WorkerProfileFactory(user=UserFactory(organization=org_b))
    WorkerRateFactory(
        worker=worker_b,
        amount="50000.00",
        valid_from=date(2026, 1, 1),
        valid_until=None,
    )
    wd_type = WorkdayTypeFactory(name="Día completo", factor="1.00")
    wd_b = create_workday(
        worker=worker_b,
        workday_type=wd_type,
        date=date(2026, 3, 1),
        created_by=UserFactory(organization=org_b),
    )
    with pytest.raises(CrossOrganizationError):
        preview_payment(
            worker=worker_a,
            workday_ids=[wd_b.id],
            loan_allocations=[],
        )


@pytest.mark.django_db
def test_preview_payment_cross_worker_loan_rejected():
    """Préstamo de otro worker → ``CrossOrganizationError`` (mapeada a 404)."""
    org = OrganizationFactory(name="Org Mixta preview")
    worker_a = WorkerProfileFactory(user=UserFactory(organization=org))
    worker_b = WorkerProfileFactory(user=UserFactory(organization=org))
    maestro = _maestro_de_org(org)
    loan_b = create_loan(
        worker=worker_b,
        amount=Decimal("10000.00"),
        date=date(2026, 1, 1),
        created_by=maestro,
    )
    with pytest.raises(CrossOrganizationError):
        preview_payment(
            worker=worker_a,
            workday_ids=[],
            loan_allocations=[LoanAllocation(loan=loan_b, amount=Decimal("5000.00"))],
        )


@pytest.mark.django_db
def test_preview_payment_solo_prestamo_no_workdays():
    """Pago que solo abona a préstamo → breakdown coherente."""
    profile = WorkerProfileFactory()
    org = profile.user.organization
    maestro = _maestro_de_org(org)
    loan = create_loan(
        worker=profile,
        amount=Decimal("50000.00"),
        date=date(2026, 1, 1),
        created_by=maestro,
    )
    preview = preview_payment(
        worker=profile,
        workday_ids=[],
        loan_allocations=[LoanAllocation(loan=loan, amount=Decimal("20000.00"))],
    )
    assert preview.subtotal_workdays == Decimal("0")
    assert preview.total_abonos_prestamos == Decimal("20000.00")
    assert preview.total_amount == Decimal("20000.00")
    assert preview.saldo_prestamos_despues == {loan.id: Decimal("30000.00")}
