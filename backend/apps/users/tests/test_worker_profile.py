"""Tests de ``WorkerProfile.current_rate`` (regla de tarifa vigente).

Punto 8 del spec Fase A: tarifa vigente con varios casos usando
``freezegun`` para fijar ``today`` de forma determinista.
"""

from __future__ import annotations

from datetime import date

import pytest
from freezegun import freeze_time

from apps.users.tests.factories import WorkerProfileFactory
from apps.workdays.tests.factories import WorkerRateFactory

TODAY = "2026-06-15"


@pytest.mark.django_db
@freeze_time(TODAY)
def test_current_rate_with_no_rates():
    profile = WorkerProfileFactory()
    assert profile.current_rate is None


@pytest.mark.django_db
@freeze_time(TODAY)
def test_current_rate_with_single_vigente():
    profile = WorkerProfileFactory()
    rate = WorkerRateFactory(
        worker=profile,
        amount="60000.00",
        valid_from=date(2026, 1, 1),
        valid_until=None,
    )
    assert profile.current_rate == rate


@pytest.mark.django_db
@freeze_time(TODAY)
def test_current_rate_returns_most_recent_vigente():
    profile = WorkerProfileFactory()
    older = WorkerRateFactory(
        worker=profile,
        amount="50000.00",
        valid_from=date(2025, 1, 1),
        valid_until=date(2025, 12, 31),
    )
    newer = WorkerRateFactory(
        worker=profile,
        amount="75000.00",
        valid_from=date(2026, 1, 1),
        valid_until=None,
    )
    assert profile.current_rate == newer
    assert profile.current_rate != older


@pytest.mark.django_db
@freeze_time(TODAY)
def test_current_rate_excludes_vencida():
    profile = WorkerProfileFactory()
    vencida = WorkerRateFactory(
        worker=profile,
        amount="40000.00",
        valid_from=date(2025, 1, 1),
        valid_until=date(2025, 6, 30),
    )
    assert profile.current_rate is None
    profile.refresh_from_db()
    assert profile.rates.count() == 1
    assert vencida in profile.rates.all()


@pytest.mark.django_db
@freeze_time(TODAY)
def test_current_rate_valid_until_none_counts_as_vigente():
    """``valid_until=None`` se interpreta como vigente de forma indefinida."""
    profile = WorkerProfileFactory()
    rate = WorkerRateFactory(
        worker=profile,
        amount="55000.00",
        valid_from=date(2024, 1, 1),
        valid_until=None,
    )
    assert profile.current_rate == rate
