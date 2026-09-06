# 08 — Architectural Decisions

Tres decisiones arquitectónicas (ADR) clave del proyecto. Formato
ligero siguiendo arc42.

---

## ADR-001: SimpleJWT + refresh token en cookie HttpOnly

**Estado:** Aceptado (Fase 0)

**Contexto:**

Necesitamos autenticación stateless para una SPA React. Las opciones
consideradas fueron:

1. **Sesiones Django** (cookie de sesión + CSRF).
2. **JWT en localStorage** (Authorization header + manual refresh).
3. **SimpleJWT + refresh en cookie HttpOnly** + access en memoria.

**Decisión:**

Opción 3. Implementación:

- `access_token`: 5 minutos, en memoria del frontend (Zustand).
  Se envía como `Authorization: Bearer <token>` en cada request.
- `refresh_token`: 7 días, en cookie HttpOnly + SameSite=Lax.
  NO es accesible desde JavaScript.
- Endpoint `POST /api/auth/refresh/`: lee la cookie, devuelve nuevo
  access + rota el refresh (blacklisteando el viejo).
- Endpoint `POST /api/auth/logout/`: blacklisteaa el refresh + limpia
  la cookie.

**Consecuencias:**

✅ **Pro:** inmune a XSS. Si un atacante inyecta JS en la página, no
puede leer el refresh token porque HttpOnly lo bloquea desde JS.

✅ **Pro:** rotación de tokens. Cada refresh genera uno nuevo y
blacklistea el viejo, limitando la ventana de uso si alguien lo roba.

❌ **Contra:** vulnerable a CSRF si no usamos SameSite. Mitigado con
`SameSite=Lax` + verificación de Origin en middleware.

❌ **Contra:** el access token en memoria se pierde al recargar la
página. Mitigado: el frontend llama a `/api/auth/me/` al montar para
rehidratar el store.

**Alternativas rechazadas:**

- localStorage: vulnerable a XSS (cualquier script puede leerlo).
- Sesiones Django: requiere CSRF, complica la SPA, no escala
  horizontalmente sin sticky sessions.

---

## ADR-002: Multi-tenant con shared schema + filtro por `organization_id`

**Estado:** Aceptado (Fase 1)

**Contexto:**

JornalPro es SaaS multi-tenant. Cada "maestro de obra" es un tenant
independiente. Las opciones consideradas fueron:

1. **Schema por tenant** (Django `search_path` por request).
2. **Base de datos por tenant** (un Postgres por maestro).
3. **Shared schema + columna `organization_id`** (filtro en cada query).

**Decisión:**

Opción 3. Todas las tablas tenant-specific tienen FK nullable a
`apps.organizations.Organization`. El filtro se aplica en:

- `ViewSet.get_queryset()`: cada ViewSet filtra por
  `organization_id=request.user.organization_id` (excepto admin plataforma).
- `permissions.IsSameOrganization`: valida que un objeto pertenezca a
  la organización del usuario antes de permitir edición/borrado.
- Tests `test_*_isolation` en cada app: confirman que un usuario del
  Tenant A no ve datos del Tenant B.

**Consecuencias:**

✅ **Pro:** 1 sola base de datos. JOINs eficientes entre tablas
tenant-specific. Backups únicos.

✅ **Pro:** onboarding rápido: crear un Organization + asignar usuarios
y listo. Sin DDL.

❌ **Contra:** si olvidas el filtro en un ViewSet nuevo, hay fuga de
datos entre tenants. Mitigado por:

- Code review obligatorio en cada PR que toque un ViewSet.
- Test de aislamiento en cada app.
- `permissions.IsSameOrganization` como red de seguridad.

❌ **Contra:** backups son "todo o nada". Si un tenant pide borrar
sus datos, hay que filtrar las filas. NO hay "drop schema".

**Alternativas rechazadas:**

- Schema por tenant: requiere DDL dinámico al crear tenant, complica
  migraciones, y PostgreSQL tiene un límite de schemas por DB.
- DB por tenant: complejidad operativa brutal para >10 tenants. Backup
  y restore por tenant es caro. No escala.

---

## ADR-003: Liquidación como snapshot inmutable en JSONField

**Estado:** Aceptado (Fase 5)

**Contexto:**

Cuando un maestro liquida un período, debe quedar un comprobante que
sea **verificable** y **auditable**. Las opciones consideradas fueron:

1. **Recalcular la liquidación cada vez que se ve** (JOIN con Workday).
2. **Generar un PDF** al liquidar y guardarlo.
3. **Snapshot en JSONField** en el modelo Liquidacion.

**Decisión:**

Opción 3. `Liquidacion` tiene un campo `detalle` (JSONField) que se
llena en el momento de liquidar con una copia de las jornadas:

```python
detalle = [
  {"fecha": "2024-09-01", "tipo": "Día completo", "tarifa_aplicada": 100000, "valor": 100000, "es_override": False},
  {"fecha": "2024-09-02", "tipo": "Día completo", "tarifa_aplicada": 100000, "valor": 100000, "es_override": False},
  ...
]
```

Adicionalmente, `LiquidacionViewSet` usa `prefetch_related('workday_details')`
que crea filas `PaymentWorkdayDetail` con un FK a la Workday original.
Esto permite:

- Ver el detalle en el JSONField sin JOIN.
- Auditar qué Workdays originales se incluyeron (vía PaymentWorkdayDetail).

**Consecuencias:**

✅ **Pro:** el comprobante es **verificable**. Si una Workday se borra o
modifica después, el comprobante mantiene los valores originales.

✅ **Pro:** los auditores pueden comparar el JSONField contra la
realidad actual y detectar discrepancias.

✅ **Pro:** el cálculo del total vive en `services/liquidacion.py`,
NO en el JSONField. El JSONField es **resultado**, no fuente.

❌ **Contra:** si en el futuro necesitamos "anular" una liquidación,
hay que crear una Liquidación de tipo "rectificación" que apunte a la
original. NO se edita ni se borra la original.

❌ **Contra:** ocupa más espacio en disco que un JOIN lazy. Mitigado:
las liquidaciones son semanales (~50/año/trabajador), no diarias.

**Test de verificación:**

`apps/payments/tests/test_liquidacion.py::test_snapshot_detalle_no_cambia_si_se_edita_workday`
garantiza que tras intentar modificar la Workday post-liquidación
(lo cual falla porque el modelo está protegido), el `detalle` del
comprobante NO cambia.

**Alternativas rechazadas:**

- Recalcular: cualquier cambio retroactivo en la tarifa altera el
  comprobante. Impide auditoría.
- PDF: requiere servicio de generación + storage. Más complejo.
  Además, NO permite consultas SQL sobre el detalle.

---

## Cómo añadir un nuevo ADR

1. Crea una sección con el prefijo `## ADR-NNN: <título>`.
2. Estado: Propuesto | Aceptado | Deprecado.
3. Contexto: qué opciones consideraste.
4. Decisión: qué elegiste + cómo se implementa.
5. Consecuencias: pros, contras, mitigaciones.
6. Alternativas rechazadas: por qué no las otras.
