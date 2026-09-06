from django.contrib.auth.hashers import make_password
from django.db import migrations


SEED = [
    {"email": "admin@jornalpro.dev", "password": "admin123", "name": "Admin Plataforma",
     "is_staff": True, "is_superuser": True, "organization": None,
     "groups": ["AdminPlataforma"]},
    {"email": "jairo@jornalpro.dev", "password": "maestro123", "name": "Jairo Restrepo",
     "is_staff": False, "organization": "Construcciones Jairo", "groups": ["Maestro"]},
    {"email": "wilson@jornalpro.dev", "password": "maestro123", "name": "Wilson Cárdenas",
     "is_staff": False, "organization": "Construcciones Wilson", "groups": ["Maestro"]},
    {"email": "carlos@jornalpro.dev", "password": "obra123", "name": "Carlos Mosquera",
     "is_staff": False, "organization": "Construcciones Jairo", "groups": ["Trabajador"],
     "worker_profile": {"id_document": "1234567890", "hire_date": "2024-01-15"}},
    {"email": "duvan@jornalpro.dev", "password": "obra123", "name": "Duván Riascos",
     "is_staff": False, "organization": "Construcciones Jairo", "groups": ["Trabajador"],
     "worker_profile": {"id_document": "2345678901", "hire_date": "2024-02-01"}},
    {"email": "edinson@jornalpro.dev", "password": "obra123", "name": "Édinson Palacios",
     "is_staff": False, "organization": "Construcciones Jairo", "groups": ["Trabajador"],
     "worker_profile": {"id_document": "3456789012", "hire_date": "2024-03-01"}},
    {"email": "wilmar@jornalpro.dev", "password": "obra123", "name": "Wilmar Angulo",
     "is_staff": False, "organization": "Construcciones Jairo", "groups": ["Trabajador"],
     "worker_profile": {"id_document": "4567890123", "hire_date": "2024-03-15"}},
    {"email": "freddy@jornalpro.dev", "password": "obra123", "name": "Freddy Caicedo",
     "is_staff": False, "organization": "Construcciones Jairo", "groups": ["Trabajador"],
     "worker_profile": {"id_document": "5678901234", "hire_date": "2024-04-01"}},
    {"email": "yeison@jornalpro.dev", "password": "obra123", "name": "Yeison Bonilla",
     "is_staff": False, "organization": "Construcciones Jairo", "groups": ["Trabajador"],
     "worker_profile": {"id_document": "6789012345", "hire_date": "2024-04-15"}},
]


def seed_users(apps, schema_editor):
    User = apps.get_model("users", "User")
    Group = apps.get_model("auth", "Group")
    Organization = apps.get_model("organizations", "Organization")
    WorkerProfile = apps.get_model("users", "WorkerProfile")

    for entry in SEED:
        org = None
        if entry.get("organization"):
            try:
                org = Organization.objects.get(name=entry["organization"])
            except Organization.DoesNotExist:
                continue

        user, created = User.objects.get_or_create(
            email=entry["email"],
            defaults={
                "name": entry["name"],
                "is_staff": entry.get("is_staff", False),
                "is_superuser": entry.get("is_superuser", False),
                "organization": org,
            },
        )
        if created:
            user.password = make_password(entry["password"])
            user.save()

        for g_name in entry.get("groups", []):
            try:
                user.groups.add(Group.objects.get(name=g_name))
            except Group.DoesNotExist:
                pass

        if entry.get("worker_profile"):
            WorkerProfile.objects.update_or_create(
                user=user,
                defaults={
                    "id_document": entry["worker_profile"]["id_document"],
                    "hire_date": entry["worker_profile"]["hire_date"],
                    "is_active": True,
                },
            )


class Migration(migrations.Migration):
    dependencies = [("users", "0002_groups")]
    operations = [migrations.RunPython(seed_users, migrations.RunPython.noop)]
