"""Admin Django para catálogos reutilizables."""

from __future__ import annotations

from django.contrib import admin

from .models import LoanStatus
from .models import PaymentMethod
from .models import PaymentStatus
from .models import WorkdayType


@admin.register(WorkdayType)
class WorkdayTypeAdmin(admin.ModelAdmin):
    list_display = ("name", "factor", "organization", "order", "is_active")
    list_filter = ("is_active", "organization")
    search_fields = ("name",)
    autocomplete_fields = ("organization",)


@admin.register(PaymentStatus)
class PaymentStatusAdmin(admin.ModelAdmin):
    list_display = ("name", "order", "is_active")
    list_filter = ("is_active",)
    search_fields = ("name",)


@admin.register(LoanStatus)
class LoanStatusAdmin(admin.ModelAdmin):
    list_display = ("name", "order", "is_active")
    list_filter = ("is_active",)
    search_fields = ("name",)


@admin.register(PaymentMethod)
class PaymentMethodAdmin(admin.ModelAdmin):
    list_display = ("name", "order", "is_active")
    list_filter = ("is_active",)
    search_fields = ("name",)
