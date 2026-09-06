# arc42 — Documentación de arquitectura de JornalPro

Documentación de la arquitectura del sistema **JornalPro** siguiendo el
template [arc42 v9.0](https://arc42.org/).

> 📘 **Doc interactiva Sphinx:** [`../index.rst`](../index.rst) describe la
> misma arquitectura en formato HTML navegable (generada con `just docs-serve`).
> arc42 y Sphinx describen los mismos bloques; mantenerlos sincronizados.

## Índice

| # | Sección | Descripción | Estado |
|---|---------|-------------|--------|
| 01 | [Introducción y metas](01-introduccion-y-metas/README.md) | Propósito, stakeholders, objetivos de calidad | Completa |
| 02 | [Restricciones](02-restricciones/README.md) | Restricciones técnicas y organizativas | Completa |
| 03 | [Contexto y alcance](03-contexto-y-alcance/README.md) | Contexto de negocio y técnico, frontera del sistema | Completa |
| 04 | [Estrategia de solución](04-estrategia-de-solucion/README.md) | Decisiones estratégicas de diseño, una línea cada una | Completa |
| 05 | [Vista de bloques](05-vista-de-bloques/README.md) | Estructura estática del software (Nivel 1) | Completa |
| 06 | [Vista de ejecución](06-vista-de-ejecucion/README.md) | Escenarios de comportamiento relevantes | Completa |
| 07 | [Vista de despliegue](07-vista-de-despliegue/README.md) | Infraestructura, mapeo bloques↔nodos | Completa |
| 08 | [Conceptos transversales](08-conceptos-transversales/README.md) | Multi-tenancy, modelo de dinero, preview, soft-delete | Completa |
| 09 | [Decisiones de arquitectura](09-decisiones-de-arquitectura/README.md) | ADRs (registro detallado de decisiones) | Completa |
| 10 | [Requisitos de calidad](10-requisitos-de-calidad/README.md) | Atributos de calidad y métricas | Parcial |
| 11 | [Riesgos y deuda técnica](11-riesgos-y-deuda-tecnica/README.md) | Riesgos conocidos, deuda técnica | Parcial |
| 12 | [Glosario](12-glosario/README.md) | Términos del dominio | Completa |

## Cómo navegar

- **¿Nuevo en el proyecto?** → [01 Introducción](01-introduccion-y-metas/README.md) +
  [05 Vista de bloques](05-vista-de-bloques/README.md) +
  [08 Conceptos transversales](08-conceptos-transversales/README.md).
- **¿Vas a tocar la lógica de dinero?** →
  [08 · modelo de dinero](08-conceptos-transversales/README.md#modelo-canónico-de-dinero)
  antes que nada. **Decimal en todo, atomic + select_for_update obligatorio.**
- **¿Vas a añadir un endpoint que cruce tenants?** →
  [08 · multi-tenancy](08-conceptos-transversales/README.md#multi-tenancy) para
  entender dónde va el filtro de organización y por qué cross-org es 404, no 403.
- **¿Vas a registrar/anular un pago?** →
  [08 · preview vs register](08-conceptos-transversales/README.md#preview-vs-register)
  y [08 · soft-delete con auditoría](08-conceptos-transversales/README.md#anulación-soft-delete).
- **¿Quieres entender una decisión?** →
  [09 Decisiones de arquitectura](09-decisiones-de-arquitectura/README.md).
- **¿Vas a desplegar?** →
  [07 Vista de despliegue](07-vista-de-despliegue/README.md) +
  [../PGBOUNCER_OPTIMAL.md](../PGBOUNCER_OPTIMAL.md).
- **¿Hay problemas?** →
  [11 Riesgos y deuda](11-riesgos-y-deuda-tecnica/README.md).

## Estado

Documentación generada como parte de **Fase 9** (cierre) del plan
`plan-001-jornalpro-backend.md`. Cubre todo lo implementado hasta F8.
Secciones 10 y 11 marcadas como **Parcial** por decisión del usuario:
no se profundizó en escenarios de calidad ni en nuevos riesgos durante
el cierre; se conservan los que ya existían.

Plantilla: **arc42 v9.0**. Última revisión: 2026-09-06.
