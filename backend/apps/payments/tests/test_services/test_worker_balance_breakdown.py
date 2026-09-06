"""Tests del desglose que ``worker_balance`` devuelve para la UI.

Reglas:
- ``workdays``: jornadas Pendientes y Parciales; las Pagadas NO aparecen.
- Cada línea ``workdays`` trae ``id``, ``date``, ``workday_type`` (id+name),
  ``applied_rate``, ``ya_pagado`` y ``pendiente``.
- ``loans``: solo los activos (``status = Activo``); Pagado/Condonado fuera.
- ``pendientes_count`` sigue contando solo las ``Pendiente`` (no Parcial).
- Los 5 agregados originales no cambian.
"""

from __future__ import annotations

from datetime import date
from decimal import Decimal

import pytest
from django.contrib.auth.models import Group

from apps.catalogs.tests.factories import PaymentMethodFactory
from apps.catalogs.tests.factories import WorkdayTypeFactory
from apps.payments.services import LoanAllocation
from apps.payments.services import create_loan
from apps.payments.services import register_payment
from apps.payments.services import worker_balance
from apps.users.tests.factories import UserFactory
from apps.users.tests.factories import WorkerProfileFactory
from apps.workdays.services import create_workday
from apps.workdays.tests.factories import WorkerRateFactory


def _maestro_de_org(org):
    g, _ = Group.objects.get_or_create(name="Maestro")
    u = UserFactory(organization=org)
    u.groups.add(g)
    return u


@pytest.mark.django_db
def test_worker_balance_breakdown_pendientes_y_parciales_y_pagadas():
    """Mezcla de pagada, parcial y pendiente: solo las dos últimas aparecen."""
    profile = WorkerProfileFactory()
    org = profile.user.organization
    maestro = _maestro_de_org(org)
    WorkerRateFactory(
        worker=profile,
        amount="60000.00",
        valid_from=date(2026, 1, 1),
        valid_until=None,
    )
    wd_type = WorkdayTypeFactory(name="Día completo", factor="1.00")
    wd_pagada = create_workday(
        worker=profile,
        workday_type=wd_type,
        date=date(2026, 3, 1),
        created_by=maestro,
    )
    wd_parcial = create_workday(
        worker=profile,
        workday_type=wd_type,
        date=date(2026, 3, 2),
        created_by=maestro,
    )
    wd_pendiente = create_workday(
        worker=profile,
        workday_type=wd_type,
        date=date(2026, 3, 3),
        created_by=maestro,
    )
    pm = PaymentMethodFactory(name="Efectivo")
    # Pago completo de wd_pagada + pago parcial explícito de wd_parcial.
    register_payment(
        worker=profile,
        payment_method=pm,
        payment_date=date(2026, 3, 10),
        workday_ids=[wd_pagada.id],
        loan_allocations=[],
        created_by=maestro,
    )
    register_payment(
        worker=profile,
        payment_method=pm,
        payment_date=date(2026, 3, 11),
        workday_ids=[wd_parcial.id],
        loan_allocations=[],
        created_by=maestro,
        workday_overrides={wd_parcial.id: Decimal("20000.00")},
    )

    bal = worker_balance(profile)

    # 5 agregados coherentes con la mezcla.
    # Pagada 0 + Parcial (60000-20000)=40000 + Pendiente 60000 = 100000
    assert bal.adeudado_workdays == Decimal("100000.00")
    assert bal.saldo_prestamos == Decimal("0")
    assert bal.neto_a_pagar == Decimal("100000.00")
    # Solo la Pendiente cuenta (la parcial no).
    assert bal.pendientes_count == 1

    # Desglose de workdays: solo Parcial + Pendiente (2 líneas).
    assert len(bal.workdays) == 2
    by_id = {line.id: line for line in bal.workdays}
    assert wd_pagada.id not in by_id
    assert wd_parcial.id in by_id
    assert wd_pendiente.id in by_id

    # Parcial: aplicada 60000, ya pagado 20000, pendiente 40000.
    parcial_line = by_id[wd_parcial.id]
    assert parcial_line.applied_rate == Decimal("60000.00")
    assert parcial_line.ya_pagado == Decimal("20000.00")
    assert parcial_line.pendiente == Decimal("40000.00")
    assert parcial_line.workday_type_id == wd_type.id
    assert parcial_line.workday_type_name == "Día completo"
    assert parcial_line.date == date(2026, 3, 2)

    # Pendiente: aplicada 60000, ya pagado 0, pendiente 60000.
    pendiente_line = by_id[wd_pendiente.id]
    assert pendiente_line.applied_rate == Decimal("60000.00")
    assert pendiente_line.ya_pagado == Decimal("0.00")
    assert pendiente_line.pendiente == Decimal("60000.00")

    # loans vacío.
    assert bal.loans == []


@pytest.mark.django_db
def test_worker_balance_loans_only_activos():
    """Préstamos Pagado y Condonado NO aparecen en ``loans``."""
    profile = WorkerProfileFactory()
    org = profile.user.organization
    maestro = _maestro_de_org(org)
    loan_activo = create_loan(
        worker=profile,
        amount=Decimal("100000.00"),
        date=date(2026, 1, 1),
        reason="Adelanto",
        created_by=maestro,
    )
    loan_pagado = create_loan(
        worker=profile,
        amount=Decimal("50000.00"),
        date=date(2026, 2, 1),
        reason="Pagado entero",
        created_by=maestro,
    )
    loan_condonado = create_loan(
        worker=profile,
        amount=Decimal("20000.00"),
        date=date(2026, 3, 1),
        reason="A condonar",
        created_by=maestro,
    )
    pm = PaymentMethodFactory(name="Efectivo")
    # Saldar loan_pagado
    register_payment(
        worker=profile,
        payment_method=pm,
        payment_date=date(2026, 3, 15),
        workday_ids=[],
        loan_allocations=[LoanAllocation(loan=loan_pagado, amount=Decimal("50000.00"))],
        created_by=maestro,
    )
    # Condonar loan_condonado
    from apps.payments.services import _loan_status_condonado

    loan_condonado.status = _loan_status_condonado()
    loan_condonado.save(update_fields=["status"])

    bal = worker_balance(profile)

    assert len(bal.loans) == 1
    only = bal.loans[0]
    assert only.id == loan_activo.id
    assert only.amount == Decimal("100000.00")
    assert only.outstanding_balance == Decimal("100000.00")
    assert only.reason == "Adelanto"
    assert only.date == date(2026, 1, 1)
    # saldo_prestamos solo suma el activo.
    assert bal.saldo_prestamos == Decimal("100000.00")


@pytest.mark.django_db
def test_worker_balance_breakdown_vacio():
    """Sin jornadas ni préstamos: agregados en 0 y desgloses vacíos."""
    profile = WorkerProfileFactory()
    bal = worker_balance(profile)
    assert bal.pendientes_count == 0
    assert bal.adeudado_workdays == Decimal("0")
    assert bal.saldo_prestamos == Decimal("0")
    assert bal.neto_a_pagar == Decimal("0")
    assert bal.workdays == []
    assert bal.loans == []
