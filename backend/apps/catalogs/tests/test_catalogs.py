import pytest
from django.contrib.auth import get_user_model
from django.db import connection
from django.test.utils import CaptureQueriesContext
from rest_framework.test import APIClient

from apps.catalogs.models import (
    WorkdayType,
    PaymentStatus,
    TipoMovimientoDeuda,
    PaymentMethod,
)

User = get_user_model()


@pytest.fixture
def user(db):
    return User.objects.create_user(email="x@y.com", password="x")


@pytest.mark.django_db
def test_workday_type_seed_exists():
    assert WorkdayType.objects.filter(name="Día completo").exists()
    assert WorkdayType.objects.filter(name="Medio día").exists()


@pytest.mark.django_db
def test_payment_status_seed_exists():
    assert PaymentStatus.objects.filter(name="Pendiente").exists()


@pytest.mark.django_db
def test_tipo_movimiento_seed_exists():
    assert TipoMovimientoDeuda.objects.filter(name="Préstamo").exists()
    assert TipoMovimientoDeuda.objects.filter(name="Abono", affects_balance=False).exists()


@pytest.mark.django_db
def test_payment_methods_seed_exists():
    assert PaymentMethod.objects.filter(name="Efectivo").exists()


@pytest.mark.django_db
def test_workday_types_list_requires_auth(client):
    assert client.get("/api/catalogs/workday-types/").status_code == 401


@pytest.mark.django_db
def test_workday_types_list_returns_200(user):
    # client (Django) no tiene force_authenticate; usar APIClient (DRF).
    api = APIClient()
    api.force_authenticate(user=user)
    resp = api.get("/api/catalogs/workday-types/")
    assert resp.status_code == 200


@pytest.mark.django_db
def test_workday_types_list_query_count_is_optimal(user):
    """Documenta cuántas queries hace el listado. Debe ser 1 (sin N+1)."""
    WorkdayType.objects.create(name="A", factor="1.00", order=0)
    WorkdayType.objects.create(name="B", factor="1.00", order=1)
    api = APIClient()
    api.force_authenticate(user=user)
    with CaptureQueriesContext(connection) as ctx:
        resp = api.get("/api/catalogs/workday-types/")
    assert resp.status_code == 200
    # pytest-django añade SAVEPOINT/RELEASE; budget = 1 SELECT + 2 overhead.
    assert len(ctx.captured_queries) <= 4, (
        f"Listado hace {len(ctx.captured_queries)} queries: "
        f"{[q['sql'] for q in ctx.captured_queries]}"
    )
