from __future__ import annotations

from django.contrib.auth.base_user import BaseUserManager
from django.db import models


class UserQuerySet(models.QuerySet):
    def admin_plataforma(self):
        return self.filter(is_staff=True, organization__isnull=True)

    def of_organization(self, org):
        return self.filter(organization=org)


class UserManager(BaseUserManager.from_queryset(UserQuerySet)):
    def create_user(self, email, password=None, **extra_fields):
        if not email:
            msg = "El email es obligatorio."
            raise ValueError(msg)
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        return self.create_user(email, password, **extra_fields)
