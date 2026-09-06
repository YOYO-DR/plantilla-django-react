from rest_framework.routers import DefaultRouter

from .viewsets import OrganizationViewSet

router = DefaultRouter()
router.register("organizations", OrganizationViewSet, basename="organization")

urlpatterns = router.urls
