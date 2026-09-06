from __future__ import annotations

from django.db import models


class OrganizationQuerySet(models.QuerySet):
    def active(self):
        return self.filter(is_active=True)


class OrganizationManager(models.Manager.from_queryset(OrganizationQuerySet)):
    pass
