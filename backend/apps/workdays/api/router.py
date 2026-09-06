"""Router para ``apps.workdays``."""

from rest_framework.routers import DefaultRouter

from .viewsets import WorkdayViewSet
from .viewsets import WorkerRateViewSet

router = DefaultRouter()
router.register("workdays", WorkdayViewSet, basename="workday")
router.register(
    "worker-rates",
    WorkerRateViewSet,
    basename="worker-rate",
)

urlpatterns = router.urls
