"""Tests de los endpoints nuevos del balance y el preview de pago.

- ``GET  /api/workers/{id}/balance/`` con el desglose nuevo.
- ``POST /api/payments/preview/`` sin persistir.
"""

from __future__ import annotations

from datetime import date
from decimal import Decimal

import pytest
from django.contrib.auth.models import Group
from rest_framework.test import APIClient

from apps.catalogs.tests.factories import PaymentMethodFactory
from apps.catalogs.tests.factories import WorkdayTypeFactory
from apps.organizations.tests.factories import OrganizationFactory
from apps.payments.models import Payment
from apps.payments.services import LoanAllocation
from apps.payments.services import create_loan
from apps.payments.services import register_payment
from apps.payments.services import void_payment
from apps.users.tests.factories import UserFactory
from apps.users.tests.factories import WorkerProfileFactory
from apps.workdays.services import create_workday
from apps.workdays.tests.factories import WorkerRateFactory


def _maestro_de_org(org):
    g, _ = Group.objects.get_or_create(name="Maestro")
    u = UserFactory(organization=org)
    u.groups.add(g)
    return u


# =====================================================================
# GET /api/workers/{id}/balance/
# =====================================================================


@pytest.mark.django_db
def test_balance_view_returns_breakdown_workdays_and_loans():
    profile = WorkerProfileFactory()
    org = profile.user.organization
    maestro = _maestro_de_org(org)
    WorkerRateFactory(
        worker=profile,
        amount="60000.00",
        valid_from=date(2026, 1, 1),
        valid_until=None,
    )
    wd_type = WorkdayTypeFactory(name="Día completo", factor="1.00")
    wd_parcial = create_workday(
        worker=profile,
        workday_type=wd_type,
        date=date(2026, 3, 1),
        created_by=maestro,
    )
    create_workday(
        worker=profile,
        workday_type=wd_type,
        date=date(2026, 3, 2),
        created_by=maestro,
    )
    pm = PaymentMethodFactory(name="Efectivo")
    register_payment(
        worker=profile,
        payment_method=pm,
        payment_date=date(2026, 3, 5),
        workday_ids=[wd_parcial.id],
        loan_allocations=[],
        created_by=maestro,
        workday_overrides={wd_parcial.id: Decimal("20000.00")},
    )
    loan = create_loan(
        worker=profile,
        amount=Decimal("100000.00"),
        date=date(2026, 1, 1),
        reason="Adelanto",
        created_by=maestro,
    )
    api = APIClient()
    api.force_authenticate(user=maestro)
    resp = api.get(f"/api/workers/{profile.id}/balance/")
    assert resp.status_code == 200
    body = resp.json()

    # 5 agregados existentes intactos.
    assert body["worker_id"] == profile.id
    assert body["pendientes_count"] == 1
    assert Decimal(body["adeudado_workdays"]) == Decimal("100000.00")
    assert Decimal(body["saldo_prestamos"]) == Decimal("100000.00")
    assert Decimal(body["neto_a_pagar"]) == Decimal("200000.00")

    # Desglose de workdays: 2 líneas (parcial + pendiente).
    assert len(body["workdays"]) == 2
    by_id = {line["id"]: line for line in body["workdays"]}
    assert Decimal(by_id[wd_parcial.id]["ya_pagado"]) == Decimal("20000.00")
    assert Decimal(by_id[wd_parcial.id]["pendiente"]) == Decimal("40000.00")
    assert by_id[wd_parcial.id]["workday_type"] == {
        "id": wd_type.id,
        "name": "Día completo",
    }
    # Fecha ISO.
    assert by_id[wd_parcial.id]["date"] == "2026-03-01"

    # Desglose de loans: 1 línea.
    assert len(body["loans"]) == 1
    loan_line = body["loans"][0]
    assert loan_line["id"] == loan.id
    assert Decimal(loan_line["amount"]) == Decimal("100000.00")
    assert Decimal(loan_line["outstanding_balance"]) == Decimal("100000.00")
    assert loan_line["reason"] == "Adelanto"
    assert loan_line["date"] == "2026-01-01"


@pytest.mark.django_db
def test_balance_view_cross_org_returns_404():
    org_a = OrganizationFactory(name="Org A bal")
    org_b = OrganizationFactory(name="Org B bal")
    maestro_a_g = Group.objects.get_or_create(name="Maestro")[0]
    maestro_a_user = UserFactory(organization=org_a)
    maestro_a_user.groups.add(maestro_a_g)
    worker_b = WorkerProfileFactory(user=UserFactory(organization=org_b))
    api = APIClient()
    api.force_authenticate(user=maestro_a_user)
    resp = api.get(f"/api/workers/{worker_b.id}/balance/")
    assert resp.status_code == 404


# =====================================================================
# POST /api/payments/preview/
# =====================================================================


@pytest.mark.django_db
def test_preview_view_returns_breakdown_does_not_persist():
    profile = WorkerProfileFactory()
    org = profile.user.organization
    maestro = _maestro_de_org(org)
    WorkerRateFactory(
        worker=profile,
        amount="50000.00",
        valid_from=date(2026, 1, 1),
        valid_until=None,
    )
    wd_type = WorkdayTypeFactory(name="Día completo", factor="1.00")
    wds = [
        create_workday(
            worker=profile,
            workday_type=wd_type,
            date=date(2026, 3, day),
            created_by=maestro,
        )
        for day in range(1, 4)
    ]
    loan = create_loan(
        worker=profile,
        amount=Decimal("100000.00"),
        date=date(2026, 1, 1),
        created_by=maestro,
    )
    pm = PaymentMethodFactory(name="Efectivo")
    api = APIClient()
    api.force_authenticate(user=maestro)
    assert Payment.objects.count() == 0
    resp = api.post(
        "/api/payments/preview/",
        {
            "worker": profile.id,
            "payment_method": pm.id,
            "payment_date": "2026-03-05",
            "workday_ids": [w.id for w in wds],
            "loan_allocations": [{"loan": loan.id, "amount": "30000.00"}],
        },
        format="json",
    )
    assert resp.status_code == 200
    body = resp.json()
    assert Decimal(body["subtotal_workdays"]) == Decimal("150000.00")
    assert Decimal(body["total_abonos_prestamos"]) == Decimal("30000.00")
    assert Decimal(body["total_amount"]) == Decimal("180000.00")
    assert Decimal(body["saldo_prestamos_despues"][str(loan.id)]) == Decimal(
        "70000.00",
    )
    # Nada persistido.
    assert Payment.objects.count() == 0
    loan.refresh_from_db()
    assert loan.outstanding_balance == Decimal("100000.00")


@pytest.mark.django_db
def test_preview_view_overpayment_returns_409():
    profile = WorkerProfileFactory()
    org = profile.user.organization
    maestro = _maestro_de_org(org)
    WorkerRateFactory(
        worker=profile,
        amount="50000.00",
        valid_from=date(2026, 1, 1),
        valid_until=None,
    )
    wd_type = WorkdayTypeFactory(name="Día completo", factor="1.00")
    wd = create_workday(
        worker=profile,
        workday_type=wd_type,
        date=date(2026, 3, 1),
        created_by=maestro,
    )
    api = APIClient()
    api.force_authenticate(user=maestro)
    resp = api.post(
        "/api/payments/preview/",
        {
            "worker": profile.id,
            "payment_method": 1,  # no se valida; solo se ignora
            "payment_date": "2026-03-05",
            "workday_ids": [wd.id],
            "workday_overrides": {str(wd.id): "60000.00"},  # > 50000
        },
        format="json",
    )
    assert resp.status_code == 409
    assert Payment.objects.count() == 0


@pytest.mark.django_db
def test_preview_view_cross_org_returns_404():
    org_a = OrganizationFactory(name="Org A prev")
    org_b = OrganizationFactory(name="Org B prev")
    g = Group.objects.get_or_create(name="Maestro")[0]
    maestro_a_user = UserFactory(organization=org_a)
    maestro_a_user.groups.add(g)
    worker_b = WorkerProfileFactory(user=UserFactory(organization=org_b))
    api = APIClient()
    api.force_authenticate(user=maestro_a_user)
    resp = api.post(
        "/api/payments/preview/",
        {
            "worker": worker_b.id,
            "payment_method": 1,
            "payment_date": "2026-03-05",
            "workday_ids": [],
        },
        format="json",
    )
    assert resp.status_code == 404


@pytest.mark.django_db
def test_preview_view_as_trabajador_returns_403():
    """Trabajador (no maestro) NO puede pedir preview."""
    from apps.users.tests.factories import UserFactory as UF

    profile = WorkerProfileFactory()
    org = profile.user.organization
    t, _ = Group.objects.get_or_create(name="Trabajador")
    user = UF(organization=org)
    user.groups.add(t)
    api = APIClient()
    api.force_authenticate(user=user)
    resp = api.post(
        "/api/payments/preview/",
        {
            "worker": profile.id,
            "payment_method": 1,
            "payment_date": "2026-03-05",
            "workday_ids": [],
        },
        format="json",
    )
    assert resp.status_code == 403


# =====================================================================
# Serializer: auditoría y desglose en PaymentDetail / LoanSerializer
# =====================================================================


@pytest.mark.django_db
def test_payment_detail_voided_fields_for_active_and_voided_payments():
    """Pago vigente: voided_at/voided_by nulos. Anulado: con timestamp
    y nombre legible del usuario que anuló."""
    org = OrganizationFactory(name="Org audit")
    profile = WorkerProfileFactory(user__organization=org)
    maestro = _maestro_de_org(org)
    admin = _maestro_de_org(org)
    admin.name = "Ana Pérez"
    admin.save()
    WorkerRateFactory(
        worker=profile,
        amount="50000.00",
        valid_from=date(2026, 1, 1),
        valid_until=None,
    )
    wd_type = WorkdayTypeFactory(name="Día completo", factor="1.00")
    wds = [
        create_workday(
            worker=profile,
            workday_type=wd_type,
            date=date(2026, 3, day),
            created_by=maestro,
        )
        for day in range(1, 3)
    ]
    pm = PaymentMethodFactory(name="Efectivo")

    # Pago activo (no anulado).
    active = register_payment(
        worker=profile,
        payment_method=pm,
        payment_date=date(2026, 3, 5),
        workday_ids=[wds[0].id],
        loan_allocations=[],
        created_by=maestro,
    )
    # Pago que luego anulamos.
    to_void = register_payment(
        worker=profile,
        payment_method=pm,
        payment_date=date(2026, 3, 6),
        workday_ids=[wds[1].id],
        loan_allocations=[],
        created_by=maestro,
    )
    void_payment(payment=to_void, voided_by=admin)

    api = APIClient()
    api.force_authenticate(user=maestro)
    resp = api.get(f"/api/payments/{active.id}/")
    assert resp.status_code == 200
    body = resp.json()
    assert body["voided_at"] is None
    assert body["voided_by"] is None

    resp = api.get(f"/api/payments/{to_void.id}/")
    assert resp.status_code == 200
    body = resp.json()
    assert body["voided_at"] is not None
    # Nombre legible, no id.
    assert body["voided_by"] == "Ana Pérez"


@pytest.mark.django_db
def test_payment_detail_breakdown_for_mixed_payment():
    """Pago mixto: workday_details + loan_details con montos correctos."""
    org = OrganizationFactory(name="Org breakdown")
    profile = WorkerProfileFactory(user__organization=org)
    maestro = _maestro_de_org(org)
    WorkerRateFactory(
        worker=profile,
        amount="50000.00",
        valid_from=date(2026, 1, 1),
        valid_until=None,
    )
    wd_type = WorkdayTypeFactory(name="Día completo", factor="1.00")
    wds = [
        create_workday(
            worker=profile,
            workday_type=wd_type,
            date=date(2026, 3, day),
            created_by=maestro,
        )
        for day in range(1, 3)
    ]
    loan = create_loan(
        worker=profile,
        amount=Decimal("100000.00"),
        date=date(2026, 1, 1),
        reason="Adelanto",
        created_by=maestro,
    )
    pm = PaymentMethodFactory(name="Efectivo")
    payment = register_payment(
        worker=profile,
        payment_method=pm,
        payment_date=date(2026, 3, 5),
        workday_ids=[wds[0].id, wds[1].id],
        loan_allocations=[LoanAllocation(loan=loan, amount=Decimal("20000.00"))],
        created_by=maestro,
    )

    api = APIClient()
    api.force_authenticate(user=maestro)
    resp = api.get(f"/api/payments/{payment.id}/")
    assert resp.status_code == 200
    body = resp.json()

    # 2 detalles de jornada con workday completo (id, date, workday_type).
    assert len(body["workday_details"]) == 2
    wd_amounts = sorted(
        [Decimal(d["applied_amount"]) for d in body["workday_details"]],
    )
    assert wd_amounts == [Decimal("50000.00"), Decimal("50000.00")]
    for d in body["workday_details"]:
        assert set(d["workday"].keys()) == {"id", "date", "workday_type"}
        assert d["workday"]["workday_type"]["name"] == "Día completo"

    # 1 detalle de préstamo con loan completo (id, reason).
    assert len(body["loan_details"]) == 1
    loan_detail = body["loan_details"][0]
    assert Decimal(loan_detail["paid_amount"]) == Decimal("20000.00")
    assert loan_detail["loan"]["id"] == loan.id
    assert loan_detail["loan"]["reason"] == "Adelanto"


@pytest.mark.django_db
def test_loan_detail_payment_details_listing():
    """Préstamo con 2 abonos: ambos en ``payment_details``."""
    org = OrganizationFactory(name="Org loans-list")
    profile = WorkerProfileFactory(user__organization=org)
    maestro = _maestro_de_org(org)
    loan = create_loan(
        worker=profile,
        amount=Decimal("100000.00"),
        date=date(2026, 1, 1),
        reason="Adelanto",
        created_by=maestro,
    )
    pm = PaymentMethodFactory(name="Efectivo")
    register_payment(
        worker=profile,
        payment_method=pm,
        payment_date=date(2026, 3, 5),
        workday_ids=[],
        loan_allocations=[LoanAllocation(loan=loan, amount=Decimal("30000.00"))],
        created_by=maestro,
    )
    register_payment(
        worker=profile,
        payment_method=pm,
        payment_date=date(2026, 3, 12),
        workday_ids=[],
        loan_allocations=[LoanAllocation(loan=loan, amount=Decimal("20000.00"))],
        created_by=maestro,
    )

    api = APIClient()
    api.force_authenticate(user=maestro)
    resp = api.get(f"/api/loans/{loan.id}/")
    assert resp.status_code == 200
    body = resp.json()
    assert len(body["payment_details"]) == 2
    amounts = sorted(
        [Decimal(d["paid_amount"]) for d in body["payment_details"]],
    )
    assert amounts == [Decimal("20000.00"), Decimal("30000.00")]


@pytest.mark.django_db
def test_payment_list_query_count_is_constant(django_assert_num_queries):
    """Listar N pagos no dispara N+1: el queryset trae los detalles con
    prefetch_related. ``assertNumQueries`` fija un techo concreto para
    que nadie pueda degradarlo sin enterarse."""
    org = OrganizationFactory(name="Org perf")
    profile = WorkerProfileFactory(user__organization=org)
    maestro = _maestro_de_org(org)
    WorkerRateFactory(
        worker=profile,
        amount="50000.00",
        valid_from=date(2026, 1, 1),
        valid_until=None,
    )
    wd_type = WorkdayTypeFactory(name="Día completo", factor="1.00")
    pm = PaymentMethodFactory(name="Efectivo")
    loan = create_loan(
        worker=profile,
        amount=Decimal("200000.00"),
        date=date(2026, 1, 1),
        created_by=maestro,
    )
    # 5 pagos, cada uno con 1 workday + 1 abono a préstamo.
    for i in range(5):
        wd = create_workday(
            worker=profile,
            workday_type=wd_type,
            date=date(2026, 3, i + 1),
            created_by=maestro,
        )
        register_payment(
            worker=profile,
            payment_method=pm,
            payment_date=date(2026, 3, 10 + i),
            workday_ids=[wd.id],
            loan_allocations=[LoanAllocation(loan=loan, amount=Decimal("1000.00"))],
            created_by=maestro,
        )

    api = APIClient()
    api.force_authenticate(user=maestro)
    with django_assert_num_queries(7):
        # 7 ≈ 1 list + prefetch workday_details__workday__workday_type
        # (2 queries: workday + workday_type) + prefetch loan_details__loan
        # + count. Lo importante es que es constante: si fueran 5 pagos
        # con detalles anidados sin prefetch serían ~20+ queries.
        resp = api.get("/api/payments/")
    assert resp.status_code == 200
    body = resp.json()
    assert body["count"] == 5


@pytest.mark.django_db
def test_payment_detail_cross_org_returns_404():
    org_a = OrganizationFactory(name="Org A audit")
    org_b = OrganizationFactory(name="Org B audit")
    g, _ = Group.objects.get_or_create(name="Maestro")
    maestro_a_user = UserFactory(organization=org_a)
    maestro_a_user.groups.add(g)
    profile_b = WorkerProfileFactory(user=UserFactory(organization=org_b))
    WorkerRateFactory(
        worker=profile_b,
        amount="50000.00",
        valid_from=date(2026, 1, 1),
        valid_until=None,
    )
    wd_type = WorkdayTypeFactory(name="Día completo", factor="1.00")
    wd = create_workday(
        worker=profile_b,
        workday_type=wd_type,
        date=date(2026, 3, 1),
        created_by=UserFactory(organization=org_b),
    )
    pm = PaymentMethodFactory(name="Efectivo")
    payment = register_payment(
        worker=profile_b,
        payment_method=pm,
        payment_date=date(2026, 3, 5),
        workday_ids=[wd.id],
        loan_allocations=[],
        created_by=UserFactory(organization=org_b),
    )
    api = APIClient()
    api.force_authenticate(user=maestro_a_user)
    resp = api.get(f"/api/payments/{payment.id}/")
    assert resp.status_code == 404
