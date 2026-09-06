# 10 — Glossary

Términos del dominio y técnicos usados en el proyecto.

## Términos del dominio (construcción)

| Término | Definición |
|---------|------------|
| **Jornal** | Pago diario por día de trabajo. En Colombia típicamente se calcula como jornal_diario × días_trabajados. |
| **Maestro de obra** | Persona que dirige una obra de construcción. En JornalPro, es el usuario primario que registra jornadas y paga. |
| **Trabajador / Obrero** | Persona que ejecuta el trabajo físico. En JornalPro, ve sus propios días y pagos en modo lectura. |
| **Jornada** | Un día de trabajo. Tiene tipo (día completo, medio día, hora extra) y una tarifa aplicada. |
| **Medio día** | Jornada que vale 0.5 × jornal_diario. |
| **Hora extra** | Jornada que vale 1.5 × jornal_diario. |
| **Préstamo / Adelanto** | Dinero que el maestro le da al trabajador antes del cierre. Se descuenta de la próxima liquidación. En JornalPro es un `MovimientoDeuda` con `affects_balance=True`. |
| **Abono** | Pago que el trabajador hace al maestro para reducir deuda (raro, pero existe). En JornalPro es un `MovimientoDeuda` con `affects_balance=False`. |
| **Liquidación** | El cierre de un período (típicamente semanal). Genera un comprobante con el detalle de lo que se pagó. |
| **Comprobante** | El resultado de una Liquidación. Es un snapshot inmutable. |
| **Tarifa** | El valor por día que se le paga a un trabajador específico. Puede cambiar en el tiempo (tener histórico vía `WorkerRate`). |
| **Tenant** | Un maestro o empresa constructora que usa JornalPro como SaaS independiente. En código: `Organization`. |
| **Saldo de deuda** | Lo que el trabajador le debe al maestro. Se calcula como `sum(movimientos.signed_amount where liquidacion IS NULL)`. |

## Términos técnicos

| Término | Definición |
|---------|------------|
| **Multi-tenant** | Una sola instalación del software sirve a múltiples clientes (tenants) independientes. |
| **Shared schema** | Estrategia multi-tenant donde todos los tenants comparten las mismas tablas, diferenciados por una columna `organization_id`. |
| **Bounded context** | Subdominio del problema con su propio modelo. En Django, cada bounded context vive en una `app/`. |
| **Snapshot inmutable** | Copia de datos en un momento dado que NO se actualiza cuando los datos originales cambian. |
| **SimpleJWT** | Librería DRF para autenticación con JWT. |
| **HttpOnly cookie** | Cookie que NO es legible desde JavaScript. Mitiga XSS. |
| **SameSite=Lax** | Atributo de cookie que mitiga CSRF: la cookie NO se envía en requests cross-site de terceros. |
| **DRF** | Django REST Framework. |
| **ViewSet** | Clase DRF que agrupa las operaciones CRUD de un modelo en una sola URL. |
| **Serializer** | Clase DRF que convierte entre modelos Django y JSON. |
| **prefetch_related** | Query de Django que ejecuta una segunda query para relaciones inversas, evitando N+1. |
| **select_related** | Query de Django que usa JOIN para traer FKs en una sola query. |
| **pgbouncer** | Proxy ligero para Postgres que mantiene un pool de conexiones. |
| **JSONField** | Campo PostgreSQL nativo para datos JSON. Permite queries con operadores como `@>` y `?`. |
| **Celery** | Cola de tareas async para Python. |
| **Celery beat** | Programador de tareas Celery (cron-like). |
| **Flower** | UI web para monitorear Celery. |
| **Gunicorn** | Servidor WSGI para Python en producción. |
| **Nginx** | Servidor web / proxy inverso. |
| **arc42** | Template de documentación de arquitectura. |
| **ADR** | Architecture Decision Record. Documento que captura una decisión arquitectónica + contexto + consecuencias. |
| **Dokploy** | PaaS self-hosted para Docker. Usado para desplegar JornalPro en producción. |
| **YAGNI** | "You Aren't Gonna Need It". Principio de no añadir funcionalidad hasta que se necesite. |

## Siglas

| Sigla | Significado |
|-------|-------------|
| CRUD | Create, Read, Update, Delete |
| CSRF | Cross-Site Request Forgery |
| XSS | Cross-Site Scripting |
| JWT | JSON Web Token |
| ORM | Object-Relational Mapping |
| N+1 | Anti-patrón: 1 query inicial + N queries adicionales en loop |
| R6 | Regla de negocio 6 (en el prototipo original: liquidar bloquea jornadas + crea abonos) |
| MVP | Minimum Viable Product |
| SaaS | Software as a Service |
| COP | Peso colombiano (moneda) |
| SLA | Service Level Agreement |
| OWASP | Open Web Application Security Project |
| WSGI | Web Server Gateway Interface |
