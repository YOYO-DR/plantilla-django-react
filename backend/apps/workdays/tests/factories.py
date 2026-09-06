"""Factories para ``apps.workdays``."""

from __future__ import annotations

from datetime import date

import factory
from factory import SubFactory
from factory.django import DjangoModelFactory

from apps.catalogs.tests.factories import (
    PaymentStatusFactory,
    WorkdayTypeFactory,
)
from apps.users.tests.factories import WorkerProfileFactory

from apps.workdays.models import Workday
from apps.workdays.models import WorkerRate


class WorkerRateFactory(DjangoModelFactory):
    worker = SubFactory(WorkerProfileFactory)
    amount = "50000.00"
    valid_from = date(2024, 1, 1)
    valid_until = None

    class Meta:
        model = "workdays.WorkerRate"


class WorkdayFactory(DjangoModelFactory):
    worker = SubFactory(WorkerProfileFactory)
    workday_type = SubFactory(WorkdayTypeFactory)
    payment_status = SubFactory(PaymentStatusFactory)
    date = date(2026, 1, 1)
    applied_rate = "50000.00"
    created_by = factory.SubFactory(
        "apps.users.tests.factories.UserFactory",
        organization=factory.LazyAttribute(
            lambda o: o.factory_parent.worker.user.organization,
        ),
    )

    class Meta:
        model = "workdays.Workday"
