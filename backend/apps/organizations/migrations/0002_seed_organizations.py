from django.db import migrations


def seed_organizations(apps, schema_editor):
    Organization = apps.get_model("organizations", "Organization")
    for name in ["Construcciones Jairo", "Construcciones Wilson"]:
        Organization.objects.get_or_create(name=name)


class Migration(migrations.Migration):
    dependencies = [("organizations", "0001_initial")]
    operations = [migrations.RunPython(seed_organizations, migrations.RunPython.noop)]
