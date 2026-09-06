# 06 — Runtime View

Comportamiento dinámico del sistema: los escenarios más importantes
expresados como interacciones entre los bloques.

## Escenario 1: Login de un maestro

```mermaid
sequenceDiagram
  participant U as Usuario (browser)
  participant F as Frontend (React)
  participant A as authService.login
  participant B as Backend (DRF)
  participant DB as Postgres
  participant Z as authStore (Zustand)

  U->>F: Ingresa email + password en /login
  F->>A: authService.login({email, password})
  A->>B: POST /api/auth/token/ {email, password}
  B->>DB: SELECT user WHERE email=? AND password=?
  DB-->>B: user row
  B-->>A: {access: "eyJ...", refresh: "abc"}
  A->>B: Set-Cookie: refresh_token=abc; HttpOnly; SameSite=Lax
  B-->>A: 200 OK
  A->>Z: setAccessToken(eyJ...)
  A->>Z: setUser({email, is_staff, organization_id})
  A-->>F: ok
  F->>U: redirect /app/maestro
```

Tras el login:
- El access token vive en memoria (Zustand) + Authorization header en
  cada request subsecuente.
- El refresh token vive en cookie HttpOnly — JS no puede leerlo.
- Si el access expira (5 min), `api.js` llama a `POST /api/auth/refresh/`
  que lee la cookie, devuelve un nuevo access, y rota el refresh.

## Escenario 2: Maestro registra una jornada

```mermaid
sequenceDiagram
  participant U as Maestro
  participant F as Frontend
  participant S as workdaysService.create
  participant V as WorkdayViewSet
  participant M as Workday model
  participant DB as Postgres

  U->>F: Click "+ Nueva jornada", llena form
  F->>S: workdaysService.create({worker, workday_type, date, ...})
  S->>V: POST /api/workdays/ + Bearer access
  V->>V: authenticate + IsAuthenticated
  V->>V: get_queryset() filtra por organization_id
  V->>V: perform_create(serializer)
  V->>M: applied_rate = worker.rates.active.first().amount * workday_type.factor
  V->>DB: INSERT workday (applied_rate, liquidacion=NULL, ...)
  DB-->>V: workday.id
  V-->>S: 201 {id, applied_rate, ...}
  S-->>F: ok
  F->>U: Toast "Jornada creada"
```

Notas:
- `applied_rate` lo calcula el backend, no el frontend. El frontend
  puede enviar `applied_rate` opcional pero si no, se calcula del
  último `WorkerRate` activo del trabajador × `factor` del tipo.

## Escenario 3: Liquidar un período (R6)

```mermaid
sequenceDiagram
  participant M as Maestro
  participant F as AsistenteLiquidacion
  participant S as liquidacionesService.liquidar
  participant V as LiquidacionViewSet.liquidar
  participant L as services.liquidacion.liquidar
  participant DB as Postgres

  M->>F: Selecciona 5 jornadas, modo="parcial", monto=50000
  F->>S: liquidacionesService.liquidar({worker_id, jornada_ids:[...], modo_descuento, monto_manual, fecha_pago})
  S->>V: POST /api/liquidaciones/liquidar/ + Bearer access
  V->>V: get_object_or_404(WorkerProfile, id=worker_id)
  V->>V: assert worker.organization_id == user.organization_id
  V->>L: liquidar(organization, worker, ...)
  L->>DB: BEGIN TRANSACTION
  L->>DB: SELECT FOR UPDATE jornadas WHERE id IN (...) AND liquidacion IS NULL
  alt Alguna ya liquidada
    L-->>V: raise ValueError("Alguna jornada ya está liquidada.")
    V-->>S: 400 {detail: "..."}
    S-->>F: throw Error
  end
  L->>L: subtotal = sum(applied_rate)
  L->>L: saldo = sum(movimientos.signed_amount WHERE liquidacion IS NULL)
  L->>L: descuento = min(saldo, subtotal, monto_manual)
  L->>DB: INSERT liquidacion (snapshot detalle JSON)
  L->>DB: UPDATE jornadas SET liquidacion_id = liq.id
  L->>DB: INSERT payment_workday_details (bulk)
  alt descuento > 0
    L->>DB: INSERT movimiento_deuda (tipo='Abono', liquidacion=liq)
  end
  L->>DB: COMMIT
  L-->>V: Liquidacion instance
  V-->>S: 201 {id, consecutivo, detalle, total_pagado, ...}
  S-->>F: ok
  F->>M: Mostrar ComprobanteLiquidacion
```

Notas:
- Toda la operación es **atómica**. Si algo falla, nada se persiste.
- `SELECT FOR UPDATE` sobre las jornadas previene doble liquidación
  concurrente del mismo período.
- Si `descuento > 0`, se crea automáticamente un MovimientoDeuda de
  tipo `Abono` vinculado a la liquidación, así el saldo del trabajador
  queda consistente.

## Escenario 4: Trabajador consulta sus liquidaciones

```mermaid
sequenceDiagram
  participant T as Trabajador
  participant F as TrabajadorDashboard
  participant S as liquidacionesService.list
  participant V as LiquidacionViewSet
  participant DB as Postgres

  T->>F: Navega a /app/trabajador/comprobantes
  F->>S: liquidacionesService.list({worker_id: self})
  S->>V: GET /api/liquidaciones/ + Bearer access
  V->>V: get_queryset() — user.is_admin_plataforma? NO; user.organization_id? maybe; hasattr(user, 'worker_profile')? SÍ
  V->>V: qs.filter(worker_id=user.worker_profile.id)
  V->>DB: SELECT liq.* FROM liquidaciones WHERE worker_id=? ORDER BY fecha_pago DESC
  V-->>S: 200 [{id, consecutivo, total_pagado, ...}]
  S-->>F: array
  F->>T: Mostrar lista de comprobantes
```

Notas:
- El trabajador **NO ve otros trabajadores** (multi-tenant estricto).
- `prefetch_related('workday_details', 'loan_details')` evita N+1
  cuando se serializa cada liq.

## Escenario 5: Admin plataforma ve métricas

```mermaid
sequenceDiagram
  participant A as Admin Plataforma
  participant F as AdminDashboard
  participant S as adminService (futuro)
  participant V as admin_platforma.metrics
  participant DB as Postgres

  A->>F: Navega a /app/admin
  F->>S: GET /api/admin/metrics/
  S->>V: + Bearer access (admin user)
  V->>V: IsAuthenticated + IsAdminPlataforma
  alt user.is_admin_plataforma = True
    V->>DB: SELECT COUNT(*) FROM organizations
    V->>DB: SELECT COUNT(*) FROM users
    V->>DB: SELECT COUNT(*) FROM workdays
    V->>DB: SELECT SUM(total_pagado) FROM liquidaciones
    V-->>S: 200 {tenants_total: 2, users_total: 9, ...}
    S-->>F: metrics
  else
    V-->>S: 403 Forbidden
    S-->>F: throw Error
  end
```

Notas:
- `IsAdminPlataforma` valida `is_staff=True AND organization_id=None`.
- Los queries son agregados simples (COUNT, SUM). Sin N+1 porque no
  hay iteración.
