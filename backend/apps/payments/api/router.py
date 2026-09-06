"""Router de ``apps.payments``."""

from django.urls import path
from rest_framework.routers import DefaultRouter

from .viewsets import LoanViewSet
from .viewsets import PaymentViewSet
from .viewsets import WorkerBalanceView

router = DefaultRouter()
router.register("loans", LoanViewSet, basename="loan")
router.register("payments", PaymentViewSet, basename="payment")

urlpatterns = [
    path(
        "workers/<int:worker_id>/balance/",
        WorkerBalanceView.as_view(),
        name="worker-balance",
    ),
    *router.urls,
]
