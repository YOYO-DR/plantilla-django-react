from __future__ import annotations

from typing import TYPE_CHECKING

import pytest
from rest_framework.test import APIRequestFactory

from apps.users.api.views import UserViewSet

if TYPE_CHECKING:
    from apps.users.models import User


class TestUserViewSet:
    @pytest.fixture
    def api_rf(self) -> APIRequestFactory:
        return APIRequestFactory()

    def test_get_queryset(self, user: User, api_rf: APIRequestFactory):
        view = UserViewSet()
        request = api_rf.get("/fake-url/")
        request.user = user

        view.request = request

        assert user in view.get_queryset()

    def test_me(self, user: User, api_rf: APIRequestFactory):
        view = UserViewSet()
        request = api_rf.get("/fake-url/")
        request.user = user

        view.request = request

        response = view.me(request)  # type: ignore[misc,call-arg,arg-type]

        # UserSerializer expone id, email, name, phone, organization_id,
        # is_staff, is_superuser, is_admin_plataforma, groups, date_joined.
        assert response.data["id"] == user.pk
        assert response.data["email"] == user.email
        assert response.data["name"] == user.name
