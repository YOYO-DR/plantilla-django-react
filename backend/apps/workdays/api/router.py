from rest_framework.routers import DefaultRouter

from .viewsets import WorkdayViewSet

router = DefaultRouter()
router.register("workdays", WorkdayViewSet, basename="workday")

urlpatterns = router.urls
