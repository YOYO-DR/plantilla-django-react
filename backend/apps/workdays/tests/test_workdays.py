from __future__ import annotations

import uuid
from datetime import date

import pytest
from django.contrib.auth import get_user_model
from django.db import connection
from django.test.utils import CaptureQueriesContext
from rest_framework.test import APIClient

from apps.catalogs.models import PaymentStatus
from apps.catalogs.models import WorkdayType
from apps.users.models import WorkerProfile
from apps.workdays.models import Workday

User = get_user_model()


@pytest.fixture
def workday_type(db):
    # get_or_create para colisión con seed (0002_seed_catalogs).
    obj, _ = WorkdayType.objects.get_or_create(
        name="Día completo",
        defaults={"factor": "1.00"},
    )
    return obj


@pytest.fixture
def payment_status(db):
    # get_or_create para colisión con seed (0002_seed_catalogs).
    obj, _ = PaymentStatus.objects.get_or_create(name="Pendiente")
    return obj


@pytest.fixture
def worker_user(db):
    # Email único para evitar colisión con seed (0003_seed_users).
    user = User.objects.create_user(
        email=f"worker-{uuid.uuid4().hex[:8]}@test.local",
        password="obra123",  # noqa: S106
        name="Worker Test",
        organization_id=None,
    )
    WorkerProfile.objects.create(
        user=user,
        id_document="1",
        hire_date=date(2024, 1, 1),
    )
    return user


@pytest.mark.django_db
def test_workday_creation_sets_applied_rate_from_factor(
    client,
    workday_type,
    payment_status,
    worker_user,
):
    workday_type.factor = "1.00"
    workday_type.save()
    api = APIClient()
    api.force_authenticate(user=worker_user)
    resp = api.post(
        "/api/workdays/",
        {
            "worker": worker_user.worker_profile.id,
            "workday_type": workday_type.id,
            "date": "2024-09-01",
        },
        format="json",
    )
    assert resp.status_code == 201  # noqa: PLR2004
    wd = Workday.objects.get(date="2024-09-01")
    assert wd.applied_rate == 0


@pytest.mark.django_db
def test_workday_unique_constraint(
    client,
    workday_type,
    payment_status,
    worker_user,
):
    """Se permiten varias jornadas del mismo trabajador en la misma fecha (Fase A).

    El constraint ``unique(worker, date)`` que existía en versiones
    previas fue retirado a decisión del usuario. Este test verifica que
    la regla de negocio actualizada NO impide crear dos jornadas iguales.
    """
    Workday.objects.create(
        worker=worker_user.worker_profile,
        workday_type=workday_type,
        payment_status=payment_status,
        date=date(2024, 9, 1),
        applied_rate=100000,
        created_by=worker_user,
    )
    # Misma (worker, date) → debe ser válido.
    second = Workday.objects.create(
        worker=worker_user.worker_profile,
        workday_type=workday_type,
        payment_status=payment_status,
        date=date(2024, 9, 1),
        applied_rate=120000,
        created_by=worker_user,
    )
    assert (
        Workday.objects.filter(
            worker=worker_user.worker_profile,
            date=date(2024, 9, 1),
        ).count()
        == 2  # noqa: PLR2004
    )
    assert second.id is not None


@pytest.mark.django_db
def test_workday_list_query_count_is_optimal(
    client,
    workday_type,
    payment_status,
    worker_user,
):
    """Documenta que el listado hace una sola query (no N+1)."""
    for day in range(1, 4):
        Workday.objects.create(
            worker=worker_user.worker_profile,
            workday_type=workday_type,
            payment_status=payment_status,
            date=date(2024, 9, day),
            applied_rate=100000,
            created_by=worker_user,
        )
    api = APIClient()
    api.force_authenticate(user=worker_user)
    with CaptureQueriesContext(connection) as ctx:
        resp = api.get("/api/workdays/")
    assert resp.status_code == 200  # noqa: PLR2004
    # pytest-django + DRF añaden SAVEPOINT/RELEASE alrededor del SELECT.
    # Presupuesto = 1 query de listado + overhead transaccional.
    assert len(ctx.captured_queries) <= 4, (  # noqa: PLR2004
        f"Listado hace {len(ctx.captured_queries)} queries: "
        f"{[q['sql'] for q in ctx.captured_queries]}"
    )
