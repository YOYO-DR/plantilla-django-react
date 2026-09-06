from __future__ import annotations

import uuid
from datetime import date

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from apps.catalogs.models import TipoMovimientoDeuda
from apps.payments.models import MovimientoDeuda
from apps.users.models import WorkerProfile

User = get_user_model()


@pytest.fixture
def tipo_prestamo(db):
    # get_or_create para colisión con seed (0002_seed_catalogs).
    obj, _ = TipoMovimientoDeuda.objects.get_or_create(
        name="Préstamo", defaults={"affects_balance": True}
    )
    return obj


@pytest.fixture
def tipo_abono(db):
    # get_or_create para colisión con seed (0002_seed_catalogs).
    obj, _ = TipoMovimientoDeuda.objects.get_or_create(
        name="Abono", defaults={"affects_balance": False}
    )
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
        user=user, id_document="1", hire_date=date(2024, 1, 1)
    )
    return user


@pytest.mark.django_db
def test_movimiento_creation_signed_amount(
    client, tipo_prestamo, tipo_abono, worker_user
):
    prestamo = MovimientoDeuda.objects.create(
        worker=worker_user.worker_profile,
        tipo=tipo_prestamo,
        monto=100,
        fecha=date(2024, 9, 1),
        registrado_por=worker_user,
    )
    assert prestamo.signed_amount == 100

    abono = MovimientoDeuda.objects.create(
        worker=worker_user.worker_profile,
        tipo=tipo_abono,
        monto=50,
        fecha=date(2024, 9, 2),
        registrado_por=worker_user,
    )
    assert abono.signed_amount == -50


@pytest.mark.django_db
def test_movimiento_list_isolation(client, worker_user):
    api = APIClient()
    api.force_authenticate(user=worker_user)
    resp = api.get("/api/movimientos-deuda/")
    assert resp.status_code == 200
