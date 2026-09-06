"""Tests de aislamiento multi-tenant vía ``for_organization``."""

from __future__ import annotations

import pytest

from apps.organizations.tests.factories import OrganizationFactory
from apps.users.tests.factories import (
    UserFactory,
    WorkerProfileFactory,
)
from apps.workdays.tests.factories import WorkdayFactory


@pytest.mark.django_db
def test_workday_for_organization_isolates():
    org_a = OrganizationFactory(name="Org A")
    org_b = OrganizationFactory(name="Org B")
    user_a = UserFactory(organization=org_a)
    user_b = UserFactory(organization=org_b)
    profile_a = WorkerProfileFactory(user=user_a)
    profile_b = WorkerProfileFactory(user=user_b)
    wd_a = WorkdayFactory(worker=profile_a, created_by=user_a)
    wd_b = WorkdayFactory(worker=profile_b, created_by=user_b)

    from apps.workdays.models import Workday

    assert Workday.objects.for_organization(org_a).count() == 1
    assert Workday.objects.for_organization(org_a).first() == wd_a
    assert Workday.objects.for_organization(org_b).count() == 1
    assert Workday.objects.for_organization(org_b).first() == wd_b
    # Mezcla no se devuelve cruzada.
    assert Workday.objects.count() == 2
