# JornalPro

SaaS para que **maestros de obra** en Colombia gestionen el jornal
diario de sus trabajadores: jornadas, tarifas, deudas (préstamos y
adelantos), liquidaciones semanales y comprobantes inmutables.

Construido como monorepo con:

- **Backend:** Django 6 + DRF + SimpleJWT + Postgres 18 + pgbouncer + Redis + Celery.
- **Frontend:** React 19 + Vite + shadcn/ui + Tailwind + Zustand.
- **Multi-tenant:** Shared schema con filtro por `organization_id` (ver
  `docs/arc42/08_architectural_decisions.md` para el ADR).
- **Documentación arc42:** ver [`docs/arc42/README.md`](docs/arc42/README.md).

## Quick start (con Docker)

```bash
# Levantar todo el stack
docker compose -f docker-compose.local.yml up

# Backend: http://localhost:8000/api/
# Frontend: http://localhost:5173/
# Flower (Celery monitor): http://localhost:5555/
```

## Roles de demo

Tras `manage.py migrate` (incluye seed), hay **9 usuarios** distribuidos
en **2 tenants**. Contraseñas en texto plano sólo para el seed de demo:

| Email | Password | Rol | Tenant | Notas |
|-------|----------|-----|--------|-------|
| `admin@jornalpro.dev` | `admin123` | Admin Plataforma | (ninguno) | Ve métricas globales. |
| `jairo@jornalpro.dev` | `maestro123` | Maestro | Construcciones Jairo | Tenant A. |
| `wilson@jornalpro.dev` | `maestro123` | Maestro | Construcciones Wilson | Tenant B. |
| `carlos@jornalpro.dev` | `obra123` | Trabajador | Construcciones Jairo | Cédula 1234567890. |
| `duvan@jornalpro.dev` | `obra123` | Trabajador | Construcciones Jairo | Cédula 2345678901. |
| `edinson@jornalpro.dev` | `obra123` | Trabajador | Construcciones Jairo | Cédula 3456789012. |
| `wilmar@jornalpro.dev` | `obra123` | Trabajador | Construcciones Jairo | Cédula 4567890123. |
| `freddy@jornalpro.dev` | `obra123` | Trabajador | Construcciones Jairo | Cédula 5678901234. |
| `yeison@jornalpro.dev` | `obra123` | Trabajador | Construcciones Jairo | Cédula 6789012345. |

**Cómo probar el aislamiento multi-tenant:**

1. Login con `jairo@jornalpro.dev` → ve 6 trabajadores (sus 6).
2. Login con `wilson@jornalpro.dev` → ve 0 trabajadores (Tenant B vacío).
3. Login con `admin@jornalpro.dev` → ve los 2 tenants + métricas.

**Cómo probar una liquidación:**

1. Login con `jairo@jornalpro.dev` → /app/maestro.
2. Registrar algunas jornadas para `carlos@jornalpro.dev`.
3. Ir a "Asistente de liquidación", seleccionar las jornadas, modo
   `ninguno` o `parcial` con un monto.
4. Ver el comprobante generado (snapshot inmutable).

## Estructura del repo

```
.
├── backend/                          # Django + DRF
│   ├── apps/
│   │   ├── organizations/            # Tenant model
│   │   ├── users/                    # User, WorkerProfile, WorkerRate
│   │   ├── custom_auth/              # JWT login + refresh + logout + me
│   │   ├── catalogs/                 # 4 catálogos reutilizables
│   │   ├── workdays/                 # Workday + applied_rate auto
│   │   ├── payments/                 # Liquidacion snapshot + MovimientoDeuda
│   │   ├── admin_platforma/          # Métricas globales
│   │   └── utils/                    # Utilidades varias
│   ├── config/                       # Settings + URL routing
│   ├── compose/                      # Dockerfiles local + production
│   └── pyproject.toml
├── frontend/                         # React 19 + Vite
│   ├── src/
│   │   ├── api/                      # authService, workdaysService, liquidacionesService, ...
│   │   ├── components/               # Maestro, Trabajador, Admin, ui
│   │   ├── context/                  # DataContext (con useBackend flag)
│   │   ├── store/                    # authStore (Zustand)
│   │   └── pages/
│   └── package.json
├── docs/
│   ├── arc42/                        # Documentación arc42 (11 archivos)
│   ├── PGBOUNCER_OPTIMAL.md          # Tuning pgbouncer + postgres
│   └── SETUP_NOTES.md                # Pendientes para CI verde
├── docker-compose.local.yml          # Stack local
├── docker-compose.production.yml     # Stack producción
├── docker-compose.dokploy.yml        # Para Dokploy
└── README.md                         # Este archivo
```

## Endpoints principales

| Método | URL | Quién | Qué hace |
|--------|-----|-------|----------|
| POST | `/api/auth/token/` | público | Login. Devuelve access + cookie refresh. |
| POST | `/api/auth/refresh/` | cookie | Rota refresh, devuelve nuevo access. |
| POST | `/api/auth/logout/` | autenticado | Blacklisteaa refresh + limpia cookie. |
| GET | `/api/auth/me/` | autenticado | Devuelve el usuario actual. |
| GET/POST | `/api/workdays/` | autenticado | CRUD de jornadas. |
| GET/POST | `/api/movimientos-deuda/` | autenticado | CRUD de movimientos de deuda. |
| GET | `/api/liquidaciones/` | autenticado | Lista comprobantes (multi-tenant). |
| POST | `/api/liquidaciones/liquidar/` | autenticado | Ejecuta la transacción R6. |
| GET | `/api/catalogs/workday-types/` | autenticado | Lista tipos de jornada. |
| GET | `/api/catalogs/payment-statuses/` | autenticado | Lista estados de pago. |
| GET | `/api/admin/metrics/` | admin plataforma | Métricas globales. |

## Documentación

- **Arquitectura:** [`docs/arc42/README.md`](docs/arc42/README.md)
- **Decisiones arquitectónicas (ADRs):**
  [`docs/arc42/08_architectural_decisions.md`](docs/arc42/08_architectural_decisions.md)
- **Tuning pgbouncer/postgres:** [`docs/PGBOUNCER_OPTIMAL.md`](docs/PGBOUNCER_OPTIMAL.md)
- **Pendientes de setup:** [`docs/SETUP_NOTES.md`](docs/SETUP_NOTES.md)

## Desarrollo local sin Docker (avanzado)

```bash
# Backend
cd backend
uv sync
DJANGO_READ_DOT_ENV_FILE=True uv run python manage.py migrate
DJANGO_READ_DOT_ENV_FILE=True uv run python manage.py runserver

# Frontend
cd frontend
pnpm install
pnpm dev
```

Requiere Postgres 18 y Redis 7 corriendo localmente. NO recomendado —
usa Docker.

## Convenciones

- Commits: feat|fix|chore|docs(scope): description.
- Branches: feat/*, fix/*, chore/*, docs/*.
- pre-commit obligatorio antes de push.
- Tests junto al código en `apps/<bounded_context>/tests/`.

## Licencia

Privado. Todos los derechos reservados.
