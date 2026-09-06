"""Serializers para jornadas de trabajo."""

from __future__ import annotations

from rest_framework import serializers

from apps.workdays.models import Workday


class WorkdaySerializer(serializers.ModelSerializer):
    class Meta:
        model = Workday
        fields = [
            "id",
            "worker",
            "workday_type",
            "payment_status",
            "date",
            "applied_rate",
            "notes",
            "created_at",
        ]
        read_only_fields = [
            "id",
            "created_at",
            "created_by",
            "applied_rate",
            "payment_status",
        ]
