# 04 — Solution Strategy

Las decisiones estratégicas que guían la arquitectura. Cada decisión
tiene un "por qué" concreto y un trade-off conocido.

## Top-level strategy: monolito modular Django

JornalPro es un **monolito Django** estructurado como un conjunto de
bounded contexts (cada uno = una `app` Django). No usamos microservicios.

**Por qué:**

- El equipo es pequeño (1-3 devs). La complejidad operativa de
  microservicios no se justifica.
- Los bounded contexts comparten `Organization` (multi-tenant base) y
  `User`. Partir esto en microservicios introduce JOINs remotos.
- Desplegar es 1 comando: `docker compose up`. Sin service mesh.

**Trade-off:** el monolito escala verticalmente. Cuando lleguemos a
>100 tenants activos simultáneos, podemos extraer `payments` o
`workdays` como servicio separado. Hoy es prematuro.

## Stack técnico

```
┌─────────────────────────────────────────────────────┐
│ Frontend (browser)                                  │
│   React 19 + Vite + shadcn/ui + Tailwind            │
│   Zustand (auth) + sessionStorage                   │
└─────────────────────┬───────────────────────────────┘
                      │ HTTPS + JWT
┌─────────────────────▼───────────────────────────────┐
│ Backend                                            │
│   Django 6.0.6 + DRF 3.x + SimpleJWT               │
│   Multi-app: organizations, users, catalogs,        │
│   workdays, payments, custom_auth, admin_platforma  │
└─────────────────────┬───────────────────────────────┘
                      │ TCP + pgbouncer
┌─────────────────────▼───────────────────────────────┐
│ Datos                                              │
│   Postgres 18 + Redis 7.2 + Celery 5.x             │
└─────────────────────────────────────────────────────┘
```

## Decisiones estratégicas

### S1. Multi-tenant: shared schema con `organization_id`

Todas las tablas tenant-specific tienen `organization_id` (FK nullable
a `Organization`). El filtro se aplica en cada `ViewSet.get_queryset()`.

- **Pro:** 1 sola DB, JOINs eficientes, backups únicos.
- **Contra:** si olvidas el filtro, hay fuga. Mitigado por
  `permissions.IsSameOrganization` + tests de aislamiento.

### S2. Auth: SimpleJWT + refresh HttpOnly cookie

- Access token: 5 min, en memoria (Zustand) + Authorization header.
- Refresh token: 7 días, en cookie HttpOnly + SameSite=Lax.
- Logout: blacklistea el refresh + limpia Zustand.

- **Pro:** inmunes a XSS (la cookie HttpOnly no es legible desde JS).
- **Contra:** vulnerable a CSRF si no usamos SameSite=Strict. Mitigado
  con SameSite=Lax + verificación de Origin en middleware.

Ver [ADR-001](08_architectural_decisions.md#adr-001).

### S3. Liquidación: snapshot inmutable en JSONField

`Liquidacion.detalle` es un JSONField que se llena **al momento de
liquidar** con una copia de las jornadas. Aunque cambies la tarifa de
una Workday después, el comprobante NO cambia.

- **Pro:** auditoría trivial (los auditores ven el comprobante y la
  realidad actual, y comparan).
- **Contra:** más espacio en disco. Mitigado: las liquidaciones son
  semanales, no diarias (~50/año por trabajador).

Ver [ADR-003](08_architectural_decisions.md#adr-003).

### S4. Cálculo de jornal: el backend es la fuente de verdad

El frontend tiene `lib/calculo.ts` con la lógica original (de Fase 0
del proyecto, previa al backend). En Fase 6, esa lógica se reemplaza
por llamadas al backend (`liquidacionesService.liquidar`).

- **Pro:** no se puede "engañar" al backend haciendo POST con valores
  trucados. El cálculo vive en `services/liquidacion.py` y los tests
  lo cubren.
- **Contra:** la UI es menos responsiva (round-trip HTTP). Mitigado:
  el cálculo es barato (<10 ms), y el usuario está acostumbrado a
  "Guardar" en formularios web.

### S5. Catálogos globales con `CatalogBase` abstract

`WorkdayType`, `PaymentStatus`, `TipoMovimientoDeuda`, `PaymentMethod`
heredan de `CatalogBase` (abstract model con `name`, `order`,
`is_active`, FK a `Organization`).

- **Pro:** 1 sola tabla por catálogo, fácil de seedear, fácil de listar.
- **Contra:** no permite valores únicos-por-tenant sin extender el
  modelo. Hoy no lo necesitamos.

## Tácticas para alcanzar los objetivos de calidad

| Objetivo | Táctica |
|----------|---------|
| **Q1. Aislamiento multi-tenant** | `select_related('worker__user__organization')` + filtro `organization_id` en cada `get_queryset()`. Test `test_list_isolation` en cada app. |
| **Q2. Sin N+1** | `select_related()` para FKs, `prefetch_related()` para inversas. Test `test_*_no_n_plus_1` con `CaptureQueriesContext`. |
| **Q3. Audit inmutable** | JSONField `detalle` en `Liquidacion`. Test `test_snapshot_detalle_no_cambia_si_se_edita_workday`. |

## Decisiones que conscientemente NO tomamos

- ❌ GraphQL. REST es suficiente para 7 endpoints.
- ❌ WebSockets. No necesitamos push real-time.
- ❌ Event sourcing. El estado actual de Postgres es suficiente.
- ❌ CQRS. El modelo es lo bastante simple.
- ❌ TypeScript en el frontend. JSX con PropTypes implícitos es OK
  para un equipo pequeño.

Si alguna de estas "faltan" llega a doler, las añadimos. Mientras
tanto, YAGNI.
