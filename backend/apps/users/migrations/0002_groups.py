"""Data migration: crea los grupos ``django.contrib.auth.Group`` canónicos."""

from django.db import migrations


def create_groups(apps, schema_editor):
    Group = apps.get_model("auth", "Group")
    for name in ("AdminPlataforma", "Maestro", "Trabajador"):
        Group.objects.get_or_create(name=name)


def remove_groups(apps, schema_editor):
    Group = apps.get_model("auth", "Group")
    Group.objects.filter(name__in=("AdminPlataforma", "Maestro", "Trabajador")).delete()


class Migration(migrations.Migration):
    dependencies = [("users", "0001_initial")]
    operations = [migrations.RunPython(create_groups, reverse_code=remove_groups)]
