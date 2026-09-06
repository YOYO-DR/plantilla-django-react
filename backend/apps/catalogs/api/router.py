from rest_framework.routers import DefaultRouter

from .viewsets import (
    WorkdayTypeViewSet,
    PaymentStatusViewSet,
    TipoMovimientoDeudaViewSet,
    PaymentMethodViewSet,
)

router = DefaultRouter()
router.register("catalogs/workday-types", WorkdayTypeViewSet, basename="workday-type")
router.register("catalogs/payment-statuses", PaymentStatusViewSet, basename="payment-status")
router.register("catalogs/tipos-movimiento-deuda", TipoMovimientoDeudaViewSet, basename="tipo-movimiento-deuda")
router.register("catalogs/payment-methods", PaymentMethodViewSet, basename="payment-method")

urlpatterns = router.urls
