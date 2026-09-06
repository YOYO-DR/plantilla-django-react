from django.db import migrations


def create_groups(apps, schema_editor):
    Group = apps.get_model("auth", "Group")
    for n in ["AdminPlataforma", "Maestro", "Trabajador"]:
        Group.objects.get_or_create(name=n)


def remove_groups(apps, schema_editor):
    Group = apps.get_model("auth", "Group")
    Group.objects.filter(name__in=["AdminPlataforma", "Maestro", "Trabajador"]).delete()


class Migration(migrations.Migration):
    dependencies = [("users", "0001_initial")]
    operations = [migrations.RunPython(create_groups, remove_groups)]
