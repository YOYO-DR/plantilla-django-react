"""Vistas para admin plataforma: métricas globales + gestión de tenants."""

from __future__ import annotations

from django.db.models import Sum
from rest_framework.decorators import api_view
from rest_framework.decorators import permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.organizations.models import Organization
from apps.payments.models import Liquidacion
from apps.users.models import User
from apps.users.permissions import IsAdminPlataforma
from apps.workdays.models import Workday


@api_view(["GET"])
@permission_classes([IsAuthenticated, IsAdminPlataforma])
def metrics(request):
    """Métricas globales para el dashboard de admin plataforma."""
    qs_workdays = Workday.objects.all()
    qs_liqs = Liquidacion.objects.all()
    return Response(
        {
            "tenants_total": Organization.objects.count(),
            "tenants_active": Organization.objects.filter(is_active=True).count(),
            "users_total": User.objects.count(),
            "maestros_total": User.objects.filter(groups__name="Maestro").count(),
            "trabajadores_total": User.objects.filter(
                groups__name="Trabajador",
            ).count(),
            "workdays_total": qs_workdays.count(),
            "liquidaciones_total": qs_liqs.count(),
            "liquidaciones_monto_total": str(
                qs_liqs.aggregate(t=Sum("total_pagado"))["t"] or 0,
            ),
        },
    )
