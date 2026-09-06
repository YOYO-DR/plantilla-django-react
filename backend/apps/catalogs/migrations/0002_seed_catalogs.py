from django.db import migrations

SEED = [
    ("WorkdayType", "Día completo", {"factor": "1.00", "order": 0}),
    ("WorkdayType", "Medio día", {"factor": "0.50", "order": 1}),
    ("WorkdayType", "Hora extra", {"factor": "1.50", "order": 2}),
    ("PaymentStatus", "Pendiente", {"order": 0}),
    ("PaymentStatus", "Parcial", {"order": 1}),
    ("PaymentStatus", "Pagado", {"order": 2}),
    ("TipoMovimientoDeuda", "Préstamo", {"affects_balance": True, "order": 0}),
    ("TipoMovimientoDeuda", "Abono", {"affects_balance": False, "order": 1}),
    ("TipoMovimientoDeuda", "Ajuste", {"affects_balance": True, "order": 2}),
    ("PaymentMethod", "Efectivo", {"order": 0}),
    ("PaymentMethod", "Transferencia", {"order": 1}),
    ("PaymentMethod", "Nequi", {"order": 2}),
    ("PaymentMethod", "Daviplata", {"order": 3}),
]


def seed_catalogs(apps, schema_editor):
    for klass_name, name, defaults in SEED:
        Model = apps.get_model("catalogs", klass_name)
        Model.objects.get_or_create(name=name, defaults=defaults)


class Migration(migrations.Migration):
    dependencies = [("catalogs", "0001_initial")]
    operations = [migrations.RunPython(seed_catalogs, migrations.RunPython.noop)]
