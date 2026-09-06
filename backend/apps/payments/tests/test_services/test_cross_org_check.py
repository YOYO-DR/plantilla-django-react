"""Comportamiento: chequeo real de organización (no solo de worker)."""

from __future__ import annotations

from datetime import date
from decimal import Decimal

import pytest

from apps.catalogs.tests.factories import (
    LoanStatusFactory,
    PaymentMethodFactory,
    WorkdayTypeFactory,
)
from apps.organizations.tests.factories import OrganizationFactory
from apps.payments.exceptions import CrossOrganizationError
from apps.payments.models import Loan
from apps.payments.services import (
    LoanAllocation,
    register_payment,
)
from apps.users.tests.factories import (
    UserFactory,
    WorkerProfileFactory,
)
from apps.workdays.services import create_workday
from apps.workdays.tests.factories import WorkerRateFactory


@pytest.mark.django_db
def test_register_payment_cross_organization_with_real_org_check():
    """Un pago a un worker de Org A intenta incluir jornadas de un
    worker de la Org B. Se rechaza con ``CrossOrganizationError``
    que menciona las organizaciones (no los workers).
    """
    org_a = OrganizationFactory(name="Org Alfa Cross")
    org_b = OrganizationFactory(name="Org Beta Cross")

    worker_payer = WorkerProfileFactory(user=UserFactory(organization=org_a))
    maestro = UserFactory(organization=org_a)
    user_other = UserFactory(organization=org_b)
    worker_other = WorkerProfileFactory(user=user_other)

    WorkerRateFactory(
        worker=worker_other,
        amount="50000.00",
        valid_from=date(2026, 1, 1),
        valid_until=None,
    )
    wd_type = WorkdayTypeFactory(name="Día completo", factor="1.00")
    wd_other = create_workday(
        worker=worker_other,
        workday_type=wd_type,
        date=date(2026, 3, 1),
        created_by=maestro,
    )
    pm = PaymentMethodFactory(name="Efectivo")
    with pytest.raises(CrossOrganizationError, match="organización"):
        register_payment(
            worker=worker_payer,
            payment_method=pm,
            payment_date=date(2026, 3, 16),
            workday_ids=[wd_other.id],
            loan_allocations=[],
            created_by=maestro,
        )


@pytest.mark.django_db
def test_register_payment_cross_organization_loan_other_org():
    """Préstamo de un worker de OTRA organización → ``CrossOrganizationError``.
    Cubre la rama específica del chequeo por organización para préstamos.
    """
    org_a = OrganizationFactory(name="Org Loan Cross A")
    org_b = OrganizationFactory(name="Org Loan Cross B")

    worker_payer = WorkerProfileFactory(user=UserFactory(organization=org_a))
    user_other = UserFactory(organization=org_b)
    worker_other = WorkerProfileFactory(user=user_other)
    maestro = UserFactory(organization=org_a)
    loan_other = Loan.objects.create(
        worker=worker_other,
        status=LoanStatusFactory(name="Activo"),
        amount=Decimal("10000.00"),
        outstanding_balance=Decimal("10000.00"),
        date=date(2026, 1, 1),
        created_by=maestro,
    )
    pm = PaymentMethodFactory(name="Efectivo")
    with pytest.raises(CrossOrganizationError, match="organización"):
        register_payment(
            worker=worker_payer,
            payment_method=pm,
            payment_date=date(2026, 1, 16),
            workday_ids=[],
            loan_allocations=[
                LoanAllocation(loan=loan_other, amount=Decimal("5000.00")),
            ],
            created_by=maestro,
        )


@pytest.mark.django_db
def test_register_payment_same_org_passes():
    """Smoke test: worker y jornadas de la MISMA org → sin error."""
    org = OrganizationFactory(name="Org Coh")
    worker = WorkerProfileFactory(user=UserFactory(organization=org))
    maestro = UserFactory(organization=org)
    WorkerRateFactory(
        worker=worker,
        amount="50000.00",
        valid_from=date(2026, 1, 1),
        valid_until=None,
    )
    wd_type = WorkdayTypeFactory(name="Día completo", factor="1.00")
    wd = create_workday(
        worker=worker,
        workday_type=wd_type,
        date=date(2026, 3, 1),
        created_by=maestro,
    )
    pm = PaymentMethodFactory(name="Efectivo")
    payment = register_payment(
        worker=worker,
        payment_method=pm,
        payment_date=date(2026, 3, 16),
        workday_ids=[wd.id],
        loan_allocations=[],
        created_by=maestro,
    )
    assert payment.total_amount == Decimal("50000.00")
