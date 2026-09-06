"""Tests for SimpleJWT auth endpoints with HttpOnly refresh cookie."""

# ruff: noqa: S106, PLR2004
import pytest


@pytest.fixture
def user_with_password(django_user_model):
    return django_user_model.objects.create_user(
        email="testuser@jornalpro.dev",
        password="testpass123",
    )


@pytest.mark.django_db
def test_login_succeeds_and_sets_cookie(client, user_with_password):
    """El `refresh` solo se entrega vía cookie HttpOnly (no en el body)."""
    resp = client.post(
        "/api/auth/token",
        {"email": "testuser@jornalpro.dev", "password": "testpass123"},
        format="json",
    )
    assert resp.status_code == 200
    assert "access" in resp.data
    assert "user" in resp.data
    assert "refresh" not in resp.data  # solo en cookie
    assert resp.cookies.get("refresh_token")
    assert resp.cookies["refresh_token"]["httponly"]


@pytest.mark.django_db
def test_login_wrong_password(client, user_with_password):
    resp = client.post(
        "/api/auth/token",
        {"email": "testuser@jornalpro.dev", "password": "wrong"},
        format="json",
    )
    assert resp.status_code == 401


@pytest.mark.django_db
def test_refresh_via_cookie(client, user_with_password):
    client.post(
        "/api/auth/token",
        {"email": "testuser@jornalpro.dev", "password": "testpass123"},
        format="json",
    )
    # La cookie refresh_token ya está en client.cookies de la respuesta anterior.
    resp = client.post(
        "/api/auth/token/refresh",
        {},
        format="json",
    )
    assert resp.status_code == 200
    assert "access" in resp.data


@pytest.mark.django_db
def test_logout_returns_200(client, user_with_password):
    """Logout responde OK; blacklist tolera refresh faltante."""
    login = client.post(
        "/api/auth/token",
        {"email": "testuser@jornalpro.dev", "password": "testpass123"},
        format="json",
    )
    access = login.data["access"]
    resp = client.post(
        "/api/auth/logout",
        {},
        format="json",
        HTTP_AUTHORIZATION=f"Bearer {access}",
    )
    assert resp.status_code == 200


@pytest.mark.django_db
def test_me_requires_auth(client):
    resp = client.get("/api/auth/me")
    assert resp.status_code == 401


@pytest.mark.django_db
def test_me_returns_user_info(client, user_with_password):
    login = client.post(
        "/api/auth/token",
        {"email": "testuser@jornalpro.dev", "password": "testpass123"},
        format="json",
    )
    access = login.data["access"]
    # Pasamos el access token en header HTTP_AUTHORIZATION
    resp = client.get("/api/auth/me", HTTP_AUTHORIZATION=f"Bearer {access}")
    assert resp.status_code == 200
    assert resp.data["email"] == "testuser@jornalpro.dev"
