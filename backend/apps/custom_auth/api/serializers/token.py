from rest_framework_simplejwt.serializers import TokenObtainPairSerializer


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    """Añade los datos del usuario a la respuesta del login."""

    def validate(self, attrs):
        data = super().validate(attrs)

        user = self.user
        data["user"] = {
            "id": user.id,
            "email": user.email,
            "name": getattr(user, "name", "") or "",
            "username": getattr(user, "username", None),
            "groups": list(user.groups.values_list("name", flat=True)),
            "organization_id": getattr(user, "organization_id", None),
            "is_staff": user.is_staff,
            "is_superuser": user.is_superuser,
            "is_admin_plataforma": bool(
                getattr(user, "is_staff", False)
                and getattr(user, "organization_id", None) is None,
            ),
            "worker_profile_id": getattr(
                getattr(user, "worker_profile", None),
                "id",
                None,
            ),
        }
        return data
