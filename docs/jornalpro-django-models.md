# JornalPro — Modelos y apps de Django

> Documento de referencia para implementar con Claude Code. Basado en el MER de JornalPro (app multi-tenant para que cada maestro de obra administre su cuadrilla: jornadas, tarifas variables, préstamos y liquidaciones).
>
> Convención: identificadores de código (apps, clases, campos, funciones) en inglés. Comentarios, docstrings, `verbose_name` y datos de catálogo (contenido que ve el usuario final) en español.

## Stack asumido

- Django 5.x + PostgreSQL
- Multi-tenant por fila (shared schema), aislamiento vía `organization`
- Roles con `django.contrib.auth.models.Group` — nada de un campo `role` hardcodeado
- Todo lo que sea regla de negocio configurable (tipos de jornada, estados, métodos de pago) es tabla de catálogo, no `choices=`

## Estructura de apps

```
jornalpro/
├── config/            # settings, urls, wsgi/asgi
├── organizations/     # tenant raíz
├── users/             # User (AUTH_USER_MODEL), WorkerProfile
├── catalogs/          # tablas de catálogo reutilizables
├── workdays/          # WorkerRate, Workday
└── payments/          # Loan, Payment, detalles de conciliación
```

Dependencias: `users` depende de `organizations`; `workdays` depende de `users` y `catalogs`; `payments` depende de `users`, `workdays` y `catalogs`. `catalogs` y `organizations` no dependen de nadie — ponlas primero en `INSTALLED_APPS`.

```python
# config/settings.py
INSTALLED_APPS = [
    # ...
    "organizations",
    "catalogs",
    "users",
    "workdays",
    "payments",
]

AUTH_USER_MODEL = "users.User"
```

---

## 1. `organizations`

```python
# organizations/models.py
from django.db import models


class Organization(models.Model):
    name = models.CharField(max_length=150)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Organización"
        verbose_name_plural = "Organizaciones"
        ordering = ["name"]

    def __str__(self):
        return self.name
```

Raíz del tenant. Hoy es 1:1 con cada maestro, pero al desacoplarla de `User` se permite que una organización tenga varios usuarios administradores en el futuro sin tocar el esquema.

---

## 2. `catalogs`

```python
# catalogs/models.py
from django.db import models
from organizations.models import Organization


class CatalogBase(models.Model):
    """Base abstracta para todas las tablas de catálogo."""
    name = models.CharField(max_length=100)
    is_active = models.BooleanField(default=True)
    order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        abstract = True
        ordering = ["order", "name"]

    def __str__(self):
        return self.name


class WorkdayType(CatalogBase):
    """Día completo, medio día, hora extra... con un factor multiplicador sobre la tarifa."""
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="workday_types",
        null=True,
        blank=True,
        help_text="Vacío = catálogo global compartido por todas las organizaciones.",
    )
    factor = models.DecimalField(max_digits=4, decimal_places=2, default=1.00)

    class Meta(CatalogBase.Meta):
        verbose_name = "Tipo de jornada"
        verbose_name_plural = "Tipos de jornada"
        unique_together = ("organization", "name")


class PaymentStatus(CatalogBase):
    class Meta(CatalogBase.Meta):
        verbose_name = "Estado de pago"
        verbose_name_plural = "Estados de pago"


class LoanStatus(CatalogBase):
    class Meta(CatalogBase.Meta):
        verbose_name = "Estado de préstamo"
        verbose_name_plural = "Estados de préstamo"


class PaymentMethod(CatalogBase):
    class Meta(CatalogBase.Meta):
        verbose_name = "Método de pago"
        verbose_name_plural = "Métodos de pago"
```

Semillas sugeridas (data migration, no hardcodeadas en el modelo — el contenido de estos registros se queda en español porque es lo que ve el maestro/trabajador en la app):

- `WorkdayType`: Día completo (factor 1.00), Medio día (factor 0.50)
- `PaymentStatus`: Pendiente, Parcial, Pagado
- `LoanStatus`: Activo, Pagado, Condonado
- `PaymentMethod`: Efectivo, Transferencia, Nequi, Daviplata

---

## 3. `users`

```python
# users/models.py
from django.contrib.auth.models import AbstractUser
from django.db import models
from organizations.models import Organization


class User(AbstractUser):
    organization = models.ForeignKey(
        Organization,
        on_delete=models.SET_NULL,
        related_name="users",
        null=True,
        blank=True,
        help_text="Vacío solo para staff de plataforma sin organización asignada.",
    )
    phone = models.CharField(max_length=20, blank=True)

    class Meta:
        verbose_name = "Usuario"
        verbose_name_plural = "Usuarios"

    def __str__(self):
        return self.get_full_name() or self.username


class WorkerProfile(models.Model):
    user = models.OneToOneField(
        User, on_delete=models.CASCADE, related_name="worker_profile"
    )
    id_document = models.CharField(max_length=30, blank=True)
    hire_date = models.DateField(null=True, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        verbose_name = "Perfil de trabajador"
        verbose_name_plural = "Perfiles de trabajador"

    def __str__(self):
        return str(self.user)

    @property
    def organization(self):
        return self.user.organization

    @property
    def current_rate(self):
        from django.utils import timezone
        return self.rates.filter(
            models.Q(valid_until__isnull=True)
            | models.Q(valid_until__gte=timezone.now().date())
        ).order_by("-valid_from").first()
```

Roles: sin campo `role`. Se resuelven con `Group` de `django.contrib.auth` — crea los grupos "Maestro" y "Trabajador" en una data migration (ver más abajo). El nombre del grupo es un dato, no un identificador de código, así que se queda en español (es lo que ve el maestro en el admin). Asigna los `Permission` de cada modelo al grupo correspondiente; un rol nuevo ("Supervisor", etc.) es un grupo más — cero cambios de esquema.

---

## 4. `workdays`

```python
# workdays/models.py
from django.db import models
from users.models import User, WorkerProfile
from catalogs.models import WorkdayType, PaymentStatus


class WorkerRate(models.Model):
    worker = models.ForeignKey(
        WorkerProfile, on_delete=models.CASCADE, related_name="rates"
    )
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    valid_from = models.DateField()
    valid_until = models.DateField(null=True, blank=True)

    class Meta:
        verbose_name = "Tarifa de trabajador"
        verbose_name_plural = "Tarifas de trabajador"
        ordering = ["-valid_from"]

    def __str__(self):
        return f"{self.worker} — {self.amount} desde {self.valid_from}"


class Workday(models.Model):
    worker = models.ForeignKey(
        WorkerProfile, on_delete=models.PROTECT, related_name="workdays"
    )
    workday_type = models.ForeignKey(
        WorkdayType, on_delete=models.PROTECT, related_name="workdays"
    )
    payment_status = models.ForeignKey(
        PaymentStatus, on_delete=models.PROTECT, related_name="workdays"
    )
    date = models.DateField()
    applied_rate = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        help_text="Valor realmente pagado ese día; puede diferir de la tarifa vigente.",
    )
    notes = models.TextField(blank=True)
    created_by = models.ForeignKey(
        User, on_delete=models.PROTECT, related_name="workdays_created"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Jornada"
        verbose_name_plural = "Jornadas"
        ordering = ["-date"]
        indexes = [models.Index(fields=["worker", "date"])]

    def __str__(self):
        return f"{self.worker} — {self.date}"
```

---

## 5. `payments`

```python
# payments/models.py
from django.db import models
from users.models import User, WorkerProfile
from catalogs.models import LoanStatus, PaymentMethod
from workdays.models import Workday


class Loan(models.Model):
    worker = models.ForeignKey(
        WorkerProfile, on_delete=models.PROTECT, related_name="loans"
    )
    status = models.ForeignKey(
        LoanStatus, on_delete=models.PROTECT, related_name="loans"
    )
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    outstanding_balance = models.DecimalField(max_digits=10, decimal_places=2)
    date = models.DateField()
    reason = models.TextField(blank=True)
    created_by = models.ForeignKey(
        User, on_delete=models.PROTECT, related_name="loans_created"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Préstamo"
        verbose_name_plural = "Préstamos"
        ordering = ["-date"]

    def __str__(self):
        return f"{self.worker} — {self.amount}"


class Payment(models.Model):
    worker = models.ForeignKey(
        WorkerProfile, on_delete=models.PROTECT, related_name="payments"
    )
    payment_method = models.ForeignKey(
        PaymentMethod, on_delete=models.PROTECT, related_name="payments"
    )
    total_amount = models.DecimalField(max_digits=10, decimal_places=2)
    payment_date = models.DateField()
    notes = models.TextField(blank=True)
    created_by = models.ForeignKey(
        User, on_delete=models.PROTECT, related_name="payments_created"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Pago"
        verbose_name_plural = "Pagos"
        ordering = ["-payment_date"]

    def __str__(self):
        return f"{self.worker} — {self.total_amount} ({self.payment_date})"


class PaymentWorkdayDetail(models.Model):
    payment = models.ForeignKey(
        Payment, on_delete=models.CASCADE, related_name="workday_details"
    )
    workday = models.ForeignKey(
        Workday, on_delete=models.PROTECT, related_name="payment_details"
    )
    applied_amount = models.DecimalField(max_digits=10, decimal_places=2)

    class Meta:
        verbose_name = "Detalle de pago (jornada)"
        verbose_name_plural = "Detalles de pago (jornadas)"
        unique_together = ("payment", "workday")


class PaymentLoanDetail(models.Model):
    payment = models.ForeignKey(
        Payment, on_delete=models.CASCADE, related_name="loan_details"
    )
    loan = models.ForeignKey(
        Loan, on_delete=models.PROTECT, related_name="payment_details"
    )
    paid_amount = models.DecimalField(max_digits=10, decimal_places=2)

    class Meta:
        verbose_name = "Detalle de pago (préstamo)"
        verbose_name_plural = "Detalles de pago (préstamos)"
        unique_together = ("payment", "loan")
```

---

## Aislamiento multi-tenant (sin columna redundante)

Ninguna tabla de `workdays` o `payments` tiene `organization` directo — se llega vía `worker.user.organization`. Es normalizado y evita que una columna duplicada se desincronice. El costo es un join extra al filtrar, aceptable para el volumen esperado de esta app. Si más adelante hace falta, se puede agregar `organization` directo a `Workday`/`Payment`/`Loan` sin romper el modelo existente.

```python
class WorkerScopedQuerySet(models.QuerySet):
    def for_organization(self, organization):
        return self.filter(worker__user__organization=organization)
```

Aplícalo como manager en `Workday`, `Loan` y `Payment` (`objects = WorkerScopedQuerySet.as_manager()`), y en cada vista filtra con `.for_organization(request.user.organization)`.

---

## Notas de lógica de negocio (fuera del esquema)

- Al crear un `PaymentLoanDetail`, restar `paid_amount` de `Loan.outstanding_balance` (en una señal `post_save` o en la capa de servicio/serializer, no en el `save()` del modelo, para que sea testeable).
- Al crear un `Workday` sin `applied_rate` explícita, tomar `worker.current_rate.amount` y aplicar `workday_type.factor` como default.
- Validar (en `clean()` o en el serializer) que el `User` asociado a un `WorkerProfile` pertenezca al grupo "Trabajador".

---

## Grupos y permisos (setup inicial)

Data migration sugerida, por ejemplo en `users/migrations/0002_initial_groups.py`:

```python
from django.db import migrations


def create_groups(apps, schema_editor):
    Group = apps.get_model("auth", "Group")
    Group.objects.get_or_create(name="Maestro")
    Group.objects.get_or_create(name="Trabajador")


class Migration(migrations.Migration):
    dependencies = [("users", "0001_initial")]
    operations = [migrations.RunPython(create_groups, migrations.RunPython.noop)]
```

Después, asigna permisos: al grupo "Maestro" dale `add_workday`, `change_workday`, `add_loan`, `add_payment`, etc.; al grupo "Trabajador" solo los `view_*` de sus propios modelos. El scoping a "solo lo suyo" se resuelve combinando estos permisos con el filtro `for_organization` / `worker=request.user.worker_profile` en las vistas, no con permisos por objeto (no hace falta `django-guardian` para este tamaño de app).
