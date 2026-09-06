"""Data migration: siembra los catálogos canónicos de JornalPro.

Contenido en español. Idempotente vía ``get_or_create``.
"""

from django.db import migrations


SEED = [
    ("WorkdayType", "Día completo", {"factor": "1.00", "order": 0}),
    ("WorkdayType", "Medio día", {"factor": "0.50", "order": 1}),
    ("PaymentStatus", "Pendiente", {"order": 0}),
    ("PaymentStatus", "Parcial", {"order": 1}),
    ("PaymentStatus", "Pagado", {"order": 2}),
    ("LoanStatus", "Activo", {"order": 0}),
    ("LoanStatus", "Pagado", {"order": 1}),
    ("LoanStatus", "Condonado", {"order": 2}),
    ("PaymentMethod", "Efectivo", {"order": 0}),
    ("PaymentMethod", "Transferencia", {"order": 1}),
    ("PaymentMethod", "Nequi", {"order": 2}),
    ("PaymentMethod", "Daviplata", {"order": 3}),
]


def seed_catalogs(apps, schema_editor):
    for klass_name, name, defaults in SEED:
        Model = apps.get_model("catalogs", klass_name)
        Model.objects.get_or_create(name=name, defaults=defaults)


def unseed_catalogs(apps, schema_editor):
    """Reversa: borra los registros creados por ``seed_catalogs``."""
    for klass_name, name, _defaults in SEED:
        Model = apps.get_model("catalogs", klass_name)
        Model.objects.filter(name=name).delete()


class Migration(migrations.Migration):
    dependencies = [("catalogs", "0001_initial")]
    operations = [
        migrations.RunPython(seed_catalogs, reverse_code=unseed_catalogs),
    ]
