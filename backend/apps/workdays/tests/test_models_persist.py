"""Smoke test: cada modelo nuevo persiste vía factory."""

from __future__ import annotations

import pytest

from apps.catalogs.tests.factories import LoanStatusFactory
from apps.catalogs.tests.factories import PaymentMethodFactory
from apps.catalogs.tests.factories import PaymentStatusFactory
from apps.catalogs.tests.factories import WorkdayTypeFactory
from apps.organizations.tests.factories import OrganizationFactory
from apps.payments.tests.factories import LoanFactory
from apps.payments.tests.factories import PaymentFactory
from apps.payments.tests.factories import PaymentLoanDetailFactory
from apps.payments.tests.factories import PaymentWorkdayDetailFactory
from apps.users.tests.factories import UserFactory
from apps.users.tests.factories import WorkerProfileFactory
from apps.workdays.tests.factories import WorkdayFactory
from apps.workdays.tests.factories import WorkerRateFactory


@pytest.mark.django_db
def test_models_persist_via_factories():
    org = OrganizationFactory()
    user = UserFactory(organization=org)
    WorkerProfileFactory(user=user)
    WorkerRateFactory()
    WorkdayTypeFactory()
    PaymentStatusFactory()
    LoanStatusFactory()
    PaymentMethodFactory()
    WorkdayFactory()
    LoanFactory()
    PaymentFactory()
    PaymentWorkdayDetailFactory()
    PaymentLoanDetailFactory()
    # Si llegamos aquí sin IntegrityError ni ValidationError, todo persiste.
