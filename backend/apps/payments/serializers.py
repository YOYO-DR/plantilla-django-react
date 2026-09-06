from __future__ import annotations

from rest_framework import serializers

from apps.payments.models import Liquidacion
from apps.payments.models import MovimientoDeuda
from apps.payments.models import PaymentLoanDetail
from apps.payments.models import PaymentWorkdayDetail


class LiquidacionSerializer(serializers.ModelSerializer):
    workday_details = serializers.SerializerMethodField()
    loan_details = serializers.SerializerMethodField()

    class Meta:
        model = Liquidacion
        fields = [
            "id",
            "consecutivo",
            "organization",
            "worker",
            "periodo_inicio",
            "periodo_fin",
            "jornada_ids",
            "detalle",
            "subtotal_jornadas",
            "saldo_deuda_antes",
            "modo_descuento",
            "monto_descontado",
            "total_pagado",
            "saldo_deuda_despues",
            "estado",
            "fecha_pago",
            "observaciones",
            "creado_en",
            "workday_details",
            "loan_details",
        ]
        read_only_fields = fields

    def get_workday_details(self, obj):
        return [
            {
                "workday_id": d.workday_id,
                "applied_amount": str(d.applied_amount),
            }
            for d in obj.workday_details.all()
        ]

    def get_loan_details(self, obj):
        return [
            {
                "loan_id": d.loan_id,
                "paid_amount": str(d.paid_amount),
            }
            for d in obj.loan_details.all()
        ]


class MovimientoDeudaSerializer(serializers.ModelSerializer):
    signed_amount = serializers.DecimalField(
        max_digits=10,
        decimal_places=2,
        read_only=True,
    )

    class Meta:
        model = MovimientoDeuda
        fields = [
            "id",
            "worker",
            "tipo",
            "monto",
            "signed_amount",
            "concepto",
            "fecha",
            "liquidacion",
            "registrado_en",
        ]
        read_only_fields = ["id", "registrado_en", "signed_amount"]


class PaymentWorkdayDetailSerializer(serializers.ModelSerializer):
    class Meta:
        model = PaymentWorkdayDetail
        fields = "__all__"


class PaymentLoanDetailSerializer(serializers.ModelSerializer):
    class Meta:
        model = PaymentLoanDetail
        fields = "__all__"
