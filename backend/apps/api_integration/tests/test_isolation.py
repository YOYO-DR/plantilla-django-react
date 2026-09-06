"""Tests de aislamiento multi-tenant del API Fase C.

Reglas verificadas:
- 404 cross-org (URL+body) en cada recurso.
- Trabajador no puede crear/editar (403 en write).
- Trabajador solo ve lo propio.
- Sin autenticar → 401.
- Excepciones de dominio mappen a 4xx consistentes.
- WorkerBalanceView solo expone el balance del worker de su org.
- WorkerProfileViewSet (POST) devuelve la contraseña UNA vez;
  en GET nunca aparece.
"""

from __future__ import annotations

import json
from datetime import date
from decimal import Decimal

import pytest
from django.contrib.auth.models import Group
from rest_framework.test import APIClient

from apps.catalogs.tests.factories import PaymentMethodFactory
from apps.catalogs.tests.factories import PaymentStatusFactory
from apps.catalogs.tests.factories import WorkdayTypeFactory
from apps.organizations.tests.factories import OrganizationFactory
from apps.payments.tests.factories import LoanFactory
from apps.users.tests.factories import UserFactory
from apps.users.tests.factories import WorkerProfileFactory
from apps.workdays.services import create_workday
from apps.workdays.tests.factories import WorkerRateFactory

# Fixtures -------------------------------------------------------------


@pytest.fixture
def org_a():
    return OrganizationFactory(name="Org A API")


@pytest.fixture
def org_b():
    return OrganizationFactory(name="Org B API")


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


@pytest.fixture
def trabajador_b(org_b):
    trabajador, _ = Group.objects.get_or_create(name="Trabajador")
    user = UserFactory(organization=org_b)
    user.groups.add(trabajador)
    WorkerProfileFactory(user=user)
    return user


# Workers --------------------------------------------------------------


@pytest.mark.django_db
def test_worker_profile_cross_org_url_returns_404(maestro_a, maestro_b):
    """Maestro de A pide el worker de B → 404."""
    profile_b = WorkerProfileFactory(user=maestro_b)
    api = APIClient()
    api.force_authenticate(user=maestro_a)
    resp = api.get(f"/api/workers/{profile_b.id}/")
    assert resp.status_code == 404


@pytest.mark.django_db
def test_worker_profile_create_returns_password_only_in_post(maestro_a):
    """POST devuelve ``initial_password`` en la respuesta; GET NUNCA."""
    api = APIClient()
    api.force_authenticate(user=maestro_a)
    resp = api.post(
        "/api/workers/",
        {
            "user": {
                "email": "nuevo@x.com",
                "name": "Nuevo Trabajador",
            },
            "id_document": "999",
            "hire_date": "2024-01-01",
            "is_active": True,
        },
        format="json",
    )
    assert resp.status_code == 201
    data = resp.json()
    assert "initial_password" in data
    assert len(data["initial_password"]) >= 12

    # GET del mismo worker NO debe contener la contraseña.
    worker_id = data["id"]
    resp_get = api.get(f"/api/workers/{worker_id}/")
    assert resp_get.status_code == 200
    payload = json.dumps(resp_get.json())
    assert "initial_password" not in payload


@pytest.mark.django_db
def test_worker_profile_create_rejects_cross_org_body(maestro_a, org_b):
    """Body con id de worker de OTRA org → 404 (no leak)."""
    other_user = UserFactory(organization=org_b)
    WorkerProfileFactory(user=other_user)
    api = APIClient()
    api.force_authenticate(user=maestro_a)
    # Intentamos crear un worker para org_b desde maestro_a.
    # El endpoint actual crea worker sin org explícita; usa la del caller.
    # El chequeo de cross-org se aplica al body cuando vienen IDs.
    # Aquí creamos un loan o workday referenciando al worker de org_b.
    resp = api.post(
        "/api/loans/",
        {
            "worker": other_user.worker_profile.id,
            "amount": "100.00",
            "date": "2026-01-01",
            "reason": "",
        },
        format="json",
    )
    # Si la org del caller no coincide con la del worker → 404.
    assert resp.status_code == 404


@pytest.mark.django_db
def test_worker_create_returns_400_on_missing_email(maestro_a):
    """POST sin email → 400."""
    api = APIClient()
    api.force_authenticate(user=maestro_a)
    resp = api.post(
        "/api/workers/",
        {
            "user": {},
            "is_active": True,
        },
        format="json",
    )
    assert resp.status_code == 400


@pytest.mark.django_db
def test_worker_anonymous_get_401():
    """Sin autenticar → 401."""
    api = APIClient()
    resp = api.get("/api/workers/")
    assert resp.status_code == 401


@pytest.mark.django_db
def test_worker_trabajador_post_403(trabajador_a):
    """Trabajador no puede crear workers: 403."""
    api = APIClient()
    api.force_authenticate(user=trabajador_a)
    resp = api.post(
        "/api/workers/",
        {
            "user": {"email": "otro@x.com"},
            "is_active": True,
        },
        format="json",
    )
    assert resp.status_code == 403


# Users -----------------------------------------------------------------


@pytest.fixture
def admin_plataforma():
    return UserFactory(
        organization=None,
        is_staff=True,
        is_superuser=True,
    )


@pytest.mark.django_db
def test_user_list_admin_platforma_sees_all(admin_plataforma, org_a, org_b):
    """Admin plataforma lista users de cualquier organización."""
    user_a = UserFactory(organization=org_a)
    user_b = UserFactory(organization=org_b)
    api = APIClient()
    api.force_authenticate(user=admin_plataforma)
    resp = api.get("/api/users/")
    assert resp.status_code == 200
    ids = [u["id"] for u in resp.json()["results"]]
    assert user_a.id in ids
    assert user_b.id in ids


# Workdays -------------------------------------------------------------


@pytest.mark.django_db
def test_workday_list_filters_by_organization(maestro_a, maestro_b):
    """Solo aparecen las jornadas de la org del caller."""
    profile_a = WorkerProfileFactory(user=maestro_a)
    profile_b = WorkerProfileFactory(user=maestro_b)
    WorkerRateFactory(
        worker=profile_a,
        amount="60000.00",
        valid_from=date(2026, 1, 1),
        valid_until=None,
    )
    WorkerRateFactory(
        worker=profile_b,
        amount="70000.00",
        valid_from=date(2026, 1, 1),
        valid_until=None,
    )
    wd_type_a = WorkdayTypeFactory(name="A", factor="1.00")
    PaymentStatusFactory(name="p")
    wd_a = create_workday(
        worker=profile_a,
        workday_type=wd_type_a,
        date=date(2026, 3, 1),
        created_by=maestro_a,
    )
    wd_type_b = WorkdayTypeFactory(name="B", factor="1.00")
    wd_b = create_workday(
        worker=profile_b,
        workday_type=wd_type_b,
        date=date(2026, 3, 1),
        created_by=maestro_b,
    )

    api = APIClient()
    api.force_authenticate(user=maestro_a)
    resp = api.get("/api/workdays/")
    assert resp.status_code == 200
    ids = [w["id"] for w in resp.json()["results"]]
    assert wd_a.id in ids
    assert wd_b.id not in ids


@pytest.mark.django_db
def test_workday_cross_org_url_returns_404(maestro_a, maestro_b):
    """Maestro A pide workday de B → 404."""
    WorkerProfileFactory(user=maestro_b)
    WorkerRateFactory(
        worker=maestro_b.worker_profile,
        amount="60000.00",
        valid_from=date(2026, 1, 1),
        valid_until=None,
    )
    wd_type = WorkdayTypeFactory(name="X", factor="1.00")
    wd_b = create_workday(
        worker=maestro_b.worker_profile,
        workday_type=wd_type,
        date=date(2026, 3, 1),
        created_by=maestro_b,
    )
    api = APIClient()
    api.force_authenticate(user=maestro_a)
    resp = api.get(f"/api/workdays/{wd_b.id}/")
    assert resp.status_code == 404


# Loans ----------------------------------------------------------------


@pytest.mark.django_db
def test_loan_list_filters_by_org(maestro_a, maestro_b):
    """Solo ve loans de su org."""
    WorkerProfileFactory(user=maestro_a)
    WorkerProfileFactory(user=maestro_b)
    from apps.payments.services import create_loan as cl  # noqa: PLC0415

    loan_a = cl(
        worker=maestro_a.worker_profile,
        amount=Decimal("100.00"),
        date=date(2026, 1, 1),
        created_by=maestro_a,
    )
    loan_b = cl(
        worker=maestro_b.worker_profile,
        amount=Decimal("200.00"),
        date=date(2026, 1, 1),
        created_by=maestro_b,
    )

    api = APIClient()
    api.force_authenticate(user=maestro_a)
    resp = api.get("/api/loans/")
    assert resp.status_code == 200
    ids = [lo["id"] for lo in resp.json()["results"]]
    assert loan_a.id in ids
    assert loan_b.id not in ids


@pytest.mark.django_db
def test_loan_cross_org_url_404(maestro_a, maestro_b):
    from apps.payments.services import create_loan as cl  # noqa: PLC0415
    WorkerProfileFactory(user=maestro_b)
    loan_b = cl(
        worker=maestro_b.worker_profile,
        amount=Decimal("100.00"),
        date=date(2026, 1, 1),
        created_by=maestro_b,
    )
    api = APIClient()
    api.force_authenticate(user=maestro_a)
    resp = api.get(f"/api/loans/{loan_b.id}/")
    assert resp.status_code == 404


@pytest.mark.django_db
def test_loan_post_cross_org_body_404(maestro_a, maestro_b):
    """POST /api/loans/ con worker de otra org en el body → 404."""
    WorkerProfileFactory(user=maestro_b)
    api = APIClient()
    api.force_authenticate(user=maestro_a)
    resp = api.post(
        "/api/loans/",
        {
            "worker": maestro_b.worker_profile.id,
            "amount": "100.00",
            "date": "2026-01-01",
            "reason": "",
        },
        format="json",
    )
    assert resp.status_code == 404


# Payments --------------------------------------------------------------


@pytest.mark.django_db
def test_payment_list_filters_by_org(maestro_a, maestro_b):
    from apps.payments.services import register_payment  # noqa: PLC0415

    profile_a = WorkerProfileFactory(user=maestro_a)
    profile_b = WorkerProfileFactory(user=maestro_b)
    WorkerRateFactory(
        worker=profile_a,
        amount="60000.00",
        valid_from=date(2026, 1, 1),
        valid_until=None,
    )
    WorkerRateFactory(
        worker=profile_b,
        amount="70000.00",
        valid_from=date(2026, 1, 1),
        valid_until=None,
    )
    wd_type = WorkdayTypeFactory(name="A", factor="1.00")
    PaymentStatusFactory(name="p")
    pm = PaymentMethodFactory(name="Efectivo")
    wd_a = create_workday(
        worker=profile_a,
        workday_type=wd_type,
        date=date(2026, 3, 1),
        created_by=maestro_a,
    )
    wd_b = create_workday(
        worker=profile_b,
        workday_type=wd_type,
        date=date(2026, 3, 1),
        created_by=maestro_b,
    )

    pay_a = register_payment(
        worker=profile_a,
        payment_method=pm,
        payment_date=date(2026, 3, 2),
        workday_ids=[wd_a.id],
        loan_allocations=[],
        created_by=maestro_a,
    )
    pay_b = register_payment(
        worker=profile_b,
        payment_method=pm,
        payment_date=date(2026, 3, 2),
        workday_ids=[wd_b.id],
        loan_allocations=[],
        created_by=maestro_b,
    )

    api = APIClient()
    api.force_authenticate(user=maestro_a)
    resp = api.get("/api/payments/")
    assert resp.status_code == 200
    ids = [p["id"] for p in resp.json()["results"]]
    assert pay_a.id in ids
    assert pay_b.id not in ids


@pytest.mark.django_db
def test_payment_cross_org_url_404(maestro_a, maestro_b):
    from apps.payments.services import register_payment  # noqa: PLC0415

    profile_b = WorkerProfileFactory(user=maestro_b)
    WorkerRateFactory(
        worker=profile_b,
        amount="60000.00",
        valid_from=date(2026, 1, 1),
        valid_until=None,
    )
    wd_type = WorkdayTypeFactory(name="X", factor="1.00")
    PaymentStatusFactory(name="p")
    pm = PaymentMethodFactory(name="Efectivo")
    wd_b = create_workday(
        worker=profile_b,
        workday_type=wd_type,
        date=date(2026, 3, 1),
        created_by=maestro_b,
    )
    pay_b = register_payment(
        worker=profile_b,
        payment_method=pm,
        payment_date=date(2026, 3, 2),
        workday_ids=[wd_b.id],
        loan_allocations=[],
        created_by=maestro_b,
    )

    api = APIClient()
    api.force_authenticate(user=maestro_a)
    resp = api.get(f"/api/payments/{pay_b.id}/")
    assert resp.status_code == 404


# Trabajador solo ve lo propio ---------------------------------------


@pytest.mark.django_db
def test_trabajador_sees_own_workday_only(trabajador_a, maestro_b):
    """Trabajador de A solo ve su propio workday, no el de su compañero."""
    # Un compañero del mismo org.
    otrx_user = UserFactory(organization=trabajador_a.organization)
    otrx_worker = WorkerProfileFactory(user=otrx_user)

    WorkerRateFactory(
        worker=trabajador_a.worker_profile,
        amount="60000.00",
        valid_from=date(2026, 1, 1),
        valid_until=None,
    )
    WorkerRateFactory(
        worker=otrx_worker,
        amount="70000.00",
        valid_from=date(2026, 1, 1),
        valid_until=None,
    )
    wd_type = WorkdayTypeFactory(name="A", factor="1.00")
    PaymentStatusFactory(name="p")
    wd_self = create_workday(
        worker=trabajador_a.worker_profile,
        workday_type=wd_type,
        date=date(2026, 3, 1),
        created_by=UserFactory(is_staff=True),
    )
    wd_otrx = create_workday(
        worker=otrx_worker,
        workday_type=wd_type,
        date=date(2026, 3, 1),
        created_by=UserFactory(is_staff=True),
    )

    api = APIClient()
    api.force_authenticate(user=trabajador_a)
    resp = api.get("/api/workdays/")
    assert resp.status_code == 200
    ids = [w["id"] for w in resp.json()["results"]]
    assert wd_self.id in ids
    assert wd_otrx.id not in ids


@pytest.mark.django_db
def test_trabajador_post_403(trabajador_a):
    """Trabajador no puede crear workday: 403."""
    api = APIClient()
    api.force_authenticate(user=trabajador_a)
    resp = api.post(
        "/api/workdays/",
        {
            "worker": trabajador_a.worker_profile.id,
            "workday_type": 1,
            "date": "2026-01-01",
        },
        format="json",
    )
    assert resp.status_code == 403


# Balance --------------------------------------------------------------


@pytest.mark.django_db
def test_balance_anonymous_401():
    api = APIClient()
    resp = api.get("/api/workers/1/balance/")
    assert resp.status_code == 401


@pytest.mark.django_db
def test_balance_cross_org_404(maestro_a, maestro_b):
    """Maestro A pide el balance de un worker de B → 404."""
    WorkerProfileFactory(user=maestro_b)
    api = APIClient()
    api.force_authenticate(user=maestro_a)
    resp = api.get(f"/api/workers/{maestro_b.worker_profile.id}/balance/")
    assert resp.status_code == 404


@pytest.mark.django_db
def test_balance_own_worker_ok(maestro_a):
    if not hasattr(maestro_a, "worker_profile"):
        WorkerProfileFactory(user=maestro_a)
    api = APIClient()
    api.force_authenticate(user=maestro_a)
    resp = api.get(f"/api/workers/{maestro_a.worker_profile.id}/balance/")
    assert resp.status_code == 200
    data = resp.json()
    for key in [
        "worker_id",
        "pendientes_count",
        "adeudado_workdays",
        "saldo_prestamos",
        "neto_a_pagar",
    ]:
        assert key in data
    assert data["worker_id"] == maestro_a.worker_profile.id


# Excepciones de dominio mappen correctamente -----------------------


@pytest.mark.django_db
def test_register_payment_existing_loan_in_pagado_returns_409(maestro_a):
    """Loan ya en Pagado al hacer register_payment → 409 Conflict
    (mapeo de ``LoanOverpaymentError`` por conflicto de estado).
    """
    WorkerProfileFactory(user=maestro_a)
    from apps.payments.models import LoanStatus as LS  # noqa: PLC0415

    pagado, _ = LS.objects.get_or_create(name="Pagado")
    loan = LoanFactory(worker=maestro_a.worker_profile)
    loan.status = pagado
    loan.outstanding_balance = Decimal("0")
    loan.save()
    pm = PaymentMethodFactory(name="Efectivo")
    api = APIClient()
    api.force_authenticate(user=maestro_a)
    resp = api.post(
        "/api/payments/",
        {
            "worker": maestro_a.worker_profile.id,
            "payment_method": pm.id,
            "payment_date": "2026-01-16",
            "workday_ids": [],
            "loan_allocations": [{"loan": loan.id, "amount": "10.00"}],
        },
        format="json",
    )
    assert resp.status_code == 409
    assert "Pagado" in str(resp.json().get("detail", ""))


@pytest.mark.django_db
def test_void_payment_returns_409_on_double_void(maestro_a):
    """Doble void → 409 (PaymentAlreadyVoidedError)."""
    WorkerProfileFactory(user=maestro_a)
    worker = maestro_a.worker_profile
    WorkerRateFactory(
        worker=worker,
        amount="60000.00",
        valid_from=date(2026, 1, 1),
        valid_until=None,
    )
    wd_type = WorkdayTypeFactory(name="X", factor="1.00")
    PaymentStatusFactory(name="p")
    pm = PaymentMethodFactory(name="Efectivo")
    wd = create_workday(
        worker=worker,
        workday_type=wd_type,
        date=date(2026, 3, 1),
        created_by=maestro_a,
    )
    from apps.payments.services import register_payment  # noqa: PLC0415

    payment = register_payment(
        worker=worker,
        payment_method=pm,
        payment_date=date(2026, 3, 2),
        workday_ids=[wd.id],
        loan_allocations=[],
        created_by=maestro_a,
    )

    api = APIClient()
    api.force_authenticate(user=maestro_a)
    resp1 = api.post(f"/api/payments/{payment.id}/void/")
    assert resp1.status_code == 200
    resp2 = api.post(f"/api/payments/{payment.id}/void/")
    assert resp2.status_code == 409
