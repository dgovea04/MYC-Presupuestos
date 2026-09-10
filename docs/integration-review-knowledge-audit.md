# Auditoría de integración MC Revisión Inteligente ↔ MC Knowledge Perú

Fecha: 2026-09-09  
PRD auditado: `prd/PRD_Integracion_Avanzada_MC_Revision_Inteligente_MC_Knowledge_Peru.md`

## Alcance y estado del repositorio

La auditoría se realizó antes de cambios de implementación. El árbol de trabajo ya contiene cambios no relacionados en `components/khipu/*`, archivos de diagnóstico y los PRD de Knowledge; no se modificaron ni limpiaron.

El repositorio ya tiene módulos separados para Review y Knowledge, Prisma 7/Next 16, `decimal.js`, autenticación NextAuth, memberships de company, autorización de proyecto, persistencia de Review V1, tests Vitest y una migración inicial de Knowledge.

## Archivos y rutas confirmados

### Knowledge

- Servicios: `lib/knowledge/api-access.ts`, `events.ts`, `observations.ts`, `provenance.ts`, `scope.ts`, `validation.ts`, `canonical-items.ts`, `canonical-resources.ts`, `apu.ts`, `retrieval.ts`, `integrations.ts`.
- APIs confirmadas: `/api/knowledge/events`, `/items`, `/items/[id]/aliases`, `/resources`, `/resources/[id]/aliases`, `/price-observations`, `/yield-observations`, `/sources`, `/sources/evidence`, `/retrieval`, además de regiones y suppliers.
- Administración: `app/admin/knowledge/page.tsx` y `components/admin/knowledge-review-panel.tsx`.

### Review

- Servicios: `lib/review-intelligence/findings.ts`, `pipeline.ts`, `jobs.ts`, `storage.ts`, matching, extracción, lifecycle y métricas.
- APIs confirmadas: review runs, documents, evidence, findings, decisions, assignments, review status y `/api/ai/review/bridge`.
- UI: `components/review-intelligence/review-intelligence-page.tsx`, queue, detail, dashboard y paneles relacionados.
- El guardado de decisiones está en `recordFindingDecision`; conserva la decisión antes de intentar registrar el evento Knowledge.

### Seguridad e infraestructura

- Auth: `lib/auth/session.ts`.
- Company/project access: `lib/workspace/access.ts` (`assertWorkspaceMembership`, `assertProjectInWorkspace`, `assertBudgetInWorkspace`).
- Review V1 ya persiste intentos, deadlines, retries, estados y auditoría de corrida.
- No se encontró una cola distribuida general ni un modelo `IntegrationJob` existente para Knowledge.
- No existe todavía una flag específica de integración Review → Knowledge; hay patrones de flags/rollout en otros dominios.
- Logging de integración actual usa `console.warn` en findings/imports; debe reemplazarse o envolverse en una superficie estructurada existente si está disponible.

## Modelo Prisma actual

La migración `prisma/migrations/20260907100000_add_mc_knowledge_v0/migration.sql` creó KnowledgeSource, KnowledgeEvidence, KnowledgeEvent, CanonicalItem/Resource, KnowledgeApuVersion, regiones, suppliers, PriceObservation, YieldObservation y KnowledgeAssertion. La migración siguiente agrega `sourceId` de suppliers.

ReviewEvidence ya contiene `companyId`, `projectId`, `documentVersionId`, hash, texto, ubicación, valor, unidad, extracción, confidence y metadata; tiene relaciones tenant-safe hacia Project/DocumentVersion y unique por documento/hash.

Brechas de modelo frente al PRD:

- No existe relación `ReviewEvidence ↔ KnowledgeEvidence` con `relationType`.
- KnowledgeSource/KnowledgeEvidence no tienen company/project/actor/provenance tenant explícita.
- KnowledgeAssertion no tiene `updatedBy`, evidencia, source, idempotency key, historial ni campos de lifecycle suficientes para un workflow auditable.
- PriceObservation/YieldObservation no tienen unique/idempotency key ni actor/finding/review evidence directos.
- KnowledgeApuVersion tiene unique `(apuId, versionNumber)`, pero no una identidad de snapshot derivado de Review.
- No existe IntegrationJob/error/dead-letter persistente.
- Las entidades canonical no tienen constraints que impidan por sí mismas combinaciones inválidas de scope y company/project.

## Comparación con el PRD

Ya existe parcialmente: separación modular, eventos idempotentes básicos, scope enum, observaciones Decimal-safe, provenance base, retrieval de items por PROJECT → COMPANY → GLOBAL, revisión humana de findings, correcciones con versión posterior y protección global en algunas rutas.

Falta o está incompleto: hardening transversal de tenancy, bridge de evidencia, taxonomy completa de eventos, builders de observaciones desde decisiones, retries/idempotencia de todos los artefactos, lifecycle de assertions, retrieval compuesto, enrichment detrás de flag, review queue administrativa, conflictos/promotion candidates/errors, observabilidad, backfill dry-run y documentación de rollout.

## Hallazgos P0 de seguridad

1. `app/api/knowledge/price-observations/route.ts` y `yield-observations/route.ts` sólo autentican. Aceptan desde el cliente scope/company/project/user/source/evidence y llaman directamente a builders que sólo validan presencia, no ownership.
2. `app/api/knowledge/sources/route.ts` y `sources/evidence/route.ts` sólo autentican. No hay company/project membership ni validación de que una evidencia pertenezca a una fuente autorizada.
3. GET de items/resources y retrieval derivan `companyId` de query string antes de verificar membership; retrieval sí verifica después, pero la lectura debe centralizarse y nunca depender de un companyId client-provided no resuelto.
4. Resource aliases no protegen `GLOBAL` con superadmin; item/resource alias services consultan la entidad por ID y mutan sin una guardia centralizada de scope/provenance.
5. `recordKnowledgeEvent` valida sólo forma de scope. La autorización se ejecuta en la ruta de events, no en el servicio, por lo que integraciones internas pueden omitirla accidentalmente.
6. `createKnowledgeSource`/`createKnowledgeEvidence` y observaciones usan Prisma directamente sin un actor/authorization context; esto dificulta imponer trazabilidad y cross-tenant tests.

Por la Regla 2 del PRD, no se deben implementar observation builders ni nuevos writes Review → Knowledge hasta corregir estos puntos y agregar pruebas cross-tenant/global.

## Plan de fases propuesto

1. Seguridad: contexto de actor, resolver de scope, ownership source/evidence/canonical y guards reutilizables; tests de company/project/global.
2. Evidence bridge: modelo/link idempotente y traversal desde ReviewFinding → ReviewEvidence → documento/version → KnowledgeEvidence.
3. Learning events: mapeo completo de resoluciones/evidencia/correcciones con actor y provenance.
4. Observation builders: price/yield/APU derivados sólo de decisiones humanas, default PROJECT, skip reasons y Decimal-safe.
5. Idempotencia/retry: keys determinísticas, constraints y `IntegrationJob`/errores aislados.
6. Assertion lifecycle y acciones administrativas explícitas.
7. Retrieval compuesto determinístico con filtros, ranking y provenance.
8. Review enrichment detrás de feature flag sin cambiar baseline ni mutar presupuesto.
9. Admin queue para assertions, observations, evidence, conflicts, candidates y errores.
10. Observabilidad, rollout y backfill dry-run/re-ejecutable.

## Invariantes que deberán quedar probados

- `humanReviewRequired = true` y `automaticBudgetMutation = false`.
- Review-originated writes usan `PROJECT` por defecto.
- Ningún `GLOBAL` se crea/promueve automáticamente.
- Un usuario de Company A no puede leer/escribir datos privados de Company B ni proyectos ajenos.
- Guardar una decisión Review no depende de que Knowledge esté disponible; el fallo queda retryable y no duplica.
- Toda observación derivada conserva finding, evidence, documento/version, company, project, actor y timestamp cuando existan.
- Retry/replay no duplica eventos, evidencia, observaciones, APU versions ni assertions.

## Conclusión de auditoría

La base funcional de V0 existe, pero la autorización no es suficientemente centralizada para soportar la integración avanzada. El siguiente cambio autorizado debe ser exclusivamente el hardening de tenancy y la cobertura de seguridad, seguido de una migración incremental para el bridge. No se recomienda el backfill ni la expansión de retrieval antes de cerrar los hallazgos P0.
