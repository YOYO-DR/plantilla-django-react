"""Admin Django para préstamos, pagos y detalles."""

from __future__ import annotations

from django.contrib import admin

from .models import Loan
from .models import Payment
from .models import PaymentLoanDetail
from .models import PaymentWorkdayDetail


class PaymentWorkdayDetailInline(admin.TabularInline):
    model = PaymentWorkdayDetail
    extra = 0
    autocomplete_fields = ("workday",)


class PaymentLoanDetailInline(admin.TabularInline):
    model = PaymentLoanDetail
    extra = 0
    autocomplete_fields = ("loan",)


@admin.register(Loan)
class LoanAdmin(admin.ModelAdmin):
    list_display = ("worker", "amount", "outstanding_balance", "status", "date")
    list_filter = ("status", "date")
    search_fields = ("worker__user__email", "worker__user__name", "reason")
    autocomplete_fields = ("worker", "status", "created_by")


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = (
        "worker",
        "payment_method",
        "total_amount",
        "payment_date",
        "voided_at",
    )
    list_filter = ("payment_method", "voided_at", "payment_date")
    search_fields = ("worker__user__email", "worker__user__name", "notes")
    autocomplete_fields = (
        "worker",
        "payment_method",
        "created_by",
        "voided_by",
    )
    inlines = (PaymentWorkdayDetailInline, PaymentLoanDetailInline)


@admin.register(PaymentWorkdayDetail)
class PaymentWorkdayDetailAdmin(admin.ModelAdmin):
    list_display = ("payment", "workday", "applied_amount")
    autocomplete_fields = ("payment", "workday")


@admin.register(PaymentLoanDetail)
class PaymentLoanDetailAdmin(admin.ModelAdmin):
    list_display = ("payment", "loan", "paid_amount")
    autocomplete_fields = ("payment", "loan")
