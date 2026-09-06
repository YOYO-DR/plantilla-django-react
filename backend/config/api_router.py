from django.conf import settings
from rest_framework.routers import DefaultRouter
from rest_framework.routers import SimpleRouter

from apps.admin_platforma.urls import urlpatterns as admin_urls
from apps.catalogs.api.router import urlpatterns as catalogs_urls
from apps.custom_auth.api.router import urlpatterns as auth_urls
from apps.organizations.api.router import urlpatterns as organizations_urls
from apps.payments.api.router import urlpatterns as payments_urls
from apps.users.api.views import UserViewSet
from apps.users.api.views import WorkerProfileViewSet
from apps.workdays.api.router import urlpatterns as workdays_urls

router = DefaultRouter() if settings.DEBUG else SimpleRouter()

router.register("users", UserViewSet)
router.register("workers", WorkerProfileViewSet, basename="worker")


app_name = "api"
urlpatterns = (
    router.urls
    + auth_urls
    + catalogs_urls
    + organizations_urls
    + workdays_urls
    + payments_urls
    + admin_urls
)
