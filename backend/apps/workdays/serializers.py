"""Serializers para jornadas de trabajo y tarifas."""

from __future__ import annotations

from rest_framework import serializers

from apps.workdays.models import Workday
from apps.workdays.models import WorkerRate


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


class WorkerRateSerializer(serializers.ModelSerializer):
    class Meta:
        model = WorkerRate
        fields = [
            "id",
            "worker",
            "amount",
            "valid_from",
            "valid_until",
        ]
        read_only_fields = ["id"]
