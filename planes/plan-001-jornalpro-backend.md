# plan-001 — Backend JornalPro: auth + estructura MER + plan por fases

**Fecha**: 2026-09-04
**Estado**: Aprobado por el usuario. Empezando.
**Orquestador**: sesión actual (orquestador-jornal).
**Ejecutor**: sesión paralela ejecutor-jornal.
**Duración estimada**: 5 fases × 2-3h = ~12-15h netas, ejecutables en 1-2 sprints.

---

## Contexto

El proyecto `jornal-pro-trabajadores` es un fork operativo de `plantilla-django-react`. La migración .tsx → .jsx del frontend ya está cerrada (121 archivos JSX). El backend sigue como plantilla con apps `users/` + `custom_auth/`.

Este plan implementa el backend completo de JornalPro siguiendo el MER de `docs/jornalpro-django-models.md`, más 3 extensiones que aprobamos juntos:

1. **Grupo `AdminPlataforma`** (modelo: User con `organization=NULL`, `is_staff=True`) — para soportar el rol admin del prototipo (cross-tenant).
2. **`Liquidacion` como snapshot inmutable** (no solo `Payment` + detalles) — auditoria del comprobante.
3. **`MovimientoDeuda` con tipo (`prestamo|abono|ajuste`)** — para igualar el patrón del prototipo y registrar abonos de liquidación.

## Decisiones cerradas

| Decisión | Valor | Razón |
|----------|-------|-------|
| Apps Django | 5 nuevas: `organizations`, `catalogs`, `users`, `workdays`, `payments` | Sigue el MER al pie de la letra |
| Auth | SimpleJWT (existente) + refresh HttpOnly cookie + access en body | Ya configurado, falta endpoints y tests |
| Roles | 3 grupos: `AdminPlataforma`, `Maestro`, `Trabajador` | Aceptado el grupo extra |
| Multi-tenant | shared schema, `for_organization()` queryset | Aislar por org vía worker.user.organization |
| Liquidacion | snapshot con consecutivo + periodo + detalle[] | Aceptado por auditoría |
| Movimientos | `MovimientoDeuda` con tipo (préstamo/abono/ajuste) | Aceptado por lógica de saldos |
| Integración frontend | auth primero, datos gradual | Cada fase conecta el módulo al API sin tirar localStorage de golpe |
| Calidad | pre-commit + pnpm lint + pytest (backend) + pnpm build (frontend) + Playwright MCP visual por fase | Regla innegociable |
| Optimización queries | `select_related` + `prefetch_related` obligatorio en viewsets | Documentar en cada PR qué joins se cubren |
| Optimización pgbouncer | `pool_mode=transaction` + `STMT_TIMEOUT` configurado, `default_transaction_*` cuidadosos | Confirmar al inicio de Fase 1 |

---

## Estructura target del backend

```
backend/
├── apps/
│   ├── organizations/   # Organization (tenant)
│   ├── catalogs/        # WorkdayType, PaymentStatus, TipoMovimiento (≡LoanStatus), PaymentMethod
│   ├── users/           # User (+organization), WorkerProfile; Group data migration (AdminPlataforma/Maestro/Trabajador)
│   ├── workdays/        # WorkerRate, Workday
│   ├── payments/        # MovimientoDeuda, Liquidacion (snapshot), PaymentWorkdayDetail, PaymentLoanDetail
│   ├── custom_auth/     # SimpleJWT (existente, queda como capa de auth)
│   └── contrib/sites/   # (existente, sin cambios)
├── config/              # settings + api_router (registra los 5 routers nuevos)
└── ...
```

Dependencias:

```
organizations (sin deps)
   ↓
users → AUTH_USER_MODEL
   ↓
catalogs (sin deps, pero consumido por workdays/payments)
   ↓
workdays → users, catalogs
   ↓
payments → users, workdays, catalogs
```

`INSTALLED_APPS` (orden crítico):
```python
INSTALLED_APPS = [
  ...
  "organizations",
  "catalogs",
  "apps.users",
  "apps.workdays",
  "apps.payments",
  "apps.custom_auth",  # última capa de auth
]
```

---

## Plan por fases

### Fase 0 — Auth backend + integración frontend (CUENTA, esta fase)

**Objetivo**: Conectar el frontend (que vive con localStorage) al backend real. El usuario puede hacer login con credenciales del backend, y el access token vive en `authStore` (zustand); el refresh en cookie HttpOnly. Los datos de negocio siguen en localStorage durante esta fase.

#### Backend (`apps/custom_auth/`)

1. Endpoint `POST /api/auth/token/` — `CustomTokenObtainPairView` que:
   - Acepta `{ username, password }`.
   - Valida contra `AUTHENTICATION_BACKENDS`.
   - Genera `access_token` (5min) y `refresh_token` (7d).
   - Setea `refresh_token` como cookie HttpOnly (`response.set_cookie(...)`) **además** de devolver el `refresh` en el body (compatibilidad con flujos que ya lo esperan).
   - Body: `{ access, refresh, user: { id, username, email, groups: [...], organization_id } }`.

2. Endpoint `POST /api/auth/token/refresh/` — toma el refresh de la cookie (o del body si lo mandan) y devuelve un nuevo access. Rota el refresh si `ROTATE_REFRESH_TOKENS=True`.

3. Endpoint `POST /api/auth/logout/` — limpia la cookie `refresh_token` y añade el refresh al blacklist (`token_blacklist` app).

4. Endpoint `GET /api/auth/me/` — devuelve `{ id, username, email, groups, organization_id, is_staff, worker_profile_id? }`. Requiere `IsAuthenticated`.

5. App `rest_framework_simplejwt.token_blacklist` añadida a `INSTALLED_APPS`. Migración aplicada.

6. Tests pytest en `apps/custom_auth/tests/`:
   - `test_token_obtain_pair_sets_cookie`: login válido setea cookie HttpOnly correct.
   - `test_token_refresh_via_cookie`: refresh desde cookie funciona.
   - `test_logout_clears_cookie_and_blacklists`: logout elimina cookie y bloquea refresh.
   - `test_me_requires_auth`: GET /me/ sin token = 401.

7. Pre-commit run --all-files limpio.

#### Frontend

1. **Nuevo** `frontend/src/api/authService.js` con funciones:
   - `login(username, password)` → `POST /api/auth/token/`.
   - `logout()` → `POST /api/auth/logout/`.
   - `refreshAccess()` → `POST /api/auth/token/refresh/` (lee cookie automáticamente).
   - `me()` → `GET /api/auth/me/`.

2. **Reemplazar** `frontend/src/store/authStore.js` (zustand) con uno que:
   - Persista `accessToken` (en memoria + sessionStorage, NO localStorage).
   - NO persista refresh token (vive en cookie HttpOnly).
   - Hook de auto-refresh: cuando access expira, intenta refresh silencioso; si falla, redirige a `/login`.
   - `useAuth()` reemplaza al `AuthContext` legacy del prototipo para auth (los datos de negocio siguen en `DataContext`).

3. `frontend/src/api/apiClient.js` con axios:
   - `baseURL = import.meta.env.VITE_API_URL || '/api'`.
   - `withCredentials = true` para enviar cookies.
   - Interceptor: en 401, intenta refresh; si 2do 401, logout.

4. `frontend/src/pages/public/Login.jsx` modificado: submit llama a `authService.login()`. Tras éxito, `authStore.loginSuccess(...)` y redirect según rol:
   - `AdminPlataforma` → `/app/admin`
   - `Maestro` → `/app/maestro`
   - `Trabajador` → `/app/trabajador`

5. **Semilla backend mínima**: `createsuperuser` del usuario `admin` platform (existente via `just manage-direct-db createsuperuser`). Las demás cuentas se crean en Fase 3.

6. `pnpm lint` + `pnpm build` pasan.
7. Playwright visual: el flujo `login con admin`/`login con credencial futura` → dashboard existe. Comparte screenshot del login page (colores, no blancos rotos).

#### Calidad al cerrar Fase 0

- `cd backend && pre-commit run --all-files` exit 0
- `cd backend && docker compose -f docker-compose.local.yml config --quiet` exit 0
- `cd backend && uv run pytest apps/custom_auth/tests/ -v` todos verdes
- `cd frontend && pnpm lint` exit 0
- `cd frontend && pnpm build` exit 0
- Validación visual Playwright: login → /app/[rol] → dashboard renderiza colores correctos

---

### Fase 1 — Organizations (multi-tenant)

**Objetivo**: App `organizations/` con modelo `Organization`, `OrganizationScopedQuerySet`, ViewSet, serializer, URLs. Seed data con "Construcciones Jairo" y "Construcciones Wilson" (los dos maestros del prototipo).

#### Backend

1. `apps/organizations/models.py` con `Organization(name, is_active, created_at)`.
2. `apps/organizations/managers.py` con `OrganizationScopedQuerySet` y `OrganizationManager`.
3. `apps/organizations/serializers.py` con `OrganizationSerializer`.
4. `apps/organizations/api/viewsets.py` con `OrganizationViewSet` (DRF), permiso `IsAdminPlataforma` (custom permission).
5. `apps/organizations/urls.py` con router.
6. `apps/organizations/migrations/` con `0001_initial`.
7. **Data migration** `0002_seed_organizations.py` con seed:
   - "Construcciones Jairo" (Cali)
   - "Construcciones Wilson" (Palmira)
8. **Data migration** `0003_seed_admin_plataforma.py`: crea `is_staff=True` user para admin plataforma.
9. Tests pytest:
   - `test_create_organization_requires_admin`: solo AdminPlataforma puede crear.
   - `test_list_organizations_as_maestro_returns_own`: aislamiento.
   - `test_manager_for_organization_filters_correctly`.

#### Frontend

1. `frontend/src/api/organizationsService.js` con `listMine()`.
2. `frontend/src/context/OrganizationContext.jsx` que envuelve AppShell y carga la org del `/api/auth/me/`.
3. Página `/app/maestro` muestra nombre de la org en el header (ya lo tiene — confirmar).
4. Tests: ninguno en esta fase (es solo consumir del backend).
5. Playwright visual: dashboard maestro muestra "Construcciones Jairo" correctamente.

#### Optimización

- `Organization.objects.filter(is_active=True).only('id', 'name')` para listar. Sin joins necesarios en este modelo.

#### Índices

- `Organization.name`: índice implícito por `unique=True` (agregarlo).
- `Organization.is_active`: índice para el filtro del manager.

#### Calidad al cerrar Fase 1

- Pre-commit + pytest custom_auth + pytest organizations + lint + build + Playwright visual.
- Verificar `manage.py check --deploy` no reporta issues nuevos.

---

### Fase 2 — Catalogs (catálogos reutilizables)

**Objetivo**: App `catalogs/` con `WorkdayType`, `PaymentStatus`, `TipoMovimientoDeuda`, `PaymentMethod`. Seed en español. Endpoints públicos para maestro y trabajador.

#### Backend

1. `apps/catalogs/models.py`:
   - `CatalogBase` abstracto.
   - `WorkdayType(organization, name, factor, is_active, order)`.
   - `PaymentStatus(name, is_active, order)`.
   - `TipoMovimientoDeuda(name, is_active, order)` (≡LoanStatus del MER).
   - `PaymentMethod(name, is_active, order)`.
2. `apps/catalogs/serializers.py`.
3. `apps/catalogs/api/viewsets.py` con ViewSets solo-lectura (no CRUD de usuario normal; solo admin plataforma los modifica).
4. `apps/catalogs/migrations/` con initial + data migration de seed:
   - WorkdayType seed: "Día completo" (1.00), "Medio día" (0.50) — por organización.
   - PaymentStatus: Pendiente, Parcial, Pagado.
   - TipoMovimiento: Préstamo, Abono, Ajuste.
   - PaymentMethod: Efectivo, Transferencia, Nequi, Daviplata.
5. Tests pytest.

#### Frontend

1. `frontend/src/api/catalogsService.js` con `getWorkdayTypes()`, `getPaymentStatuses()`, etc.
2. `frontend/src/context/CatalogContext.jsx` (sustituye las constantes hardcoded del prototipo).
3. `AppShell` y los formularios consumen los catálogos del backend.
4. Componentes shadcn no se tocan (no dependían de catálogos).
5. Playwright visual: el dropdown de tipo de jornada en `DialogoMovimiento` muestra las opciones del backend.

#### Índices

- `WorkdayType.organization` (FK indexada automáticamente).
- `WorkdayType.unique_together = ('organization', 'name')` crea índice.

#### Calidad al cerrar Fase 2

- Suite completa.

---

### Fase 3 — Users + WorkerProfile + AdminPlataforma + Groups

**Objetivo**: El MEATPOT del plan. Reescribir `users/models.py`, crear `WorkerProfile`, data migrations con grupos y seed de usuarios del prototipo.

#### Backend

1. **Refactor** `apps/users/models.py`:
   - `User(AbstractUser)` con `organization = ForeignKey(Organization, null=True)`, `phone = CharField`.
   - `WorkerProfile(user, id_document, hire_date, is_active)`.
   - `is_admin_plataforma` property (sin `organization` + `is_staff`).
   - `current_rate` property (igual MER).
2. `apps/users/managers.py` con querysets scopeados.
3. `apps/users/api/viewsets.py`:
   - `UserViewSet` (existente, refactor).
   - `WorkerProfileViewSet` (solo lectura para maestro, escritura solo para AdminPlataforma en workers de su org).
   - `MeView` (GET /api/auth/me/ — reubicado desde custom_auth).
4. `apps/users/serializers.py` con `UserSerializer`, `WorkerProfileSerializer`.
5. **Data migration** `users/migrations/0002_groups.py` — crea grupos `AdminPlataforma`, `Maestro`, `Trabajador`.
6. **Data migration** `0003_seed_users.py` — recrea los usuarios del seed del prototipo:
   - `admin / admin123` (AdminPlataforma, sin org).
   - `jairo / maestro123` (Maestro, Construcciones Jairo).
   - `wilson / maestro123` (Maestro, Construcciones Wilson).
   - `carlos / obra123` (Trabajador, WorkerProfile de jairo).
   - `duvan / obra123` (Trabajador, WorkerProfile de jairo).
   - `edinson / obra123` (Trabajador).
   - `wilmar / obra123` (Trabajador).
   - `freddy / obra123` (Trabajador).
   - `yeison / obra123` (Trabajador).
7. **Data migration** `0004_set_passwords_mejor.py` — usa `set_password` (no texto plano). Para prototipo, se acepta `pbkdf2_sha256` con sales.
8. Permisos custom:
   - `apps/users/permissions.py` con `IsAdminPlataforma`, `IsMaestroOAdmin`, `IsSameOrganization`.
9. Tests pytest:
   - Cobertura de los 3 grupos en `setUp` y permisos por endpoint.
   - Login con cada rol devuelve la respuesta esperada.
   - Aislamiento: maestro de organización A no ve workers de B.

#### Frontend

1. **Sustituir** `frontend/src/api/authService.js` (existente del prototipo) por uno nuevo que use backend.
2. **Login flow refactor**: tras login, redirigir basado en `groups[0]` del usuario.
3. Las páginas `/app/maestro/trabajadores/Lista.jsx`, etc., consumen datos de /api/users/workers/.
4. `authStore` zustand mantiene solo `accessToken`, `userProfile`. NO hay `seed.ts` local; los datos vienen del API.
5. Tests: vitest/jest o manual con curl.
6. Playwright visual crítico: **login con cada uno de los 3 roles** → screenshot de cada dashboard → validar que los colores y el layout están bien.

#### Calidad al cerrar Fase 3

- Suite completa + Playwright visual por rol.

---

### Fase 4 — Workdays + MovimientoDeuda

**Objetivo**: App `workdays/` (`WorkerRate`, `Workday`) y parte de `payments/` (`MovimientoDeuda`). Sustituye `trabajadores`, `jornadas`, `movimientos` del `DataContext` por llamadas API.

#### Backend

1. `apps/workdays/models.py`:
   - `WorkerRate(worker, amount, valid_from, valid_until, is_active)`.
   - `Workday(worker, workday_type, payment_status, date, applied_rate, notes, created_by, created_at)`.
   - `Workday.objects = WorkerScopedQuerySet.as_manager()`.
   - **Constraint**: `unique_together = ('worker', 'date')` (no duplicar jornada por día).
2. `apps/workdays/serializers.py`:
   - `WorkerRateSerializer`.
   - `WorkdaySerializer` (anida `workday_type`, `payment_status`, `worker`).
3. `apps/workdays/api/viewsets.py` con `WorkdayViewSet`:
   - `get_queryset()` con `select_related('worker__user__organization', 'workday_type', 'payment_status').filter(worker__user__organization=request.user.organization)`.
   - Acción custom `POST /api/workdays/bulk/` para "marcar semana completa".
4. `apps/payments/models.py` (solo MovimientoDeuda en esta fase):
   - `MovimientoDeuda(worker, tipo, monto, concepto, liquidacion_id? , fecha, registrado_por, registrado_en)`.
   - `Monto` siempre positivo, el signo lo da `tipo`.
   - `unique_together` para `MovimientoDeuda` no hay (puede haber múltiples del mismo día).
5. `apps/payments/serializers.py` con `MovimientoDeudaSerializer`.
6. `apps/payments/api/viewsets.py` con `MovimientoDeudaViewSet` (CRUD).
7. **Migraciones** con `0001_initial` + ajustar `Workday.worker` FK a `WorkerProfile`.

#### Frontend

1. `frontend/src/api/workdaysService.js`, `movementsService.js`.
2. `DataContext` parcialmente reemplazado:
   - `trabajadores`, `jornadas`, `movimientos` ahora vienen del API.
   - Las mutaciones (`upsertJornada`, `registrarMovimiento`, etc.) hacen POST/PUT/DELETE.
   - Loading states con spinners (shadcn `Skeleton` ya está).
3. Eliminar `seed.ts` y `repositorios.ts` si ya no se usan.
4. Playwright visual crítico: marcar una semana completa como maestro, ver el flujo real → screenshot.

#### Optimización de queries (regla de la fase)

Todas las vistas que listen jornadas deben:

```python
queryset = (
    Workday.objects
    .select_related('worker__user__organization', 'workday_type', 'payment_status', 'created_by')
    .filter(worker__user__organization=request.user.organization)
    .order_by('-date')
)
```

Para `MovimientoDeuda`:

```python
queryset = (
    MovimientoDeuda.objects
    .select_related('worker__user__organization', 'registrado_por')
    .filter(worker__user__organization=request.user.organization)
)
```

#### Índices y constraints (regla de la fase)

- `Workday`: `Index(fields=['worker', 'date'])`, `unique_together=(worker, date)`.
- `MovimientoDeuda`: `Index(fields=['worker', 'fecha'])`, `Index(fields=['liquidacion_id'])`.
- `WorkerRate`: `Index(fields=['worker', 'valid_from'])`.

#### Calidad al cerrar Fase 4

- `python manage.py check --deploy`.
- `pre-commit run --all-files`.
- `pytest apps/ -v`.
- `EXPLAIN ANALYZE` de las queries top 5 (maestro lista sus 100 jornadas del mes) → confirmar índice usado.
- Playwright visual.

---

### Fase 5 — Liquidacion + Payments snapshot

**Objetivo**: Implementar liquidación transaccional con snapshot inmutable.

#### Backend

1. `apps/payments/models.py` extiende con:
   - `Liquidacion(consecutivo, organization, worker, periodo_inicio, periodo_fin, jornada_ids[], detalle(JSONField snapshot), subtotal_jornadas, saldo_deuda_antes, modo_descuento, monto_descontado, total_pagado, saldo_deuda_despues, estado, fecha_pago, observaciones, created_by, created_at)`.
   - `PaymentWorkdayDetail(payment, workday, applied_amount)`.
   - `PaymentLoanDetail(payment, loan, paid_amount)`.
   - **Snapshot inmutable**: `detalle[]` es `JSONField` con copia exacta del cálculo al momento (LineaLiquidacion { fecha, tipo, tarifa_aplicada, valor, es_override }).
   - **Consecutivo por organización**: `Liquidacion.consecutivo` es `IntegerField`, autocalculado al crear (último +1 filtrado por org).
2. `apps/payments/api/viewsets.py`:
   - `LiquidacionViewSet` con acción `POST /api/payments/liquidaciones/liquidar/` con `modo_descuento` ('ninguno'|'total'|'parcial').
   - **Transacción** (R6): `with transaction.atomic(): crear Liquidacion; jornadas.update(liquidacion_id=liq.id); si descuento>0: crear MovimientoDeuda(abono, descuento)`.
   - `select_related('worker__user__organization', 'created_by').prefetch_related('payment_workday_details', 'payment_loan_details')` en `get_queryset`.
3. `apps/payments/services/liquidacion.py` con la lógica de cálculo (testeable).
4. Tests pytest:
   - `test_liquidar_bloquea_jornadas`: tras liquidar, las jornadas tienen `liquidacion_id`.
   - `test_liquidar_genera_abono_si_hay_descuento`.
   - `test_liquidar_consecutivo_se_incrementa_por_org`.
   - `test_snapshot_inmutable`: modificar tarifa después no afecta liquidación vieja.
   - `test_no_liquidar_jornadas_ya_liquidadas`.

#### Frontend

1. `frontend/src/api/liquidacionesService.js` con `create()` (POST /liquidar/) y `get()`.
2. `frontend/src/components/Maestro/AsistenteLiquidacion.jsx` consume API.
3. `frontend/src/components/Maestro/ComprobanteLiquidacion.jsx` muestra snapshot del backend (no recalcula).
4. Playwright visual crítico: comprobante en pantalla → validar colores, alineación.

#### Índices y constraints

- `Liquidacion`: `Index(fields=['organization', 'consecutivo'])`, `unique_together = ('organization', 'consecutivo')`. `Index(fields=['worker'])`.
- `PaymentWorkdayDetail`: `unique_together = ('payment', 'workday')`.
- `PaymentLoanDetail`: `unique_together = ('payment', 'loan')`.

#### Calidad al cerrar Fase 5

- Suite completa.
- Playwright visual del comprobante.

---

### Fase 6 — Admin plataforma + pulido final

**Objetivo**: Endpoints para AdminPlataforma (gestión de tenants, usuarios, métricas globales). Pulido de optimizaciones.

#### Backend

1. `apps/users/api/viewsets.py`:
   - `TenantManagementViewSet` (solo AdminPlataforma): CRUD de tenants + asignar maestros.
   - `UsuarioAdminViewSet`: CRUD usuarios cross-tenant.
   - `MetricsView`: `GET /api/admin/metrics/` con conteos globales.
2. `Organization.objects.select_related('users', 'workday_types').annotate(count_users=Count('users'))` para evitar N+1.
3. Tests pytest.

#### Optimización pgbouncer↔postgres

- Verificar `docker-compose.local.yml`: pgbouncer con `POOL_MODE=transaction`, `SERVER_RESET_QUERY=DEALLOCATE ALL`, `MAX_CLIENT_CONN=200`, `DEFAULT_POOL_SIZE=20`.
- Postgres: `shared_buffers=256MB`, `work_mem=4MB`, `statement_timeout=60s`.
- Backend connection: `CONN_MAX_AGE=0`, `OPTIONS: -c statement_timeout=60000`.

#### Playwright visual final

- Login AdminPlataforma → dashboard global → ver 2 tenants (Jairo+Wilson) + workers totales.
- Login Jairo → dashboard maestro → ver jornal semanal.
- Login Carlos → portal trabajador (solo lectura) → ver sus días.

#### Documentación final

- Actualizar `docs/` con `docs/arc42/` (carpetas por sección arc42 v9.0 con diagramas Mermaid).
- `README.md` actualizado con login de demo + endpoints clave.
- `AGENTS.md` refrescado.

#### Calidad al cerrar Fase 6

- Suite completa + Playwright visual para los 3 roles + arc42 docs + `pre-commit run --all-files` limpio.

---

## Reglas de calidad innegociables (todas las fases)

1. **Backend**:
   - `cd backend && pre-commit run --all-files` exit 0 antes de cada merge.
   - `cd backend && docker compose -f docker-compose.local.yml config --quiet` exit 0.
   - `cd backend && uv run pytest apps/ -v` todos verdes. Mínimo 80% coverage por app crítica (`custom_auth`, `organizations`, `workdays`, `payments`).
   - `cd backend && python manage.py check --deploy` sin issues nuevos.

2. **Frontend**:
   - `cd frontend && pnpm lint` exit 0 (warnings `no-unused-vars` aceptables si vienen de `lazy()` imports).
   - `cd frontend && pnpm build` exit 0.

3. **Optimización**:
   - Toda vista que liste datos con `ForeignKey` → `select_related` o `prefetch_related` documentado.
   - Migraciones nuevas con índices explícitos en campos de búsqueda frecuente.
   - Tests pytest con `assertNumQueries` en al menos 1 viewset por app.

4. **Multi-tenant**:
   - Cada vista con filtro `for_organization(request.user.organization)`.
   - Test que verifica aislamiento entre organizaciones.

5. **Playwright visual por fase**:
   - Antes de cerrar cada fase, ejecutar validación Playwright MCP con `browser_navigate` + `browser_take_screenshot` + `browser_snapshot` en las páginas tocadas.
   - Reportar: ¿se ven los colores correctos? ¿hay overflow? ¿texto cortado?

6. **Git**:
   - Cada fase = 1 commit (o PR si hay remoto configurado).
   - Mensajes: `feat(custom-auth): SimpleJWT refresh HttpOnly`, `feat(organizations): tenant model + scoped queryset`, etc.

---

## Herramientas

- **Orquestador** (esta sesión): planifica, asigna, valida con Playwright.
- **Ejecutor** (`ejecutor-jornal`, sesión paralela): implementa bloques, corre tests, reporta.
- **Cron cada 15 min**: revisar progreso, detectar atascos.
- **MCP tools**: Playwright para validación visual, engram para memoria, linear/jira si se conecta a tablero.

## Convenciones

- **Branch**: `feature/fase-N-descripcion`. PR a `main`. Squash merge.
- **Conventional commits**: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`.
- **python**: 3.14 (`.python-version`), uv para venv.
- **Frontend**: JSX sin TS. Tailwind + shadcn. Zustand solo para `authStore`.

---

## Riesgos identificados

1. **Servidor Postgres-pgbouncer**: connection storms al liquidar muchas jornadas. Mitigar: `default_pool_size=20`, `statement_timeout=60s`, tests con `assertNumQueries`.
2. **Multi-tenant data leak**: un `select_related` sin `for_organization` filtra accidental. Mitigar: test de aislamiento por organización al cierre de cada fase.
3. **Snapshot de Liquidacion grande**: `detalle[]` JSONField con ~520 entradas (1 año × 4 workers × 130 días). Tamaño aceptable para Postgres JSONB. Indexable con GIN si hace falta.
4. **Frontend migrating localStorage → API**: romper el flujo `authStore` puede dejar al usuario sin sesión. Hacerlo en la Fase 0 con test E2E.
5. **MFA allauth**: el MER no lo menciona; la plantilla trae allauth + MFA preconfigurado. Decidir si mantener o desactivar.

## Decisiones pendientes (si surgen durante implementación)

- ¿Integración con Twilio/SMS? No en este plan.
- ¿Reportes PDF? El prototipo usa `window.print()`. Mantener.
- ¿Notificaciones push? No en este plan.
- ¿Export/Import JSON? El prototipo lo tiene vía `exportImport.ts`. Migrar en Fase 6 como bonus.
