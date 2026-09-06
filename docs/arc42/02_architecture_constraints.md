# 02 — Architecture Constraints

Restricciones técnicas, organizativas y de negocio que **limitan** las
decisiones arquitectónicas.

## Restricciones técnicas

| # | Restricción | Impacto |
|---|-------------|---------|
| T1 | **Django 6.0.6** como framework backend | Heredamos patrones DRF, ORM, migraciones. |
| T2 | **React 19 + Vite** como framework frontend | Hooks, JSX, sin TypeScript en la capa de UI. |
| T3 | **Postgres 18** como base de datos | Aprovechamos JSONField, índices GIN, `select_for_update`. |
| T4 | **pgbouncer** en modo `transaction` | Forzó `server_reset_query = DEALLOCATE ALL` y `statement_timeout` corto. |
| T5 | **SimpleJWT** para autenticación | Tokens en cookie HttpOnly + Authorization header. |
| T6 | **Multi-app Django** (un `apps/<dominio>` por bounded context) | No mezclar `Workday` con `User` en el mismo archivo. |
| T7 | **pre-commit obligatorio** (ruff + djLint + pyproject-fmt) | Código formateado y lint-clean antes de commit. |
| T8 | **pnpm** para el frontend (no npm ni yarn) | Lockfile pnpm-lock.yaml. |

## Restricciones organizativas

| # | Restricción | Impacto |
|---|-------------|---------|
| O1 | **Plan `plan-001-jornalpro-backend.md`** gobierna las fases | Cada fase tiene un OK explícito del orquestador. |
| O2 | **Convenciones de nombres Django** | `apps/<bounded_context>/api/{router,viewsets,serializers}.py`. |
| O3 | **Tests junto al código** | `apps/<bounded_context>/tests/test_*.py`. |
| O4 | **Sin sobre-ingeniería** | "El código no escrito es el mejor código". No añadir abstracciones por si acaso. |
| O5 | **Idioma del dominio: español** | Los nombres de campos visibles al usuario están en español (`jornada`, `liquidación`, `abono`). Los nombres técnicos (clases Python, URLs) en inglés. |

## Restricciones de negocio

| # | Restricción | Impacto |
|---|-------------|---------|
| B1 | **Multi-tenant estricto** | Datos de un maestro NO son visibles a otro. |
| B2 | **Liquidaciones inmutables** | Una vez creadas, no se editan. Para corregir, se crea una rectificación. |
| B3 | **Roles fijos**: AdminPlataforma, Maestro, Trabajador | Definidos en `apps/users/migrations/0002_groups.py`. |
| B4 | **Snapshot de auditoría** | Cada Liquidación guarda su detalle en JSONField para auditores. |
| B5 | **Seed de demo con 9 usuarios** | `apps/users/migrations/0003_seed_users.py`. |

## Convenciones específicas del proyecto

### Naming

- Modelos: `PascalCase` en singular (`Workday`, no `Workdays`).
- Endpoints API: `kebab-case` plural (`/api/movimientos-deuda/`).
- Campos JSONField: `snake_case`.
- Permisos: prefijo `Is` (`IsAdminPlataforma`, `IsSameOrganization`).
- Tests: prefijo `test_` y nombre descriptivo en español
  (`test_liquidar_con_descuento_parcial`).

### Layout de archivos

```
backend/
├── apps/
│   ├── <bounded_context>/
│   │   ├── __init__.py
│   │   ├── apps.py
│   │   ├── models.py
│   │   ├── serializers.py            # sólo si el bounded context expone API
│   │   ├── permissions.py            # sólo si tiene permisos custom
│   │   ├── migrations/
│   │   ├── api/
│   │   │   ├── __init__.py
│   │   │   ├── router.py             # registra ViewSets en DRF router
│   │   │   ├── viewsets.py           # ModelViewSet / ReadOnlyModelViewSet
│   │   │   └── serializers.py        # serializers específicos de API
│   │   ├── services/                 # lógica de negocio transaccional
│   │   │   └── <accion>.py
│   │   └── tests/
│   │       ├── __init__.py
│   │       └── test_<accion>.py
├── config/
│   ├── api_router.py                 # agrega urlpatterns de cada app
│   ├── settings/
│   │   ├── base.py
│   │   ├── local.py
│   │   └── production.py
│   └── urls.py
└── compose/
    ├── local/
    └── production/
```

### Reglas de import

- `apps.<bounded_context>.models` no debe importar de `apps.<otro>.models`
  salvo `User` y `Organization` (que son transversales).
- `services/` puede importar de `models/` y de otros `services/`,
  pero NO de `api/`.
- `api/` puede importar de `models/`, `services/`, `permissions/`.
- Los type-hints circulares van a `TYPE_CHECKING` block (ver
  `apps/payments/services/liquidacion.py`).
