"""Smoke test: cada modelo nuevo persiste vía factory."""

from __future__ import annotations

import pytest

from apps.catalogs.tests.factories import (
    LoanStatusFactory,
    PaymentMethodFactory,
    PaymentStatusFactory,
    WorkdayTypeFactory,
)
from apps.organizations.tests.factories import OrganizationFactory
from apps.payments.tests.factories import (
    LoanFactory,
    PaymentFactory,
    PaymentLoanDetailFactory,
    PaymentWorkdayDetailFactory,
)
from apps.users.tests.factories import (
    UserFactory,
    WorkerProfileFactory,
)
from apps.workdays.tests.factories import WorkdayFactory, WorkerRateFactory


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
