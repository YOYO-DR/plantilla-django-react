"""ViewSets para ``apps.organizations``.

Lectura: cualquier usuario autenticado, acotada por su organización
(excepto admin plataforma que ve todas).
Escritura: solo admin plataforma. Un maestro o trabajador
**NO** puede crear, modificar ni eliminar organizaciones.
"""

from __future__ import annotations

from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated

from apps.organizations.models import Organization
from apps.organizations.serializers import OrganizationSerializer
from apps.users.permissions import IsAdminPlataforma


class OrganizationViewSet(viewsets.ModelViewSet):
    serializer_class = OrganizationSerializer

    def get_queryset(self):
        """Admin plataforma ve TODAS; el resto solo su propia organización."""
        qs = Organization.objects.all()
        user = self.request.user
        if not (user and user.is_authenticated):
            return qs.none()
        if getattr(user, "is_admin_plataforma", False):
            return qs
        org_id = getattr(user, "organization_id", None)
        if org_id:
            return qs.filter(id=org_id)
        return qs.none()

    def get_permissions(self):
        """Escritura solo admin plataforma; lectura autenticado."""
        if self.request.method in {"GET", "HEAD", "OPTIONS"}:
            return [IsAuthenticated()]
        return [IsAdminPlataforma()]
