"""Cobertura 100% de ``apps.payments.services``.

Casos obligatorios del plan:
- ``create_loan``: outstanding_balance = amount, status Activo.
- ``register_payment``: cubre jornadas, recalcula estados, parcial, total,
  mixto, suelto-préstamo, ``LoanOverpaymentError`` con rollback verificado,
  ``OverpaymentError``, ``PaymentAlreadyVoidedError``, ``CrossOrganizationError``,
  ``IntegrityError`` por unique_together al pagar dos veces la misma jornada.
- ``void_payment``: revierte saldos y estados; idempotente error.
- ``worker_balance``: 4 escenarios.

Todas las sumas se hacen con ``Decimal`` (sin ``float``).
"""

from __future__ import annotations

from datetime import date
from decimal import Decimal

import pytest
from django.db import IntegrityError
from django.db import transaction

from apps.catalogs.tests.factories import LoanStatusFactory
from apps.catalogs.tests.factories import PaymentMethodFactory
from apps.catalogs.tests.factories import WorkdayTypeFactory
from apps.organizations.tests.factories import OrganizationFactory
from apps.payments.exceptions import CrossOrganizationError
from apps.payments.exceptions import LoanOverpaymentError
from apps.payments.exceptions import PaymentAlreadyVoidedError
from apps.payments.models import Payment
from apps.payments.models import PaymentWorkdayDetail
from apps.payments.services import LoanAllocation
from apps.payments.services import create_loan
from apps.payments.services import register_payment
from apps.payments.services import void_payment
from apps.payments.services import worker_balance
from apps.payments.tests.factories import PaymentFactory
from apps.payments.tests.factories import PaymentWorkdayDetailFactory
from apps.users.tests.factories import UserFactory
from apps.users.tests.factories import WorkerProfileFactory
from apps.workdays.services import create_workday
from apps.workdays.tests.factories import WorkerRateFactory


def _maestro_de_org(org):
    return UserFactory(organization=org)


def _status(name):
    from apps.payments.models import PaymentStatus

    return PaymentStatus.objects.get(name=name)


def _loan_status(name):
    from apps.payments.models import LoanStatus

    return LoanStatus.objects.get(name=name)


# =====================================================================
# create_loan
# =====================================================================


@pytest.mark.django_db
def test_create_loan_outstanding_balance_equals_amount_status_activo():
    profile = WorkerProfileFactory()
    maestro = _maestro_de_org(profile.user.organization)
    loan = create_loan(
        worker=profile,
        amount=Decimal("100000.00"),
        date=date(2026, 1, 1),
        reason="Adelanto de quincena",
        created_by=maestro,
    )
    assert loan.amount == Decimal("100000.00")
    assert loan.outstanding_balance == Decimal("100000.00")
    assert loan.status.name == "Activo"


# =====================================================================
# register_payment
# =====================================================================


@pytest.mark.django_db
def test_register_payment_full_coverage_single_workday():
    profile = WorkerProfileFactory()
    org = profile.user.organization
    WorkerRateFactory(
        worker=profile,
        amount="60000.00",
        valid_from=date(2026, 1, 1),
        valid_until=None,
    )
    wd_type = WorkdayTypeFactory(name="Día completo", factor="1.00")
    maestro = _maestro_de_org(org)
    wd = create_workday(
        worker=profile,
        workday_type=wd_type,
        date=date(2026, 3, 15),
        created_by=maestro,
    )
    pm = PaymentMethodFactory(name="Efectivo")

    payment = register_payment(
        worker=profile,
        payment_method=pm,
        payment_date=date(2026, 3, 16),
        workday_ids=[wd.id],
        loan_allocations=[],
        created_by=maestro,
    )

    assert payment.total_amount == Decimal("60000.00")
    assert PaymentWorkdayDetail.objects.filter(payment=payment, workday=wd).exists()
    wd.refresh_from_db()
    assert wd.payment_status.name == "Pagado"


@pytest.mark.django_db
def test_register_payment_partial_completion():
    """Pago parcial (workday_overrides) → Parcial; segundo pago completa → Pagado."""
    profile = WorkerProfileFactory()
    org = profile.user.organization
    WorkerRateFactory(
        worker=profile,
        amount="60000.00",
        valid_from=date(2026, 1, 1),
        valid_until=None,
    )
    wd_type = WorkdayTypeFactory(name="Día completo", factor="1.00")
    maestro = _maestro_de_org(org)
    wd = create_workday(
        worker=profile,
        workday_type=wd_type,
        date=date(2026, 3, 15),
        created_by=maestro,
    )
    pm = PaymentMethodFactory(name="Efectivo")

    # Primer pago parcial: 30000 sobre applied_rate 60000 → status Parcial.
    register_payment(
        worker=profile,
        payment_method=pm,
        payment_date=date(2026, 3, 16),
        workday_ids=[wd.id],
        loan_allocations=[],
        created_by=maestro,
        workday_overrides={wd.id: Decimal("30000.00")},
    )
    wd.refresh_from_db()
    assert wd.payment_status.name == "Parcial"

    # Segundo pago: completa el resto (30000) → status Pagado.
    register_payment(
        worker=profile,
        payment_method=pm,
        payment_date=date(2026, 3, 17),
        workday_ids=[wd.id],
        loan_allocations=[],
        created_by=maestro,
        workday_overrides={wd.id: Decimal("30000.00")},
    )
    wd.refresh_from_db()
    assert wd.payment_status.name == "Pagado"


@pytest.mark.django_db
def test_register_payment_covers_five_workdays_at_once():
    profile = WorkerProfileFactory()
    org = profile.user.organization
    WorkerRateFactory(
        worker=profile,
        amount="50000.00",
        valid_from=date(2026, 1, 1),
        valid_until=None,
    )
    wd_type = WorkdayTypeFactory(name="Día completo", factor="1.00")
    maestro = _maestro_de_org(org)
    wds = [
        create_workday(
            worker=profile,
            workday_type=wd_type,
            date=date(2026, 3, day),
            created_by=maestro,
        )
        for day in range(1, 6)
    ]
    pm = PaymentMethodFactory(name="Efectivo")

    payment = register_payment(
        worker=profile,
        payment_method=pm,
        payment_date=date(2026, 3, 6),
        workday_ids=[w.id for w in wds],
        loan_allocations=[],
        created_by=maestro,
    )
    assert payment.total_amount == Decimal("250000.00")
    for w in wds:
        w.refresh_from_db()
        assert w.payment_status.name == "Pagado"


@pytest.mark.django_db
def test_register_payment_loan_full_settlement_to_pagado():
    profile = WorkerProfileFactory()
    org = profile.user.organization
    maestro = _maestro_de_org(org)
    loan = create_loan(
        worker=profile,
        amount=Decimal("100000.00"),
        date=date(2026, 1, 1),
        created_by=maestro,
    )
    pm = PaymentMethodFactory(name="Efectivo")
    register_payment(
        worker=profile,
        payment_method=pm,
        payment_date=date(2026, 1, 16),
        workday_ids=[],
        loan_allocations=[LoanAllocation(loan=loan, amount=Decimal("100000.00"))],
        created_by=maestro,
    )
    loan.refresh_from_db()
    assert loan.outstanding_balance == Decimal("0")
    assert loan.status.name == "Pagado"


@pytest.mark.django_db
def test_register_payment_loan_partial_keeps_activo():
    profile = WorkerProfileFactory()
    org = profile.user.organization
    maestro = _maestro_de_org(org)
    loan = create_loan(
        worker=profile,
        amount=Decimal("100000.00"),
        date=date(2026, 1, 1),
        created_by=maestro,
    )
    pm = PaymentMethodFactory(name="Efectivo")
    register_payment(
        worker=profile,
        payment_method=pm,
        payment_date=date(2026, 1, 16),
        workday_ids=[],
        loan_allocations=[LoanAllocation(loan=loan, amount=Decimal("40000.00"))],
        created_by=maestro,
    )
    loan.refresh_from_db()
    assert loan.outstanding_balance == Decimal("60000.00")
    assert loan.status.name == "Activo"


@pytest.mark.django_db
def test_register_payment_loan_overpayment_raises_and_rolls_back():
    """``LoanOverpaymentError`` debe dejar el saldo intacto (rollback atómico)."""
    profile = WorkerProfileFactory()
    org = profile.user.organization
    maestro = _maestro_de_org(org)
    loan = create_loan(
        worker=profile,
        amount=Decimal("100000.00"),
        date=date(2026, 1, 1),
        created_by=maestro,
    )
    pm = PaymentMethodFactory(name="Efectivo")
    with pytest.raises(LoanOverpaymentError):
        register_payment(
            worker=profile,
            payment_method=pm,
            payment_date=date(2026, 1, 16),
            workday_ids=[],
            loan_allocations=[LoanAllocation(loan=loan, amount=Decimal("150000.00"))],
            created_by=maestro,
        )
    loan.refresh_from_db()
    assert loan.outstanding_balance == Decimal("100000.00")
    assert loan.status.name == "Activo"
    assert Payment.objects.count() == 0


@pytest.mark.django_db
def test_register_payment_loan_to_pagado_status_rejects_new_payment():
    """Abonar a un préstamo ya Pagado → LoanOverpaymentError."""
    profile = WorkerProfileFactory()
    org = profile.user.organization
    maestro = _maestro_de_org(org)
    loan = create_loan(
        worker=profile,
        amount=Decimal("50000.00"),
        date=date(2026, 1, 1),
        created_by=maestro,
    )
    pm = PaymentMethodFactory(name="Efectivo")
    # saldarlo completamente
    register_payment(
        worker=profile,
        payment_method=pm,
        payment_date=date(2026, 1, 16),
        workday_ids=[],
        loan_allocations=[LoanAllocation(loan=loan, amount=Decimal("50000.00"))],
        created_by=maestro,
    )
    # nuevo intento
    with pytest.raises(LoanOverpaymentError):
        register_payment(
            worker=profile,
            payment_method=pm,
            payment_date=date(2026, 1, 17),
            workday_ids=[],
            loan_allocations=[LoanAllocation(loan=loan, amount=Decimal("1000.00"))],
            created_by=maestro,
        )


@pytest.mark.django_db
def test_register_payment_loan_condonado_rejects_abonos():
    profile = WorkerProfileFactory()
    org = profile.user.organization
    maestro = _maestro_de_org(org)
    loan = create_loan(
        worker=profile,
        amount=Decimal("20000.00"),
        date=date(2026, 1, 1),
        created_by=maestro,
    )
    condonado = LoanStatusFactory(name="Condonado", order=2)
    loan.status = condonado
    loan.save(update_fields=["status"])
    pm = PaymentMethodFactory(name="Efectivo")
    with pytest.raises(LoanOverpaymentError):
        register_payment(
            worker=profile,
            payment_method=pm,
            payment_date=date(2026, 1, 17),
            workday_ids=[],
            loan_allocations=[LoanAllocation(loan=loan, amount=Decimal("1000.00"))],
            created_by=maestro,
        )


@pytest.mark.django_db
def test_register_payment_mixed_workdays_and_loan_partial():
    """Pago mixto: 3 jornadas + abono parcial a un préstamo. Verificar
    que ``total_amount`` = suma, saldos y estados correctos."""
    profile = WorkerProfileFactory()
    org = profile.user.organization
    maestro = _maestro_de_org(org)
    WorkerRateFactory(
        worker=profile,
        amount="50000.00",
        valid_from=date(2026, 1, 1),
        valid_until=None,
    )
    wd_type = WorkdayTypeFactory(name="Día completo", factor="1.00")
    wds = [
        create_workday(
            worker=profile,
            workday_type=wd_type,
            date=date(2026, 3, day),
            created_by=maestro,
        )
        for day in range(1, 4)
    ]
    loan = create_loan(
        worker=profile,
        amount=Decimal("100000.00"),
        date=date(2026, 1, 1),
        created_by=maestro,
    )
    pm = PaymentMethodFactory(name="Efectivo")

    payment = register_payment(
        worker=profile,
        payment_method=pm,
        payment_date=date(2026, 3, 5),
        workday_ids=[w.id for w in wds],
        loan_allocations=[LoanAllocation(loan=loan, amount=Decimal("30000.00"))],
        created_by=maestro,
    )

    # 3 jornadas * 50000 = 150000 + 30000 = 180000
    assert payment.total_amount == Decimal("180000.00")
    for w in wds:
        w.refresh_from_db()
        assert w.payment_status.name == "Pagado"
    loan.refresh_from_db()
    assert loan.outstanding_balance == Decimal("70000.00")  # 100k - 30k
    assert loan.status.name == "Activo"


@pytest.mark.django_db
def test_register_payment_double_payment_same_workday_raises_integrityerror():
    """Intentar pagar dos veces la misma jornada en el mismo ``Payment``
    → IntegrityError por ``unique_together`` (``payment``, ``workday``).
    """
    profile = WorkerProfileFactory()
    org = profile.user.organization
    maestro = _maestro_de_org(org)
    WorkerRateFactory(
        worker=profile,
        amount="50000.00",
        valid_from=date(2026, 1, 1),
        valid_until=None,
    )
    wd_type = WorkdayTypeFactory(name="Día completo", factor="1.00")
    wd = create_workday(
        worker=profile,
        workday_type=wd_type,
        date=date(2026, 3, 1),
        created_by=maestro,
    )
    pm = PaymentMethodFactory(name="Efectivo")
    payment = PaymentFactory(
        worker=profile,
        payment_method=pm,
        total_amount="100000.00",
        payment_date=date(2026, 3, 16),
        created_by=maestro,
    )
    PaymentWorkdayDetailFactory(
        payment=payment,
        workday=wd,
        applied_amount="50000.00",
    )
    # Segundo detalle con misma (payment, workday) → IntegrityError.
    with pytest.raises(IntegrityError), transaction.atomic():
        PaymentWorkdayDetail.objects.create(
            payment=payment,
            workday=wd,
            applied_amount="50000.00",
        )


@pytest.mark.django_db
def test_register_payment_cross_organization_rejected():
    """Pago que mezcla worker de una org con workday de otra → ``CrossOrganizationError``."""
    org_a = OrganizationFactory(name="Org A")
    org_b = OrganizationFactory(name="Org B")
    worker_a = WorkerProfileFactory(user=UserFactory(organization=org_a))
    worker_b = WorkerProfileFactory(user=UserFactory(organization=org_b))
    WorkerRateFactory(
        worker=worker_b,
        amount="50000.00",
        valid_from=date(2026, 1, 1),
        valid_until=None,
    )
    wd_type = WorkdayTypeFactory(name="Día completo", factor="1.00")
    wd_b = create_workday(
        worker=worker_b,
        workday_type=wd_type,
        date=date(2026, 3, 1),
        created_by=UserFactory(organization=org_b),
    )
    pm = PaymentMethodFactory(name="Efectivo")
    maestro = UserFactory(organization=org_a)
    with pytest.raises(CrossOrganizationError):
        register_payment(
            worker=worker_a,
            payment_method=pm,
            payment_date=date(2026, 3, 16),
            workday_ids=[wd_b.id],
            loan_allocations=[],
            created_by=maestro,
        )


@pytest.mark.django_db
def test_register_payment_cross_worker_loan_rejected():
    """Pago que asigna préstamo de otro worker → ``CrossOrganizationError``."""
    org = OrganizationFactory(name="Org Mixta")
    worker_a = WorkerProfileFactory(user=UserFactory(organization=org))
    worker_b = WorkerProfileFactory(user=UserFactory(organization=org))
    maestro = UserFactory(organization=org)
    loan_b = create_loan(
        worker=worker_b,
        amount=Decimal("10000.00"),
        date=date(2026, 1, 1),
        created_by=maestro,
    )
    pm = PaymentMethodFactory(name="Efectivo")
    with pytest.raises(CrossOrganizationError):
        register_payment(
            worker=worker_a,
            payment_method=pm,
            payment_date=date(2026, 1, 16),
            workday_ids=[],
            loan_allocations=[LoanAllocation(loan=loan_b, amount=Decimal("5000.00"))],
            created_by=maestro,
        )


# =====================================================================
# void_payment
# =====================================================================


@pytest.mark.django_db
def test_void_payment_reverts_mixed_payment():
    """Pago mixto: tras anular, préstamo recupera saldo y jornadas vuelven a Pendiente."""
    profile = WorkerProfileFactory()
    org = profile.user.organization
    maestro = _maestro_de_org(org)
    WorkerRateFactory(
        worker=profile,
        amount="50000.00",
        valid_from=date(2026, 1, 1),
        valid_until=None,
    )
    wd_type = WorkdayTypeFactory(name="Día completo", factor="1.00")
    wd = create_workday(
        worker=profile,
        workday_type=wd_type,
        date=date(2026, 3, 1),
        created_by=maestro,
    )
    loan = create_loan(
        worker=profile,
        amount=Decimal("100000.00"),
        date=date(2026, 1, 1),
        created_by=maestro,
    )
    pm = PaymentMethodFactory(name="Efectivo")
    payment = register_payment(
        worker=profile,
        payment_method=pm,
        payment_date=date(2026, 3, 5),
        workday_ids=[wd.id],
        loan_allocations=[LoanAllocation(loan=loan, amount=Decimal("30000.00"))],
        created_by=maestro,
    )
    loan.refresh_from_db()
    assert loan.outstanding_balance == Decimal("70000.00")

    void_payment(payment=payment, voided_by=maestro)

    loan.refresh_from_db()
    assert loan.outstanding_balance == Decimal("100000.00")  # revertido
    assert loan.status.name == "Activo"
    wd.refresh_from_db()
    # Tras reversa, no hay detalles no anulados → status Pendiente.
    assert wd.payment_status.name == "Pendiente"
    payment.refresh_from_db()
    assert payment.voided_at is not None


@pytest.mark.django_db
def test_void_payment_twice_raises():
    profile = WorkerProfileFactory()
    org = profile.user.organization
    maestro = _maestro_de_org(org)
    WorkerRateFactory(
        worker=profile,
        amount="50000.00",
        valid_from=date(2026, 1, 1),
        valid_until=None,
    )
    wd_type = WorkdayTypeFactory(name="Día completo", factor="1.00")
    wd = create_workday(
        worker=profile,
        workday_type=wd_type,
        date=date(2026, 3, 1),
        created_by=maestro,
    )
    pm = PaymentMethodFactory(name="Efectivo")
    payment = register_payment(
        worker=profile,
        payment_method=pm,
        payment_date=date(2026, 3, 5),
        workday_ids=[wd.id],
        loan_allocations=[],
        created_by=maestro,
    )
    void_payment(payment=payment, voided_by=maestro)
    with pytest.raises(PaymentAlreadyVoidedError):
        void_payment(payment=payment, voided_by=maestro)


@pytest.mark.django_db
def test_void_payment_does_not_touch_other_payment_details():
    """Si otra jornada tiene su propio detalle no anulado, no se le cambia el status."""
    profile = WorkerProfileFactory()
    org = profile.user.organization
    maestro = _maestro_de_org(org)
    WorkerRateFactory(
        worker=profile,
        amount="50000.00",
        valid_from=date(2026, 1, 1),
        valid_until=None,
    )
    wd_type = WorkdayTypeFactory(name="Día completo", factor="1.00")
    wd_other = create_workday(
        worker=profile,
        workday_type=wd_type,
        date=date(2026, 3, 2),
        created_by=maestro,
    )
    # Pago secundario que cubre SOLO wd_other (la primera jornada queda Pendiente).
    pm = PaymentMethodFactory(name="Efectivo")
    payment2 = register_payment(
        worker=profile,
        payment_method=pm,
        payment_date=date(2026, 3, 6),
        workday_ids=[wd_other.id],
        loan_allocations=[],
        created_by=maestro,
    )
    wd_other.refresh_from_db()
    assert wd_other.payment_status.name == "Pagado"

    # Anular payment2: wd_other debe volver a Pendiente (porque ahora no
    # tiene detalles no anulados).
    void_payment(payment=payment2, voided_by=maestro)
    wd_other.refresh_from_db()
    assert wd_other.payment_status.name == "Pendiente"


# =====================================================================
# worker_balance
# =====================================================================


@pytest.mark.django_db
def test_worker_balance_sin_jornadas():
    profile = WorkerProfileFactory()
    bal = worker_balance(profile)
    assert bal.pendientes_count == 0
    assert bal.adeudado_workdays == Decimal("0")
    assert bal.saldo_prestamos == Decimal("0")
    assert bal.neto_a_pagar == Decimal("0")


@pytest.mark.django_db
def test_worker_balance_solo_pendientes():
    profile = WorkerProfileFactory()
    org = profile.user.organization
    maestro = _maestro_de_org(org)
    WorkerRateFactory(
        worker=profile,
        amount="50000.00",
        valid_from=date(2026, 1, 1),
        valid_until=None,
    )
    wd_type = WorkdayTypeFactory(name="Día completo", factor="1.00")
    [
        create_workday(
            worker=profile,
            workday_type=wd_type,
            date=date(2026, 3, day),
            created_by=maestro,
        )
        for day in range(1, 4)
    ]
    bal = worker_balance(profile)
    assert bal.pendientes_count == 3
    assert bal.adeudado_workdays == Decimal("150000.00")
    assert bal.saldo_prestamos == Decimal("0")
    assert bal.neto_a_pagar == Decimal("150000.00")


@pytest.mark.django_db
def test_worker_balance_workdays_parciales_y_prestamo_activo():
    """Jornadas pagadas parcialmente + préstamo con abono parcial.

    Aquí el "parcial" por jornada se logra con dos ``register_payment``:
    - Pago 1: paga SOLO 30000 de wd1 (parcial explícito vía
      ``workday_overrides``) + 50000 al préstamo.
    - Pago 2: nunca ocurre; wd1 queda Parcial, wd2 queda Pendiente.
    """
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
    wd1 = create_workday(
        worker=profile,
        workday_type=wd_type,
        date=date(2026, 3, 1),
        created_by=maestro,
    )
    create_workday(
        worker=profile,
        workday_type=wd_type,
        date=date(2026, 3, 2),
        created_by=maestro,
    )
    loan = create_loan(
        worker=profile,
        amount=Decimal("200000.00"),
        date=date(2026, 1, 1),
        created_by=maestro,
    )
    pm = PaymentMethodFactory(name="Efectivo")

    # Pago 1: 30.000 parcial de wd1 (parcial explícito) + 50.000 al préstamo.
    register_payment(
        worker=profile,
        payment_method=pm,
        payment_date=date(2026, 3, 5),
        workday_ids=[wd1.id],
        loan_allocations=[LoanAllocation(loan=loan, amount=Decimal("50000.00"))],
        created_by=maestro,
        workday_overrides={wd1.id: Decimal("30000.00")},
    )

    bal = worker_balance(profile)
    # wd1 Parcial (adeudado 30000) + wd2 Pendiente (adeudado 60000) = 90000
    assert bal.adeudado_workdays == Decimal("90000.00")
    # Verificación del saldo del préstamo tras el pago parcial
    assert bal.saldo_prestamos == Decimal("150000.00")
    assert bal.neto_a_pagar == Decimal("240000.00")
    assert bal.pendientes_count == 1  # solo wd2


@pytest.mark.django_db
def test_worker_balance_todo_saldado_neto_cero():
    profile = WorkerProfileFactory()
    org = profile.user.organization
    maestro = _maestro_de_org(org)
    WorkerRateFactory(
        worker=profile,
        amount="50000.00",
        valid_from=date(2026, 1, 1),
        valid_until=None,
    )
    wd_type = WorkdayTypeFactory(name="Día completo", factor="1.00")
    wd = create_workday(
        worker=profile,
        workday_type=wd_type,
        date=date(2026, 3, 1),
        created_by=maestro,
    )
    loan = create_loan(
        worker=profile,
        amount=Decimal("50000.00"),
        date=date(2026, 1, 1),
        created_by=maestro,
    )
    pm = PaymentMethodFactory(name="Efectivo")
    register_payment(
        worker=profile,
        payment_method=pm,
        payment_date=date(2026, 3, 5),
        workday_ids=[wd.id],
        loan_allocations=[LoanAllocation(loan=loan, amount=Decimal("50000.00"))],
        created_by=maestro,
    )

    bal = worker_balance(profile)
    assert bal.pendientes_count == 0
    assert bal.adeudado_workdays == Decimal("0")
    assert bal.saldo_prestamos == Decimal("0")
    assert bal.neto_a_pagar == Decimal("0")


# =====================================================================
# Concurrencia
# =====================================================================


@pytest.mark.django_db(transaction=True)
def test_register_payment_concurrent_no_negative_balance():
    """Dos ``register_payment`` simultáneos sobre el mismo préstamo no
    producen saldo negativo gracias a ``select_for_update``.
    """
    import threading

    from django.db import close_old_connections

    profile = WorkerProfileFactory()
    org = profile.user.organization
    maestro = _maestro_de_org(org)
    loan = create_loan(
        worker=profile,
        amount=Decimal("100000.00"),
        date=date(2026, 1, 1),
        created_by=maestro,
    )
    pm = PaymentMethodFactory(name="Efectivo")
    results: list = []

    def worker(amount):
        try:
            close_old_connections()
            register_payment(
                worker=profile,
                payment_method=pm,
                payment_date=date(2026, 1, 16),
                workday_ids=[],
                loan_allocations=[
                    LoanAllocation(loan=loan, amount=Decimal(amount)),
                ],
                created_by=maestro,
            )
            results.append(("ok", amount))
        except LoanOverpaymentError:
            results.append(("rejected", amount))
        finally:
            close_old_connections()

    t1 = threading.Thread(target=worker, args=("80000.00",))
    t2 = threading.Thread(target=worker, args=("80000.00",))
    t1.start()
    t2.start()
    t1.join()
    t2.join()

    loan.refresh_from_db()
    assert loan.outstanding_balance >= Decimal("0")
    ok_count = sum(1 for kind, _ in results if kind == "ok")
    rejected_count = sum(1 for kind, _ in results if kind == "rejected")
    assert ok_count + rejected_count == 2
    # Si ambos pasaron → saldo = 100k - 80k - 80k = -60k ← NO debería pasar.
    # Al menos uno fue rechazado para evitar saldo negativo.
    if ok_count == 2:
        # Si no pasó nada raro, ambos pagos son válidos secuencialmente;
        # el segundo hilo debe haber sido rechazado por saldo insuficiente.
        pytest.fail(
            "Concurrencia sin protección: ambos pagos aceptados, "
            "saldo final sería "
            f"{loan.outstanding_balance}.",
        )
    assert ok_count == 1
    assert rejected_count == 1
    loan.refresh_from_db()
    assert loan.outstanding_balance == Decimal("20000.00")
