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
            "groups",
            "is_admin_plataforma",
        ]

    def get_groups(self, obj):
        return list(obj.groups.values_list("name", flat=True))


class WorkerProfileSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    worker_id = serializers.IntegerField(source="id", read_only=True)

    class Meta:
        model = WorkerProfile
        fields = ["worker_id", "user", "id_document", "hire_date", "is_active"]
