"""Serializers DRF de ``apps.users``.

`UserSerializer` y `WorkerProfileSerializer` solo exponen campos seguros.
La contraseña generada solo aparece en la respuesta POST del endpoint
que crea Trabajador (no en GET nunca).
"""

from __future__ import annotations

from rest_framework import serializers

from apps.users.models import User
from apps.users.models import WorkerProfile


class UserSerializer(serializers.ModelSerializer):
    groups = serializers.SerializerMethodField()
    organization_id = serializers.IntegerField(read_only=True, allow_null=True)
    is_admin_plataforma = serializers.BooleanField(read_only=True)

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
            "date_joined",
        ]
        read_only_fields = [
            "id",
            "date_joined",
            "is_staff",
            "is_superuser",
            "is_admin_plataforma",
            "groups",
            "password",  # nunca se expone.
        ]

    def get_groups(self, obj):
        return list(obj.groups.values_list("name", flat=True))


class WorkerProfileSerializer(serializers.ModelSerializer):
    user = UserSerializer(required=False)

    class Meta:
        model = WorkerProfile
        fields = ["id", "user", "id_document", "hire_date", "is_active"]
        read_only_fields = ["id"]
