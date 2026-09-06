"""Factories para ``apps.catalogs``."""

from __future__ import annotations

import factory
from factory.django import DjangoModelFactory

from apps.catalogs.models import LoanStatus
from apps.catalogs.models import PaymentMethod
from apps.catalogs.models import PaymentStatus
from apps.catalogs.models import WorkdayType


class WorkdayTypeFactory(DjangoModelFactory):
    name = factory.Sequence(lambda n: f"Tipo {n}")
    factor = "1.00"
    order = 0
    is_active = True

    class Meta:
        model = "catalogs.WorkdayType"


class PaymentStatusFactory(DjangoModelFactory):
    name = factory.Sequence(lambda n: f"Estado {n}")
    order = 0
    is_active = True

    class Meta:
        model = "catalogs.PaymentStatus"


class LoanStatusFactory(DjangoModelFactory):
    name = factory.Sequence(lambda n: f"LoanStatus {n}")
    order = 0
    is_active = True

    class Meta:
        model = "catalogs.LoanStatus"


class PaymentMethodFactory(DjangoModelFactory):
    name = factory.Sequence(lambda n: f"Método {n}")
    order = 0
    is_active = True

    class Meta:
        model = "catalogs.PaymentMethod"
