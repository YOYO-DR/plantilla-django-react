"""Cubre la rama ``notes`` pura y la rama ``workday_type`` de ``update_workday``."""

from __future__ import annotations

import pytest

from apps.catalogs.tests.factories import WorkdayTypeFactory
from apps.workdays.services import update_workday
from apps.workdays.tests.factories import WorkdayFactory


@pytest.mark.django_db
def test_update_workday_changes_only_notes_without_payments():
    wd = WorkdayFactory()
    update_workday(workday=wd, notes="solo notas")
    wd.refresh_from_db()
    assert wd.notes == "solo notas"


@pytest.mark.django_db
def test_update_workday_changes_only_workday_type():
    wd = WorkdayFactory()
    new_type = WorkdayTypeFactory(name="Otro tipo", factor="0.75")
    update_workday(workday=wd, workday_type=new_type)
    wd.refresh_from_db()
    assert wd.workday_type_id == new_type.id


@pytest.mark.django_db
def test_update_workday_changes_only_date():
    from datetime import date

    wd = WorkdayFactory()
    update_workday(workday=wd, date=date(2027, 1, 1))
    wd.refresh_from_db()
    assert wd.date == date(2027, 1, 1)

