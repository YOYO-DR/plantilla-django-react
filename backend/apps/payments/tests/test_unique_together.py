"""Tests de unique_together → IntegrityError."""

from __future__ import annotations

import pytest
from django.db import IntegrityError, transaction

from apps.catalogs.tests.factories import (
    PaymentMethodFactory,
    WorkdayTypeFactory,
)
from apps.organizations.tests.factories import OrganizationFactory
from apps.payments.tests.factories import (
    LoanFactory,
    PaymentFactory,
    PaymentLoanDetailFactory,
    PaymentWorkdayDetailFactory,
)
from apps.users.tests.factories import WorkerProfileFactory
from apps.workdays.tests.factories import WorkdayFactory


@pytest.mark.django_db
def test_workday_type_unique_per_org():
    org = OrganizationFactory(name="Duplicados")
    WorkdayTypeFactory(name="Tipo X", organization=org)
    with pytest.raises(IntegrityError), transaction.atomic():
        # Mismo (organization, name) → choca con el UniqueConstraint.
        WorkdayTypeFactory(name="Tipo X", organization=org)


@pytest.mark.django_db
def test_payment_workday_detail_unique_pair():
    pay = PaymentFactory()
    wd = WorkdayFactory()
    PaymentWorkdayDetailFactory(payment=pay, workday=wd)
    with pytest.raises(IntegrityError), transaction.atomic():
        PaymentWorkdayDetailFactory(payment=pay, workday=wd)


@pytest.mark.django_db
def test_payment_loan_detail_unique_pair():
    pay = PaymentFactory()
    loan = LoanFactory()
    PaymentLoanDetailFactory(payment=pay, loan=loan)
    with pytest.raises(IntegrityError), transaction.atomic():
        PaymentLoanDetailFactory(payment=pay, loan=loan)
