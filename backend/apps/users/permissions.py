from __future__ import annotations

from rest_framework.permissions import BasePermission


class IsAdminPlataforma(BasePermission):
    """Solo admin plataforma: is_staff=True y organization_id=None."""

    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        return bool(getattr(request.user, "is_admin_plataforma", False))


class IsSameOrganization(BasePermission):
    """Permite usuarios autenticados cuya organización coincida con obj.organization."""

    def has_object_permission(self, request, view, obj):
        user = request.user
        if not (user and user.is_authenticated):
            return False
        if getattr(user, "is_admin_plataforma", False):
            return True
        obj_org = getattr(obj, "organization_id", None)
        return obj_org and obj_org == getattr(user, "organization_id", None)
