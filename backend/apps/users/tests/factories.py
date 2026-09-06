"""Factories factory-boy para ``apps.users``."""

from __future__ import annotations

import uuid

from factory import Faker
from factory import SubFactory
from factory import post_generation
from factory.django import DjangoModelFactory


def _unique_email() -> str:
    """UUID4 hex truncado → emails únicos por test para no chocar con seed."""
    return f"u{uuid.uuid4().hex[:8]}@test.local"


class UserFactory(DjangoModelFactory):
    email = Faker("email")
    name = Faker("name")

    @post_generation
    def password(self, create: bool, extracted: str | None, **kwargs):  # noqa: FBT001
        password = extracted or "test-pass-42"
        self.set_password(password)
        if create:
            self.save()

    class Meta:
        model = "users.User"
        django_get_or_create = ["email"]
        skip_postgeneration_save = True


class WorkerProfileFactory(DjangoModelFactory):
    user = SubFactory(UserFactory)
    id_document = Faker("ssn")
    hire_date = Faker("date_object")
    is_active = True

    class Meta:
        model = "users.WorkerProfile"
        django_get_or_create = ["user"]
        skip_postgeneration_save = True
