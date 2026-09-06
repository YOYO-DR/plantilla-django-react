"""Router de catálogos."""

from rest_framework.routers import DefaultRouter

from .viewsets import LoanStatusViewSet
from .viewsets import PaymentMethodViewSet
from .viewsets import PaymentStatusViewSet
from .viewsets import WorkdayTypeViewSet

router = DefaultRouter()
router.register("catalogs/workday-types", WorkdayTypeViewSet, basename="workday-type")
router.register(
    "catalogs/payment-statuses",
    PaymentStatusViewSet,
    basename="payment-status",
)
router.register("catalogs/loan-statuses", LoanStatusViewSet, basename="loan-status")
router.register(
    "catalogs/payment-methods",
    PaymentMethodViewSet,
    basename="payment-method",
)

urlpatterns = router.urls
