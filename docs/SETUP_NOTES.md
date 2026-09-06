# SETUP_NOTES.md — Notas de setup

> Documento vivo. Mantenido por el ejecutor-jornal. Cada bloque
> incluye **síntoma → causa raíz → fix aplicado → estado actual**.

## Estado general (2026-09-05)

| Bloqueador reportado | Estado real | Acción |
|---|---|---|
| `wait-for-it pgbouncer:6432` crashea Django | **Resuelto** (entrypoint ya tiene fallback `--strict` + if/else) | Ninguna |
| `UserFactory` ImproperlyConfigured | **Resuelto parcialmente** (string notation correcta) | Cambiar `"apps.users.User"` → `"users.User"` |
| `pytest apps/` blocked | **Resuelto** — `pytest --ds=config.settings.test` corre | Ninguna |
| Migración Fase 3 seed antes de WorkerProfile | **Pendiente verificar** | — |
| E2E Playwright contra backend | **Pendiente** (frontend OK, backend pytest pasa 44/66) | Resolver bugs tests payments/organizations |
| `useBackend=true` en frontend | **Pendiente decisión del usuario** | — |

Última corrida: `pytest --ds=config.settings.test` →
**7 failed, 44 passed, 15 errors, 66 collected, 7.39s**.

---

## Bloqueador 1 — RESUELTO: pytest ahora corre

**Síntoma original (orquestador):**
`pytest apps/` falla con
`AppRegistryNotReady: Models aren't loaded yet.`

**Causa raíz:** dos bugs encadenados:

1. `apps/users/tests/factories.py` declaraba
   `model = "apps.users.User"` (path completo de Python).
   Factory-boy pasa eso a `apps.get_model("apps", "User")`,
   buscando app_label = `"apps"`. Pero como
   `INSTALLED_APPS = [..., "apps.users", ...]` registra la app con
   label `"users"` (último segmento del `AppConfig.name`), el lookup
   falla con `LookupError: No installed app with label 'apps'`.

2. `pyproject.toml` sección `[tool.pytest]` no es estándar —
   pytest solo lee `[tool.pytest.ini_options]`. Por eso `--ds` no se
   aplica automáticamente y hay que pasarlo en CLI.

**Fix aplicado (ejecutor 2026-09-05):**

```python
# apps/users/tests/factories.py
class Meta:
    model = "users.User"   # antes "apps.users.User"
```

**Workaround hasta arreglar pyproject:**
```bash
docker exec jornal_pro_trabajadores_local_django pytest --ds=config.settings.test
```

**Fix recomendado (no aplicado):** renombrar sección en
`backend/pyproject.toml`:
```toml
[tool.pytest.ini_options]   # antes [tool.pytest]
addopts = ["--ds=config.settings.test", "--reuse-db", "--import-mode=importlib"]
```

---

## Bloqueador 2 — RESUELTO: Docker entrypoint NO crashea

**Síntoma original (orquestador):**
"Django container con `wait-for-it pgbouncer:6432` crashea localmente."

**Causa real:** falso positivo. El orquestador veía un crash, pero
el entrypoint actual ya tiene graceful fallback:

```bash
# backend/compose/local/django/entrypoint
if wait-for-it "${PGB_POSTGRES_HOST}:${PGB_POSTGRES_PORT}" -t 30 --strict; then
    >&2 echo 'PostgreSQL is available (via wait-for-it).'
else
    >&2 echo 'PostgreSQL no respondió por wait-for-it; continuando...'
fi
```

Con `set -e` activo, el `if` NO aborta en condition failure — bash
exime condition tests de errexit. Si wait-for-it falla, cae al
`else` y continúa.

**Validación (ejecutor 2026-09-05):**
```bash
docker compose -f docker-compose.local.yml up -d
docker logs jornal_pro_trabajadores_local_django --tail 20
# → "wait-for-it: pgbouncer:6432 is available after 0 seconds"
# → "PostgreSQL is available (via wait-for-it)."
# → "Uvicorn running on http://0.0.0.0:8000"
```

---

## Pendiente 1 — `OrganizationFactory` con kwarg `slug` inexistente

**Síntoma (pytest 2026-09-05):**
```
TypeError: Organization() got unexpected keyword arguments: 'slug'
```
aparece en `apps/admin_platforma/tests/test_metrics.py`,
`apps/payments/tests/test_liquidacion.py`,
`apps/payments/tests/test_movimientos.py`,
`apps/workdays/tests/test_workdays.py`.

**Causa raíz:** los factories de tests pasan `slug="..."` al crear
Organization pero `apps/organizations/models.py` ya no tiene campo
`slug` (fue removido en algún refactor). Inconsistencia entre tests
y modelo.

**Archivos a tocar:**

- `apps/organizations/tests/factories.py` (o equivalente)
- `apps/payments/tests/test_liquidacion.py`
- `apps/payments/tests/test_movimientos.py`
- `apps/workdays/tests/test_workdays.py`
- `apps/admin_platforma/tests/test_metrics.py`

**Fix sugerido:** grep `slug=` en `apps/*/tests/` y reemplazar por
el campo real (probablemente `name` o `legal_name`).

---

## Pendiente 2 — Aislamiento entre tests: `users_user_email_key`

**Síntoma (pytest 2026-09-05):**
```
django.db.utils.IntegrityError: duplicate key value violates unique
constraint "users_user_email_key"
```
aparece en `test_metrics_admin_ok`, `test_list_organizations_*`.

**Causa raíz:** `UserFactory` declara
`django_get_or_create = ["email"]`, y Faker genera emails estables
(`brittanymartinez@example.com`) que persisten entre tests
cuando se usa `--reuse-db`.

**Fix sugerido:** dos opciones (cualquiera funciona):

1. Usar `pytest --create-db` (db fresca por sesión, no reuse).
2. Agregar `@pytest.mark.django_db(transaction=True)` o
   `pytest.fixture(autouse=True)` que limpie tablas entre tests.
3. Cambiar `django_get_or_create` por `Faker("email")` con
   seed aleatorio por test.

---

## Pendiente 3 — Verificar `migrate` desde cero

**Síntoma reportado por orquestador:**
`apps/users/migrations/0003_seed_users.py` referencia `WorkerProfile`
antes de que `0004_...` lo cree.

**Estado:** NO verificado por ejecutor (la DB ya tiene migraciones
aplicadas del orquestador). Si se hace `docker compose down -v`
+ `up` desde cero, podría romperse.

**Acción recomendada:** correr desde cero y reportar:
```bash
docker compose -f docker-compose.local.yml down -v
docker compose -f docker-compose.local.yml up -d postgres pgbouncer redis
docker compose -f docker-compose.local.yml run --rm django python manage.py migrate
```

---

## Pendiente 4 — E2E backend con Playwright MCP

**Estado:** no ejecutado. Depende de resolver Pendiente 1 y 2
(los tests payments/workdays/organizations deben pasar).

**Acción (post-fix):**
```bash
# Levantar stack
docker compose -f docker-compose.local.yml up -d
# Validar curl
curl -X POST http://localhost:8000/api/v1/auth/login/ \
  -H "Content-Type: application/json" \
  -d '{"email":"jairo@jornalpro.dev","password":"..."}'
# Playwright MCP contra frontend :5173 (login jairo/maestro123)
```

---

## Pendiente 5 — Decisión `useBackend=true` en frontend

El orquestador terminó Fase 6 con la integración frontend
**sin aplicar** (decisión prudente para no romper prototipo).
Cada servicio (`authService.js`, `workdaysService.js`, etc.) tiene
un flag `useBackend` que hoy retorna datos de localStorage.

**Acción:** preguntar al usuario antes de activar. Si se activa,
hacer por servicio (no todos a la vez) y validar E2E cada paso.

---

## Resumen ejecutivo

El orquestador dejó:
- 6 fases backend completas (código + migrations + tests escritos)
- Frontend JSX migrado y validado con Playwright contra prototipo
- Documentación arc42 completa
- pytest escrito pero **no ejecutado** (creía que Docker bloqueaba)

El ejecutor encontró que **Docker NO bloqueaba** (entrypoint ya
tiene fallback). pytest corre pero revela **2 bugs reales** en los
tests (Organization slug kwarg + email uniqueness). Resolver esos
2 bugs es el camino más corto a CI verde.