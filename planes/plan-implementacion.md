# JornalPro — Plan de ejecución por fases

> Documento operativo para el par **orquestador-jornal** (validador, modelo grande) y **ejecutor-jornal** (ejecutor de tareas, modelo económico).
> Referencia de esquema: `jornalpro-django-models.md`.
> Convención de código: identificadores en inglés, comentarios y textos de usuario en español.

---

## 1. Roles y protocolo

### orquestador-jornal

- Es el **único** que toma decisiones de diseño, arquitectura y alcance.
- Define la tarea de cada fase, la entrega al ejecutor y **valida el resultado antes de cerrar la fase**.
- Nunca escribe código de producción salvo que el ejecutor se atasque dos veces en el mismo punto.
- Responde las preguntas del ejecutor de forma concreta y cerrada (una decisión, no un menú de opciones).
- Al cerrar cada fase: revisa el diff completo, corre la suite de tests, revisa cobertura y aprueba o devuelve con correcciones numeradas.

### ejecutor-jornal

- Ejecuta exactamente lo que dice la tarea de la fase. Nada más.
- **Nunca asume.** Si algo no está explícito en la tarea o en `jornalpro-django-models.md`, para y pregunta al orquestador. Ejemplos de cosas que se preguntan, no se inventan: nombre de un campo que no está en el esquema, si un endpoint debe paginar, qué hacer ante un caso de negocio no cubierto, si una librería nueva está permitida.
- **Nunca marca una fase como terminada** con tests en rojo, lint en rojo o pre-commit fallando.
- Al terminar, entrega un reporte de fase (formato en §3) y espera aprobación. No arranca la siguiente fase por su cuenta.

### Formato de pregunta del ejecutor

```
[DUDA — Fase N]
Contexto: <qué estaba haciendo>
Bloqueo: <qué no está definido>
Opciones que veo: A) ... B) ...
No voy a asumir ninguna. Espero decisión.
```

### Formato de devolución del orquestador

```
[CORRECCIONES — Fase N]
1. archivo:línea — qué está mal — qué se espera
2. ...
Re-entregar con estos puntos resueltos y la suite en verde.
```

---

## 2. Reglas transversales (aplican a TODAS las fases)

1. **Ninguna fase se cierra sin:** tests en verde, `pre-commit run --all-files` limpio, y (desde la Fase 6 en adelante) `npm run lint` + `npm run build` limpios.
2. **Cobertura mínima backend: 90%** global, **100% en la capa de servicios de dinero** (`services/` de `payments` y `workdays`). Sin excepciones.
3. **Nada de `choices=` para reglas de negocio.** Todo va a catálogo. Si el ejecutor siente la tentación de un `choices`, es una duda para el orquestador.
4. **Toda mutación de dinero pasa por la capa de servicios**, nunca por `save()` del modelo ni directamente desde la vista.
5. **Todo movimiento de saldo es transaccional** (`transaction.atomic` + `select_for_update`).
6. Commits atómicos por sub-tarea, mensaje en inglés, formato Conventional Commits (`feat:`, `test:`, `fix:`, `chore:`).
7. Sin `print()`, sin `console.log` en el código entregado.
8. Idioma: código en inglés, comentarios/docstrings/verbose_name/textos de UI en español.

---

## 3. Reporte de fase (lo entrega el ejecutor al cerrar)

```
[FASE N — ENTREGA]
Archivos creados/modificados: <lista>
Tests: X passed, 0 failed — cobertura global XX%, servicios de dinero XX%
Pre-commit: OK
Lint frontend: OK / N/A
Playwright: OK / N/A — <qué se validó>
Decisiones que tomé: <ninguna, o las que el orquestador aprobó explícitamente>
Dudas pendientes: <ninguna, o lista>
```

---

# FASE 0 — Andamiaje y calidad

**Objetivo:** que el repo tenga puertas de calidad *antes* de la primera línea de negocio.

**Tareas del ejecutor:**

1. Proyecto Django 5 + PostgreSQL, estructura `config/` + apps vacías (`organizations`, `catalogs`, `users`, `workdays`, `payments`).
2. `docker-compose.yml` para desarrollo: `db` (Postgres 16), `web`. Redis solo si el orquestador lo aprueba (no hay tareas async en el alcance inicial).
3. Settings divididos: `base.py` / `dev.py` / `prod.py`. Variables por entorno con `django-environ`.
4. Dependencias: `django`, `djangorestframework`, `psycopg[binary]`, `django-environ`, `django-filter`, `drf-spectacular`. Dev: `pytest`, `pytest-django`, `pytest-cov`, `factory-boy`, `freezegun`, `ruff`, `pre-commit`.
5. `pytest.ini` con `--cov --cov-fail-under=90`. `conftest.py` base.
6. `ruff.toml`: line-length 100, reglas `E,F,I,N,UP,B,DJ`. `ruff format` como formateador.
7. `.pre-commit-config.yaml`: `ruff`, `ruff-format`, `check-merge-conflict`, `end-of-file-fixer`, `trailing-whitespace`, `check-added-large-files`. Instalar el hook.
8. Un test trivial que pase, para verificar que la tubería corre de punta a punta.

**Puertas de salida:** `pytest` verde, `pre-commit run --all-files` limpio, `docker compose up` levanta y responde en `/admin`.

**Validación del orquestador:** revisar que `--cov-fail-under=90` esté activo desde ya (no "lo subimos después"), y que los settings de prod no tengan secretos hardcodeados.

---

# FASE 1 — Modelos base y catálogos

**Objetivo:** esquema completo migrado, sin lógica.

**Tareas del ejecutor:**

1. Implementar los modelos exactamente como en `jornalpro-django-models.md`: `Organization`, `CatalogBase` + `WorkdayType`/`PaymentStatus`/`LoanStatus`/`PaymentMethod`, `User` (AbstractUser) + `WorkerProfile`, `WorkerRate` + `Workday`, `Loan` + `Payment` + `PaymentWorkdayDetail` + `PaymentLoanDetail`.
2. `AUTH_USER_MODEL = "users.User"` desde la primera migración (no se puede cambiar después sin dolor).
3. `WorkerScopedQuerySet.for_organization()` como manager en `Workday`, `Loan`, `Payment`.
4. Data migrations de semillas: catálogos en español (Día completo/Medio día, Pendiente/Parcial/Pagado, Activo/Pagado/Condonado, Efectivo/Transferencia/Nequi/Daviplata) y grupos `Maestro` / `Trabajador`.
5. Factories de `factory-boy` para todos los modelos.
6. Registrar todo en el admin con `list_display`, `list_filter` y `search_fields` razonables.

**Tests obligatorios:**

- Cada modelo se crea vía factory y persiste.
- `WorkerProfile.current_rate` devuelve la tarifa vigente cuando hay varias, incluyendo el caso `valid_until=None` y el caso de tarifa ya vencida (usar `freezegun`).
- `for_organization()` no devuelve filas de otra organización.
- `unique_together` de `WorkdayType(organization, name)`, `PaymentWorkdayDetail(payment, workday)` y `PaymentLoanDetail(payment, loan)` levantan `IntegrityError`.
- Las semillas quedaron creadas después de migrar.

**Puertas de salida:** migraciones aplican en base limpia, `makemigrations --check --dry-run` no detecta cambios pendientes, tests verdes.

**Validación del orquestador:** verificar que no se coló ningún `choices` y que ningún modelo de negocio tiene FK directa a `Organization` (el aislamiento va por `worker__user__organization`).

---

# FASE 2 — Capa de servicios: jornadas y tarifas

**Objetivo:** la lógica de negocio de jornadas, aislada y testeada.

**Tareas del ejecutor:**

1. `workdays/services.py`:
   - `create_worker_rate(worker, amount, valid_from)` — cierra la tarifa anterior poniéndole `valid_until = valid_from - 1 día`. No se permiten dos tarifas vigentes solapadas.
   - `create_workday(worker, workday_type, date, applied_rate=None, created_by=...)` — si `applied_rate` es `None`, calcula `worker.current_rate.amount * workday_type.factor`. Estado inicial: `Pendiente`.
   - `update_workday(...)` — no permite modificar una jornada que ya tiene pagos aplicados; levanta excepción de dominio.
   - `delete_workday(...)` — misma restricción.
2. `workdays/exceptions.py` con excepciones de dominio propias (`WorkdayAlreadyPaidError`, `NoActiveRateError`, `OverlappingRateError`).
3. Todo servicio que toque más de una fila: `transaction.atomic`.

**Tests obligatorios (casos límite, no solo el happy path):**

- Jornada con tarifa auto-calculada, día completo (factor 1.0) y medio día (factor 0.5) — verificar el redondeo a 2 decimales.
- Jornada con `applied_rate` explícita distinta de la vigente (el caso "ese día le pagué distinto") — la jornada guarda el valor explícito y la tarifa vigente no se altera.
- Crear jornada para trabajador **sin** tarifa vigente → `NoActiveRateError`.
- Nueva tarifa cierra correctamente la anterior; jornadas históricas conservan su `applied_rate` (no se recalculan retroactivamente).
- Tarifa con `valid_from` anterior a la vigente actual → `OverlappingRateError`.
- Editar/eliminar jornada ya pagada (total o parcialmente) → `WorkdayAlreadyPaidError`.
- Jornada duplicada mismo trabajador/misma fecha: decidir con el orquestador si se permite (turno partido) — **el ejecutor pregunta, no asume**.

---

# FASE 3 — Capa de servicios: préstamos y pagos (la crítica)

**Objetivo:** el núcleo de dinero. Aquí la cobertura es **100% obligatoria**.

**Tareas del ejecutor:**

1. `payments/services.py`:
   - `create_loan(worker, amount, date, reason, created_by)` — `outstanding_balance = amount`, estado `Activo`.
   - `register_payment(worker, payment_method, payment_date, workday_ids, loan_allocations, created_by)`:
     - Abre `transaction.atomic`.
     - `select_for_update()` sobre las jornadas y préstamos involucrados.
     - Crea `Payment`, crea los `PaymentWorkdayDetail` (monto = `applied_rate` de cada jornada, salvo pago parcial explícito) y los `PaymentLoanDetail` según `loan_allocations`.
     - Recalcula `Loan.outstanding_balance` restando lo abonado; si llega a 0 → estado `Pagado`.
     - Recalcula `Workday.payment_status`: suma de detalles = `applied_rate` → `Pagado`; 0 < suma < `applied_rate` → `Parcial`; 0 → `Pendiente`.
     - `total_amount` del pago = suma de todos los detalles. Validar consistencia y levantar excepción si no cuadra.
   - `void_payment(payment)` — reversa: revierte saldos de préstamo, devuelve estados de jornada al valor que corresponda, y marca el pago como anulado (**preguntar al orquestador**: soft-delete con campo `voided_at` vs. borrado — no asumir).
   - `worker_balance(worker)` — devuelve jornadas pendientes, total adeudado, saldo de préstamos y neto a pagar.
2. `payments/exceptions.py`: `OverpaymentError`, `LoanOverpaymentError`, `InconsistentPaymentTotalError`, `CrossOrganizationError`.

**Tests obligatorios — movimientos de saldo, todos los casos:**

*Préstamos*
- Abono parcial: saldo baja exactamente lo abonado, estado sigue `Activo`.
- Abono que deja el saldo en 0: estado pasa a `Pagado`.
- Abono mayor al saldo pendiente → `LoanOverpaymentError`, y **el saldo no se modifica** (verificar que la transacción hizo rollback).
- Varios abonos sucesivos al mismo préstamo: el saldo va bajando correctamente y la suma de abonos nunca excede el monto.
- Abono a préstamo ya `Pagado` → error.
- Préstamo condonado: no admite abonos.

*Jornadas*
- Pago que cubre exactamente una jornada → `Pagado`.
- Pago parcial de una jornada → `Parcial`; un segundo pago que completa el resto → `Pagado`.
- Pago que cubre 5 jornadas de golpe: las 5 quedan `Pagado`, `total_amount` = suma de las 5.
- Pago que excede el valor de la jornada → `OverpaymentError`.
- Intentar pagar dos veces la misma jornada en el mismo `Payment` → `IntegrityError` por `unique_together`.
- Intentar volver a pagar una jornada ya `Pagado` en un pago posterior → error.

*Pagos mixtos (el caso real)*
- Un pago que cubre 3 jornadas **y** abona parcialmente a un préstamo: verificar que `total_amount` = jornadas + abono, que el saldo del préstamo bajó, y que las 3 jornadas quedaron `Pagado`.
- Un pago que cubre jornadas y **cancela** un préstamo completo: préstamo a `Pagado`, saldo 0.
- Pago donde el abono al préstamo se descuenta de lo que se le entrega en efectivo — validar con el orquestador cómo se representa (`total_amount` bruto vs. neto entregado). **Pregunta obligatoria, es una decisión de negocio.**

*Reversas e integridad*
- `void_payment` de un pago mixto: préstamo recupera su saldo, jornadas vuelven a `Pendiente`/`Parcial` según corresponda.
- `void_payment` dos veces sobre el mismo pago → error, sin doble reversa del saldo.
- Pago que intenta mezclar jornadas de un trabajador con préstamo de otro → `CrossOrganizationError`.
- Pago con jornadas de otra organización → `CrossOrganizationError`.
- Concurrencia: dos `register_payment` simultáneos sobre el mismo préstamo no producen saldo negativo (test con `TransactionTestCase` y threads, o al menos verificar que el `select_for_update` está presente).
- Redondeo: montos con decimales (ej. tarifa 58.333,33) suman exacto, sin drift de centavos. Todo `Decimal`, **nunca `float`**.
- `worker_balance` con: sin jornadas; solo jornadas pendientes; jornadas + préstamo activo; todo saldado (neto 0).

**Validación del orquestador:** leer línea por línea `register_payment` y `void_payment`. Confirmar `Decimal` en todo, `atomic` + `select_for_update` presentes, y que no hay ninguna ruta que actualice `outstanding_balance` fuera del servicio. Exigir 100% de cobertura en este archivo.

---

# FASE 4 — API REST

**Objetivo:** exponer todo con DRF, con aislamiento por tenant garantizado.

**Tareas del ejecutor:**

1. Autenticación JWT (`djangorestframework-simplejwt`): `/api/auth/login/`, `/refresh/`.
2. Permiso base `IsOrganizationMember`: bloquea cualquier request cuyo `request.user.organization` no coincida con el objeto.
3. Permiso `IsMaestro` (grupo "Maestro") para todo lo que escriba. El grupo "Trabajador" solo lee y solo lo suyo (`worker=request.user.worker_profile`).
4. ViewSets: catálogos (solo lectura para trabajador), trabajadores, tarifas, jornadas, préstamos, pagos, y endpoint `GET /api/workers/{id}/balance/`.
5. **Todos** los `get_queryset()` aplican `for_organization(request.user.organization)`. Sin excepción.
6. Las vistas de escritura llaman a los servicios de las Fases 2 y 3; **cero lógica de negocio en serializers o vistas**.
7. Mapear las excepciones de dominio a respuestas 400/409 con un `exception_handler` propio.
8. Filtros (`django-filter`) por rango de fechas, trabajador, estado. Paginación por defecto.
9. `drf-spectacular` → schema en `/api/schema/` y Swagger UI.

**Tests obligatorios:**

- Un maestro de la organización A recibe **404** (no 403 — no filtramos información) al pedir un trabajador de la organización B. Repetir para jornadas, préstamos y pagos.
- Un trabajador **no puede** crear/editar/eliminar nada (403 en cada verbo de escritura).
- Un trabajador solo ve sus propias jornadas y préstamos, no los de sus compañeros.
- Usuario sin autenticar → 401 en todos los endpoints salvo login.
- Cada excepción de dominio de la Fase 3 devuelve el status y el cuerpo de error esperado.
- Un test de humo por endpoint: 2xx con payload válido, 400 con payload inválido.

**Validación del orquestador:** intentar romper el aislamiento a mano (IDs de otra organización en el body, no solo en la URL). Si hay una sola ruta sin `for_organization`, se devuelve la fase.

---

# FASE 5 — Frontend: base

**Objetivo:** cimientos del cliente, sin pantallas de negocio todavía.

**Tareas del ejecutor:**

1. React + Vite + TypeScript. TailwindCSS. **Mobile-first**: el maestro va a usar esto en el celular parado en la obra, esa es la vista principal, no el escritorio.
2. ESLint + Prettier + `eslint-plugin-react-hooks` + `@typescript-eslint`. `npm run lint` sin warnings.
3. Añadir el lint del frontend al `.pre-commit-config.yaml` (hook local que corre sobre archivos staged).
4. Cliente HTTP (axios) con interceptor de JWT + refresh automático. TanStack Query para estado de servidor.
5. Tipos TS generados desde el schema de `drf-spectacular` (`openapi-typescript`), no escritos a mano.
6. Rutas protegidas por rol, layout base, navegación inferior en móvil.
7. Login funcional contra el backend.

**Puertas de salida:** `npm run lint` limpio, `npm run build` limpio, `tsc --noEmit` limpio, login real funciona contra el backend.

---

# FASE 6 — Frontend: pantallas de gestión

1. Trabajadores: lista, alta, edición, activar/desactivar, historial de tarifas.
2. Registro de jornadas — **la pantalla más importante**: seleccionar fecha, marcar varios trabajadores de golpe, tipo de jornada por trabajador, y opción de sobrescribir la tarifa de ese día. Tiene que ser rápido de operar con una mano.
3. Vista de jornadas: filtro por trabajador y por rango, con estado de pago visible.
4. Catálogos: CRUD de tipos de jornada y métodos de pago (para que el maestro no dependa de ti para agregar "Nequi" o "turno nocturno").

Cada pantalla con estados de carga, error y vacío. Nada de pantallas en blanco.

**Puerta de salida:** lint + build limpios.

---

# FASE 7 — Frontend: préstamos, pagos y liquidación

1. Préstamos: alta, lista con saldo pendiente visible, historial de abonos.
2. **Pantalla de liquidación** (la que más cuidado necesita): elegir trabajador → muestra jornadas pendientes con su total, préstamos activos con su saldo → el maestro marca qué jornadas paga y cuánto abona al préstamo → el neto a entregar se calcula en vivo → confirmar.
3. Historial de pagos con detalle desglosado (qué jornadas y qué abonos incluyó cada pago) y opción de anular.
4. Dashboard del maestro: total pendiente por pagar, préstamos activos, jornadas de la semana.
5. Vista del trabajador: sus jornadas, su saldo, sus préstamos. Solo lectura.

**Regla:** los cálculos que se muestran en pantalla se comparan siempre contra `GET /workers/{id}/balance/`. La UI **no** es la fuente de verdad de los montos; si difiere del backend, es bug del frontend.

**Puerta de salida:** lint + build limpios.

---

# FASE 8 — Validación con Playwright MCP

El ejecutor usa el MCP de Playwright para verificar en navegador real. No basta con que compile.

**Flujos funcionales a recorrer end-to-end:**

1. Login como maestro → dashboard carga con datos reales.
2. Crear trabajador → asignarle tarifa → aparece en la lista.
3. Registrar jornadas de 3 trabajadores en una fecha → verificar que aparecen como `Pendiente`.
4. Crear un préstamo a uno de ellos.
5. Liquidar: pagar 2 jornadas + abonar parcialmente el préstamo → **verificar en pantalla que el saldo del préstamo bajó exactamente lo abonado y que las jornadas quedaron `Pagado`**.
6. Anular ese pago → verificar que todo volvió al estado anterior.
7. Login como trabajador → solo ve lo suyo, no ve botones de escritura.

**Validación visual y responsiva:**

- Capturas en 3 anchos: **375px** (móvil, el caso real de uso), **768px** (tablet), **1440px** (escritorio).
- En cada ancho verificar: sin scroll horizontal, sin texto desbordado o cortado, botones de al menos 44px de alto (uso con guantes/dedo en obra), tablas que colapsan a tarjetas en móvil, modales que caben en pantalla.
- Revisar la consola del navegador: **cero errores**, cero warnings de React.
- Formularios: mensajes de error visibles y legibles, no solo un borde rojo.

**Reporte:** el ejecutor entrega las capturas y una lista de hallazgos. El orquestador revisa las capturas y decide qué se corrige antes de cerrar.

---

# FASE 9 — Cierre

1. Auditoría de cobertura: global ≥90%, servicios de dinero al 100%. Si algo bajó, se arregla.
2. `README.md`: cómo levantar el proyecto, correr tests, variables de entorno.
3. Documentación arc42 en `docs/arc42/` usando la skill que ya tienes.
4. `docker-compose.prod.yml` y preparación de despliegue en Dokploy con Traefik.
5. Repaso final del orquestador sobre todo el diff acumulado, con foco en: rutas sin filtro de organización, cálculos con `float`, lógica de negocio que se haya filtrado a las vistas.

---

## Anexo — Preguntas que el ejecutor DEBE hacer (no asumir)

Estas ya están identificadas como decisiones de negocio abiertas. El ejecutor las plantea al llegar a la fase correspondiente:

| Fase | Pregunta |
|---|---|
| 2 | ¿Se permite más de una jornada del mismo trabajador en la misma fecha? |
| 3 | ¿`void_payment` es soft-delete (`voided_at`) o borrado real? |
| 3 | ¿`Payment.total_amount` es el bruto (jornadas + abono) o el neto entregado en efectivo? |
| 3 | ¿Un préstamo puede abonarse sin que haya jornadas en el mismo pago? |
| 6 | ¿El maestro puede registrar jornadas de fechas pasadas sin límite, o hay una ventana? |
| 7 | ¿El trabajador puede ver el detalle de sus préstamos o solo el saldo? |

Cualquier otra ambigüedad que aparezca se agrega a esta tabla antes de escribir código.
---

## Anexo B — Decisiones cerradas (2026-09-06)

Resueltas por el usuario vía el orquestador. **No se re-discuten.**

| Tema | Decisión |
|---|---|
| Esquema de dinero | Vuelve al canónico del plan: `Loan` + `Payment` + `PaymentWorkdayDetail` + `PaymentLoanDetail`. Se elimina `Liquidacion` / `MovimientoDeuda`. `WorkerRate` se mueve de `users` a `workdays`. `TipoMovimientoDeuda` → `LoanStatus`. |
| Camino migratorio | Borrar migraciones → `docker compose down -v` → recrear modelos → `migrate` desde cero. Sin migraciones de transformación (el proyecto no está desplegado). |
| Stack frontend | Se queda en JSX (no se migra a TypeScript). Se añade **TanStack Query** reemplazando el `DataContext` monolítico por queries/mutations con caché e invalidación. |
| Alta de trabajador | El backend genera la contraseña, la devuelve **solo** en la respuesta del POST y guarda el hash. "Restablecer" llama a un endpoint que devuelve la nueva una única vez. `AccesoTab` deja de leer `usuario.password`. |
| `Payment.total_amount` | **Bruto**: suma de todos los detalles (jornadas + abonos a préstamo). El neto entregado en efectivo se calcula, no se almacena. |
| `void_payment` | **Soft-delete**: `voided_at` + `voided_by` en `Payment`. Los saldos se revierten; el registro se conserva por auditoría. |
| Abono sin jornadas | **Permitido**: un pago puede abonar solo a un préstamo (el trabajador devuelve efectivo). |
| Jornada duplicada | **Permitida sin restricción** (turno partido, hora extra). Ningún constraint `unique(worker, date)`. |

### Fases de ejecución vigentes

- **Fase A** — Reset del esquema (modelos, migraciones desde cero, admin, factories, tests de modelo).
- **Fase B** — Capa de servicios: `workdays/services.py` y `payments/services.py`. Cobertura 100% en dinero.
- **Fase C** — API REST: workers, worker-rates, workdays, loans, payments, `GET /workers/{id}/balance/`, gestión de usuarios, exception handler, permisos.
- **Fase D** — Frontend: TanStack Query + cableado de las ~14 mutaciones hoy `noop`.
- **Fase E** — Validación Playwright (Fase 8 del plan) y cierre (Fase 9).
