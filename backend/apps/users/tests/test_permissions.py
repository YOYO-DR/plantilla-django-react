"""Cobertura 100% de ``apps.users.permissions``."""

from __future__ import annotations

import pytest

from apps.users.models import User
from apps.users.permissions import IsAdminPlataforma
from apps.users.permissions import IsMaestro
from apps.users.permissions import IsMaestroOrAdminPlataforma
from apps.users.permissions import IsMaestroOrWriteOwn
from apps.users.permissions import IsOrganizationMember
from apps.users.permissions import IsSameOrganizationUser
from apps.users.permissions import ReadOnlyOrMaestro
from apps.users.tests.factories import UserFactory

# Helpers --------------------------------------------------------------


def _stub_request(user, method: str = "GET"):
    """Construye un request minimalista con ``user`` y ``method``."""
    class R:
        pass
    r = R()
    r.user = user
    r.method = method
    return r


def _stub_view(action: str = "list") -> object:
    """Construye una view con acción."""
    class V:
        pass
    v = V()
    v.action = action
    return v


@pytest.fixture
def admin_plataforma():
    return User.objects.create_user(
        email="admin@x.com",
        password="x",  # noqa: S106 - fixture de tests
        name="Admin P",
        is_staff=True,
        organization=None,
    )


@pytest.fixture
def org_a():
    from apps.organizations.tests.factories import OrganizationFactory  # noqa: PLC0415
    return OrganizationFactory(name="Org A")


@pytest.fixture
def org_b():
    from apps.organizations.tests.factories import OrganizationFactory  # noqa: PLC0415
    return OrganizationFactory(name="Org B")


@pytest.fixture
def maestro_org_a(org_a):
    from django.contrib.auth.models import Group  # noqa: PLC0415
    user = UserFactory(organization=org_a)
    user.groups.add(Group.objects.get_or_create(name="Maestro")[0])
    return user


@pytest.fixture
def maestro_org_b(org_b):
    from django.contrib.auth.models import Group  # noqa: PLC0415
    user = UserFactory(organization=org_b)
    user.groups.add(Group.objects.get_or_create(name="Maestro")[0])
    return user


@pytest.fixture
def trabajador_org_a(org_a):
    from django.contrib.auth.models import Group  # noqa: PLC0415
    user = UserFactory(organization=org_a)
    user.groups.add(Group.objects.get_or_create(name="Trabajador")[0])
    return user


# IsAdminPlataforma -----------------------------------------------------


@pytest.mark.django_db
def test_is_admin_plataforma_passes_for_admin(admin_plataforma):
    perm = IsAdminPlataforma()
    assert perm.has_permission(_stub_request(admin_plataforma), _stub_view()) is True


@pytest.mark.django_db
def test_is_admin_plataforma_rejects_maestro(maestro_org_a):
    perm = IsAdminPlataforma()
    assert perm.has_permission(_stub_request(maestro_org_a), _stub_view()) is False


@pytest.mark.django_db
def test_is_admin_plataforma_rejects_trabajador(trabajador_org_a):
    perm = IsAdminPlataforma()
    assert perm.has_permission(_stub_request(trabajador_org_a), _stub_view()) is False


@pytest.mark.django_db
def test_is_admin_plataforma_rejects_anonymous():
    from django.contrib.auth.models import AnonymousUser  # noqa: PLC0415
    perm = IsAdminPlataforma()
    assert perm.has_permission(_stub_request(AnonymousUser()), _stub_view()) is False


# IsMaestro -------------------------------------------------------------


@pytest.mark.django_db
def test_is_maestro_passes_for_maestro(maestro_org_a):
    from django.contrib.auth.models import Group  # noqa: PLC0415
    maestro_org_a.groups.add(Group.objects.get_or_create(name="Maestro")[0])
    perm = IsMaestro()
    assert perm.has_permission(_stub_request(maestro_org_a), _stub_view()) is True


@pytest.mark.django_db
def test_is_maestro_rejects_trabajador(trabajador_org_a):
    perm = IsMaestro()
    assert perm.has_permission(_stub_request(trabajador_org_a), _stub_view()) is False


@pytest.mark.django_db
def test_is_maestro_rejects_anonymous():
    from django.contrib.auth.models import AnonymousUser  # noqa: PLC0415
    perm = IsMaestro()
    assert perm.has_permission(_stub_request(AnonymousUser()), _stub_view()) is False


@pytest.mark.django_db
def test_is_maestro_or_admin_anonymous_denied():
    from django.contrib.auth.models import AnonymousUser  # noqa: PLC0415
    perm = IsMaestroOrAdminPlataforma()
    assert perm.has_permission(_stub_request(AnonymousUser()), _stub_view()) is False


def test_is_in_group_internal_with_anonymous():
    """Cubre la rama `_is_in_group` con usuario ``AnonymousUser``."""
    from django.contrib.auth.models import AnonymousUser  # noqa: PLC0415

    from apps.users.permissions import _is_in_group  # noqa: PLC0415

    assert _is_in_group(AnonymousUser(), "Maestro") is False


def test_object_organization_id_returns_none_when_no_attrs():
    """Cubre ``_object_organization_id`` con obj sin ninguno de los attrs."""

    class NoAttrs:
        pass
    from apps.users.permissions import _object_organization_id  # noqa: PLC0415

    assert _object_organization_id(NoAttrs()) is None


def test_object_organization_id_falls_through_to_none_on_unset_attrs():
    """Cubre el camino ``hasattr(obj, x) True`` pero con valor None."""

    class StubUser:
        organization_id = None

    class Obj:
        user = StubUser()
    from apps.users.permissions import _object_organization_id  # noqa: PLC0415

    assert _object_organization_id(Obj()) is None


@pytest.mark.django_db
def test_is_org_member_object_org_none_with_user_in_org():
    """El obj sin org detectable Y el user tiene organización → denegado."""
    perm = IsOrganizationMember()
    from apps.organizations.tests.factories import OrganizationFactory  # noqa: PLC0415

    org2 = OrganizationFactory(name="Org sólo para obj-none")
    user = UserFactory(organization=org2)

    class StubUser:
        organization_id = None

    class Obj:
        # Forzar el path: hasattr(organization_id) es True con valor None.
        organization_id = None
        user = StubUser()

    obj = Obj()
    assert perm.has_object_permission(
        _stub_request(user), _stub_view(), obj,
    ) is False


def test_is_same_org_user_anonymous_denied():
    from django.contrib.auth.models import AnonymousUser  # noqa: PLC0415
    perm = IsSameOrganizationUser()

    class U:
        organization_id = 1

    obj = U()
    assert perm.has_object_permission(
        _stub_request(AnonymousUser()), _stub_view(), obj,
    ) is False


# IsMaestroOrAdminPlataforma -------------------------------------------


@pytest.mark.django_db
def test_is_maestro_or_admin_passes_admin(admin_plataforma):
    perm = IsMaestroOrAdminPlataforma()
    assert perm.has_permission(_stub_request(admin_plataforma), _stub_view()) is True


@pytest.mark.django_db
def test_is_maestro_or_admin_passes_maestro(maestro_org_a):
    from django.contrib.auth.models import Group  # noqa: PLC0415
    maestro_org_a.groups.add(Group.objects.get_or_create(name="Maestro")[0])
    perm = IsMaestroOrAdminPlataforma()
    assert perm.has_permission(_stub_request(maestro_org_a), _stub_view()) is True


@pytest.mark.django_db
def test_is_maestro_or_admin_rejects_trabajador(trabajador_org_a):
    perm = IsMaestroOrAdminPlataforma()
    assert perm.has_permission(_stub_request(trabajador_org_a), _stub_view()) is False


# IsOrganizationMember -------------------------------------------------


@pytest.mark.django_db
def test_is_org_member_has_permission_anonymous():
    from django.contrib.auth.models import AnonymousUser  # noqa: PLC0415
    perm = IsOrganizationMember()
    assert perm.has_permission(_stub_request(AnonymousUser()), _stub_view()) is False


@pytest.mark.django_db
def test_is_org_member_has_permission_authenticated(maestro_org_a):
    perm = IsOrganizationMember()
    assert perm.has_permission(_stub_request(maestro_org_a), _stub_view()) is True


@pytest.mark.django_db
def test_is_org_member_object_direct_org_attr(admin_plataforma, org_a, maestro_org_a):
    """Objeto con ``organization_id`` directo, admin plataforma pasa."""
    perm = IsOrganizationMember()

    class Obj:
        organization_id = org_a.id
    obj = Obj()
    assert perm.has_object_permission(
        _stub_request(admin_plataforma), _stub_view(), obj,
    ) is True


@pytest.mark.django_db
def test_is_org_member_object_direct_org_match(admin_plataforma, org_a, maestro_org_a):
    perm = IsOrganizationMember()

    class Obj:
        organization_id = org_a.id
    obj = Obj()
    assert perm.has_object_permission(
        _stub_request(maestro_org_a), _stub_view(), obj,
    ) is True


@pytest.mark.django_db
def test_is_org_member_object_direct_org_mismatch(admin_plataforma, org_a, org_b):
    perm = IsOrganizationMember()

    class Obj:
        organization_id = org_a.id
    obj = Obj()
    # User en org_b, obj en org_a → mismatch.
    user_other = UserFactory(organization=org_b)
    assert perm.has_object_permission(
        _stub_request(user_other), _stub_view(), obj,
    ) is False


@pytest.mark.django_db
def test_is_org_member_object_direct_org_none_mismatch(org_a):
    perm = IsOrganizationMember()
    user_no_org = UserFactory(organization=None)
    user_no_org.is_staff = False  # no admin

    class Obj:
        organization_id = org_a.id
    obj = Obj()
    # user sin organization → falla el chequeo.
    assert perm.has_object_permission(
        _stub_request(user_no_org), _stub_view(), obj,
    ) is False


@pytest.mark.django_db
def test_is_org_member_user_attr_traversal(org_a, maestro_org_a):
    """Objeto sin ``organization_id`` propio pero con ``.user``."""
    perm = IsOrganizationMember()

    class ObjUser:
        organization_id = org_a.id

    class Obj:
        user = ObjUser()
    obj = Obj()
    assert perm.has_object_permission(
        _stub_request(maestro_org_a), _stub_view(), obj,
    ) is True


@pytest.mark.django_db
def test_is_org_member_worker_attr_traversal(org_a, maestro_org_a):
    perm = IsOrganizationMember()

    class ObjUser:
        organization_id = org_a.id

    class ObjWorker:
        user = ObjUser()

    class Obj:
        worker = ObjWorker()
    obj = Obj()
    assert perm.has_object_permission(
        _stub_request(maestro_org_a), _stub_view(), obj,
    ) is True


@pytest.mark.django_db
def test_is_org_member_no_org_attr_in_object():
    """Objeto sin organization_id ni .user ni .worker → denegado."""
    perm = IsOrganizationMember()

    class Obj:
        pass
    obj = Obj()
    user = UserFactory(organization=None)
    assert perm.has_object_permission(
        _stub_request(user), _stub_view(), obj,
    ) is False


@pytest.mark.django_db
def test_is_org_member_anonymous_user():
    from django.contrib.auth.models import AnonymousUser  # noqa: PLC0415
    perm = IsOrganizationMember()

    class Obj:
        organization_id = 1
    obj = Obj()
    assert perm.has_object_permission(
        _stub_request(AnonymousUser()), _stub_view(), obj,
    ) is False


# IsSameOrganizationUser -----------------------------------------------


@pytest.mark.django_db
def test_is_same_org_user_admin(admin_plataforma, maestro_org_a):
    perm = IsSameOrganizationUser()
    assert perm.has_object_permission(
        _stub_request(admin_plataforma), _stub_view(), maestro_org_a,
    ) is True


@pytest.mark.django_db
def test_is_same_org_user_match(org_a, maestro_org_a, maestro_org_b):
    perm = IsSameOrganizationUser()
    assert perm.has_object_permission(
        _stub_request(maestro_org_a), _stub_view(), maestro_org_b,
    ) is False


@pytest.mark.django_db
def test_is_same_org_user_no_user_orgs():
    perm = IsSameOrganizationUser()
    user_no_org = UserFactory(organization=None)
    obj = UserFactory(organization=None)
    assert perm.has_object_permission(
        _stub_request(user_no_org), _stub_view(), obj,
    ) is False


# ReadOnlyOrMaestro ----------------------------------------------------


@pytest.mark.django_db
def test_read_only_or_maestro_get_allows_trabajador(trabajador_org_a):
    perm = ReadOnlyOrMaestro()
    assert perm.has_permission(
        _stub_request(trabajador_org_a, "GET"), _stub_view(),
    ) is True


@pytest.mark.django_db
def test_read_only_or_maestro_post_rejects_trabajador(trabajador_org_a):
    perm = ReadOnlyOrMaestro()
    assert perm.has_permission(
        _stub_request(trabajador_org_a, "POST"), _stub_view(),
    ) is False


@pytest.mark.django_db
def test_read_only_or_maestro_post_allows_maestro(maestro_org_a):
    from django.contrib.auth.models import Group  # noqa: PLC0415
    maestro_org_a.groups.add(Group.objects.get_or_create(name="Maestro")[0])
    perm = ReadOnlyOrMaestro()
    assert perm.has_permission(
        _stub_request(maestro_org_a, "POST"), _stub_view(),
    ) is True


@pytest.mark.django_db
def test_read_only_or_maestro_post_allows_admin(admin_plataforma):
    perm = ReadOnlyOrMaestro()
    assert perm.has_permission(
        _stub_request(admin_plataforma, "POST"), _stub_view(),
    ) is True


@pytest.mark.django_db
def test_read_only_or_maestro_rejects_anonymous():
    from django.contrib.auth.models import AnonymousUser  # noqa: PLC0415
    perm = ReadOnlyOrMaestro()
    assert perm.has_permission(
        _stub_request(AnonymousUser(), "GET"), _stub_view(),
    ) is False


# IsMaestroOrWriteOwn --------------------------------------------------


@pytest.mark.django_db
def test_maestro_or_writeown_get_allows_trabajador(trabajador_org_a):
    perm = IsMaestroOrWriteOwn()
    assert perm.has_permission(
        _stub_request(trabajador_org_a, "GET"), _stub_view(),
    ) is True


@pytest.mark.django_db
def test_maestro_or_writeown_post_allows_trabajador(trabajador_org_a):
    from django.contrib.auth.models import Group  # noqa: PLC0415
    trabajador_org_a.groups.add(Group.objects.get_or_create(name="Trabajador")[0])
    perm = IsMaestroOrWriteOwn()
    assert perm.has_permission(
        _stub_request(trabajador_org_a, "POST"), _stub_view(),
    ) is True


@pytest.mark.django_db
def test_maestro_or_writeown_post_rejects_unrelated():
    """Trabajador sin grupo Trabajador → write rechazado."""
    perm = IsMaestroOrWriteOwn()
    user = UserFactory(organization=None)
    assert perm.has_permission(
        _stub_request(user, "POST"), _stub_view(),
    ) is False


@pytest.mark.django_db
def test_maestro_or_writeown_post_allows_maestro(maestro_org_a):
    from django.contrib.auth.models import Group  # noqa: PLC0415
    maestro_org_a.groups.add(Group.objects.get_or_create(name="Maestro")[0])
    perm = IsMaestroOrWriteOwn()
    assert perm.has_permission(
        _stub_request(maestro_org_a, "POST"), _stub_view(),
    ) is True


@pytest.mark.django_db
def test_maestro_or_writeown_anonymous_denied():
    from django.contrib.auth.models import AnonymousUser  # noqa: PLC0415
    perm = IsMaestroOrWriteOwn()
    assert perm.has_permission(
        _stub_request(AnonymousUser(), "GET"), _stub_view(),
    ) is False
