from __future__ import annotations

from django.db import models

from apps.organizations.managers import OrganizationManager


class Organization(models.Model):
    name = models.CharField(max_length=150, verbose_name="Nombre")
    is_active = models.BooleanField(default=True, verbose_name="Activo")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Creado en")

    objects = OrganizationManager()

    class Meta:
        verbose_name = "Organización"
        verbose_name_plural = "Organizaciones"
        ordering = ["name"]
        indexes = [models.Index(fields=["is_active"])]

    def __str__(self):
        return self.name
