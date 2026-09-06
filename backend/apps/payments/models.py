"""Préstamos, pagos y detalles de conciliación.

El esquema canónico del MER: cada ``Payment`` puede cubrir jornadas
(``PaymentWorkdayDetail``) y/o abonos a préstamos
(``PaymentLoanDetail``). Total del pago es la suma de ambos
(bruto). El soft-delete (anulación) se hace con ``voided_at`` +
``voided_by``.
"""

from __future__ import annotations

from django.conf import settings
from django.db import models

from apps.catalogs.models import LoanStatus
from apps.catalogs.models import PaymentMethod
from apps.users.models import WorkerProfile
from apps.workdays.models import Workday


class WorkerScopingQuerySet(models.QuerySet):
    """Filtra por organización via worker.user.organization."""

    def for_organization(self, organization):
        return self.filter(worker__user__organization=organization)


class Loan(models.Model):
    """Préstamo otorgado a un trabajador (saldo = outstanding_balance)."""

    worker = models.ForeignKey(
        WorkerProfile,
        on_delete=models.PROTECT,
        related_name="loans",
        verbose_name="Trabajador",
    )
    status = models.ForeignKey(
        LoanStatus,
        on_delete=models.PROTECT,
        related_name="loans",
        verbose_name="Estado",
    )
    amount = models.DecimalField(max_digits=10, decimal_places=2, verbose_name="Valor")
    outstanding_balance = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        verbose_name="Saldo pendiente",
    )
    date = models.DateField(verbose_name="Fecha")
    reason = models.TextField(blank=True, verbose_name="Motivo")
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="loans_created",
        verbose_name="Creado por",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    objects = WorkerScopingQuerySet.as_manager()

    class Meta:
        verbose_name = "Préstamo"
        verbose_name_plural = "Préstamos"
        ordering = ["-date"]
        indexes = [
            models.Index(fields=["worker", "date"]),
            models.Index(fields=["status"]),
        ]

    def __str__(self) -> str:
        return f"{self.worker} — {self.amount}"


class Payment(models.Model):
    """Comprobante de pago a un trabajador (cubre jornadas y/o préstamos)."""

    worker = models.ForeignKey(
        WorkerProfile,
        on_delete=models.PROTECT,
        related_name="payments",
        verbose_name="Trabajador",
    )
    payment_method = models.ForeignKey(
        PaymentMethod,
        on_delete=models.PROTECT,
        related_name="payments",
        verbose_name="Método de pago",
    )
    total_amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        verbose_name="Valor total (bruto)",
        help_text="Suma de todos los detalles: jornadas + abonos a préstamo.",
    )
    payment_date = models.DateField(verbose_name="Fecha del pago")
    notes = models.TextField(blank=True, verbose_name="Notas")
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="payments_created",
        verbose_name="Creado por",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    voided_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="Anulado en",
        help_text="Fecha de anulación; nulo = pago vigente.",
    )
    voided_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="payments_voided",
        null=True,
        blank=True,
        verbose_name="Anulado por",
    )

    objects = WorkerScopingQuerySet.as_manager()

    class Meta:
        verbose_name = "Pago"
        verbose_name_plural = "Pagos"
        ordering = ["-payment_date"]
        indexes = [
            models.Index(fields=["worker", "payment_date"]),
            models.Index(fields=["payment_method"]),
            models.Index(fields=["voided_at"]),
        ]

    def __str__(self) -> str:
        return f"{self.worker} — {self.total_amount} ({self.payment_date})"


class PaymentWorkdayDetail(models.Model):
    """Detalle: jornadas cubiertas por un ``Payment``."""

    payment = models.ForeignKey(
        Payment,
        on_delete=models.CASCADE,
        related_name="workday_details",
        verbose_name="Pago",
    )
    workday = models.ForeignKey(
        Workday,
        on_delete=models.PROTECT,
        related_name="payment_details",
        verbose_name="Jornada",
    )
    applied_amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        verbose_name="Valor aplicado",
    )

    class Meta:
        verbose_name = "Detalle de pago (jornada)"
        verbose_name_plural = "Detalles de pago (jornadas)"
        constraints = [
            models.UniqueConstraint(
                fields=["payment", "workday"],
                name="unique_payment_workday",
            ),
        ]

    def __str__(self) -> str:
        return f"PWD {self.payment_id} wd={self.workday_id}"


class PaymentLoanDetail(models.Model):
    """Detalle: abonos a préstamo cubiertos por un ``Payment``."""

    payment = models.ForeignKey(
        Payment,
        on_delete=models.CASCADE,
        related_name="loan_details",
        verbose_name="Pago",
    )
    loan = models.ForeignKey(
        Loan,
        on_delete=models.PROTECT,
        related_name="payment_details",
        verbose_name="Préstamo",
    )
    paid_amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        verbose_name="Valor abonado",
    )

    class Meta:
        verbose_name = "Detalle de pago (préstamo)"
        verbose_name_plural = "Detalles de pago (préstamos)"
        constraints = [
            models.UniqueConstraint(
                fields=["payment", "loan"],
                name="unique_payment_loan",
            ),
        ]

    def __str__(self) -> str:
        return f"PLD {self.payment_id} loan={self.loan_id}"
