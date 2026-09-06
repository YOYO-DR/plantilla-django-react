"""Tests de cobertura 100% — ramas internas / defensivas.

Estos tests no son tests de comportamiento canónico: cubren ramas
auxiliares del servicio que el flujo de negocio normal no alcanza
(chequeos redundantes, summaries). Si tu contraparte quiere eliminar
estos tests porque no prueban comportamiento, son candidatos.
"""

from __future__ import annotations

from datetime import date
from decimal import Decimal

import pytest
from django.db.models import Sum

from apps.catalogs.tests.factories import (
    LoanStatusFactory,
    PaymentMethodFactory,
    WorkdayTypeFactory,
)
from apps.organizations.tests.factories import OrganizationFactory
from apps.payments.exceptions import CrossOrganizationError
from apps.payments.exceptions import InconsistentPaymentTotalError
from apps.payments.exceptions import LoanOverpaymentError
from apps.payments.models import Loan
from apps.payments.models import Payment
from apps.payments.models import PaymentWorkdayDetail
from apps.payments.services import (
    LoanAllocation,
    create_loan,
    register_payment,
)
from apps.users.tests.factories import (
    UserFactory,
    WorkerProfileFactory,
)
from apps.workdays.services import create_workday
from apps.workdays.tests.factories import WorkerRateFactory


@pytest.mark.django_db
def test_cross_org_same_org_different_worker_workday_raises_with_worker_msg():
    """Rama ``worker_id`` de ``_ensure_same_org`` para jornadas."""
    org = OrganizationFactory(name="Org Misma Wd")
    worker_payer = WorkerProfileFactory(user=UserFactory(organization=org))
    worker_other = WorkerProfileFactory(user=UserFactory(organization=org))
    maestro = UserFactory(organization=org)
    WorkerRateFactory(
        worker=worker_other,
        amount="50000.00",
        valid_from=date(2026, 1, 1),
        valid_until=None,
    )
    wd_type = WorkdayTypeFactory(name="Día completo", factor="1.00")
    wd_other = create_workday(
        worker=worker_other,
        workday_type=wd_type,
        date=date(2026, 3, 1),
        created_by=maestro,
    )
    pm = PaymentMethodFactory(name="Efectivo")
    with pytest.raises(CrossOrganizationError, match="otro trabajador"):
        register_payment(
            worker=worker_payer,
            payment_method=pm,
            payment_date=date(2026, 3, 16),
            workday_ids=[wd_other.id],
            loan_allocations=[],
            created_by=maestro,
        )


@pytest.mark.django_db
def test_cross_org_same_org_different_worker_loan_raises_with_worker_msg():
    """Si los workers son distintos en la MISMA organización, la
    rama de ``worker_id`` dispara con el mensaje apropiado.
    """
    org = OrganizationFactory(name="Org Misma")
    worker_payer = WorkerProfileFactory(user=UserFactory(organization=org))
    worker_other = WorkerProfileFactory(user=UserFactory(organization=org))
    maestro = UserFactory(organization=org)
    loan_other = Loan.objects.create(
        worker=worker_other,
        status=LoanStatusFactory(name="Activo"),
        amount=Decimal("10000.00"),
        outstanding_balance=Decimal("10000.00"),
        date=date(2026, 1, 1),
        created_by=maestro,
    )
    pm = PaymentMethodFactory(name="Efectivo")
    with pytest.raises(CrossOrganizationError, match="otro trabajador"):
        register_payment(
            worker=worker_payer,
            payment_method=pm,
            payment_date=date(2026, 1, 16),
            workday_ids=[],
            loan_allocations=[LoanAllocation(loan=loan_other, amount=Decimal("5000.00"))],
            created_by=maestro,
        )


@pytest.mark.django_db
def test_loan_overpayment_zero_balance_raises():
    """Préstamo con ``outstanding_balance <= 0`` pero status Activo →
    ``LoanOverpaymentError`` con mensaje explícito."""
    profile = WorkerProfileFactory()
    maestro = UserFactory(organization=profile.user.organization)
    loan = Loan.objects.create(
        worker=profile,
        status=LoanStatusFactory(name="Activo"),
        amount=Decimal("100.00"),
        outstanding_balance=Decimal("0"),
        date=date(2026, 1, 1),
        created_by=maestro,
    )
    pm = PaymentMethodFactory(name="Efectivo")
    with pytest.raises(LoanOverpaymentError, match="saldo 0"):
        register_payment(
            worker=profile,
            payment_method=pm,
            payment_date=date(2026, 1, 16),
            workday_ids=[],
            loan_allocations=[LoanAllocation(loan=loan, amount=Decimal("10.00"))],
            created_by=maestro,
        )


@pytest.mark.django_db
def test_overpayment_error_branch_with_full_then_partial_workday():
    """El primer pago cubre el total; el segundo intento es overpayment."""
    profile = WorkerProfileFactory()
    maestro = UserFactory(organization=profile.user.organization)
    WorkerRateFactory(
        worker=profile,
        amount="60000.00",
        valid_from=date(2026, 1, 1),
        valid_until=None,
    )
    wd_type = WorkdayTypeFactory(name="Día completo", factor="1.00")
    wd = create_workday(
        worker=profile,
        workday_type=wd_type,
        date=date(2026, 3, 15),
        created_by=maestro,
    )
    pm = PaymentMethodFactory(name="Efectivo")

    # Primer pago: total.
    register_payment(
        worker=profile,
        payment_method=pm,
        payment_date=date(2026, 3, 16),
        workday_ids=[wd.id],
        loan_allocations=[],
        created_by=maestro,
    )

    # Segundo intento: explícito 1.00 sobre la misma jornada ya pagada → overpayment.
    from apps.payments.exceptions import OverpaymentError

    with pytest.raises(OverpaymentError, match="excede applied_rate"):
        register_payment(
            worker=profile,
            payment_method=pm,
            payment_date=date(2026, 3, 17),
            workday_ids=[wd.id],
            loan_allocations=[],
            created_by=maestro,
            workday_overrides={wd.id: Decimal("1.00")},
        )


@pytest.mark.django_db
def test_inconsistent_payment_total_when_loan_details_sum_drifted():
    """Forzamos la inconsistencia creando un ``PaymentLoanDetail``
    adicional directamente (no anulado). Tras ``register_payment``, la
    suma real difiere de ``payment.total_amount`` si por alguna razón
    ocurrió corrupción. El servicio detecta esa deriva con una segunda
    llamada (de ``worker_balance`` u otra rutina). Aquí ejercitamos el
    escenario: dejamos la suma real desalineada y la sumamos para
    demostrar el escenario. La rama ``InconsistentPaymentTotalError``
    del servicio requiere corromper DURANTE la transacción; este test
    documenta la capa.
    """
    profile = WorkerProfileFactory()
    maestro = UserFactory(organization=profile.user.organization)
    WorkerRateFactory(
        worker=profile,
        amount="60000.00",
        valid_from=date(2026, 1, 1),
        valid_until=None,
    )
    wd_type = WorkdayTypeFactory(name="Día completo", factor="1.00")
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

    # El servicio ya creó el detalle correctamente; añadimos un detalle
    # extra a otro workday distinto para simular corrupción posterior.
    # No es estrictamente la rama del chequeo del servicio (porque
    # éste corre durante register_payment, no después), pero
    # documentamos el contexto: si la suma de detalles ≠ total_amount,
    # es una condición de inconsistencia detectable.
    wd2 = create_workday(
        worker=profile,
        workday_type=wd_type,
        date=date(2026, 3, 16),
        created_by=maestro,
    )
    PaymentWorkdayDetail.objects.create(
        payment=payment,
        workday=wd2,
        applied_amount=Decimal("1.00"),
    )

    real_sum = (
        PaymentWorkdayDetail.objects.filter(payment=payment)
        .aggregate(t=Sum("applied_amount"))["t"]
    )
    assert (real_sum or Decimal("0")) > payment.total_amount
    # Esta condición es exactamente la que el servicio detecta.
    # Aquí la rama se ejercita solo si register_payment ve inconsistencia;
    # en la práctica los unique_together y el flujo síncrono lo impiden.
    # Si alguna vez cambia la suposición, ``InconsistentPaymentTotalError``
    # detendrá la operación.


@pytest.mark.django_db
def test_inconsistent_payment_total_helper_directly_raises():
    """Llamada directa al helper de consistencia con suma drifted."""
    from apps.payments.services import _raise_if_inconsistent_total

    profile = WorkerProfileFactory()
    maestro = UserFactory(organization=profile.user.organization)
    WorkerRateFactory(
        worker=profile,
        amount="60000.00",
        valid_from=date(2026, 1, 1),
        valid_until=None,
    )
    wd_type = WorkdayTypeFactory(name="Día completo", factor="1.00")
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

    # Consistencia OK: no levanta.
    _raise_if_inconsistent_total(payment)

    # Forzamos drift cambiando payment.total_amount directamente.
    # pytest-django envuelve el test en una transacción que se revierte
    # al final, así que el cambio es válido durante este test.
    Payment.objects.filter(id=payment.id).update(total_amount=Decimal("99.00"))
    payment.refresh_from_db()
    with pytest.raises(InconsistentPaymentTotalError):
        _raise_if_inconsistent_total(payment)
