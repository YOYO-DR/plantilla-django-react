from __future__ import annotations

import uuid
from datetime import date

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from apps.organizations.models import Organization
from apps.users.models import WorkerProfile

User = get_user_model()


HTTP_OK = 200
HTTP_FORBIDDEN = 403
HTTP_UNAUTHORIZED = 401


@pytest.fixture
def org(db):
    return Organization.objects.create(name="Org Test")


@pytest.fixture
def admin_plataforma(db):
    # Email único por test para evitar colisión con seed (0003_seed_users).
    return User.objects.create_user(
        email=f"admin-{uuid.uuid4().hex[:8]}@test.local",
        password="admin123",  # noqa: S106
        name="Admin Plataforma",
        organization=None,
        is_staff=True,
    )


@pytest.fixture
def maestro(db, org):
    return User.objects.create_user(
        email=f"maestro-{uuid.uuid4().hex[:8]}@test.local",
        password="obra123",  # noqa: S106
        name="Maestro Test",
        organization=org,
        is_staff=False,
    )


@pytest.fixture
def worker_user(db, org):
    user = User.objects.create_user(
        email=f"worker-{uuid.uuid4().hex[:8]}@test.local",
        password="obra123",  # noqa: S106
        name="Worker Test",
        organization=org,
        is_staff=False,
    )
    WorkerProfile.objects.create(
        user=user,
        id_document="12345",
        hire_date=date(2024, 1, 1),
    )
    return user


@pytest.mark.django_db
def test_metrics_admin_ok(admin_plataforma, org, worker_user):
    api = APIClient()
    api.force_authenticate(user=admin_plataforma)
    resp = api.get("/api/metrics/")
    assert resp.status_code == HTTP_OK
    data = resp.json()
    assert "tenants_total" in data
    assert "users_total" in data
    assert data["tenants_total"] >= 1


@pytest.mark.django_db
def test_metrics_maestro_denied(maestro):
    api = APIClient()
    api.force_authenticate(user=maestro)
    resp = api.get("/api/metrics/")
    assert resp.status_code == HTTP_FORBIDDEN


@pytest.mark.django_db
def test_metrics_anonymous_denied():
    api = APIClient()
    resp = api.get("/api/metrics/")
    assert resp.status_code == HTTP_UNAUTHORIZED
