# 03 — System Scope and Context

## Contexto de negocio

JornalPro se sitúa entre el **maestro de obra** (usuario primario) y el
**trabajador** (beneficiario), con el **admin plataforma** como
supervisor multi-tenant.

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│                  JornalPro (SaaS)                       │
│                                                         │
│   ┌────────────┐                  ┌────────────┐        │
│   │  Maestro   │ ─── registra ──► │            │        │
│   │ (Tenant A) │   jornadas, paga │            │        │
│   └────────────┘                  │  Backend   │        │
│                                   │  Django +  │        │
│   ┌────────────┐                  │  Postgres  │        │
│   │ Trabajador │ ◄── consulta ──  │            │        │
│   │ (Tenant A) │   sus días, pago │            │        │
│   └────────────┘                  └────────────┘        │
│                                                         │
│   ┌────────────┐                                        │
│   │   Admin    │ ─── métricas ──►                       │
│   │ Plataforma │   globales                            │
│   └────────────┘                                        │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Actores externos

| Actor | Protocolo | Qué hace |
|-------|-----------|----------|
| **Maestro** | HTTPS + JWT | Registra jornadas, crea movimientos de deuda, liquida, ve reportes. |
| **Trabajador** | HTTPS + JWT | Ve sus propias jornadas, movimientos, liquidaciones (modo lectura). |
| **Admin plataforma** | HTTPS + JWT | CRUD de tenants, asigna maestros, ve métricas globales. |
| **Postgres** | TCP vía pgbouncer | Almacén de datos. |
| **Redis** | TCP | Broker de Celery + cache opcional. |
| **Celery worker** | in-process | Tareas async (rotate_logs cada día, futuras: emails). |
| **Celery beat** | in-process | Programador de tareas periódicas. |

## Contexto técnico — interfaces externas

| Sistema | Tipo | Protocolo | Puerto |
|---------|------|-----------|--------|
| Browser (Chrome, Firefox, Safari) | Cliente | HTTPS | 443 |
| PostgreSQL 18 | Almacén | TCP | 5432 (interno) |
| PgBouncer | Pool | TCP | 6432 (expuesto a Django) |
| Redis 7.2 | Cache/Broker | TCP | 6379 |
| SMTP (futuro) | Email | SMTP | 587 |
| Dokploy | Orquestación | SSH + docker compose | N/A |

## Bounded contexts (Django apps)

| App | Responsabilidad |
|-----|-----------------|
| `apps.organizations` | Tenants (Organization) + multi-tenant base. |
| `apps.users` | User (custom), WorkerProfile, WorkerRate, Groups. |
| `apps.custom_auth` | Login, refresh, logout, me — JWT + cookie HttpOnly. |
| `apps.catalogs` | WorkdayType, PaymentStatus, TipoMovimientoDeuda, PaymentMethod. |
| `apps.workdays` | Workday (jornada diaria) + WorkerRate + applied_rate auto. |
| `apps.payments` | Liquidacion (snapshot inmutable), MovimientoDeuda, PaymentWorkdayDetail, PaymentLoanDetail. |
| `apps.admin_platforma` | Métricas globales + (futuro) gestión de tenants. |
| `apps.utils` | Utilidades varias (rotate_logs, etc.). |
| `apps.contrib` | Overrides de contrib (sites migration override). |

## Datos que NO entran al sistema

Por diseño:

- ❌ Datos personales sensibles del trabajador más allá de nombre + cédula.
  No almacenamos dirección, teléfono, datos bancarios, ni fotos.
- ❌ Información fiscal o tributaria. JornalPro no es software contable.
- ❌ Geolocalización. No trackeamos dónde está el maestro.

Esta decisión es deliberada para minimizar el riesgo legal bajo
Habeas Data (Colombia) y reducir la superficie de ataque.
