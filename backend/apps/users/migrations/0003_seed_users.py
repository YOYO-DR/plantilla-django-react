"""
Migración vacía (no-op).

Los usuarios demo del orquestador quedaron obsoletos al pasar a proyecto
real. El seed canónico vive ahora en:

    python manage.py seed_users

Ver ``apps/users/management/commands/seed_users.py`` y docs/README.
"""

from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [("users", "0002_groups")]
    operations = [migrations.RunPython(migrations.RunPython.noop, migrations.RunPython.noop)]