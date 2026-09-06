"""Serializers para catálogos."""

from __future__ import annotations

from rest_framework import serializers

from .models import LoanStatus
from .models import PaymentMethod
from .models import PaymentStatus
from .models import WorkdayType


class WorkdayTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = WorkdayType
        fields = ["id", "name", "factor", "order", "is_active", "organization"]
        read_only_fields = ["id"]


class PaymentStatusSerializer(serializers.ModelSerializer):
    class Meta:
        model = PaymentStatus
        fields = ["id", "name", "order", "is_active"]
        read_only_fields = ["id"]


class LoanStatusSerializer(serializers.ModelSerializer):
    class Meta:
        model = LoanStatus
        fields = ["id", "name", "order", "is_active"]
        read_only_fields = ["id"]


class PaymentMethodSerializer(serializers.ModelSerializer):
    class Meta:
        model = PaymentMethod
        fields = ["id", "name", "order", "is_active"]
        read_only_fields = ["id"]
