# arc42 — Documentación de arquitectura de JornalPro

Documentación de la arquitectura del sistema **JornalPro** siguiendo el
template [arc42 v9.0](https://arc42.org/).

> 📘 **Doc interactiva Sphinx:** [`../index.rst`](../index.rst) describe la
> misma arquitectura en formato HTML navegable (generada con `just docs-serve`).
> arc42 y Sphinx describen los mismos bloques; mantenerlos sincronizados.

## Índice

| # | Sección | Descripción |
|---|---------|-------------|
| 01 | [Introduction and Goals](01_introduction_and_goals.md) | Propósito, stakeholders, objetivos de calidad |
| 02 | [Architecture Constraints](02_architecture_constraints.md) | Restricciones técnicas y organizativas |
| 03 | [System Scope and Context](03_system_scope_and_context.md) | Contexto de negocio y técnico |
| 04 | [Solution Strategy](04_solution_strategy.md) | Decisiones estratégicas de diseño |
| 05 | [Building Block View](05_building_block_view.md) | Estructura estática del software |
| 06 | [Runtime View](06_runtime_view.md) | Comportamiento dinámico (escenarios) |
| 07 | [Deployment View](07_deployment_view.md) | Infraestructura y despliegue |
| 08 | [Architectural Decisions](08_architectural_decisions.md) | 3 ADRs clave (SimpleJWT, multi-tenant, snapshot) |
| 09 | [Quality Requirements](09_quality_requirements.md) | Atributos de calidad y métricas |
| 10 | [Glossary](10_glossary.md) | Términos del dominio |
| 11 | [Technical Risks](11_technical_risks.md) | Riesgos técnicos y deuda |

## Cómo navegar

- **¿Nuevo en el proyecto?** → Lee [01 Introduction](01_introduction_and_goals.md) +
  [05 Building Block View](05_building_block_view.md).
- **¿Quieres entender una decisión?** → Lee [08 Architectural Decisions](08_architectural_decisions.md).
- **¿Vas a desplegar?** → Lee [07 Deployment View](07_deployment_view.md) +
  [docs/PGBOUNCER_OPTIMAL.md](../PGBOUNCER_OPTIMAL.md).
- **¿Hay problemas?** → Lee [11 Technical Risks](11_technical_risks.md).

## Estado

Documentación generada como parte de **Fase 6** del plan `plan-001-jornalpro-backend.md`.
Cubre únicamente lo implementado en Fases 0-5. Lo que NO se ha implementado
todavía (notificaciones, exportar Excel, multi-moneda) NO está documentado.
