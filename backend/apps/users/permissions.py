"""Permisos DRF de JornalPro.

Reglas:
- ``IsAdminPlataforma``: solo ``is_admin_plataforma`` (is_staff + organization_id=None).
- ``IsMaestro``: solo usuarios en el grupo "Maestro".
- ``IsMaestroOrAdminPlataforma``: o maestro de su org, o admin plataforma.
- ``IsOrganizationMember``: permite si ``request.user.organization_id`` coincide con
  el del objeto. En nivel ``has_object_permission`` lee la organización del
  objeto vía ``obj.organization_id`` o, si no existe, de ``obj.user.organization_id`` o
  ``obj.worker.user.organization_id``.

Todas las clases que filtran por organización devuelven False si el
usuario no está autenticado: las clases de DRF estándar se encargan del
401 cuando no hay ``has_permission`` y la request llega sin auth.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from rest_framework.permissions import BasePermission

if TYPE_CHECKING:
    from .models import User  # pragma: no cover


def _is_admin_plataforma(user) -> bool:
    return bool(getattr(user, "is_admin_plataforma", False))


def _is_in_group(user, name: str) -> bool:
    if not getattr(user, "is_authenticated", False):
        return False
    return user.groups.filter(name=name).exists()


def _is_maestro(user) -> bool:
    return _is_in_group(user, "Maestro")


def _is_trabajador(user) -> bool:
    return _is_in_group(user, "Trabajador")


def _object_organization_id(obj) -> int | None:
    """Devuelve el ``organization_id`` del objeto, transitando relaciones
    cuando el objeto no tiene FK directo a Organization.
    """
    if hasattr(obj, "organization_id") and obj.organization_id is not None:
        return obj.organization_id
    if hasattr(obj, "user") and getattr(obj.user, "organization_id", None) is not None:
        return obj.user.organization_id
    if hasattr(obj, "worker") and hasattr(obj.worker, "user"):
        org_id = getattr(obj.worker.user, "organization_id", None)
        if org_id is not None:
            return org_id
    return None


class IsAdminPlataforma(BasePermission):
    """Solo admin plataforma: ``is_staff`` Y ``organization_id=None``."""

    def has_permission(self, request, view) -> bool:
        user = request.user
        if not (user and user.is_authenticated):
            return False
        return _is_admin_plataforma(user)


class IsMaestro(BasePermission):
    """Solo usuarios del grupo "Maestro"."""

    def has_permission(self, request, view) -> bool:
        user = request.user
        if not (user and user.is_authenticated):
            return False
        return _is_maestro(user)


class IsMaestroOrAdminPlataforma(BasePermission):
    """Lectura accesible a maestro/admin; escritura también."""

    def has_permission(self, request, view) -> bool:
        user = request.user
        if not (user and user.is_authenticated):
            return False
        if _is_admin_plataforma(user):
            return True
        return _is_maestro(user)


class IsOrganizationMember(BasePermission):
    """Bloquea cualquier request cuyo ``request.user.organization`` no
    coincida con el del objeto (object-level).

    Admin plataforma pasa siempre. Maestro y Trabajador: solo si la
    organización del objeto coincide con la suya.
    """

    message = "El objeto solicitado no pertenece a tu organización."

    def has_permission(self, request, view) -> bool:
        user = request.user
        return bool(user and user.is_authenticated)

    def has_object_permission(self, request, view, obj) -> bool:
        user = request.user
        if not (user and user.is_authenticated):
            return False
        if _is_admin_plataforma(user):
            return True
        if not (user.organization_id and getattr(user, "is_authenticated", False)):
            return False
        obj_org = _object_organization_id(obj)
        if obj_org is None:
            return False
        return obj_org == user.organization_id


class IsSameOrganizationUser(BasePermission):
    """Como ``IsOrganizationMember`` pero específico para ``User``."""

    def has_object_permission(self, request, view, obj: User) -> bool:
        user = request.user
        if not (user and user.is_authenticated):
            return False
        if _is_admin_plataforma(user):
            return True
        user_org = getattr(user, "organization_id", None)
        obj_org = getattr(obj, "organization_id", None)
        if not user_org or not obj_org:
            return False
        return user_org == obj_org


class ReadOnlyOrMaestro(BasePermission):
    """GET/HEAD/OPTIONS para cualquiera autenticado (trabajador incluido);
    resto, solo maestro o admin plataforma.
    """

    def has_permission(self, request, view) -> bool:
        user = request.user
        if not (user and user.is_authenticated):
            return False
        if request.method in {"GET", "HEAD", "OPTIONS"}:
            return True
        if _is_admin_plataforma(user):
            return True
        return _is_maestro(user)


class IsMaestroOrWriteOwn(BasePermission):
    """Lectura: cualquiera autenticado. Escritura: maestro/admin/owner.

    Para uso combinado con ``get_queryset`` de cada viewset.
    """

    def has_permission(self, request, view) -> bool:
        user = request.user
        if not (user and user.is_authenticated):
            return False
        if request.method in {"GET", "HEAD", "OPTIONS"}:
            return True
        if _is_admin_plataforma(user) or _is_maestro(user):
            return True
        return _is_trabajador(user)


__all__ = [
    "IsAdminPlataforma",
    "IsMaestro",
    "IsMaestroOrAdminPlataforma",
    "IsMaestroOrWriteOwn",
    "IsOrganizationMember",
    "IsSameOrganizationUser",
    "ReadOnlyOrMaestro",
]
