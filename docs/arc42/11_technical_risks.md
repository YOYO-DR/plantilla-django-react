# 11 — Technical Risks

Riesgos técnicos conocidos, deuda arquitectónica y cosas a tener en
cuenta al evolucionar el sistema.

## R1. pytest bloqueado por `apps/conftest.py` (ALTO)

**Síntoma:** `pytest apps/` falla con
`AppRegistryNotReady: Models aren't loaded yet.` originado en
`apps/users/tests/factories.py:8`.

**Causa:** `apps/users/tests/factories.py` define
`class UserFactory(DjangoModelFactory)` con `model = "users.User"`.
`factory.django.DjangoModelFactory` resuelve el modelo en `__new__`,
lo que ocurre al importar el módulo — antes de que Django termine
de cargar las apps.

**Mitigación actual:** los tests se pueden ejecutar con
`docker compose -f docker-compose.local.yml run --rm django python
manage.py test apps.payments.tests.test_liquidacion -v 2`, que NO
carga conftest.py.

**Fix recomendado (post-MVP):**

- Mover el factory de `apps/users/tests/factories.py` a un módulo
  separado que se importe DESPUÉS de que Django esté listo.
- O usar `@classmethod` para resolver el modelo lazy.
- O usar `factory.LazyAttribute` + pasar el modelo manualmente.

**Impacto si no se arregla:** los tests pytest están bloqueados. Los
tests que sí corren son `manage.py test`, que es más lento y menos
flexible.

## R2. Migración Fase 3 `0003_seed_users` referencia WorkerProfile antes de existir (MEDIO)

**Síntoma:** `manage.py migrate` desde cero falla en
`apps/users/migrations/0003_seed_users.py` con
`LookupError: App 'users' doesn't have a 'WorkerProfile' model.`

**Causa:** La migración de seed (0003) corre ANTES que la migración
0004 que crea WorkerProfile. El seed intenta usar el modelo que aún
no existe en el state de Django.

**Mitigación actual:** Si la DB ya tiene las migraciones aplicadas,
no se re-ejecutan. Sólo bloquea `migrate` desde cero.

**Fix recomendado (post-MVP):**

- Mover el seed a una migración 0005 (después de 0004).
- O hacer el seed defensivo: `try: WorkerProfile = apps.get_model("users", "WorkerProfile"); except LookupError: return`.

**Impacto si no se arregla:** un dev nuevo no puede hacer
`manage.py migrate` desde cero. Tiene que aplicar Fase 1-4 manualmente
o usar el backup de la DB.

## R3. Cálculo client-side residual en frontend (BAJO)

**Síntoma:** `frontend/src/lib/calculo.ts` aún contiene la lógica
original de cálculo de jornal de Fase 0 (anterior al backend).

**Mitigación actual:** Fase 6 introduce `useBackend = true` en
`DataContext.jsx` y se crea `AsistenteLiquidacionRefactored.jsx`
que consume `liquidacionesService.liquidar()`.

**Riesgo:** si `useBackend = false` se queda activo por accidente en
producción, las liquidaciones se calculan client-side y se persisten
localmente (sin audit trail).

**Fix recomendado:** post-MVP, eliminar `calculo.ts` y forzar
`useBackend = true` por defecto. Hoy se deja por compatibilidad con
el prototipo.

## R4. Sin monitoring / alertas (MEDIO)

**Síntoma:** Si el backend se cae en producción, no nos enteramos
hasta que un usuario reporta.

**Mitigación:** Dokploy tiene health checks básicos, pero no hay
Prometheus, Grafana, Sentry ni alertas por Slack/email.

**Fix recomendado (post-MVP):**

- Añadir Sentry para capturar excepciones del backend.
- Añadir Prometheus + Grafana para métricas.
- Configurar alertas (Slack webhook) para: 5xx rate > 1%, latency
  p95 > 1s, queue Celery > 100.

## R5. Sin rate limiting (MEDIO)

**Síntoma:** Cualquier usuario puede hacer miles de requests a
`/api/auth/token/` para enumerar emails (slow attack) o agotar el
pool de pgbouncer.

**Mitigación:** hoy no hay rate limiting.

**Fix recomendado (post-MVP):** añadir `django-ratelimit` o
configurar rate limiting en nginx antes del upstream Django.

## R6. CORS configuration permissive (BAJO)

**Síntoma:** `CORS_ALLOWED_ORIGINS` se lee de env var
`DJANGO_CORS_ALLOWED_ORIGINS`. Si está vacía, default = `[]` y
ningún origen puede hacer requests cross-origin con credenciales.

**Riesgo:** si en producción se olvida configurar esta var, los
requests del frontend serán rechazados con CORS error.

**Fix recomendado:** añadir check en `manage.py check --deploy` o
en un middleware que falle loud si la var está vacía y DEBUG=False.

## R7. Sin HTTPS local (BAJO)

**Síntoma:** en local, los requests van por HTTP. La cookie
`refresh_token` se manda sin cifrar (aunque va por localhost).

**Mitigación:** aceptable en local. En producción, nginx + Dokploy
manejan TLS termination.

**Riesgo:** ninguno significativo porque localhost no es sniffable.

## R8. Dependencia de Docker para todo (MEDIO)

**Síntoma:** pre-commit funciona local sin Docker. Pero
`manage.py` requiere psycopg + Redis + Postgres + Celery. Sin Docker,
el dev no puede correr el backend.

**Mitigación:** la plantilla provee `docker compose up` y todos los
onboarding nuevos empiezan por ahí.

**Riesgo:** devs en máquinas sin Docker (Windows Home < versión
reciente) tendrán fricción.

**Fix:** documentar alternativa con Postgres nativo + virtualenv,
pero NO es prioridad.

## R9. Snapshot `Liquidacion.detalle` crece con cada corrección (BAJO)

**Síntoma:** si una liquidación tiene un error, hay que crear una
"Liquidación de rectificación" (no implementada). Con el tiempo,
un trabajador con muchas correcciones tendrá N liquidaciones.

**Mitigación:** aceptable. El snapshot es pequeño (~1 KB por
liquidación con 5 jornadas).

**Riesgo:** ninguno significativo. La tabla crece ~50 filas/año/
trabajador como máximo.

## R10. Sin versionado de API (BAJO)

**Síntoma:** no hay `/api/v1/`, `/api/v2/`. Si cambiamos un
serializer, los frontends viejos rompen.

**Mitigación:** hoy el frontend y backend viven en el mismo
monorepo y se despliegan juntos. No hay riesgo de skew.

**Riesgo:** si en el futuro hay clientes externos consumiendo la
API (ej: app móvil),我们会 romperlos sin versionado.

**Fix:** añadir versionado cuando haya un segundo cliente.

---

## Resumen de riesgos por prioridad

| # | Riesgo | Prioridad | Acción |
|---|--------|-----------|--------|
| R1 | pytest bloqueado | ALTO | Mover factory fuera de import-time |
| R2 | Migración seed antes de modelo | MEDIO | Mover seed a migración 0005 |
| R3 | Calculo client-side residual | BAJO | Eliminar `calculo.ts` post-MVP |
| R4 | Sin monitoring | MEDIO | Añadir Sentry + Grafana |
| R5 | Sin rate limiting | MEDIO | Añadir django-ratelimit |
| R6 | CORS misconfigured | BAJO | Check en startup |
| R7 | Sin HTTPS local | BAJO | Aceptable |
| R8 | Dependencia Docker | MEDIO | Documentar alternativa |
| R9 | Snapshot crece | BAJO | Aceptable |
| R10 | Sin versionado API | BAJO | Añadir cuando haya 2º cliente |
