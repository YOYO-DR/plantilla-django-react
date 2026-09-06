"""Tests de aislamiento multi-tenant para Loan y Payment."""

from __future__ import annotations

import pytest

from apps.organizations.tests.factories import OrganizationFactory
from apps.payments.models import Loan
from apps.payments.models import Payment
from apps.payments.tests.factories import LoanFactory
from apps.payments.tests.factories import PaymentFactory
from apps.users.tests.factories import UserFactory
from apps.users.tests.factories import WorkerProfileFactory


@pytest.mark.django_db
def test_loan_for_organization_isolates():
    org_a = OrganizationFactory(name="Org A")
    org_b = OrganizationFactory(name="Org B")
    user_a = UserFactory(organization=org_a)
    user_b = UserFactory(organization=org_b)
    profile_a = WorkerProfileFactory(user=user_a)
    profile_b = WorkerProfileFactory(user=user_b)
    loan_a = LoanFactory(worker=profile_a)
    LoanFactory(worker=profile_b)

    assert Loan.objects.for_organization(org_a).count() == 1
    assert Loan.objects.for_organization(org_a).first() == loan_a
    assert Loan.objects.for_organization(org_b).count() == 1


@pytest.mark.django_db
def test_payment_for_organization_isolates():
    org_a = OrganizationFactory(name="Org A")
    org_b = OrganizationFactory(name="Org B")
    user_a = UserFactory(organization=org_a)
    user_b = UserFactory(organization=org_b)
    profile_a = WorkerProfileFactory(user=user_a)
    profile_b = WorkerProfileFactory(user=user_b)
    pay_a = PaymentFactory(worker=profile_a)
    PaymentFactory(worker=profile_b)

    assert Payment.objects.for_organization(org_a).count() == 1
    assert Payment.objects.for_organization(org_a).first() == pay_a
    assert Payment.objects.for_organization(org_b).count() == 1
