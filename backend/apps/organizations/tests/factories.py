"""Factories para ``apps.organizations``."""

from __future__ import annotations

import factory
from factory.django import DjangoModelFactory

from apps.organizations.models import Organization


class OrganizationFactory(DjangoModelFactory):
    name = factory.Sequence(lambda n: f"Org {n}")
    is_active = True

    class Meta:
        model = "organizations.Organization"
        django_get_or_create = ["name"]
