"""ViewSets para catálogos."""

from __future__ import annotations

from django.db.models import Q
from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated

from apps.catalogs.models import LoanStatus
from apps.catalogs.models import PaymentMethod
from apps.catalogs.models import PaymentStatus
from apps.catalogs.models import WorkdayType
from apps.catalogs.serializers import LoanStatusSerializer
from apps.catalogs.serializers import PaymentMethodSerializer
from apps.catalogs.serializers import PaymentStatusSerializer
from apps.catalogs.serializers import WorkdayTypeSerializer


class WorkdayTypeViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = WorkdayTypeSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        org_id = getattr(self.request.user, "organization_id", None)
        if org_id:
            return (
                WorkdayType.objects.filter(
                    Q(organization_id=org_id) | Q(organization__isnull=True),
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


class LoanStatusViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = LoanStatusSerializer
    permission_classes = [IsAuthenticated]
    queryset = LoanStatus.objects.filter(is_active=True).order_by("order", "name")


class PaymentMethodViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = PaymentMethodSerializer
    permission_classes = [IsAuthenticated]
    queryset = PaymentMethod.objects.filter(is_active=True).order_by("order", "name")
