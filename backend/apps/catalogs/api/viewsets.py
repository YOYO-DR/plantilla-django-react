from __future__ import annotations

from django.db.models import Q
from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated

from apps.catalogs.models import (
    WorkdayType,
    PaymentStatus,
    TipoMovimientoDeuda,
    PaymentMethod,
)
from apps.catalogs.serializers import (
    WorkdayTypeSerializer,
    PaymentStatusSerializer,
    TipoMovimientoDeudaSerializer,
    PaymentMethodSerializer,
)


class WorkdayTypeViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = WorkdayTypeSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        org_id = getattr(self.request.user, "organization_id", None)
        if org_id:
            return (
                WorkdayType.objects.filter(
                    Q(organization_id=org_id) | Q(organization__isnull=True)
                )
                .select_related("organization")
                .order_by("order", "name")
            )
        return (
            WorkdayType.objects.filter(organization__isnull=True)
            .select_related("organization")
            .order_by("order", "name")
        )


class PaymentStatusViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = PaymentStatusSerializer
    permission_classes = [IsAuthenticated]
    queryset = PaymentStatus.objects.filter(is_active=True).order_by("order", "name")


class TipoMovimientoDeudaViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = TipoMovimientoDeudaSerializer
    permission_classes = [IsAuthenticated]
    queryset = TipoMovimientoDeuda.objects.filter(is_active=True).order_by("order", "name")


class PaymentMethodViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = PaymentMethodSerializer
    permission_classes = [IsAuthenticated]
    queryset = PaymentMethod.objects.filter(is_active=True).order_by("order", "name")
