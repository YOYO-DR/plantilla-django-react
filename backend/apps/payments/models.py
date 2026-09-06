from __future__ import annotations

from django.db import models
from django.utils import timezone

from apps.organizations.models import Organization
from apps.users.models import User
from apps.users.models import WorkerProfile


class Liquidacion(models.Model):
    """Snapshot inmutable de una liquidación de un trabajador.

    Regla R6 del prototipo: liquidar bloquea jornadas y crea movimientos
    de abono automáticos. El comprobante es snapshot inmutable: aunque
    las jornadas o tarifas cambien después, los valores almacenados
    aquí no se alteran.
    """

    organization = models.ForeignKey(
        Organization,
        on_delete=models.PROTECT,
        related_name="liquidaciones",
    )
    worker = models.ForeignKey(
        WorkerProfile,
        on_delete=models.PROTECT,
        related_name="liquidaciones",
    )
    consecutivo = models.PositiveIntegerField(verbose_name="Consecutivo")
    periodo_inicio = models.DateField()
    periodo_fin = models.DateField()
    jornada_ids = models.JSONField(default=list)  # [int, int, ...]
    detalle = models.JSONField(
        default=list,
    )  # [{fecha, tipo, tarifa_aplicada, valor, es_override}]
    subtotal_jornadas = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    saldo_deuda_antes = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    MODO_CHOICES = [
        ("ninguno", "Sin descuento"),
        ("total", "Descontar total"),
        ("parcial", "Descontar parcial"),
    ]
    modo_descuento = models.CharField(
        max_length=20,
        choices=MODO_CHOICES,
        default="ninguno",
    )
    monto_descontado = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    total_pagado = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    saldo_deuda_despues = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0,
    )
    ESTADO_CHOICES = [
        ("borrador", "Borrador"),
        ("pagada", "Pagada"),
    ]
    estado = models.CharField(max_length=20, choices=ESTADO_CHOICES, default="pagada")
    fecha_pago = models.DateField(default=timezone.now)
    observaciones = models.TextField(blank=True)
    creado_por = models.ForeignKey(
        User,
        on_delete=models.PROTECT,
        related_name="liquidaciones_creadas",
    )
    creado_en = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Liquidación"
        verbose_name_plural = "Liquidaciones"
        ordering = ["-fecha_pago", "-consecutivo"]
        constraints = [
            models.UniqueConstraint(
                fields=["organization", "consecutivo"],
                name="unique_consecutivo_per_org",
            ),
        ]
        indexes = [
            models.Index(fields=["organization", "consecutivo"]),
            models.Index(fields=["worker"]),
            models.Index(fields=["fecha_pago"]),
        ]

    def __str__(self):
        return f"Liq #{self.consecutivo} — {self.worker} ({self.fecha_pago})"


class WorkerScopingQuerySet(models.QuerySet):
    def for_organization(self, organization):
        return self.filter(worker__user__organization=organization)


class MovimientoDeuda(models.Model):
    """Movimiento de saldo de deuda de un trabajador."""

    worker = models.ForeignKey(
        WorkerProfile,
        on_delete=models.PROTECT,
        related_name="movimientos",
    )
    tipo = models.ForeignKey(
        "catalogs.TipoMovimientoDeuda",
        on_delete=models.PROTECT,
        related_name="movimientos",
    )
    monto = models.DecimalField(max_digits=10, decimal_places=2)
    concepto = models.TextField(blank=True)
    fecha = models.DateField()
    liquidacion = models.ForeignKey(
        Liquidacion,
        on_delete=models.PROTECT,
        related_name="movimientos",
        null=True,
        blank=True,
    )
    registrado_por = models.ForeignKey(
        User,
        on_delete=models.PROTECT,
        related_name="movimientos_creados",
    )
    registrado_en = models.DateTimeField(auto_now_add=True)

    objects = WorkerScopingQuerySet.as_manager()

    class Meta:
        verbose_name = "Movimiento de deuda"
        verbose_name_plural = "Movimientos de deuda"
        ordering = ["-fecha"]
        indexes = [
            models.Index(fields=["worker", "fecha"]),
            models.Index(fields=["liquidacion"]),
        ]

    def __str__(self):
        return f"{self.worker} — {self.tipo.name} {self.monto} ({self.fecha})"

    @property
    def signed_amount(self):
        """Positivo si suma al saldo (préstamo/ajuste), negativo si resta (abono)."""
        return self.monto if self.tipo.affects_balance else -self.monto


class PaymentWorkdayDetail(models.Model):
    """Detalle de trabajo dentro de un comprobante (audit)."""

    payment = models.ForeignKey(
        "payments.Liquidacion",
        on_delete=models.CASCADE,
        related_name="workday_details",
    )
    workday_id = models.BigIntegerField(
        help_text="ID del Workday. Sin FK por dependencia circular workdays↔payments.",
    )
    applied_amount = models.DecimalField(max_digits=10, decimal_places=2)

    class Meta:
        verbose_name = "Detalle workday-liquidación"
        verbose_name_plural = "Detalles workday-liquidación"

    def __str__(self):
        return f"PWD {self.payment_id} wd={self.workday_id}"


class PaymentLoanDetail(models.Model):
    """Detalle de movimiento de deuda dentro de un comprobante."""

    payment = models.ForeignKey(
        Liquidacion,
        on_delete=models.CASCADE,
        related_name="loan_details",
    )
    loan = models.ForeignKey(
        MovimientoDeuda,
        on_delete=models.PROTECT,
        related_name="payment_details",
    )
    paid_amount = models.DecimalField(max_digits=10, decimal_places=2)

    class Meta:
        verbose_name = "Detalle loan-liquidación"
        verbose_name_plural = "Detalles loan-liquidación"
        constraints = [
            models.UniqueConstraint(
                fields=["payment", "loan"],
                name="unique_payment_loan",
            ),
        ]

    def __str__(self):
        return f"PLD {self.payment_id} loan={self.loan_id}"
