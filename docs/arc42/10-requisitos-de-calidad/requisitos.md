# 09 — Quality Requirements

Atributos de calidad con métricas concretas. La arquitectura se evalúa
contra estos.

## Q1. Aislamiento multi-tenant

| Aspecto | Detalle |
|---------|---------|
| **Objetivo** | Garantizar que un usuario del Tenant A NO puede ver/modificar datos del Tenant B. |
| **Métrica** | Test automatizado en cada app: `test_*_isolation` verifica que con un usuario del Tenant B autenticado, todas las queries devuelven 0 filas del Tenant A. |
| **Implementación** | `ViewSet.get_queryset()` filtra por `organization_id`. `permissions.IsSameOrganization` valida antes de edit/borrado. |
| **Estado** | ✅ Tests pasando en `apps/users`, `apps/workdays`, `apps/payments`. |

## Q2. Performance — sin N+1

| Aspecto | Detalle |
|---------|---------|
| **Objetivo** | Listar N elementos genera un número **constante** de queries a la DB. |
| **Métrica** | `assert len(ctx) < QUERY_BUDGET=15` en `test_*_no_n_plus_1`. |
| **Implementación** | `select_related()` para FKs, `prefetch_related()` para inversas. |
| **Estado** | ✅ Test en `apps/payments/tests/test_liquidacion.py::test_liquidaciones_list_no_n_plus_1`. |

## Q3. Audit / Inmutabilidad de liquidaciones

| Aspecto | Detalle |
|---------|---------|
| **Objetivo** | Una liquidación creada NO puede ser alterada (ni directa ni indirectamente). |
| **Métrica** | Test `test_snapshot_detalle_no_cambia_si_se_edita_workday` verifica que `liq.detalle` permanece igual tras un intento de modificación de la Workday. |
| **Implementación** | `Liquidacion.detalle` es JSONField copiado al liquidar. `Workday.liquidacion` FK se setea al liquidar; modificar la Workday post-liquidación falla. |
| **Estado** | ✅ Test en `apps/payments/tests/test_liquidacion.py`. |

## Q4. Mantenibilidad

| Aspecto | Detalle |
|---------|---------|
| **Objetivo** | El código debe ser legible para un dev que se incorpora al equipo. |
| **Métrica** | Convención de nombres respetada. Tests junto al código. Docstrings en clases y servicios. |
| **Implementación** | pre-commit (ruff + djLint + pyproject-fmt) bloquea código mal formateado. Docstrings en español. |
| **Estado** | ✅ pre-commit pasa en todos los archivos. |

## Q5. Seguridad

| Aspecto | Detalle |
|---------|---------|
| **Objetivo** | La app no es vulnerable a OWASP Top 10 trivial. |
| **Métrica** | Passwords hasheados con Argon2 (default del proyecto). JWT en cookie HttpOnly. CSRF via SameSite=Lax. SQL injection imposible (ORM). XSS mitigado por cookie HttpOnly. |
| **Implementación** | `PASSWORD_HASHERS = ["Argon2PasswordHasher", ...]`. JWT_COOKIE_HTTP_ONLY=True. JWT_COOKIE_SAMESITE="Lax". |
| **Estado** | ✅ Configuración en `config/settings/base.py`. |

## Q6. Desplegabilidad

| Aspecto | Detalle |
|---------|---------|
| **Objetivo** | Un dev nuevo puede levantar el entorno con 1 comando. |
| **Métrica** | `docker compose -f docker-compose.local.yml up` levanta todo. |
| **Implementación** | docker-compose.local.yml con Django + Postgres + pgbouncer + Redis + Celery + Flower + frontend. |
| **Estado** | ✅ Probado. |

## Métricas NO implementadas todavía

- ❌ Latencia p95 < 200 ms (sin Prometheus todavía).
- ❌ Cobertura de tests > 80% (sin coverage report).
- ❌ Tasa de errores < 0.1% (sin Sentry todavía).

Estos son objetivos para post-MVP. Si llegan a doler, los añadimos.
