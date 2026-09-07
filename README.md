# JornalPro

SaaS para que **maestros de obra** en Colombia gestionen el jornal
diario de sus trabajadores: jornadas, tarifas, deudas (préstamos y
adelantos), liquidaciones semanales y comprobantes inmutables.

Construido como monorepo con:

- **Backend:** Django 6 + DRF + SimpleJWT + Postgres 18 + pgbouncer + Redis + Celery.
- **Frontend:** React 19 + Vite + shadcn/ui + Tailwind + Zustand.
- **Multi-tenant:** Shared schema con filtro por `organization_id` (ver
  [`docs/arc42/09-decisiones-de-arquitectura/decisiones.md`](docs/arc42/09-decisiones-de-arquitectura/decisiones.md) y
  [`docs/arc42/08-conceptos-transversales/README.md`](docs/arc42/08-conceptos-transversales/README.md#multi-tenancy)).
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
  [`docs/arc42/09-decisiones-de-arquitectura/decisiones.md`](docs/arc42/09-decisiones-de-arquitectura/decisiones.md)
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

## Puertas de calidad (gates)

Antes de abrir un PR o de pedir review de un cambio, las tres puertas
deben estar verdes:

```bash
# 1) Backend: pytest + cobertura global >=90%, services de dinero al 100%.
just test-backend --cov

# 2) Migraciones: no debe haber migraciones nuevas sin commitear.
just manage makemigrations --check --dry-run
# Salida esperada: "No changes detected". Exit code: 0.

# 3) Lint + format (ruff, ruff-format, djLint, …).
# ⚠️  TRAMPA: el `pre-commit` que está en el $PATH de este entorno está
# ROTO. Hay que usar el del pyenv explícitamente; si ejecutas
# `pre-commit run` a secas, sale verde pero no valida nada.
~/.pyenv/versions/3.14.2/bin/pre-commit run --all-files
# La primera pasada puede reformatear archivos (ruff-format, djLint);
# se relanza hasta exit 0 en la 2ª o 3ª corrida.
```

`just test` ejecuta las tres suites (`all`, `backend`, `frontend`).
Ver `justfile` para más recetas (`docs-build`, `docs-serve`, `ci-local`).

## Convenciones

- Commits: feat|fix|chore|docs(scope): description.
- Branches: feat/*, fix/*, chore/*, docs/*.
- pre-commit obligatorio antes de push (usando `~/.pyenv/versions/3.14.2/bin/pre-commit`).
- Tests junto al código en `apps/<bounded_context>/tests/`.

## Variables de entorno

El **`.env` de la raíz es la única fuente de variables** del proyecto.
Todos los compose (`local`, `docs`, `prod`, `production`, `dokploy`) leen
ese archivo y solo ese: no hay variables repartidas por subcarpetas.

```bash
cp .env.example .env              # desarrollo local
cp .env.production.example .env   # despliegue
```

Las dos plantillas documentan todas las variables con sus valores por
defecto. El `.env` real **nunca se commitea**: está en `.gitignore`.

## Despliegue en producción

Hay **dos archivos** de compose para producción, según dónde despliegues.
**No son intercambiables** — cada uno asume una topología distinta:

| Archivo | Cuándo usarlo | Red interna | Cómo publica 80/443 |
|---------|---------------|-------------|----------------------|
| [`docker-compose.prod.yml`](docker-compose.prod.yml) | VPS con Docker standalone (sin Dokploy) | Crea su propia red `internal_backend` | Traefik publica 80/443 al host |
| [`docker-compose.dokploy.yml`](docker-compose.dokploy.yml) | Dokploy (PaaS que orquesta contenedores) | Usa `dokploy-network` externa | Traefik gestiona el routing dentro de Dokploy |

**Regla práctica**: si tu servidor es un VPS limpio y haces
`docker compose up -d` directamente, usa `.prod.yml`. Si Dokploy
gestiona tus stacks, usa `.dokploy.yml`.

### Despliegue con `docker-compose.prod.yml` (VPS standalone)

- 10 servicios: django, postgres, pgbouncer, redis, celeryworker,
  celerybeat, flower, nginx (media), frontend, traefik.
- Healthcheck en `django` (`curl http://localhost:8000/api/`).
- Volúmenes nombrados para postgres, redis, media, logs y ACME.
- Traefik con Let's Encrypt automático. Variables en `.env`:
  `DOMAIN` (obligatoria), `VITE_API_URL`, `CELERYWORKER_CPU/RAM`,
  `PGBOUNCER_CPU/RAM`, etc. Ver [`.env.example`](.env.example).

```bash
# 1. Configurar variables en .env (ver .env.example)
cp .env.example .env
# editar .env con los valores reales

# 2. Levantar
docker compose -f docker-compose.prod.yml up -d

# 3. Verificar el certificado Let's Encrypt
docker logs <contenedor-traefik>
```

### Despliegue con `docker-compose.dokploy.yml` (Dokploy)

- Servicios con sufijo `_jornal` para evitar colisiones DNS en la red
  `dokploy-network` compartida.
- Volúmenes nombrados para postgres, media, logs y certificados ACME.
- Reverse proxy con Let's Encrypt automático vía Traefik.
- Recursos (CPU/RAM) parametrizables vía variables de entorno.

```bash
# 1. Crear red `dokploy-network` en el servidor si no existe.
# 2. Configurar las variables en `.env` de Dokploy (ver .env.example).
# 3. docker compose -f docker-compose.dokploy.yml up -d
# 4. Verificar Traefik emitió el certificado con `docker logs <contenedor-traefik>`
```

Detalle completo de cada servicio y variables en
[`docs/arc42/07-vista-de-despliegue/despliegue.md`](docs/arc42/07-vista-de-despliegue/despliegue.md).

## Licencia

Privado. Todos los derechos reservados.
