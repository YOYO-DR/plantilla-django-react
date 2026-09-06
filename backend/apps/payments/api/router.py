from rest_framework.routers import DefaultRouter

from .viewsets import LiquidacionViewSet
from .viewsets import MovimientoDeudaViewSet
from .viewsets import PaymentLoanDetailViewSet
from .viewsets import PaymentWorkdayDetailViewSet

router = DefaultRouter()
router.register("liquidaciones", LiquidacionViewSet, basename="liquidacion")
router.register(
    "movimientos-deuda",
    MovimientoDeudaViewSet,
    basename="movimiento-deuda",
)
router.register(
    "payment-workday-details",
    PaymentWorkdayDetailViewSet,
    basename="payment-workday-detail",
)
router.register(
    "payment-loan-details",
    PaymentLoanDetailViewSet,
    basename="payment-loan-detail",
)

urlpatterns = router.urls
