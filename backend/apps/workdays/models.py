"""Jornadas de trabajo y tarifas por trabajador."""

from __future__ import annotations

from django.db import models

from apps.catalogs.models import PaymentStatus
from apps.catalogs.models import WorkdayType
from apps.users.models import User
from apps.users.models import WorkerProfile


class WorkerRate(models.Model):
    """Tarifa vigente de un trabajador."""

    worker = models.ForeignKey(
        WorkerProfile,
        on_delete=models.CASCADE,
        related_name="rates",
        verbose_name="Trabajador",
    )
    amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        verbose_name="Valor",
    )
    valid_from = models.DateField(verbose_name="Vigente desde")
    valid_until = models.DateField(
        null=True,
        blank=True,
        verbose_name="Vigente hasta",
        help_text="Vacío = vigente de forma indefinida.",
    )

    class Meta:
        verbose_name = "Tarifa de trabajador"
        verbose_name_plural = "Tarifas de trabajador"
        ordering = ["-valid_from"]
        indexes = [models.Index(fields=["worker", "valid_from"])]

    def __str__(self) -> str:
        return f"{self.worker} — {self.amount} desde {self.valid_from}"


class WorkerScopingQuerySet(models.QuerySet):
    """QuerySet que filtra por organización del usuario vía worker.user."""

    def for_organization(self, organization):
        return self.filter(worker__user__organization=organization)


class Workday(models.Model):
    """Una jornada de trabajo de un WorkerProfile en una fecha."""

    worker = models.ForeignKey(
        WorkerProfile,
        on_delete=models.PROTECT,
        related_name="workdays",
        verbose_name="Trabajador",
    )
    workday_type = models.ForeignKey(
        WorkdayType,
        on_delete=models.PROTECT,
        related_name="workdays",
        verbose_name="Tipo de jornada",
    )
    payment_status = models.ForeignKey(
        PaymentStatus,
        on_delete=models.PROTECT,
        related_name="workdays",
        verbose_name="Estado de pago",
    )
    date = models.DateField(verbose_name="Fecha")
    applied_rate = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        verbose_name="Valor aplicado",
        help_text=(
            "Valor realmente pagado este día; puede diferir de la tarifa vigente."
        ),
    )
    notes = models.TextField(blank=True, verbose_name="Notas")
    created_by = models.ForeignKey(
        User,
        on_delete=models.PROTECT,
        related_name="workdays_created",
        verbose_name="Creado por",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    objects = WorkerScopingQuerySet.as_manager()

    class Meta:
        verbose_name = "Jornada"
        verbose_name_plural = "Jornadas"
        ordering = ["-date"]
        indexes = [
            models.Index(fields=["worker", "date"]),
            models.Index(fields=["payment_status"]),
            models.Index(fields=["date"]),
        ]

    def __str__(self) -> str:
        return f"{self.worker} — {self.date}"
