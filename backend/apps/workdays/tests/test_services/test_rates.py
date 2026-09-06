"""Cobertura 100% de ``apps.workdays.services``.

Casos:
- ``create_worker_rate``: cierra la vigente, rechaza solape, redondea.
- ``create_workday``: calcula tarifa vigente * factor, estado Pendiente,
  rechaza si no hay tarifa (NoActiveRateError), acepta ``applied_rate`` explícito.
- ``update_workday``: rechaza si la jornada tiene pagos aplicados.
- ``delete_workday``: rechaza idem.
"""

from __future__ import annotations

from datetime import date
from decimal import Decimal

import pytest

from apps.catalogs.tests.factories import WorkdayTypeFactory
from apps.payments.tests.factories import PaymentFactory
from apps.payments.tests.factories import PaymentWorkdayDetailFactory
from apps.users.tests.factories import UserFactory
from apps.users.tests.factories import WorkerProfileFactory
from apps.workdays.exceptions import NoActiveRateError
from apps.workdays.exceptions import OverlappingRateError
from apps.workdays.exceptions import WorkdayAlreadyPaidError
from apps.workdays.models import Workday
from apps.workdays.services import create_workday
from apps.workdays.services import create_worker_rate
from apps.workdays.services import delete_workday
from apps.workdays.services import update_workday
from apps.workdays.tests.factories import WorkerRateFactory


def _maestro_in_org(org):
    return UserFactory(organization=org)


@pytest.mark.django_db
def test_create_worker_rate_closes_prior_open_rate():
    profile = WorkerProfileFactory()
    anterior = WorkerRateFactory(
        worker=profile,
        amount="50000.00",
        valid_from=date(2025, 1, 1),
        valid_until=None,  # vigente
    )
    nueva = create_worker_rate(
        worker=profile,
        amount=Decimal("75000.00"),
        valid_from=date(2026, 1, 1),
    )
    anterior.refresh_from_db()
    assert anterior.valid_until == date(2025, 12, 31)
    assert nueva.amount == Decimal("75000.00")
    assert nueva.valid_until is None


@pytest.mark.django_db
def test_create_worker_rate_amount_rounded_to_cents():
    profile = WorkerProfileFactory()
    rate = create_worker_rate(
        worker=profile,
        amount=Decimal("58333.3333"),
        valid_from=date(2026, 1, 1),
    )
    assert rate.amount == Decimal("58333.33")


@pytest.mark.django_db
def test_create_worker_rate_rejects_overlap_with_closed_prior_window():
    """Si la tarifa anterior tiene ``valid_until`` explícito y cubre la nueva
    ``valid_from``, se rechaza (no se auto-cierra en ningún caso)."""
    profile = WorkerProfileFactory()
    WorkerRateFactory(
        worker=profile,
        amount="50000.00",
        valid_from=date(2025, 1, 1),
        valid_until=date(2025, 6, 30),  # cubre 2025-06-01
    )
    with pytest.raises(OverlappingRateError):
        create_worker_rate(
            worker=profile,
            amount=Decimal("75000.00"),
            valid_from=date(2025, 6, 1),
        )


@pytest.mark.django_db
def test_create_worker_rate_accepts_after_prior_ended():
    profile = WorkerProfileFactory()
    WorkerRateFactory(
        worker=profile,
        amount="50000.00",
        valid_from=date(2025, 1, 1),
        valid_until=date(2025, 6, 30),  # cubre 2025-06-01 también
    )
    with pytest.raises(OverlappingRateError):
        create_worker_rate(
            worker=profile,
            amount=Decimal("75000.00"),
            valid_from=date(2025, 6, 1),
        )


@pytest.mark.django_db
def test_create_worker_rate_no_prior_just_opens():
    profile = WorkerProfileFactory()
    rate = create_worker_rate(
        worker=profile,
        amount=Decimal("60000.00"),
        valid_from=date(2026, 1, 1),
    )
    assert rate.valid_until is None


@pytest.mark.django_db
def test_create_workday_calculates_from_tarifa_vigente_factor_1():
    """Día completo (factor 1.0) con tarifa 60.000 → applied_rate 60.000."""
    profile = WorkerProfileFactory()
    WorkerRateFactory(
        worker=profile,
        amount="60000.00",
        valid_from=date(2026, 1, 1),
        valid_until=None,
    )
    wd_type = WorkdayTypeFactory(name="Día completo", factor="1.00")
    maestro = _maestro_in_org(profile.user.organization)
    wd = create_workday(
        worker=profile,
        workday_type=wd_type,
        date=date(2026, 3, 15),
        created_by=maestro,
    )
    assert wd.applied_rate == Decimal("60000.00")
    assert wd.payment_status.name == "Pendiente"


@pytest.mark.django_db
def test_create_workday_calculates_factor_0_5():
    """Medio día (factor 0.5) con tarifa 60.000 → applied_rate 30.000."""
    profile = WorkerProfileFactory()
    WorkerRateFactory(
        worker=profile,
        amount="60000.00",
        valid_from=date(2026, 1, 1),
        valid_until=None,
    )
    wd_type = WorkdayTypeFactory(name="Medio día", factor="0.50")
    maestro = _maestro_in_org(profile.user.organization)
    wd = create_workday(
        worker=profile,
        workday_type=wd_type,
        date=date(2026, 3, 15),
        created_by=maestro,
    )
    assert wd.applied_rate == Decimal("30000.00")


@pytest.mark.django_db
def test_create_workday_rounds_to_cents():
    """Tarifa 58.333,33 con factor 1.0 y luego factor 0.5 — sin drift."""
    profile = WorkerProfileFactory()
    WorkerRateFactory(
        worker=profile,
        amount=Decimal("58333.3333"),
        valid_from=date(2026, 1, 1),
        valid_until=None,
    )
    wd_type_full = WorkdayTypeFactory(name="Día completo", factor="1.00")
    wd_type_half = WorkdayTypeFactory(name="Medio día", factor="0.50")
    maestro = _maestro_in_org(profile.user.organization)

    wd_full = create_workday(
        worker=profile,
        workday_type=wd_type_full,
        date=date(2026, 3, 15),
        created_by=maestro,
    )
    wd_half = create_workday(
        worker=profile,
        workday_type=wd_type_half,
        date=date(2026, 3, 16),
        created_by=maestro,
    )
    assert wd_full.applied_rate == Decimal("58333.33")
    assert wd_half.applied_rate == Decimal("29166.67")  # HALF_UP


@pytest.mark.django_db
def test_create_workday_no_active_rate_raises():
    profile = WorkerProfileFactory()
    wd_type = WorkdayTypeFactory(name="Día completo", factor="1.00")
    maestro = _maestro_in_org(profile.user.organization)
    with pytest.raises(NoActiveRateError):
        create_workday(
            worker=profile,
            workday_type=wd_type,
            date=date(2026, 3, 15),
            created_by=maestro,
        )


@pytest.mark.django_db
def test_create_workday_explicit_applied_rate_does_not_alter_rate():
    """``applied_rate`` explícito no altera la tarifa vigente del trabajador."""
    profile = WorkerProfileFactory()
    rate = WorkerRateFactory(
        worker=profile,
        amount="60000.00",
        valid_from=date(2026, 1, 1),
        valid_until=None,
    )
    wd_type = WorkdayTypeFactory(name="Día completo", factor="1.00")
    maestro = _maestro_in_org(profile.user.organization)
    wd = create_workday(
        worker=profile,
        workday_type=wd_type,
        date=date(2026, 3, 15),
        applied_rate=Decimal("80000.00"),  # explícito
        notes="ese día le pagué distinto",
        created_by=maestro,
    )
    assert wd.applied_rate == Decimal("80000.00")
    rate.refresh_from_db()
    assert rate.valid_until is None  # sin alterar


@pytest.mark.django_db
def test_create_workday_explicit_applied_rate_rounded_to_cents():
    """``applied_rate`` explícito también se redondea a centavos."""
    profile = WorkerProfileFactory()
    WorkerRateFactory(
        worker=profile,
        amount="60000.00",
        valid_from=date(2026, 1, 1),
        valid_until=None,
    )
    wd_type = WorkdayTypeFactory(name="Día completo", factor="1.00")
    maestro = _maestro_in_org(profile.user.organization)
    wd = create_workday(
        worker=profile,
        workday_type=wd_type,
        date=date(2026, 3, 15),
        applied_rate=Decimal("80123.4567"),
        created_by=maestro,
    )
    assert wd.applied_rate == Decimal("80123.46")


@pytest.mark.django_db
def test_update_workday_modifies_when_no_payments():
    profile = WorkerProfileFactory()
    WorkerRateFactory(
        worker=profile,
        amount="60000.00",
        valid_from=date(2026, 1, 1),
        valid_until=None,
    )
    wd_type = WorkdayTypeFactory(name="Día completo", factor="1.00")
    other_type = WorkdayTypeFactory(name="Medio día", factor="0.50")
    maestro = _maestro_in_org(profile.user.organization)
    wd = create_workday(
        worker=profile,
        workday_type=wd_type,
        date=date(2026, 3, 15),
        created_by=maestro,
    )
    update_workday(
        workday=wd,
        workday_type=other_type,
        notes="actualizada",
    )
    wd.refresh_from_db()
    assert wd.workday_type_id == other_type.id
    assert wd.notes == "actualizada"


@pytest.mark.django_db
def test_update_workday_rejects_when_has_payment_detail():
    profile = WorkerProfileFactory()
    WorkerRateFactory(
        worker=profile,
        amount="60000.00",
        valid_from=date(2026, 1, 1),
        valid_until=None,
    )
    wd_type = WorkdayTypeFactory(name="Día completo", factor="1.00")
    maestro = _maestro_in_org(profile.user.organization)
    wd = create_workday(
        worker=profile,
        workday_type=wd_type,
        date=date(2026, 3, 15),
        created_by=maestro,
    )
    payment = PaymentFactory(worker=profile, created_by=maestro)
    PaymentWorkdayDetailFactory(payment=payment, workday=wd)

    with pytest.raises(WorkdayAlreadyPaidError):
        update_workday(workday=wd, notes="intento cambiar")


@pytest.mark.django_db
def test_delete_workday_succeeds_when_no_payments():
    profile = WorkerProfileFactory()
    WorkerRateFactory(
        worker=profile,
        amount="60000.00",
        valid_from=date(2026, 1, 1),
        valid_until=None,
    )
    wd_type = WorkdayTypeFactory(name="Día completo", factor="1.00")
    maestro = _maestro_in_org(profile.user.organization)
    wd = create_workday(
        worker=profile,
        workday_type=wd_type,
        date=date(2026, 3, 15),
        created_by=maestro,
    )
    delete_workday(workday=wd)
    assert Workday.objects.filter(id=wd.id).count() == 0


@pytest.mark.django_db
def test_delete_workday_rejects_when_has_payment_detail():
    profile = WorkerProfileFactory()
    WorkerRateFactory(
        worker=profile,
        amount="60000.00",
        valid_from=date(2026, 1, 1),
        valid_until=None,
    )
    wd_type = WorkdayTypeFactory(name="Día completo", factor="1.00")
    maestro = _maestro_in_org(profile.user.organization)
    wd = create_workday(
        worker=profile,
        workday_type=wd_type,
        date=date(2026, 3, 15),
        created_by=maestro,
    )
    payment = PaymentFactory(worker=profile, created_by=maestro)
    PaymentWorkdayDetailFactory(payment=payment, workday=wd)

    with pytest.raises(WorkdayAlreadyPaidError):
        delete_workday(workday=wd)


@pytest.mark.django_db
def test_new_worker_rate_does_not_recalc_historic_workdays():
    """Tras nueva tarifa, jornadas históricas conservan su ``applied_rate``."""
    profile = WorkerProfileFactory()
    vieja = WorkerRateFactory(
        worker=profile,
        amount="50000.00",
        valid_from=date(2025, 1, 1),
        valid_until=None,
    )
    wd_type = WorkdayTypeFactory(name="Día completo", factor="1.00")
    maestro = _maestro_in_org(profile.user.organization)
    wd = create_workday(
        worker=profile,
        workday_type=wd_type,
        date=date(2025, 6, 1),
        created_by=maestro,
    )
    assert wd.applied_rate == Decimal("50000.00")

    create_worker_rate(
        worker=profile,
        amount=Decimal("75000.00"),
        valid_from=date(2026, 1, 1),
    )
    wd.refresh_from_db()
    assert wd.applied_rate == Decimal("50000.00")
    vieja.refresh_from_db()
    assert vieja.valid_until == date(2025, 12, 31)
