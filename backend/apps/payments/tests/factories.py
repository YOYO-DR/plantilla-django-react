"""Factories para ``apps.payments``."""

from __future__ import annotations

from datetime import date

import factory
from factory import SubFactory
from factory.django import DjangoModelFactory

from apps.catalogs.tests.factories import (
    LoanStatusFactory,
    PaymentMethodFactory,
)
from apps.users.tests.factories import (
    UserFactory,
    WorkerProfileFactory,
)
from apps.workdays.tests.factories import WorkdayFactory

from apps.payments.models import Loan
from apps.payments.models import Payment
from apps.payments.models import PaymentLoanDetail
from apps.payments.models import PaymentWorkdayDetail


class LoanFactory(DjangoModelFactory):
    worker = SubFactory(WorkerProfileFactory)
    status = SubFactory(LoanStatusFactory)
    amount = "100000.00"
    outstanding_balance = "100000.00"
    date = date(2026, 1, 1)
    reason = ""
    created_by = factory.SubFactory(UserFactory)

    class Meta:
        model = "payments.Loan"


class PaymentFactory(DjangoModelFactory):
    worker = SubFactory(WorkerProfileFactory)
    payment_method = SubFactory(PaymentMethodFactory)
    total_amount = "50000.00"
    payment_date = date(2026, 1, 15)
    notes = ""
    created_by = factory.SubFactory(UserFactory)

    class Meta:
        model = "payments.Payment"


class PaymentWorkdayDetailFactory(DjangoModelFactory):
    payment = SubFactory(PaymentFactory)
    workday = SubFactory(WorkdayFactory)
    applied_amount = "50000.00"

    class Meta:
        model = "payments.PaymentWorkdayDetail"


class PaymentLoanDetailFactory(DjangoModelFactory):
    payment = SubFactory(PaymentFactory)
    loan = SubFactory(LoanFactory)
    paid_amount = "10000.00"

    class Meta:
        model = "payments.PaymentLoanDetail"
