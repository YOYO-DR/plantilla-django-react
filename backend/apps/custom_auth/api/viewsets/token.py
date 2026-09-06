import contextlib

from django.conf import settings
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import InvalidToken
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.views import TokenRefreshView

from apps.custom_auth.api.serializers.token import CustomTokenObtainPairSerializer


class CustomTokenObtainPairView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer

    def post(self, request, *args, **kwargs):
        response = super().post(request, *args, **kwargs)

        if response.status_code == status.HTTP_200_OK:
            refresh_token = response.data.get("refresh")

            if refresh_token:
                response.set_cookie(
                    key=settings.JWT_COOKIE_NAME,
                    value=refresh_token,
                    httponly=settings.JWT_COOKIE_HTTP_ONLY,
                    secure=settings.JWT_COOKIE_SECURE,
                    samesite=settings.JWT_COOKIE_SAMESITE,
                    max_age=int(
                        settings.SIMPLE_JWT["REFRESH_TOKEN_LIFETIME"].total_seconds(),
                    ),
                )
                if "refresh" in response.data:
                    del response.data["refresh"]
        return response


class CookieTokenRefreshView(TokenRefreshView):
    def post(self, request, *args, **kwargs):
        refresh_token = request.COOKIES.get(settings.JWT_COOKIE_NAME)

        data = request.data
        if hasattr(data, "dict"):
            data = data.dict()
        elif isinstance(data, dict):
            # ``ReturnDict`` de DRF es subclase de dict; el ``.copy()``
            # defensivo existe para no mutar el body original si fuera
            # un dict compartido. En la práctica no se observa en tests
            # porque DRF construye un dict nuevo por request.
            data = data.copy()  # pragma: no cover
        else:
            # Defensivo: DRF normaliza el body a dict o QueryDict antes
            # de llegar aquí. Esta rama solo se alcanza si alguien pasa
            # un body crudo que bypasea los parsers, lo que la suite de
            # tests de DRF cubre por nosotros.
            data = {}  # pragma: no cover

        if refresh_token:
            data["refresh"] = refresh_token

        serializer = self.get_serializer(data=data)

        try:
            serializer.is_valid(raise_exception=True)
        except (InvalidToken, TokenError) as e:
            response = Response({"detail": str(e)}, status=status.HTTP_401_UNAUTHORIZED)
            if refresh_token:
                response.delete_cookie(settings.JWT_COOKIE_NAME)
            return response

        token_data = serializer.validated_data
        response = Response(token_data, status=status.HTTP_200_OK)

        if response.status_code == status.HTTP_200_OK:
            if "refresh" in response.data:
                response.set_cookie(
                    key=settings.JWT_COOKIE_NAME,
                    value=response.data["refresh"],
                    httponly=settings.JWT_COOKIE_HTTP_ONLY,
                    secure=settings.JWT_COOKIE_SECURE,
                    samesite=settings.JWT_COOKIE_SAMESITE,
                    max_age=int(
                        settings.SIMPLE_JWT["REFRESH_TOKEN_LIFETIME"].total_seconds(),
                    ),
                )
                del response.data["refresh"]
        return response


class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, *args, **kwargs):
        refresh = request.COOKIES.get(settings.JWT_COOKIE_NAME) or request.data.get(
            "refresh",
        )
        if refresh:
            with contextlib.suppress(InvalidToken, TokenError):
                RefreshToken(refresh).blacklist()
        response = Response({"detail": "Sesión cerrada."})
        response.delete_cookie(settings.JWT_COOKIE_NAME, path="/")
        return response


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        groups = list(user.groups.values_list("name", flat=True))
        # ``worker_profile`` es el ``related_name`` del OneToOneField
        # User → WorkerProfile. ``getattr`` con default ``None`` evita
        # una query cuando el usuario no tiene perfil (maestros,
        # admins de plataforma) y mantiene el contrato: ``null`` cuando
        # no aplica.
        worker_profile = getattr(user, "worker_profile", None)
        return Response(
            {
                "id": user.id,
                # ``name`` es el nombre legible del usuario (campo
                # ``name`` del modelo ``User``; ``first_name``/
                # ``last_name`` están deshabilitados en este proyecto).
                "name": user.name,
                "email": user.email,
                "groups": groups,
                "organization_id": user.organization_id,
                "worker_profile_id": worker_profile.id if worker_profile else None,
                "is_staff": user.is_staff,
                "is_superuser": user.is_superuser,
                # ``username`` se omite a propósito: el modelo ``User``
                # de este proyecto tiene ``username = None`` (USERNAME_FIELD
                # es ``email``). Devolver siempre ``null`` era ruido
                # permanente para el cliente. Si en el futuro se
                # reactiva el campo, añadirlo aquí con un test.
            },
        )
