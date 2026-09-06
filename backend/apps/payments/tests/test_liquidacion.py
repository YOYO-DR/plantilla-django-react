from __future__ import annotations

import uuid
from datetime import date
from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.db import connection
from django.db.utils import IntegrityError
from django.test.utils import CaptureQueriesContext
from rest_framework.test import APIClient

from apps.catalogs.models import PaymentStatus
from apps.catalogs.models import TipoMovimientoDeuda
from apps.catalogs.models import WorkdayType
from apps.organizations.models import Organization
from apps.payments.models import MovimientoDeuda
from apps.payments.models import PaymentWorkdayDetail
from apps.payments.services.liquidacion import liquidar
from apps.users.models import WorkerProfile
from apps.workdays.models import Workday

User = get_user_model()


HTTP_OK = 200
QUERY_BUDGET = 15


@pytest.fixture
def org(db):
    return Organization.objects.create(name="Org Test")


@pytest.fixture
def maestro(db, org):
    # Email único para evitar colisión con seed (0003_seed_users).
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


@pytest.fixture
def wdt(db):
    # get_or_create para colisión con seed (0002_seed_catalogs).
    obj, _ = WorkdayType.objects.get_or_create(
        name="Día completo", defaults={"factor": Decimal("1.00")}
    )
    return obj


@pytest.fixture
def ps(db):
    # get_or_create para colisión con seed (0002_seed_catalogs).
    obj, _ = PaymentStatus.objects.get_or_create(name="Pendiente")
    return obj


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


def _crear_workday(worker, wdt, ps, fecha, tarifa, creado_por):  # noqa: PLR0913
    return Workday.objects.create(
        worker=worker,
        workday_type=wdt,
        payment_status=ps,
        date=fecha,
        applied_rate=tarifa,
        created_by=creado_por,
    )


@pytest.mark.django_db
def test_liquidar_sin_descuento(maestro, worker_user, wdt, ps):
    worker = worker_user.worker_profile
    wd = _crear_workday(
        worker,
        wdt,
        ps,
        date(2024, 9, 1),
        Decimal("100000"),
        maestro,
    )
    liq = liquidar(
        organization=worker.user.organization,
        worker=worker,
        periodo_inicio=date(2024, 9, 1),
        periodo_fin=date(2024, 9, 1),
        jornada_ids=[wd.id],
        modo_descuento="ninguno",
        monto_manual=0,
        fecha_pago=date(2024, 9, 7),
        observaciones="",
        registrado_por=maestro,
    )
    assert liq.consecutivo == 1
    assert liq.subtotal_jornadas == Decimal("100000")
    assert liq.monto_descontado == 0
    assert liq.total_pagado == Decimal("100000")
    assert liq.saldo_deuda_antes == 0
    assert liq.saldo_deuda_despues == 0
    # Jornada bloqueada
    wd.refresh_from_db()
    assert wd.liquidacion_id == liq.id
    # Detalle persistido
    assert PaymentWorkdayDetail.objects.filter(payment=liq, workday_id=wd.id).exists()


@pytest.mark.django_db
def test_liquidar_con_descuento_parcial(  # noqa: PLR0913
    maestro,
    worker_user,
    wdt,
    ps,
    tipo_prestamo,
    tipo_abono,
):
    worker = worker_user.worker_profile
    wd1 = _crear_workday(
        worker,
        wdt,
        ps,
        date(2024, 9, 1),
        Decimal("100000"),
        maestro,
    )
    wd2 = _crear_workday(
        worker,
        wdt,
        ps,
        date(2024, 9, 2),
        Decimal("100000"),
        maestro,
    )
    # Préstamo previo de 150.000 (no ligado a ninguna liq, así que entra al saldo)
    MovimientoDeuda.objects.create(
        worker=worker,
        tipo=tipo_prestamo,
        monto=Decimal("150000"),
        concepto="Adelanto",
        fecha=date(2024, 8, 30),
        registrado_por=maestro,
    )
    liq = liquidar(
        organization=worker.user.organization,
        worker=worker,
        periodo_inicio=date(2024, 9, 1),
        periodo_fin=date(2024, 9, 2),
        jornada_ids=[wd1.id, wd2.id],
        modo_descuento="parcial",
        monto_manual=Decimal("50000"),
        fecha_pago=date(2024, 9, 7),
        observaciones="Descuento parcial",
        registrado_por=maestro,
    )
    assert liq.consecutivo == 1
    assert liq.subtotal_jornadas == Decimal("200000")
    assert liq.saldo_deuda_antes == Decimal("150000")
    assert liq.monto_descontado == Decimal("50000")
    assert liq.total_pagado == Decimal("150000")
    assert liq.saldo_deuda_despues == Decimal("100000")
    # Movimiento de abono creado y vinculado a la liquidación
    abonos = MovimientoDeuda.objects.filter(worker=worker, tipo=tipo_abono)
    assert abonos.count() == 1
    assert abonos.first().liquidacion_id == liq.id


@pytest.mark.django_db
def test_liquidar_consecutivo_increments(maestro, worker_user, wdt, ps):
    worker = worker_user.worker_profile
    wd1 = _crear_workday(
        worker,
        wdt,
        ps,
        date(2024, 9, 1),
        Decimal("100000"),
        maestro,
    )
    wd2 = _crear_workday(
        worker,
        wdt,
        ps,
        date(2024, 9, 2),
        Decimal("100000"),
        maestro,
    )
    common = {
        "organization": worker.user.organization,
        "worker": worker,
        "modo_descuento": "ninguno",
        "monto_manual": 0,
        "fecha_pago": date(2024, 9, 7),
        "observaciones": "",
        "registrado_por": maestro,
    }
    liq1 = liquidar(
        periodo_inicio=date(2024, 9, 1),
        periodo_fin=date(2024, 9, 1),
        jornada_ids=[wd1.id],
        **common,
    )
    liq2 = liquidar(
        periodo_inicio=date(2024, 9, 2),
        periodo_fin=date(2024, 9, 2),
        jornada_ids=[wd2.id],
        **common,
    )
    assert liq1.consecutivo == 1
    assert liq2.consecutivo == liq1.consecutivo + 1


@pytest.mark.django_db
def test_no_liquidar_jornada_ya_liquidada(maestro, worker_user, wdt, ps):
    worker = worker_user.worker_profile
    wd = _crear_workday(
        worker,
        wdt,
        ps,
        date(2024, 9, 1),
        Decimal("100000"),
        maestro,
    )
    common = {
        "organization": worker.user.organization,
        "worker": worker,
        "periodo_inicio": date(2024, 9, 1),
        "periodo_fin": date(2024, 9, 1),
        "modo_descuento": "ninguno",
        "monto_manual": 0,
        "fecha_pago": date(2024, 9, 7),
        "observaciones": "",
        "registrado_por": maestro,
    }
    liquidar(jornada_ids=[wd.id], **common)
    with pytest.raises(ValueError, match="ya está liquidada"):
        liquidar(jornada_ids=[wd.id], **common)


@pytest.mark.django_db
def test_snapshot_detalle_no_cambia_si_se_edita_workday(
    maestro,
    worker_user,
    wdt,
    ps,
):
    worker = worker_user.worker_profile
    wd = _crear_workday(
        worker,
        wdt,
        ps,
        date(2024, 9, 1),
        Decimal("100000"),
        maestro,
    )
    liq = liquidar(
        organization=worker.user.organization,
        worker=worker,
        periodo_inicio=date(2024, 9, 1),
        periodo_fin=date(2024, 9, 1),
        jornada_ids=[wd.id],
        modo_descuento="ninguno",
        monto_manual=0,
        fecha_pago=date(2024, 9, 7),
        observaciones="",
        registrado_por=maestro,
    )
    snapshot_detalle = liq.detalle
    snapshot_subtotal = liq.subtotal_jornadas

    # Aunque el workday se edite en BD después de liquidar, el SNAPSHOT
    # de la liquidación es inmutable (es lo que cuenta contablemente).
    # No implementamos bloqueo a nivel modelo todavía (R-futuro).
    wd.applied_rate = Decimal("500000")
    wd.save()

    liq.refresh_from_db()
    assert liq.detalle == snapshot_detalle
    assert liq.subtotal_jornadas == snapshot_subtotal


@pytest.mark.django_db
def test_liquidaciones_list_no_n_plus_1(maestro, worker_user, wdt, ps):
    """Listar liquidaciones no debe generar N+1 por workday_details."""
    worker = worker_user.worker_profile
    api = APIClient()
    api.force_authenticate(user=maestro)
    for i in range(3):
        wd = _crear_workday(
            worker,
            wdt,
            ps,
            date(2024, 9, i + 1),
            Decimal("100000"),
            maestro,
        )
        liquidar(
            organization=worker.user.organization,
            worker=worker,
            periodo_inicio=wd.date,
            periodo_fin=wd.date,
            jornada_ids=[wd.id],
            modo_descuento="ninguno",
            monto_manual=0,
            fecha_pago=date(2024, 9, 7),
            observaciones="",
            registrado_por=maestro,
        )
    with CaptureQueriesContext(connection) as ctx:
        resp = api.get("/api/liquidaciones/")
        assert resp.status_code == HTTP_OK
        # Sin paginación configurada, resp.json() es lista directa.
        # Serializa (accede a workday_details por cada liq gracias al prefetch).
        data = resp.json()
        results = data["results"] if isinstance(data, dict) else data
        _ = [liq["workday_details"] for liq in results]
    # Tolerancia: con prefetch_related, las queries deben ser planas.
    assert len(ctx) < QUERY_BUDGET, f"N+1 sospechoso: {len(ctx)} queries"
