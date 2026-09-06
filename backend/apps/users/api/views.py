"""ViewSets para ``apps.users``."""

from __future__ import annotations

import secrets

from django.contrib.auth.models import Group
from django.db import transaction
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.mixins import DestroyModelMixin
from rest_framework.mixins import ListModelMixin
from rest_framework.mixins import RetrieveModelMixin
from rest_framework.mixins import UpdateModelMixin
from rest_framework.response import Response
from rest_framework.viewsets import GenericViewSet

from apps.users.models import User
from apps.users.models import WorkerProfile
from apps.users.permissions import IsAdminPlataforma
from apps.users.permissions import IsMaestro
from apps.users.permissions import IsMaestroOrAdminPlataforma
from apps.users.permissions import IsOrganizationMember

from .serializers import UserSerializer
from .serializers import WorkerProfileSerializer


def _gen_password() -> str:
    """Genera una contraseña aleatoria legible (longitud 14)."""
    alphabet = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    return "".join(secrets.choice(alphabet) for _ in range(14))


class UserViewSet(
    RetrieveModelMixin,
    ListModelMixin,
    UpdateModelMixin,
    GenericViewSet,
):
    """Listado/recuperación de usuarios con aislamiento por organización.

    - Admin plataforma ve TODOS.
    - Maestro ve los usuarios de su organización.
    - Trabajador solo ve su propio user.
    """

    serializer_class = UserSerializer
    queryset = User.objects.all().order_by("id")
    permission_classes = [IsAdminPlataforma]

    def get_permissions(self):
        """Lectura: cualquier autenticado. Escritura: solo maestro/admin."""
        if self.request.method in {"GET", "HEAD", "OPTIONS"}:
            return [IsOrganizationMember()]
        return [IsMaestroOrAdminPlataforma()]

    def get_queryset(self):
        user = self.request.user
        if not (user and user.is_authenticated):
            return User.objects.none()
        if getattr(user, "is_admin_plataforma", False):
            return User.objects.all().order_by("id")
        if user.organization_id:
            return User.objects.filter(organization_id=user.organization_id).order_by(
                "id",
            )
        return User.objects.filter(id=user.id)

    def get_object(self):
        """Recuperar un user concreto sin filtrar por id directamente:

        delegamos al ``get_queryset`` para que la búsqueda de la URL
        (``/api/users/{id}/``) ya esté limitada a la organización.
        Si el id pertenece a OTRA organización, DRF levantará 404 al no
        encontrarlo (no 403: no filtramos información).
        """
        return super().get_object()

    @action(
        detail=False,
        methods=["get"],
        permission_classes=[],
        url_path="me",
    )
    def me(self, request):
        serializer = UserSerializer(request.user, context={"request": request})
        return Response(status=status.HTTP_200_OK, data=serializer.data)


class WorkerProfileViewSet(
    ListModelMixin,
    RetrieveModelMixin,
    UpdateModelMixin,
    DestroyModelMixin,
    GenericViewSet,
):
    """CRUD básico para ``WorkerProfile``. Escritura solo maestro/admin."""

    serializer_class = WorkerProfileSerializer
    queryset = WorkerProfile.objects.all().order_by("id")
    permission_classes = [IsMaestro | IsAdminPlataforma]
    http_method_names = ["get", "post", "patch", "delete"]
    filterset_fields = {
        "is_active": ["exact"],
        "hire_date": ["gte", "lte"],
    }
    ordering_fields = ["hire_date", "id"]
    ordering = ["id"]

    def get_queryset(self):
        user = self.request.user
        if not (user and user.is_authenticated):
            return WorkerProfile.objects.none()
        if getattr(user, "is_admin_plataforma", False):
            return WorkerProfile.objects.all().order_by("id")
        return WorkerProfile.objects.filter(
            user__organization_id=user.organization_id,
        ).order_by("id")

    def get_object(self):
        return super().get_object()

    def list(self, request, *args, **kwargs):
        return super().list(request, *args, **kwargs)

    def create(self, request, *args, **kwargs):
        """Alta de Trabajador: crea ``User`` + ``WorkerProfile`` y
        devuelve la contraseña generada en la respuesta POST (una sola
        vez)."""
        serializer = WorkerProfileSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        user_data = data.get("user") or {}
        email = user_data.get("email")
        name = user_data.get("name", "")
        phone = user_data.get("phone", "")
        if not email:
            return Response(
                {"detail": "El campo 'user.email' es obligatorio."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        password = _gen_password()
        user, created = User.objects.get_or_create(
            email=email,
            defaults={
                "name": name,
                "phone": phone,
            },
        )
        if not created:
            # No sobrescribimos password, devolvemos 400.
            return Response(
                {"detail": f"Ya existe un usuario con email {email}."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user.set_password(password)
        # Asignar grupo Trabajador.
        trabajadores = Group.objects.get_or_create(name="Trabajador")[0]
        user.groups.set([trabajadores])
        # Organización del maestro que da el alta.
        org = request.user.organization
        if org is not None:
            user.organization = org
        user.save()

        profile = WorkerProfile.objects.create(
            user=user,
            id_document=data.get("id_document", ""),
            hire_date=data.get("hire_date"),
            is_active=data.get("is_active", True),
        )
        out = WorkerProfileSerializer(profile, context={"request": request}).data
        out["initial_password"] = password
        return Response(out, status=status.HTTP_201_CREATED)

    @action(
        detail=True,
        methods=["post"],
        permission_classes=[IsMaestro | IsAdminPlataforma],
        url_path="reset-password",
    )
    def reset_password(self, request, pk=None):
        """Restablece la contraseña del User asociado. Devuelve la nueva
        contraseña solo en esta respuesta POST.
        """
        worker = self.get_object()
        with transaction.atomic():
            new_password = _gen_password()
            worker.user.set_password(new_password)
            worker.user.save(update_fields=["password"])
        return Response(
            {"worker_id": worker.id, "initial_password": new_password},
            status=status.HTTP_200_OK,
        )
