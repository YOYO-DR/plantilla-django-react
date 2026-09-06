from __future__ import annotations

from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.payments.models import Liquidacion
from apps.payments.models import MovimientoDeuda
from apps.payments.models import PaymentLoanDetail
from apps.payments.models import PaymentWorkdayDetail
from apps.payments.serializers import LiquidacionSerializer
from apps.payments.serializers import MovimientoDeudaSerializer
from apps.payments.serializers import PaymentLoanDetailSerializer
from apps.payments.serializers import PaymentWorkdayDetailSerializer
from apps.payments.services.liquidacion import liquidar as liquidar_fn
from apps.users.models import WorkerProfile


class LiquidacionViewSet(viewsets.ReadOnlyModelViewSet):
    """Lectura de comprobantes + acción ``liquidar`` para crear snapshots."""

    serializer_class = LiquidacionSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        qs = (
            Liquidacion.objects.select_related(
                "organization",
                "worker",
                "worker__user",
                "worker__user__organization",
                "creado_por",
            )
            .prefetch_related(
                "workday_details",
                "loan_details",
            )
            .order_by("-fecha_pago", "-consecutivo")
        )
        if getattr(user, "is_admin_plataforma", False):
            return qs
        if user.organization_id:
            return qs.filter(organization_id=user.organization_id)
        if hasattr(user, "worker_profile"):
            return qs.filter(worker_id=user.worker_profile.id)
        return qs.none()

    @action(detail=False, methods=["post"])
    def liquidar(self, request):
        data = request.data
        worker = get_object_or_404(WorkerProfile, id=data["worker_id"])
        if worker.user.organization_id != request.user.organization_id:
            return Response(
                {"detail": "Worker no pertenece a tu organización."},
                status=status.HTTP_403_FORBIDDEN,
            )
        try:
            liq = liquidar_fn(
                organization=worker.user.organization,
                worker=worker,
                periodo_inicio=data["periodo_inicio"],
                periodo_fin=data["periodo_fin"],
                jornada_ids=data["jornada_ids"],
                modo_descuento=data.get("modo_descuento", "ninguno"),
                monto_manual=data.get("monto_manual", 0),
                fecha_pago=data["fecha_pago"],
                observaciones=data.get("observaciones", ""),
                registrado_por=request.user,
            )
        except ValueError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(
            LiquidacionSerializer(liq).data,
            status=status.HTTP_201_CREATED,
        )


class MovimientoDeudaViewSet(viewsets.ModelViewSet):
    serializer_class = MovimientoDeudaSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        qs = MovimientoDeuda.objects.select_related(
            "worker",
            "worker__user",
            "worker__user__organization",
            "tipo",
            "registrado_por",
            "liquidacion",
        ).order_by("-fecha")
        if getattr(user, "is_admin_plataforma", False):
            return qs
        if user.organization_id:
            return qs.filter(worker__user__organization_id=user.organization_id)
        if hasattr(user, "worker_profile"):
            return qs.filter(worker_id=user.worker_profile.id)
        return qs.none()

    def perform_create(self, serializer):
        serializer.save(registrado_por=self.request.user)


class PaymentWorkdayDetailViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = PaymentWorkdayDetailSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        # workday_id es BigIntegerField (no FK por dependencia circular),
        # así que NO se puede hacer select_related sobre workday.
        qs = PaymentWorkdayDetail.objects.select_related(
            "payment",
            "payment__organization",
        )
        if getattr(user, "is_admin_plataforma", False):
            return qs
        if user.organization_id:
            return qs.filter(payment__organization_id=user.organization_id)
        return qs.none()


class PaymentLoanDetailViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = PaymentLoanDetailSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        qs = PaymentLoanDetail.objects.select_related(
            "payment",
            "payment__organization",
            "loan",
            "loan__worker",
            "loan__worker__user",
        )
        if getattr(user, "is_admin_plataforma", False):
            return qs
        if user.organization_id:
            return qs.filter(payment__organization_id=user.organization_id)
        return qs.none()
