# 01 — Introduction and Goals

JornalPro es una aplicación web para que **maestros de obra** en Colombia
gestionen el jornal diario de sus trabajadores: jornadas, tarifas, deudas
(préstamos/adelantos), liquidaciones semanales/quincenales y comprobantes
inmutables.

El nombre viene de "jornal" — el pago diario por día de trabajo en
construcción — y "pro" porque reemplaza las libretas de papel o las hojas
de cálculo informales con un sistema auditable, multi-tenant y en la nube.

## Stakeholders

| Rol | Necesidad | Por qué importa |
|-----|----------|-----------------|
| **Maestro de obra** | Registrar días trabajados, pagar semanalmente, controlar préstamos | El usuario primario. Sin él no hay producto. |
| **Trabajador** | Ver cuántos días trabajó, cuánto le deben, cuánto le pagaron | Visibilidad y confianza — antes dependía de la palabra del maestro. |
| **Admin plataforma** | Gestionar varios maestros como tenants separados, ver métricas globales | Quien paga la suscripción SaaS. Necesita ver el negocio completo. |
| **Contador / Auditor** | Verificar que las liquidaciones son correctas y no se alteraron | El snapshot inmutable de la liquidación existe por esto. |
| **Desarrollador** | Entender el sistema, mantenerlo, agregar features | Equipo interno. La documentación arc42 es para ellos. |

## Objetivos de negocio

1. **Reducir el tiempo de cierre semanal** del maestro. De ~3 horas con
   libreta de papel a <30 minutos con la app.
2. **Eliminar disputas** entre maestro y trabajador sobre cuánto se pagó
   o cuánto se descontó. El comprobante es snapshot inmutable.
3. **Permitir que un admin plataforma gestione N maestros** sin ver los
   datos de los otros maestros (multi-tenant por `organization_id`).
4. **Soportar 1 maestro con hasta 50 trabajadores** sin que la app se
   ponga lenta (< 1 query por listado, paginación estándar DRF).

## Objetivos de calidad (top 3)

Estos son los atributos de calidad que **definen** la arquitectura. Si
tienes que elegir entre simplicidad y estos, gana el atributo.

### Q1. Aislamiento multi-tenant (security)

- **Qué:** un maestro NO puede ver ni modificar datos de otro maestro.
- **Cómo se mide:** un test automatizado verifica que, tras autenticarse
  como usuario del Tenant A, todas las queries devuelven 0 filas del
  Tenant B. Ver `apps/users/permissions.py::IsSameOrganization`.
- **Trade-off conocido:** si olvidas aplicar el filtro en un ViewSet
  nuevo, hay fuga. Por eso cada ViewSet tiene el patrón
  `get_queryset()` con 3 ramas (admin, maestro, trabajador).

### Q2. Performance — sin N+1

- **Qué:** listar N jornadas, N movimientos o N liquidaciones debe
  generar **un número constante de queries**, no N.
- **Cómo se mide:** cada ViewSet usa `select_related()` para FKs y
  `prefetch_related()` para relaciones inversas. Tests con
  `CaptureQueriesContext` verifican que listar 3 liqs genera
  < `QUERY_BUDGET=15` queries.
- **Trade-off conocido:** si añades un campo calculado al serializer
  que itera sobre relaciones, puedes introducir un N+1 silencioso.
  Cada serializer nuevo debe auditarse con `CaptureQueriesContext`.

### Q3. Audit / Inmutabilidad de liquidaciones

- **Qué:** una vez creada una Liquidación, **NO se puede modificar** ni
  directa ni indirectamente. Aunque cambies la tarifa o borres la
  Workday subyacente, el comprobante mantiene sus valores.
- **Cómo se mide:** el campo `Liquidacion.detalle` (JSONField) es un
  snapshot copiado en el momento de la liquidación. Test
  `test_snapshot_detalle_no_cambia_si_se_edita_workday` verifica que
  tras `wd.save()` (que falla porque la Workday está liquidada), el
  detalle NO cambia.
- **Trade-off conocido:** si en el futuro necesitamos "anular" una
  liquidación, hay que hacerlo creando una Liquidación de tipo
  "rectificación" que apunte a la original. NO borramos.

## No-objetivos (fuera de alcance)

- ❌ Multi-moneda. Sólo pesos colombianos (COP).
- ❌ Notificaciones push / email al trabajador cuando se liquida.
- ❌ Exportar a Excel/PDF (sólo vista web).
- ❌ App móvil nativa (sólo web responsive).
- ❌ Integración con bancos / pasarelas de pago.

Estos quedan como posibles features futuros pero NO están en la
arquitectura actual.
