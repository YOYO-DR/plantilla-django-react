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
            "liquidacion_id",
            "created_at",
        ]
        read_only_fields = [
            "id",
            "created_at",
            "liquidacion_id",
            "created_by",
            "applied_rate",
            "payment_status",
        ]

    def validate(self, attrs):
        # R6: si liquidacion_id existe, no permitir upsert.
        instance = self.instance
        if instance and instance.liquidacion_id is not None:
            raise serializers.ValidationError(
                "Esta jornada ya está liquidada y no se puede modificar."
            )
        return attrs
