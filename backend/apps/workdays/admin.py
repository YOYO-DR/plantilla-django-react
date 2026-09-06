"""Admin Django para jornadas y tarifas."""

from __future__ import annotations

from django.contrib import admin

from .models import Workday
from .models import WorkerRate


@admin.register(WorkerRate)
class WorkerRateAdmin(admin.ModelAdmin):
    list_display = ("worker", "amount", "valid_from", "valid_until")
    list_filter = ("valid_from", "valid_until")
    search_fields = ("worker__user__email", "worker__user__name")
    autocomplete_fields = ("worker",)


@admin.register(Workday)
class WorkdayAdmin(admin.ModelAdmin):
    list_display = ("worker", "date", "workday_type", "payment_status", "applied_rate")
    list_filter = ("workday_type", "payment_status", "date")
    search_fields = ("worker__user__email", "worker__user__name", "notes")
    autocomplete_fields = ("worker",)
