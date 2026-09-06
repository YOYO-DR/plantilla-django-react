from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as AuthUserAdmin
from django.utils.translation import gettext_lazy as _

from .models import User
from .models import WorkerProfile


@admin.register(User)
class UserAdmin(AuthUserAdmin):
    ordering = ("email",)
    list_display = ("email", "name", "organization", "is_staff", "is_superuser")
    fieldsets = (
        (None, {"fields": ("email", "password")}),
        (_("Información personal"), {"fields": ("name", "phone")}),
        (_("Organización"), {"fields": ("organization",)}),
        (
            _("Permisos"),
            {
                "fields": (
                    "is_active",
                    "is_staff",
                    "is_superuser",
                    "groups",
                    "user_permissions",
                ),
            },
        ),
        (_("Fechas importantes"), {"fields": ("last_login", "date_joined")}),
    )
    add_fieldsets = (
        (
            None,
            {"classes": ("wide",), "fields": ("email", "password1", "password2")},
        ),
    )
    search_fields = ("email", "name")


@admin.register(WorkerProfile)
class WorkerProfileAdmin(admin.ModelAdmin):
    list_display = ("user", "id_document", "hire_date", "is_active")
    search_fields = ("user__email", "user__name", "id_document")
