from __future__ import annotations

from rest_framework import serializers

from apps.catalogs.models import (
    WorkdayType,
    PaymentStatus,
    TipoMovimientoDeuda,
    PaymentMethod,
)


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


class TipoMovimientoDeudaSerializer(serializers.ModelSerializer):
    class Meta:
        model = TipoMovimientoDeuda
        fields = ["id", "name", "affects_balance", "order", "is_active"]
        read_only_fields = ["id"]


class PaymentMethodSerializer(serializers.ModelSerializer):
    class Meta:
        model = PaymentMethod
        fields = ["id", "name", "order", "is_active"]
        read_only_fields = ["id"]
