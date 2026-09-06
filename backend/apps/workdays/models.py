from __future__ import annotations

from django.db import models

from apps.catalogs.models import WorkdayType, PaymentStatus
from apps.users.models import User, WorkerProfile


class WorkerScopingQuerySet(models.QuerySet):
    """QuerySet que filtra por organización del usuario vía worker.user."""

    def for_organization(self, organization):
        return self.filter(worker__user__organization=organization)


class Workday(models.Model):
    """Una jornada de trabajo de un WorkerProfile en una fecha."""

    worker = models.ForeignKey(
        WorkerProfile, on_delete=models.PROTECT, related_name="workdays"
    )
    workday_type = models.ForeignKey(
        WorkdayType, on_delete=models.PROTECT, related_name="workdays"
    )
    payment_status = models.ForeignKey(
        PaymentStatus, on_delete=models.PROTECT, related_name="workdays"
    )
    date = models.DateField()
    applied_rate = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        help_text="Valor realmente pagado este día (puede diferir de la tarifa vigente).",
    )
    notes = models.TextField(blank=True)
    liquidacion_id = models.BigIntegerField(
        null=True,
        blank=True,
        help_text="ID de la liquidación que bloquea esta jornada. Sin FK por dependencia circular workdays↔payments.",
    )
    created_by = models.ForeignKey(
        User, on_delete=models.PROTECT, related_name="workdays_created"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    objects = WorkerScopingQuerySet.as_manager()

    class Meta:
        verbose_name = "Jornada"
        verbose_name_plural = "Jornadas"
        ordering = ["-date"]
        constraints = [
            models.UniqueConstraint(
                fields=["worker", "date"], name="unique_workday_per_worker_date"
            ),
        ]
        indexes = [
            models.Index(fields=["worker", "date"]),
            models.Index(fields=["payment_status"]),
            models.Index(fields=["date"]),
        ]

    def __str__(self):
        return f"{self.worker} — {self.date}"
