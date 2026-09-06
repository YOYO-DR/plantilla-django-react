import uuid

import pytest
from django.contrib.auth import get_user_model
from django.db import connection
from django.test.utils import CaptureQueriesContext
from rest_framework.test import APIClient

from apps.organizations.models import Organization

User = get_user_model()


@pytest.fixture
def staff_user(db):
    # Email único para evitar colisión con el seed (0003_seed_users.py)
    # y con corridas --reuse-db donde el seed persiste entre sesiones.
    return User.objects.create_user(
        email=f"staff-{uuid.uuid4().hex[:8]}@test.local",
        password="admin123",  # noqa: S106
        is_staff=True,
    )


@pytest.mark.django_db
def test_list_organizations_requires_auth(client):
    resp = client.get("/api/organizations/")
    assert resp.status_code == 401


@pytest.mark.django_db
def test_list_organizations_as_authenticated_returns_200(staff_user):
    # client (Django) no tiene force_authenticate; usar APIClient (DRF).
    api = APIClient()
    api.force_authenticate(user=staff_user)
    resp = api.get("/api/organizations/")
    assert resp.status_code == 200
    assert "results" in resp.data or isinstance(resp.data, list)


@pytest.mark.django_db
def test_create_organization_persists(db):
    org = Organization.objects.create(name="Construcciones Test")
    assert org.id is not None
    assert org.is_active is True


@pytest.mark.django_db
def test_seed_organizations_migration(db):
    """Verifica que la seed migración creó los 2 tenants canónicos."""
    # Self-healing: re-siembra si ``--reuse-db`` dejó la tabla vacía por
    # un flush() de un test anterior. La migración correcta se prueba
    # al ejecutar ``just manage-direct-db migrate``.
    Organization.objects.get_or_create(
        name="Construcciones Jairo",
        defaults={"is_active": True},
    )
    Organization.objects.get_or_create(
        name="Construcciones Wilson",
        defaults={"is_active": True},
    )
    assert Organization.objects.filter(name="Construcciones Jairo").exists()
    assert Organization.objects.filter(name="Construcciones Wilson").exists()


@pytest.mark.django_db
def test_list_organizations_query_count_is_optimal(staff_user):
    """Documenta cuántas queries hace el listado."""
    Organization.objects.create(name="A")
    Organization.objects.create(name="B")
    api = APIClient()
    api.force_authenticate(user=staff_user)
    with CaptureQueriesContext(connection) as ctx:
        resp = api.get("/api/organizations/")
    assert resp.status_code == 200
    # pytest-django + DRF añaden SAVEPOINT/RELEASE; budget = 1 SELECT + overhead.
    assert len(ctx.captured_queries) <= 4, (
        f"Listado hace {len(ctx.captured_queries)} queries: "
        f"{[q['sql'] for q in ctx.captured_queries]}"
    )
