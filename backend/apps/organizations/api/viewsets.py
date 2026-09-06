from __future__ import annotations

from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated

from apps.organizations.models import Organization
from apps.organizations.serializers import OrganizationSerializer


class OrganizationViewSet(viewsets.ModelViewSet):
    serializer_class = OrganizationSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        # Solo el admin plataforma (is_staff=True sin organization) lista TODAS.
        # Los demás ven solo su propia organización.
        qs = Organization.objects.all()
        user = self.request.user
        if user.is_staff and not hasattr(user, "worker_profile"):
            return qs  # plataforma
        # Filtrar por la organización del usuario si la tiene.
        org_id = getattr(user, "organization_id", None)
        if org_id:
            return qs.filter(id=org_id)
        return qs.none()
