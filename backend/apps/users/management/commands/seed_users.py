"""
Comando de gestión: siembra los usuarios reales de JornalPro.

Crea (o actualiza, si ya existe) los usuarios semilla con los que se
recorre la app:

  - admin@jornalpro.dev    → superuser, sin organización
                             grupo AdminPlataforma (gestiona la plataforma)
  - jairo@jornalpro.dev    → maestro de "Construcciones Jairo"
  - wilson@jornalpro.dev   → maestro de "Construcciones Wilson"
  - carlos@jornalpro.dev   → trabajador bajo Jairo
  - duvan@jornalpro.dev    → trabajador bajo Jairo
  - edinson@jornalpro.dev  → trabajador bajo Jairo

Los emails y passwords vienen de las constantes de abajo; se pueden
sobreescribir con `--email-*` y `--password-*`. Los grupos se leen de
la semilla (`auth.Group` por `name`), así que el comando falla con un
mensaje claro si la migración 0002_groups no corrió.

USO
----
    manage.py seed_users                       # interactivo (pregunta exención)
    manage.py seed_users --yes                 # no-interactivo (corre todo)
    manage.py seed_users --email-admin otro@x.com --password-jairo secreto123
"""

from __future__ import annotations

from datetime import date
from typing import Any

from django.contrib.auth.models import Group
from django.core.management.base import BaseCommand
from django.db import transaction

from apps.organizations.models import Organization
from apps.users.models import User
from apps.users.models import WorkerProfile


# Organización por defecto para maestros y trabajadores (Fase 1 seed: 0002).
ORG_JAIRO = "Construcciones Jairo"
ORG_WILSON = "Construcciones Wilson"

# Estructura: (email, password, group_name, is_staff, is_superuser, organization_name|None,
#              worker_kwargs dict|None).
#
# - `is_superuser=True` solo para admin plataforma.
# - `worker_kwargs` se usa para crear WorkerProfile (id_document, hire_date).
# - El orden importa: el admin se crea ANTES de los maestros porque estos
#   pueden ser FK referenciada en migraciones futuras.
SEED_USERS: list[dict[str, Any]] = [
    {
        "email": "admin@jornalpro.dev",
        "password": "admin123",
        "group": "AdminPlataforma",
        "is_staff": True,
        "is_superuser": True,
        "organization": None,
        "worker": None,
        "name": "Admin Plataforma",
        "phone": "+573001234567",
        "arg_suffix": "admin",
    },
    {
        "email": "jairo@jornalpro.dev",
        "password": "maestro123",
        "group": "Maestro",
        "is_staff": False,
        "is_superuser": False,
        "organization": ORG_JAIRO,
        "worker": None,
        "name": "Jairo Restrepo",
        "phone": "+573001234568",
        "arg_suffix": "jairo",
    },
    {
        "email": "wilson@jornalpro.dev",
        "password": "maestro123",
        "group": "Maestro",
        "is_staff": False,
        "is_superuser": False,
        "organization": ORG_WILSON,
        "worker": None,
        "name": "Wilson Cárdenas",
        "phone": "+573001234569",
        "arg_suffix": "wilson",
    },
    {
        "email": "carlos@jornalpro.dev",
        "password": "obra123",
        "group": "Trabajador",
        "is_staff": False,
        "is_superuser": False,
        "organization": ORG_JAIRO,
        "worker": {"id_document": "1234567890", "hire_date": date(2024, 1, 15)},
        "name": "Carlos Mosquera",
        "phone": "+573001234570",
        "arg_suffix": "carlos",
    },
    {
        "email": "duvan@jornalpro.dev",
        "password": "obra123",
        "group": "Trabajador",
        "is_staff": False,
        "is_superuser": False,
        "organization": ORG_JAIRO,
        "worker": {"id_document": "2345678901", "hire_date": date(2024, 2, 1)},
        "name": "Duván Riascos",
        "phone": "+573001234571",
        "arg_suffix": "duvan",
    },
    {
        "email": "edinson@jornalpro.dev",
        "password": "obra123",
        "group": "Trabajador",
        "is_staff": False,
        "is_superuser": False,
        "organization": ORG_JAIRO,
        "worker": {"id_document": "3456789012", "hire_date": date(2024, 3, 1)},
        "name": "Édinson Palacios",
        "phone": "+573001234572",
        "arg_suffix": "edinson",
    },
]


class Command(BaseCommand):
    help = "Siembra los usuarios reales (admin plataforma, maestros, trabajadores)."

    def add_arguments(self, parser: Any) -> None:
        parser.add_argument(
            "--yes",
            action="store_true",
            help="No-interactivo: aplica todos los usuarios sin pedir confirmación.",
        )
        for u in SEED_USERS:
            parser.add_argument(
                f"--email-{u['arg_suffix']}",
                default=u["email"],
                help=f"Email del usuario {u['arg_suffix']} (default: {u['email']}).",
            )
            parser.add_argument(
                f"--password-{u['arg_suffix']}",
                default=u["password"],
                help=(
                    f"Password del usuario {u['arg_suffix']} "
                    f"(default: {u['password']})."
                ),
            )

    @transaction.atomic
    def handle(self, *args: Any, **options: Any) -> None:
        # --- Resolver los grupos (AdminPlataforma, Maestro, Trabajador) ---
        # Si no están, la migración 0002_groups no corrió — fallar con
        # mensaje claro, no dejar al usuario con grupos rotos.
        groups: dict[str, Group] = {}
        for u in SEED_USERS:
            code = u["group"]
            try:
                groups[code] = Group.objects.get(name=code)
            except Group.DoesNotExist:
                self.stderr.write(
                    self.style.ERROR(
                        f"No existe el grupo '{code}'. ¿Corriste las migraciones "
                        "(just manage migrate)?",
                    ),
                )
                raise SystemExit(1) from None

        # --- Resolver organizaciones (Construcciones Jairo / Wilson) ---
        orgs: dict[str, Organization] = {}
        for u in SEED_USERS:
            org_name = u["organization"]
            if org_name and org_name not in orgs:
                try:
                    orgs[org_name] = Organization.objects.get(name=org_name)
                except Organization.DoesNotExist:
                    self.stderr.write(
                        self.style.ERROR(
                            f"No existe la organización '{org_name}'. ¿Corriste las "
                            "migraciones? (la semilla 0002_seed_organizations.py "
                            "de apps/organizations crea Construcciones Jairo / Wilson)",
                        ),
                    )
                    raise SystemExit(1) from None

        # --- upsert de cada usuario ---
        for u in SEED_USERS:
            email = options[f"email_{u['arg_suffix']}"]
            password = options[f"password_{u['arg_suffix']}"]
            role_group = groups[u["group"]]
            organization = orgs.get(u["organization"]) if u["organization"] else None

            user, created = User.objects.get_or_create(
                email=email,
                defaults={
                    "name": u["name"],
                    "phone": u.get("phone", ""),
                    "is_staff": u["is_staff"],
                    "is_superuser": u["is_superuser"],
                    "is_active": True,
                    "organization": organization,
                },
            )
            # Si ya existía, refrescar campos para que un re-seed siempre
            # deje la BD en el estado conocido del README.
            user.name = u["name"]
            user.phone = u.get("phone", "")
            user.is_staff = u["is_staff"]
            user.is_superuser = u["is_superuser"]
            user.is_active = True
            user.organization = organization

            # Password determinista del seed: en un usuario real no se
            # debería hacer esto; aquí el seed fija la contraseña para que
            # las credenciales del README coincidan siempre con lo sembrado.
            user.set_password(password)

            # Asignar rol (y SOLO ese rol): limpiar grupos viejos para que
            # un re-ejecución no acumule roles obsoletos.
            user.groups.set([role_group])

            user.save()

            # WorkerProfile (1:1 con User). Solo si el seed lo declara.
            if u["worker"]:
                WorkerProfile.objects.update_or_create(
                    user=user,
                    defaults={
                        "id_document": u["worker"]["id_document"],
                        "hire_date": u["worker"]["hire_date"],
                        "is_active": True,
                    },
                )

            verb = "Creado" if created else "Actualizado"
            org_label = organization.name if organization else "—"
            self.stdout.write(
                self.style.SUCCESS(
                    f"{verb} {email} → grupo '{role_group.name}' "
                    f"· org '{org_label}' · password: {password}",
                ),
            )

        self.stdout.write("")
        self.stdout.write(
            self.style.SUCCESS(
                f"Listo: {len(SEED_USERS)} usuarios sembrados/actualizados.",
            ),
        )