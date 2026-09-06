from __future__ import annotations

from django.db import models

from apps.organizations.models import Organization

from .managers import CatalogManager


class CatalogBase(models.Model):
    """Base abstracta para todas las tablas de catálogo."""

    name = models.CharField(max_length=100, verbose_name="Nombre")
    is_active = models.BooleanField(default=True, verbose_name="Activo")
    order = models.PositiveSmallIntegerField(default=0, verbose_name="Orden")

    objects = CatalogManager()

    class Meta:
        abstract = True
        ordering = ["order", "name"]

    def __str__(self):
        return self.name


class WorkdayType(CatalogBase):
    """Tipo de jornada con factor multiplicador sobre la tarifa."""

    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="workday_types",
        null=True,
        blank=True,
        help_text="Vacío = catálogo global compartido por todas las organizaciones.",
    )
    factor = models.DecimalField(max_digits=4, decimal_places=2, default=1.00, verbose_name="Factor")

    class Meta(CatalogBase.Meta):
        verbose_name = "Tipo de jornada"
        verbose_name_plural = "Tipos de jornada"
        unique_together = ("organization", "name")
        indexes = [models.Index(fields=["is_active"])]


class PaymentStatus(CatalogBase):
    class Meta(CatalogBase.Meta):
        verbose_name = "Estado de pago"
        verbose_name_plural = "Estados de pago"
        unique_together = ("name",)
        indexes = [models.Index(fields=["is_active"])]


class TipoMovimientoDeuda(CatalogBase):
    """Tipo de movimiento sobre la deuda del trabajador (préstamo/abono/ajuste)."""

    affects_balance = models.BooleanField(
        default=True,
        verbose_name="Afecta saldo",
        help_text="Si True, suma al saldo de deuda; si False, resta.",
    )

    class Meta(CatalogBase.Meta):
        verbose_name = "Tipo de movimiento de deuda"
        verbose_name_plural = "Tipos de movimiento de deuda"
        unique_together = ("name",)
        indexes = [models.Index(fields=["is_active"])]


class PaymentMethod(CatalogBase):
    class Meta(CatalogBase.Meta):
        verbose_name = "Método de pago"
        verbose_name_plural = "Métodos de pago"
        unique_together = ("name",)
        indexes = [models.Index(fields=["is_active"])]
