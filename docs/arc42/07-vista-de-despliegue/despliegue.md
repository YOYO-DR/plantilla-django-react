# 07 — Deployment View

Cómo se despliega el sistema. Infraestructura, servicios y pipeline.

## Topología — entorno local (docker-compose.local.yml)

```mermaid
graph TB
  subgraph host [Host local]
    direction TB
    DJ[django:8000<br/>Gunicorn + whitenoise]
    FE[frontend:5173<br/>Vite dev server]
    CW[celeryworker]
    CB[celerybeat]
    FL[flower:5555<br/>Celery monitor]
  end

  subgraph data [Datos]
    PB[pgbouncer:6432]
    PG[postgres:5432]
    RD[redis:6379]
  end

  DJ --> PB
  CW --> PB
  CB --> PB
  FL --> PB
  PB --> PG
  CW --> RD
  CB --> RD
  DJ --> RD
```

Servicios definidos en `docker-compose.local.yml`:

| Servicio | Imagen custom | Puerto host | Función |
|----------|---------------|-------------|---------|
| `django` | `compose/local/django/Dockerfile` | 8000 | API REST |
| `postgres` | `compose/production/postgres/Dockerfile` | 5432 (interno) | Datos |
| `pgbouncer` | `compose/production/pgbouncer/Dockerfile` | 6432 | Pool de conexiones |
| `redis` | `redis:7.2` | 6379 | Broker Celery + cache |
| `celeryworker` | `compose/local/django/Dockerfile` | (sin puerto) | Tareas async |
| `celerybeat` | `compose/local/django/Dockerfile` | (sin puerto) | Programador |
| `flower` | `compose/local/django/Dockerfile` | 5555 | Monitor Celery |
| `frontend` | `compose/local/Dockerfile` | 5173 | Vite dev |

## Topología — producción (Dokploy)

```mermaid
graph TB
  subgraph prod [Producción - Dokploy]
    NGINX[nginx:443<br/>HTTPS + static]
    DJ[django<br/>Gunicorn]
    FE[frontend build<br/>nginx estático]
  end

  subgraph data [Datos]
    PB[pgbouncer]
    PG[postgres]
    RD[redis]
  end

  NGINX --> DJ
  NGINX --> FE
  DJ --> PB
  PB --> PG
  DJ --> RD
```

Definido en `docker-compose.production.yml`. La diferencia con local:

- nginx al frente para TLS termination.
- El frontend se sirve como estático (no dev server).
- Postgres con backups automatizados (cron en compose).

## Pipeline de despliegue

```
git push origin main
    ↓
GitHub Actions (futuro: por ahora se hace manual con Dokploy)
    ↓
Dokploy detecta cambio en main
    ↓
docker compose -f docker-compose.production.yml pull
docker compose -f docker-compose.production.yml up -d
docker compose -f docker-compose.production.yml exec django python manage.py migrate
docker compose -f docker-compose.production.yml exec django python manage.py collectstatic --noinput
```

## Configuración

### Variables de entorno (django)

Definidas en el `.env` de la raíz (plantilla en `.env.example`):

```bash
DJANGO_SECRET_KEY=...           # requerido
DJANGO_DEBUG=False              # True sólo en local
DJANGO_ALLOWED_HOSTS=*          # en prod: dominios reales
DATABASE_URL=postgresql://user:pwd@pgbouncer:6432/db
REDIS_URL=redis://redis:6379/0
JWT_REFRESH_TOKEN_DAYS=7
CORS_ALLOWED_ORIGINS=https://app.jornalpro.dev
JWT_COOKIE_SECURE=True          # True en prod
```

### Variables de entorno (postgres)

Definidas también en el `.env` de la raíz, que es la única fuente:

```bash
POSTGRES_HOST=postgres
POSTGRES_PORT=5432
POSTGRES_DB=jornalpro
POSTGRES_USER=jornalpro
POSTGRES_PASSWORD=...
```

## Observabilidad

### Logs

- Aplicación: `WatchedFileHandler` a `backend/logs/${DJANGO_NAME_LOG_FILE}.log`.
- Rotación diaria vía Celery beat (`apps.utils.rotate_logs`).
- Django request logger en WARNING.
- Apps logger en INFO.

### Métricas (futuro)

- Prometheus + grafana NO está integrado todavía. Q1 post-MVP.

### Alertas (futuro)

- Sin alertas automatizadas todavía. Q2 post-MVP.

## Backups

- Postgres: backup automático vía compose (`maintenance/_sourced/yes_no.sh`).
- Frecuencia: diaria (en producción).
- Retención: 30 días.

## Escalabilidad

Estado actual:

- Vertical: hasta ~50 tenants activos en un solo contenedor Django.
- Horizontal: Gunicorn con N workers = N cores. Detrás de nginx con
  load balancer (futuro).

Cuando lleguemos a >50 tenants activos simultáneos, evaluar:
- Extraer `apps.payments` a un servicio separado (es el más pesado).
- Mover sesiones a Redis (hoy en DB).
- CDN para estáticos del frontend.

Ver [docs/PGBOUNCER_OPTIMAL.md](../../PGBOUNCER_OPTIMAL.md) para tuning
de Postgres + pgbouncer.
