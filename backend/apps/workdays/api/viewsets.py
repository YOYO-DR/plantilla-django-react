from __future__ import annotations

from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated

from apps.catalogs.models import PaymentStatus
from apps.workdays.models import Workday
from apps.workdays.serializers import WorkdaySerializer


class WorkdayViewSet(viewsets.ModelViewSet):
    serializer_class = WorkdaySerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        qs = (
            Workday.objects.select_related(
                "worker",
                "worker__user",
                "worker__user__organization",
                "workday_type",
                "payment_status",
                "created_by",
            )
            .order_by("-date", "worker_id")
        )
        if getattr(user, "is_admin_plataforma", False):
            return qs
        if user.organization_id:
            return qs.filter(worker__user__organization_id=user.organization_id)
        # Trabajador solo ve lo propio
        if hasattr(user, "worker_profile"):
            return qs.filter(worker_id=user.worker_profile.id)
        return qs.none()

    def perform_create(self, serializer):
        workday_type = serializer.validated_data["workday_type"]
        worker = serializer.validated_data["worker"]
        tariff = serializer.validated_data.get("applied_rate")
        if tariff is None:
            current = (
                worker.rates.filter(is_active=True).order_by("-valid_from").first()
            )
            tariff = current.amount if current else 0
        payment_status, _ = PaymentStatus.objects.get_or_create(
            name="Pendiente", defaults={"order": 0, "is_active": True}
        )
        serializer.save(
            applied_rate=tariff * workday_type.factor,
            payment_status=payment_status,
            created_by=self.request.user,
        )
