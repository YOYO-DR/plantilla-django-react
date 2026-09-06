from __future__ import annotations

from typing import TYPE_CHECKING

import pytest

if TYPE_CHECKING:
    from apps.users.models import User


@pytest.fixture(autouse=True)
def _media_storage(settings, tmpdir) -> None:
    settings.MEDIA_ROOT = tmpdir.strpath


@pytest.fixture
def user(db) -> User:
    # Lazy import: factories.py triggers Django model resolution which
    # requires `django.setup()` to have run. pytest-django runs that in
    # the pytest_configure phase, AFTER conftest module imports.
    from apps.users.tests.factories import UserFactory  # noqa: PLC0415

    return UserFactory.create()
