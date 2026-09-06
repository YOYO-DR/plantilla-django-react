"""Tests for SimpleJWT auth endpoints with HttpOnly refresh cookie."""

# ruff: noqa: S106
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


# =====================================================================
# MeView: organization_id real + worker_profile_id
# =====================================================================


@pytest.fixture
def org_and_users(db, django_user_model):
    """Crea una org con un maestro, un trabajador y un admin plataforma."""
    from apps.organizations.tests.factories import OrganizationFactory
    from apps.users.tests.factories import WorkerProfileFactory

    org = OrganizationFactory(name="Org MeView")
    trabajador, _ = django_user_model.objects.get_or_create(
        email="trabajador@me.local",
    )
    trabajador.set_password("pw-12345678")
    trabajador.save()
    from django.contrib.auth.models import Group

    g_t, _ = Group.objects.get_or_create(name="Trabajador")
    trabajador.groups.add(g_t)
    trabajador.organization = org
    trabajador.save()
    profile = WorkerProfileFactory(user=trabajador)

    maestro, _ = django_user_model.objects.get_or_create(
        email="maestro@me.local",
    )
    maestro.set_password("pw-12345678")
    maestro.save()
    g_m, _ = Group.objects.get_or_create(name="Maestro")
    maestro.groups.add(g_m)
    maestro.organization = org
    maestro.save()

    admin, _ = django_user_model.objects.get_or_create(
        email="admin@me.local",
        defaults={"is_staff": True, "organization": None},
    )
    admin.is_staff = True
    admin.organization = None
    admin.set_password("pw-12345678")
    admin.save()

    return {
        "org": org,
        "trabajador": trabajador,
        "profile": profile,
        "maestro": maestro,
        "admin": admin,
    }


def _login(client, email):
    login = client.post(
        "/api/auth/token",
        {"email": email, "password": "pw-12345678"},
        format="json",
    )
    return login.data["access"]


@pytest.mark.django_db
def test_me_worker_profile_id_for_trabajador(client, org_and_users):
    access = _login(client, "trabajador@me.local")
    resp = client.get("/api/auth/me", HTTP_AUTHORIZATION=f"Bearer {access}")
    assert resp.status_code == 200
    assert resp.data["worker_profile_id"] == org_and_users["profile"].id
    assert resp.data["organization_id"] == org_and_users["org"].id


@pytest.mark.django_db
def test_me_worker_profile_id_null_for_maestro(client, org_and_users):
    access = _login(client, "maestro@me.local")
    resp = client.get("/api/auth/me", HTTP_AUTHORIZATION=f"Bearer {access}")
    assert resp.status_code == 200
    assert resp.data["worker_profile_id"] is None
    # El bug original: organization_id venía hardcodeado a None.
    # Este assert es el que detecta la regresión.
    assert resp.data["organization_id"] == org_and_users["org"].id


@pytest.mark.django_db
def test_me_worker_profile_id_null_for_admin_plataforma(client, org_and_users):
    access = _login(client, "admin@me.local")
    resp = client.get("/api/auth/me", HTTP_AUTHORIZATION=f"Bearer {access}")
    assert resp.status_code == 200
    assert resp.data["worker_profile_id"] is None
    assert resp.data["organization_id"] is None
    assert resp.data["is_staff"] is True
