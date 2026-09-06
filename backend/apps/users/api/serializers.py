"""Serializers DRF de ``apps.users``.

`UserSerializer` y `WorkerProfileSerializer` solo exponen campos seguros.
La contraseña generada solo aparece en la respuesta POST del endpoint
que crea Trabajador (no en GET nunca).
"""

from __future__ import annotations

from django.contrib.auth.models import Group
from rest_framework import serializers

from apps.users.models import User
from apps.users.models import WorkerProfile

# Grupos permitidos para asignación via API. AdminPlataforma/Staff
# quedan fuera porque no se asignan por este endpoint (se crean
# en la creación del usuario vía ``is_staff``).
ALLOWED_API_GROUPS = ("Maestro", "Trabajador")


class UserSerializer(serializers.ModelSerializer):
    """Serializer de User con ``groups`` escribible (validado).

    Solo maestro o admin plataforma pueden escribir ``groups`` por
    este endpoint; el viewset valida el permiso, el serializer
    valida que el conjunto de grupos pertenezca a ``ALLOWED_API_GROUPS``.

    El campo ``groups`` es write-only: lo que llega en el body se valida
    y aplica con ``groups.set()``. La representación de salida usa
    ``groups_display`` con la lista de nombres legible.
    """

    groups = serializers.ListField(
        child=serializers.CharField(),
        required=False,
        write_only=True,
    )
    groups_display = serializers.SerializerMethodField()
    organization_id = serializers.IntegerField(read_only=True, allow_null=True)
    is_admin_plataforma = serializers.BooleanField(read_only=True)

    def get_groups_display(self, obj):
        return list(obj.groups.values_list("name", flat=True))

    class Meta:
        model = User
        fields = [
            "id",
            "email",
            "name",
            "phone",
            "organization_id",
            "is_active",
            "is_staff",
            "is_superuser",
            "is_admin_plataforma",
            "groups",
            "groups_display",
            "date_joined",
        ]
        read_only_fields = [
            "id",
            "date_joined",
            "is_staff",
            "is_superuser",
            "is_admin_plataforma",
            "groups_display",
            "password",  # nunca se expone.
        ]

    def validate_groups(self, value):
        unknown = set(value) - set(ALLOWED_API_GROUPS)
        if unknown:
            msg = (
                f"Grupos no permitidos: {sorted(unknown)}. "
                f"Solo se aceptan: {ALLOWED_API_GROUPS}."
            )
            raise serializers.ValidationError(msg)
        return list(value)

    def update(self, instance, validated_data):
        """Si llegan ``groups`` en el body, sincroniza la membresía.

        El campo ``groups`` es write-only; aquí validamos y aplicamos
        tras la actualización de los demás campos.
        """
        groups = validated_data.pop("groups", None)
        instance = super().update(instance, validated_data)
        if groups is not None:
            group_objs = [Group.objects.get_or_create(name=name)[0] for name in groups]
            instance.groups.set(group_objs)
        return instance


class WorkerProfileSerializer(serializers.ModelSerializer):
    user = UserSerializer(required=False)

    class Meta:
        model = WorkerProfile
        fields = ["id", "user", "id_document", "hire_date", "is_active"]
        read_only_fields = ["id"]
