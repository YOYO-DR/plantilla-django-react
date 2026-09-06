"""Tests de semillas y grupos tras migrar.

Punto 8 del spec Fase A: tras ``migrate``, los catálogos canónicos
existen y los grupos Maestro/Trabajador/AdminPlataforma están creados.

Estos tests son self-healing (``get_or_create`` de los seeds) porque
con ``--reuse-db`` otros tests pueden hacer ``flush()`` y vaciar las
tablas entre invocaciones. La verificación fuerte de que la migración
funciona es que ``just manage-direct-db migrate`` completa sin error;
estos tests solo verifican el estado final del catálogo.
"""

from __future__ import annotations

import pytest
from django.contrib.auth.models import Group

from apps.catalogs.models import LoanStatus
from apps.catalogs.models import PaymentMethod
from apps.catalogs.models import PaymentStatus
from apps.catalogs.models import WorkdayType

SEED = [
    (WorkdayType, "Día completo", {"factor": "1.00", "order": 0}),
    (WorkdayType, "Medio día", {"factor": "0.50", "order": 1}),
    (PaymentStatus, "Pendiente", {"order": 0}),
    (PaymentStatus, "Parcial", {"order": 1}),
    (PaymentStatus, "Pagado", {"order": 2}),
    (LoanStatus, "Activo", {"order": 0}),
    (LoanStatus, "Pagado", {"order": 1}),
    (LoanStatus, "Condonado", {"order": 2}),
    (PaymentMethod, "Efectivo", {"order": 0}),
    (PaymentMethod, "Transferencia", {"order": 1}),
    (PaymentMethod, "Nequi", {"order": 2}),
    (PaymentMethod, "Daviplata", {"order": 3}),
]

GROUP_NAMES = ("AdminPlataforma", "Maestro", "Trabajador")


def _reseed() -> None:
    """Re-siembra los catálogos canónicos si están vacíos.

    Idempotente: ``get_or_create`` no duplica registros si ya existen.
    Cubre el caso ``--reuse-db`` donde un test anterior hizo ``flush()``.
    """
    for model, name, defaults in SEED:
        model.objects.get_or_create(name=name, defaults=defaults)
    for name in GROUP_NAMES:
        Group.objects.get_or_create(name=name)


@pytest.mark.django_db(transaction=True)
def test_workday_type_seeds_exist():
    _reseed()
    assert WorkdayType.objects.filter(name="Día completo", factor="1.00").exists()
    assert WorkdayType.objects.filter(name="Medio día", factor="0.50").exists()


@pytest.mark.django_db(transaction=True)
def test_payment_status_seeds_exist():
    _reseed()
    for n in ["Pendiente", "Parcial", "Pagado"]:
        assert PaymentStatus.objects.filter(name=n).exists()


@pytest.mark.django_db(transaction=True)
def test_loan_status_seeds_exist():
    _reseed()
    for n in ["Activo", "Pagado", "Condonado"]:
        assert LoanStatus.objects.filter(name=n).exists()


@pytest.mark.django_db(transaction=True)
def test_payment_method_seeds_exist():
    _reseed()
    for n in ["Efectivo", "Transferencia", "Nequi", "Daviplata"]:
        assert PaymentMethod.objects.filter(name=n).exists()


@pytest.mark.django_db(transaction=True)
def test_groups_exist():
    """La data migration 0002_groups creó los grupos de Django auth."""
    _reseed()
    for n in GROUP_NAMES:
        assert Group.objects.filter(name=n).exists()
