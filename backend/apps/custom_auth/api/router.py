from django.conf import settings
from django.urls import path
from rest_framework.routers import DefaultRouter
from rest_framework.routers import SimpleRouter

from .viewsets.token import CookieTokenRefreshView
from .viewsets.token import CustomTokenObtainPairView
from .viewsets.token import LogoutView
from .viewsets.token import MeView

router = DefaultRouter() if settings.DEBUG else SimpleRouter()

urlpatterns = [
    *router.urls,
    path("auth/token", CustomTokenObtainPairView.as_view(), name="obtain_pair_token"),
    path("auth/token/", CustomTokenObtainPairView.as_view(), name="obtain_pair_token_slash"),
    path("auth/token/refresh", CookieTokenRefreshView.as_view(), name="refresh_token"),
    path("auth/token/refresh/", CookieTokenRefreshView.as_view(), name="refresh_token_slash"),
    path("auth/logout", LogoutView.as_view(), name="logout"),
    path("auth/logout/", LogoutView.as_view(), name="logout_slash"),
    path("auth/me", MeView.as_view(), name="me"),
    path("auth/me/", MeView.as_view(), name="me_slash"),
]
