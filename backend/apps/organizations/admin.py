"""Admin Django para organizaciones (Fase A — autocomplete dependency)."""

from __future__ import annotations

from django.contrib import admin

from .models import Organization


@admin.register(Organization)
class OrganizationAdmin(admin.ModelAdmin):
    list_display = ("name", "is_active", "created_at")
    list_filter = ("is_active",)
    search_fields = ("name",)
