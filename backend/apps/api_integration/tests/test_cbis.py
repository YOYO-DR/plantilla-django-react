"""Tests de Fase C-bis: Workday bulk, Organization 403, Worker PATCH.

Cubre:
- POST /api/workdays/bulk-mark/  -> crear N jornadas atomicamente.
- POST /api/workdays/bulk-copy/  -> copiar rango origen a destino.
- POST /api/workdays/bulk-clear/ -> borrar rango, saltando jornadas con pago.
- POST /api/organizations/        -> 403 para maestro y trabajador.
- PATCH /api/workers/{id}/        -> maestro OK; activar/desactivar via is_active.
- PATCH /api/users/{id}/          -> maestro puede escribir ``groups``.
"""

from __future__ import annotations

from datetime import date
from decimal import Decimal

import pytest
from django.contrib.auth.models import Group
from rest_framework.test import APIClient

from apps.catalogs.tests.factories import (
    PaymentMethodFactory,
    PaymentStatusFactory,
    WorkdayTypeFactory,
)
from apps.organizations.tests.factories import OrganizationFactory
from apps.payments.tests.factories import PaymentFactory
from apps.users.tests.factories import UserFactory
from apps.users.tests.factories import WorkerProfileFactory
from apps.workdays.services import create_workday
from apps.workdays.tests.factories import WorkerRateFactory


# Fixtures -------------------------------------------------------------


@pytest.fixture
def admin_plataforma():
    return UserFactory(
        organization=None,
        is_staff=True,
        is_superuser=True,
    )


@pytest.fixture
def org_a():
    return OrganizationFactory(name="Org A C-bis")


@pytest.fixture
def org_b():
    return OrganizationFactory(name="Org B C-bis")


@pytest.fixture
def maestro_a(org_a):
    maestro, _ = Group.objects.get_or_create(name="Maestro")
    user = UserFactory(organization=org_a)
    user.groups.add(maestro)
    return user


@pytest.fixture
def maestro_b(org_b):
    maestro, _ = Group.objects.get_or_create(name="Maestro")
    user = UserFactory(organization=org_b)
    user.groups.add(maestro)
    return user


@pytest.fixture
def trabajador_a(org_a):
    trabajador, _ = Group.objects.get_or_create(name="Trabajador")
    user = UserFactory(organization=org_a)
    user.groups.add(trabajador)
    WorkerProfileFactory(user=user)
    return user


# #1 WorkerProfileViewSet PATCH/DELETE ------------------------------


@pytest.mark.django_db
def test_worker_patch_updates_id_document(maestro_a):
    profile = WorkerProfileFactory(user__organization=maestro_a.organization)
    api = APIClient()
    api.force_authenticate(user=maestro_a)
    resp = api.patch(
        f"/api/workers/{profile.id}/",
        {"id_document": "999-NEW", "is_active": False},
        format="json",
    )
    assert resp.status_code == 200
    profile.refresh_from_db()
    assert profile.id_document == "999-NEW"
    assert profile.is_active is False


@pytest.mark.django_db
def test_worker_activate_deactivate_via_is_active(maestro_a):
    profile = WorkerProfileFactory(
        user__organization=maestro_a.organization,
        is_active=True,
    )
    api = APIClient()
    api.force_authenticate(user=maestro_a)
    resp = api.patch(
        f"/api/workers/{profile.id}/",
        {"is_active": False},
        format="json",
    )
    assert resp.status_code == 200
    profile.refresh_from_db()
    assert profile.is_active is False
    resp = api.patch(
        f"/api/workers/{profile.id}/",
        {"is_active": True},
        format="json",
    )
    assert resp.status_code == 200
    profile.refresh_from_db()
    assert profile.is_active is True


@pytest.mark.django_db
def test_worker_patch_cross_org_returns_404(maestro_a, maestro_b):
    profile_b = WorkerProfileFactory(user=maestro_b)
    api = APIClient()
    api.force_authenticate(user=maestro_a)
    resp = api.patch(
        f"/api/workers/{profile_b.id}/",
        {"id_document": "x"},
        format="json",
    )
    assert resp.status_code == 404


# #2 OrganizationViewSet write 403 --------------------------------------


@pytest.mark.django_db
def test_org_post_as_maestro_returns_403(maestro_a):
    api = APIClient()
    api.force_authenticate(user=maestro_a)
    resp = api.post(
        "/api/organizations/",
        {"name": "Org Intrusa"},
        format="json",
    )
    assert resp.status_code == 403


@pytest.mark.django_db
def test_org_post_as_trabajador_returns_403(trabajador_a):
    api = APIClient()
    api.force_authenticate(user=trabajador_a)
    resp = api.post(
        "/api/organizations/",
        {"name": "Org Intrusa"},
        format="json",
    )
    assert resp.status_code == 403


@pytest.mark.django_db
def test_org_patch_as_maestro_returns_403(maestro_a, org_b):
    api = APIClient()
    api.force_authenticate(user=maestro_a)
    resp = api.patch(
        f"/api/organizations/{org_b.id}/",
        {"name": "Hack"},
        format="json",
    )
    assert resp.status_code == 403


@pytest.mark.django_db
def test_org_delete_as_maestro_returns_403(maestro_a, org_b):
    api = APIClient()
    api.force_authenticate(user=maestro_a)
    resp = api.delete(f"/api/organizations/{org_b.id}/")
    assert resp.status_code == 403


@pytest.mark.django_db
def test_org_post_as_admin_platforma_succeeds(admin_plataforma):
    api = APIClient()
    api.force_authenticate(user=admin_plataforma)
    resp = api.post(
        "/api/organizations/",
        {"name": "Org Admin"},
        format="json",
    )
    assert resp.status_code == 201


@pytest.mark.django_db
def test_org_get_as_maestro_returns_only_own(maestro_a, maestro_b, org_a, org_b):
    api = APIClient()
    api.force_authenticate(user=maestro_a)
    resp = api.get("/api/organizations/")
    assert resp.status_code == 200
    ids = [o["id"] for o in resp.json()["results"]]
    assert org_a.id in ids
    assert org_b.id not in ids


# #3 workdays bulk -----------------------------------------------------


@pytest.mark.django_db
def test_workday_bulk_mark_creates_all_atomic(maestro_a):
    org = maestro_a.organization
    profile_a = WorkerProfileFactory(user__organization=org)
    profile_b = WorkerProfileFactory(user__organization=org)
    WorkerRateFactory(
        worker=profile_a, amount="50000.00",
        valid_from=date(2026, 1, 1), valid_until=None,
    )
    WorkerRateFactory(
        worker=profile_b, amount="50000.00",
        valid_from=date(2026, 1, 1), valid_until=None,
    )
    wd_type = WorkdayTypeFactory(name="Dia completo bulk", factor="1.00")
    PaymentStatusFactory(name="p_bulk")
    api = APIClient()
    api.force_authenticate(user=maestro_a)
    resp = api.post(
        "/api/workdays/bulk-mark/",
        {
            "date": "2026-03-15",
            "workday_type_id": wd_type.id,
            "worker_ids": [profile_a.id, profile_b.id],
        },
        format="json",
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["count"] == 2
    from apps.workdays.models import Workday
    assert Workday.objects.filter(worker__in=[profile_a, profile_b], date=date(2026, 3, 15)).count() == 2


@pytest.mark.django_db
def test_workday_bulk_mark_cross_org_worker_returns_404(maestro_a, maestro_b):
    profile_a = WorkerProfileFactory(user__organization=maestro_a.organization)
    profile_b = WorkerProfileFactory(user__organization=maestro_b.organization)
    WorkerRateFactory(
        worker=profile_a, amount="50000.00",
        valid_from=date(2026, 1, 1), valid_until=None,
    )
    WorkerRateFactory(
        worker=profile_b, amount="50000.00",
        valid_from=date(2026, 1, 1), valid_until=None,
    )
    wd_type = WorkdayTypeFactory(name="X bulk", factor="1.00")
    api = APIClient()
    api.force_authenticate(user=maestro_a)
    resp = api.post(
        "/api/workdays/bulk-mark/",
        {
            "date": "2026-03-15",
            "workday_type_id": wd_type.id,
            "worker_ids": [profile_a.id, profile_b.id],
        },
        format="json",
    )
    assert resp.status_code == 404
    from apps.workdays.models import Workday
    assert Workday.objects.count() == 0


@pytest.mark.django_db
def test_workday_bulk_copy_copies_range(maestro_a):
    profile = WorkerProfileFactory(user__organization=maestro_a.organization)
    WorkerRateFactory(
        worker=profile, amount="50000.00",
        valid_from=date(2026, 1, 1), valid_until=None,
    )
    wd_type = WorkdayTypeFactory(name="Y copy", factor="1.00")
    PaymentStatusFactory(name="p_copy")
    for day in range(1, 4):
        create_workday(
            worker=profile, workday_type=wd_type,
            date=date(2026, 3, day), created_by=maestro_a,
        )
    api = APIClient()
    api.force_authenticate(user=maestro_a)
    resp = api.post(
        "/api/workdays/bulk-copy/",
        {
            "from_start": "2026-03-01",
            "from_end": "2026-03-03",
            "to_start": "2026-03-08",
        },
        format="json",
    )
    assert resp.status_code == 201
    assert resp.json()["count"] == 3
    from apps.workdays.models import Workday
    for day in range(8, 11):
        assert Workday.objects.filter(worker=profile, date=date(2026, 3, day)).exists()


@pytest.mark.django_db
def test_workday_bulk_clear_skips_workdays_with_payments(maestro_a):
    profile = WorkerProfileFactory(user__organization=maestro_a.organization)
    WorkerRateFactory(
        worker=profile, amount="50000.00",
        valid_from=date(2026, 1, 1), valid_until=None,
    )
    wd_type = WorkdayTypeFactory(name="Z clear", factor="1.00")
    PaymentStatusFactory(name="p_clear")
    pm = PaymentMethodFactory(name="Efectivo clear")

    wd_pagada = create_workday(
        worker=profile, workday_type=wd_type,
        date=date(2026, 3, 1), created_by=maestro_a,
    )
    wd_libre = create_workday(
        worker=profile, workday_type=wd_type,
        date=date(2026, 3, 2), created_by=maestro_a,
    )
    from apps.payments.services import register_payment

    register_payment(
        worker=profile, payment_method=pm,
        payment_date=date(2026, 3, 16),
        workday_ids=[wd_pagada.id], loan_allocations=[],
        created_by=maestro_a,
    )

    api = APIClient()
    api.force_authenticate(user=maestro_a)
    resp = api.post(
        "/api/workdays/bulk-clear/",
        {"start": "2026-03-01", "end": "2026-03-07"},
        format="json",
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["deleted_count"] == 1
    assert body["skipped_count"] == 1
    assert wd_libre.id in body["deleted_ids"]
    assert wd_pagada.id in body["skipped_paid_ids"]


@pytest.mark.django_db
def test_workday_bulk_mark_validation_error_returns_400(maestro_a):
    api = APIClient()
    api.force_authenticate(user=maestro_a)
    resp = api.post(
        "/api/workdays/bulk-mark/",
        {"date": "not-a-date", "workday_type_id": 999, "worker_ids": []},
        format="json",
    )
    assert resp.status_code == 400


# #4 UserViewSet groups writable --------------------------------------


@pytest.mark.django_db
def test_user_patch_groups_as_maestro_succeeds(maestro_a):
    target = UserFactory(organization=maestro_a.organization)
    target.groups.clear()  # sin grupos
    api = APIClient()
    api.force_authenticate(user=maestro_a)
    resp = api.patch(
        f"/api/users/{target.id}/",
        {"groups": ["Trabajador"]},
        format="json",
    )
    assert resp.status_code == 200
    target.refresh_from_db()
    assert list(target.groups.values_list("name", flat=True)) == ["Trabajador"]


@pytest.mark.django_db
def test_user_patch_groups_invalid_group_returns_400(maestro_a):
    target = UserFactory(organization=maestro_a.organization)
    api = APIClient()
    api.force_authenticate(user=maestro_a)
    resp = api.patch(
        f"/api/users/{target.id}/",
        {"groups": ["AdminPlataforma"]},
        format="json",
    )
    assert resp.status_code == 400


@pytest.mark.django_db
def test_user_patch_groups_as_trabajador_returns_403(trabajador_a):
    target = UserFactory(organization=trabajador_a.organization)
    api = APIClient()
    api.force_authenticate(user=trabajador_a)
    resp = api.patch(
        f"/api/users/{target.id}/",
        {"groups": ["Maestro"]},
        format="json",
    )
    assert resp.status_code == 403


@pytest.mark.django_db
def test_user_patch_cross_org_returns_404(maestro_a, maestro_b):
    target = UserFactory(organization=maestro_b.organization)
    api = APIClient()
    api.force_authenticate(user=maestro_a)
    resp = api.patch(
        f"/api/users/{target.id}/",
        {"name": "Hack"},
        format="json",
    )
    assert resp.status_code == 404
