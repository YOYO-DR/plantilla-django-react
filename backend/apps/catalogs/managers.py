from __future__ import annotations

from django.db import models


class CatalogQuerySet(models.QuerySet):
    def active(self):
        return self.filter(is_active=True)


class CatalogManager(models.Manager.from_queryset(CatalogQuerySet)):
    pass
