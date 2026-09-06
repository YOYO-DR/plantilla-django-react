from __future__ import annotations

from typing import ClassVar

from django.contrib.auth.models import AbstractUser
from django.db import models
from django.db.models import CharField
from django.db.models import EmailField
from django.urls import reverse
from django.utils.translation import gettext_lazy as _

from apps.organizations.models import Organization

from .managers import UserManager


class User(AbstractUser):
    """Custom user con email como login.

    Reglas:
    - email es USERNAME_FIELD (sin username real).
    - name (first_name) usado como display.
    - organization: si NULL + is_staff=True, es admin plataforma; si tiene, es maestro o trabajador.
    """

    # First and last name do not cover name patterns around the globe
    name = CharField(_("Name of User"), blank=False, max_length=255)
    first_name = None  # type: ignore[assignment]
    last_name = None  # type: ignore[assignment]
    email = EmailField(_("email address"), unique=True)
    username = None  # type: ignore[assignment]
    organization = models.ForeignKey(
        Organization,
        on_delete=models.SET_NULL,
        related_name="users",
        null=True,
        blank=True,
        help_text="Vacío solo para staff de plataforma sin organización asignada.",
    )
    phone = CharField(_("teléfono"), max_length=20, blank=True)

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS: ClassVar[list[str]] = []

    objects: ClassVar[UserManager] = UserManager()

    class Meta:
        verbose_name = "Usuario"
        verbose_name_plural = "Usuarios"

    def __str__(self) -> str:
        return self.get_full_name() or self.email

    def get_absolute_url(self) -> str:
        """Get URL for user's detail view."""
        return reverse("users:detail", kwargs={"pk": self.id})

    @property
    def is_admin_plataforma(self) -> bool:
        return bool(self.is_staff and self.organization_id is None)


class WorkerProfile(models.Model):
    """Perfil adicional si el usuario es un trabajador (no maestro ni admin).

    Relación 1:1 con User. NO para User de rol 'maestro' (esos son admin de su
    propia org).
    """

    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name="worker_profile",
    )
    id_document = CharField(_("documento de identidad"), max_length=30, blank=True)
    hire_date = models.DateField(_("fecha de ingreso"), null=True, blank=True)
    is_active = models.BooleanField(_("activo"), default=True)

    class Meta:
        verbose_name = "Perfil de trabajador"
        verbose_name_plural = "Perfiles de trabajador"

    def __str__(self) -> str:
        return str(self.user)

    @property
    def organization(self):
        return self.user.organization

    @property
    def current_rate(self):
        # Cuando exista WorkerRate en Fase 4 devolverá esa. Por ahora None.
        return None


class WorkerRate(models.Model):
    """Tarifa vigente de un trabajador. Se añade en Fase 4 pero la refactor
    la prepara aquí para no romper migraciones."""

    worker = models.ForeignKey(
        WorkerProfile,
        on_delete=models.CASCADE,
        related_name="rates",
    )
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    valid_from = models.DateField()
    valid_until = models.DateField(null=True, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        verbose_name = "Tarifa de trabajador"
        verbose_name_plural = "Tarifas de trabajador"
        ordering = ["-valid_from"]
        indexes = [models.Index(fields=["worker", "valid_from"])]

    def __str__(self) -> str:
        return f"{self.worker} — {self.amount} desde {self.valid_from}"
