"""Catálogos reutilizables de JornalPro.

Tablas de catálogo para reglas de negocio configurables: tipos de
jornada, estados de pago, estados de préstamo y métodos de pago. Se
resuelven en español en la UI y se exponen vía API.
"""

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

    def __str__(self) -> str:
        return self.name


class WorkdayType(CatalogBase):
    """Tipo de jornada con factor multiplicador sobre la tarifa del trabajador."""

    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="workday_types",
        null=True,
        blank=True,
        verbose_name="Organización",
        help_text="Vacío = catálogo global compartido por todas las organizaciones.",
    )
    factor = models.DecimalField(
        max_digits=4,
        decimal_places=2,
        default="1.00",
        verbose_name="Factor",
    )

    class Meta(CatalogBase.Meta):
        verbose_name = "Tipo de jornada"
        verbose_name_plural = "Tipos de jornada"
        constraints = [
            models.UniqueConstraint(
                fields=["organization", "name"],
                name="unique_workday_type_per_org",
            ),
        ]
        indexes = [models.Index(fields=["is_active"])]


class PaymentStatus(CatalogBase):
    """Estado de pago de una jornada (Pendiente, Parcial, Pagado)."""

    class Meta(CatalogBase.Meta):
        verbose_name = "Estado de pago"
        verbose_name_plural = "Estados de pago"
        constraints = [
            models.UniqueConstraint(fields=["name"], name="unique_payment_status"),
        ]
        indexes = [models.Index(fields=["is_active"])]


class LoanStatus(CatalogBase):
    """Estado del préstamo (Activo, Pagado, Condonado)."""

    class Meta(CatalogBase.Meta):
        verbose_name = "Estado de préstamo"
        verbose_name_plural = "Estados de préstamo"
        constraints = [
            models.UniqueConstraint(fields=["name"], name="unique_loan_status"),
        ]
        indexes = [models.Index(fields=["is_active"])]


class PaymentMethod(CatalogBase):
    """Método de pago de un comprobante (Efectivo, Transferencia, Nequi, Daviplata)."""

    class Meta(CatalogBase.Meta):
        verbose_name = "Método de pago"
        verbose_name_plural = "Métodos de pago"
        constraints = [
            models.UniqueConstraint(fields=["name"], name="unique_payment_method"),
        ]
        indexes = [models.Index(fields=["is_active"])]
