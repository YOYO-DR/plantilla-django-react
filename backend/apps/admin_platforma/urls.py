"""URLs del admin plataforma."""

from __future__ import annotations

from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import metrics

router = DefaultRouter()

urlpatterns = [
    path("metrics/", metrics, name="admin-platforma-metrics"),
    *router.urls,
]
