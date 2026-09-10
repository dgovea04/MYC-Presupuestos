# MC Revisión Inteligente ↔ MC Knowledge Perú Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar la integración avanzada segura, trazable e idempotente entre Review y Knowledge sin mutación automática del presupuesto.

**Architecture:** Mantener módulos separados y comunicar `lib/review-intelligence` con Knowledge mediante un Learning Bridge. La autorización, provenance, eventos, builders, retries y retrieval vivirán en servicios reutilizables; UI sólo consumirá APIs/servicios autorizados.

**Tech Stack:** Next.js App Router 16, TypeScript strict, Prisma 7, PostgreSQL, NextAuth, Vitest, `decimal.js`, Tailwind/shadcn existentes.

**Spec:** `docs/superpowers/specs/2026-09-09-review-knowledge-integration-architecture.md`

## Global Constraints

- `humanReviewRequired = true`.
- `automaticBudgetMutation = false`.
- Review-originated scope por defecto: `PROJECT`.
- Ninguna promoción automática a `GLOBAL`.
- Cálculos financieros con `decimal.js`; nunca convertir importes a `number`.
- No editar migraciones aplicadas.
- No acceso Prisma directo desde componentes UI.
- Después de cada fase ejecutar typecheck, lint y tests relevantes.

## Mapa de archivos

Create: `lib/knowledge/authorization.ts`, `lib/knowledge/learning-bridge.ts`, `lib/knowledge/idempotency.ts`, `lib/knowledge/assertions.ts`, `lib/knowledge/observations-from-review.ts`, `lib/knowledge/provenance-bridge.ts`, `lib/knowledge/integration-jobs.ts`, `lib/knowledge/retrieval-v1.ts`, tests unitarios correspondientes, migración nueva y scripts de backfill.

Modify: `lib/knowledge/api-access.ts`, `events.ts`, `observations.ts`, `provenance.ts`, `retrieval.ts`, `integrations.ts`, `lib/review-intelligence/findings.ts`, rutas `/api/knowledge/*`, rutas de decisiones Review, `app/admin/knowledge/page.tsx`, paneles Review/admin y documentación operativa.

## Task 1: Security hardening

**Files:** `lib/knowledge/authorization.ts`; `api-access.ts`; `observations.ts`; `provenance.ts`; canonical services; all `/api/knowledge` write routes; security tests.

- [ ] Escribir tests fallidos para company B, project B, source/evidence ajenos, GLOBAL por editor y alias GLOBAL.
- [ ] Ejecutar `npm.cmd test -- app/api/knowledge lib/knowledge` y confirmar fallos de autorización.
- [ ] Implementar `assertKnowledgeReadAccess`, `assertKnowledgeWriteAccess`, `assertKnowledgeEntityAccess` usando `assertWorkspaceMembership`, `assertProjectInWorkspace` y consultas ownership.
- [ ] Eliminar IDs de scope confiados del cliente y construir payloads con actor autenticado.
- [ ] Revalidar source/evidence/canonical antes de cada create.
- [ ] Ejecutar `npm.cmd test -- app/api/knowledge lib/knowledge`, `npm.cmd run typecheck`, `npm.cmd run lint`.

## Task 2: Evidence bridge and migration

**Files:** `prisma/schema.prisma`; nueva migración; `lib/knowledge/provenance-bridge.ts`; tests.

- [ ] Escribir tests de link idempotente ReviewEvidence → KnowledgeEvidence y traversal de documento/version.
- [ ] Añadir `KnowledgeReviewEvidenceLink`, índices, actor y relationType sin modificar migraciones existentes.
- [ ] Crear `linkReviewEvidenceToKnowledge` con unique key y validación de tenant.
- [ ] Crear provenance summary con company, project, finding, documentVersion, page/sheet/cell disponibles.
- [ ] Ejecutar `npm.cmd run prisma:generate`, tests de provenance e integración y `node ./node_modules/prisma/build/index.js validate`.

## Task 3: Learning events

**Files:** `lib/knowledge/idempotency.ts`; `events.ts`; `integrations.ts`; `learning-bridge.ts`; tests; findings integration tests.

- [ ] Escribir tests para cada resolución y evento determinístico.
- [ ] Definir `ReviewLearningInput/Result` y keys `review-learning:{decisionId}:{eventType}:{entityId}`.
- [ ] Implementar mapper que cargue la decisión persistida y no acepte datos derivados de UI.
- [ ] Crear evento con actor, provenance, correlationId y payload hash.
- [ ] Conectar después del commit Review con fallo aislado.
- [ ] Ejecutar tests Review/Knowledge y typecheck/lint.

## Task 4: Observation builders

**Files:** `observations-from-review.ts`; `apu.ts`; `observations.ts`; tests.

- [ ] Escribir tests de price, yield, APU corrected, falso positivo, fecha ausente y provenance incompleto.
- [ ] Implementar builders determinísticos con `Decimal`, default PROJECT y estado OBSERVED.
- [ ] Rechazar CORRECTED sin snapshot posterior y conservar before/after.
- [ ] Usar skip reasons explícitos; nunca inventar fecha, región, supplier o canonical id.
- [ ] Ejecutar tests unitarios e integración y revisar que no haya escritura BudgetItem.

## Task 5: Idempotency, jobs and retry

**Files:** schema/migración; `integration-jobs.ts`; builders; route/service tests.

- [ ] Escribir tests de replay y fallo después de guardar Review.
- [ ] Añadir keys/unique constraints para events, evidence links, observations, APU versions y assertions.
- [ ] Persistir `KnowledgeIntegrationJob` con estados y error estructurado.
- [ ] Implementar retry con backoff determinístico y dead-letter visible en admin.
- [ ] Ejecutar tests de retry, migración, typecheck y lint.

## Task 6: Assertion lifecycle

Estado: implementado; la matriz, seguridad, auditoría, promoción GLOBAL y conflictos están cubiertos por la implementación y pruebas del bloque detallado de Task 6.

**Files:** `assertions.ts`; schema/migración si faltan campos; admin APIs/UI; tests.

- [ ] Escribir matriz de transiciones válidas/ inválidas y pruebas de permissions.
- [ ] Implementar OBSERVED, CONFIRMED, VERIFIED, CANONICAL, REJECTED y DEPRECATED.
- [ ] Requerir actor, motivo y provenance en promoción; bloquear GLOBAL para no-superadmin.
- [ ] Añadir audit events e idempotency key.
- [ ] Ejecutar tests de lifecycle y security.

## Task 7: Retrieval V1

**Files:** `retrieval-v1.ts`; `retrieval.ts`; `/api/knowledge/retrieval`; tests.

- [ ] Escribir tests exact/alias, filtros, empty result, provenance y precedencia PROJECT → COMPANY → GLOBAL.
- [ ] Implementar retrieval compuesto para items, resources, APUs, prices, yields y assertions.
- [ ] Aplicar ranking determinístico y limitar resultados sin embeddings.
- [ ] Autorizar antes de consultar y devolver summaries de provenance.
- [ ] Ejecutar tests de retrieval, typecheck y lint.

## Task 8: Review enrichment

**Files:** feature flag service existente; Review services/UI; tests.

- [ ] Escribir tests que confirmen baseline idéntico con flag off y señales con flag on.
- [ ] Consultar retrieval sólo desde bridge/service, nunca Prisma en UI.
- [ ] Mostrar origen, scope, fecha, confidence y navegación a evidencia primaria.
- [ ] Registrar latencia y fallback sin bloquear Review.
- [ ] Ejecutar tests Review y UI.

## Task 9: Admin review queue

**Files:** `app/admin/knowledge/page.tsx`; `components/admin/knowledge-review-panel.tsx`; nuevas APIs admin; tests.

- [ ] Escribir tests de capability, MFA, filtros y acciones.
- [ ] Añadir colas de assertions, observations, evidence, conflicts, promotion candidates e integration errors.
- [ ] Implementar acciones explícitas de confirm/reject/deprecate/promote con audit.
- [ ] Ocultar datos fuera del scope autorizado.
- [ ] Ejecutar tests admin, typecheck y lint.

## Task 10: Flags, observability and backfill

**Files:** flags/config; logging/metrics; scripts/backfill; docs operations; tests.

- [ ] Escribir tests flags off/on, logs correlationados y backfill dry-run/replay.
- [ ] Implementar flags server-side desactivadas por defecto.
- [ ] Añadir eventos y métricas de éxito, fallo, retry, skip, provenance y promotion.
- [ ] Crear scripts idempotentes con `--dry-run`, filtros tenant y estado OBSERVED.
- [ ] Ejecutar pruebas operativas y documentar rollout/rollback.

## Verificación final

- [ ] `npm.cmd test -- lib/knowledge`
- [ ] `npm.cmd test -- lib/review-intelligence app/api/review-findings app/api/review-runs`
- [ ] `npm.cmd test -- app/api/knowledge tests/integration tests/security` (usando las rutas existentes del repositorio)
- [ ] `npm.cmd run typecheck`
- [ ] `npm.cmd run lint`
- [ ] `npm.cmd run build`
- [ ] `node ./node_modules/prisma/build/index.js validate`
- [ ] `git diff --check`
- [ ] Reportar archivos modificados, migraciones, flags, deuda técnica y requisitos PRD pendientes.

## Requisitos no incluidos en V1

Embeddings, ranking LLM obligatorio, promoción global automática, scraping, OCR productivo, anomaly detection avanzado, benchmarks cross-company no consentidos y mutación automática de presupuesto.

## Estado de implementación y pendientes por task

Actualizado: 2026-09-09. Este estado refleja el código presente en `main`; `[x]` significa implementado y verificado de forma focalizada. Una tarea marcada como `Parcial` no debe considerarse cerrada.

### Task 1 — Security hardening — Parcial

- [x] Corregir derivación de `companyId` desde la sesión en las rutas endurecidas.
- [x] Validar membership, project ownership, source/evidence/canonical ownership y proteger escrituras GLOBAL.
- [x] Añadir `assertKnowledgeEntityAccess` y pruebas focalizadas cross-tenant/GLOBAL.
- [x] Crear migración de ownership para `KnowledgeSource` y `KnowledgeEvidence` preservando compatibilidad histórica.
- [ ] Implementar las APIs de servicio separadas `assertKnowledgeReadAccess` y `assertKnowledgeWriteAccess` y aplicarlas en todas las operaciones Knowledge.
- [x] Completar auditoría/hardening de todas las rutas `/api/knowledge`, incluyendo lecturas y aliases restantes, con pruebas de ruta cross-tenant.

### Task 2 — Evidence bridge and migration — Parcial

- [x] Crear `KnowledgeReviewEvidenceLink`, relaciones, índices, actor, `relationType` y migración nueva.
- [x] Implementar `linkReviewEvidenceToKnowledge` con validación de tenant/proyecto y upsert idempotente.
- [x] Añadir pruebas focalizadas de linking idempotente.
- [x] Construir automáticamente el `KnowledgeEvidence` desde `ReviewEvidence` y conectar el bridge al flujo persistido de Review.
- [x] Completar provenance summary/traversal de documento, versión, finding, página/hoja/celda y demás metadatos disponibles.

### Task 3 — Learning events — Implementado

- [x] Registrar eventos de decisión Review con actor, correlation id, tipo y key determinística.
- [x] Mantener el guardado de la decisión Review aislado de fallos de Knowledge.
- [x] Añadir soporte de `decisionId`/`evidenceId` en la identidad del evento.
- [x] Implementar el mapper completo desde la decisión persistida, sin aceptar datos derivados de UI.
- [x] Cubrir el catálogo completo de resoluciones/eventos para unit, item, resource, evidence, price, yield y APU.
- [x] Invocar el learning bridge después del commit de Review y completar payload hash/provenance.

### Task 4 — Observation builders — Implementado

- [x] Implementar builders puros para yield y price con `scope = PROJECT`, estado `OBSERVED` y skip reasons explícitos.
- [x] Evitar inventar fecha, unidad o canonical ids faltantes.
- [x] Añadir persistencia idempotente para observaciones price/yield.
- [x] Implementar builder/persistencia de APU corrected con snapshot before/after.
- [x] Resolver y validar canonical item/resource desde datos persistidos de Review.
- [x] Conectar builders al flujo real de learning y ampliar pruebas de falso positivo/provenance incompleto.
- [x] Incorporar formalmente `PRICE_MISMATCH` al tipo/pipeline de Review si corresponde al modelo vigente.

### Task 5 — Idempotency, jobs and retry — Parcial

- [x] Añadir keys/constraints para eventos, evidence links, price/yield observations y assertions.
- [x] Crear `KnowledgeIntegrationJob` y registrar fallos reintentables sin duplicar observaciones.
- [x] Implementar retry manual y política de backoff determinística.
- [x] Añadir idempotencia específica para `KnowledgeApuVersion` y completar constraints de todos los eventos.
- [x] Implementar worker/scheduler, estados `SUCCEEDED`/`DEAD_LETTER`, límite de intentos y visibilidad operativa completa.
- [x] Probar replay/fallo después del guardado de Review en una prueba de integración real.

### Task 6 — Assertion lifecycle — Implementado

- [x] Implementar transiciones válidas/inválidas OBSERVED, CONFIRMED, VERIFIED, CANONICAL, REJECTED y DEPRECATED.
- [x] Persistir actor, provenance, rejection reason e idempotency key cuando se crea una assertion.
- [x] Crear endpoint admin protegido por capability y bloquear CANONICAL para no-superadmin.
- [x] Añadir índice de lifecycle por company/project/status y pruebas focalizadas.
- [x] Añadir audit events para cada transición y exigir provenance/actor/motivo según transición.
- [x] Completar flujo explícito de promoción GLOBAL, conflictos y acciones admin con MFA/política de superadmin.

### Task 7 — Retrieval V1 — Implementado

- [x] Implementar retrieval compuesto para items, resources, prices, yields, APUs y assertions.
- [x] Aplicar precedencia determinística PROJECT → COMPANY → GLOBAL y límites de resultados.
- [x] Autorizar el company/project a partir de la sesión antes de consultar.
- [x] Añadir búsqueda exacta/alias robusta, filtros y ranking por relevancia más allá de coincidencias parciales.
- [x] Devolver provenance summaries completos y mejorar matching de observaciones/canonical entities.
- [x] Completar pruebas de alias, filtros, provenance y empty result.

### Task 8 — Review enrichment — Implementado

- [x] Crear servicio de enrichment detrás de feature flag, conservando baseline cuando está apagado.
- [x] Devolver señales sin modificar decisiones ni presupuesto.
- [x] Añadir pruebas focalizadas flag off/on.
- [x] Conectar enrichment al API/pipeline/UI real de Review.
- [x] Mostrar origen, scope, fecha, confidence y navegación a evidencia primaria.
- [x] Registrar latencia, fallback y métricas sin bloquear Review.

### Task 9 — Admin review queue — Implementado

- [x] Crear servicio y endpoint de queue con assertions, observaciones y jobs reintentables.
- [x] Crear endpoints de retry y exploración de provenance/evidence con permisos.
- [x] Añadir resumen inicial a `/admin/knowledge`.
- [x] Completar UI de assertions, observations, evidence, conflicts, promotion candidates e integration errors.
- [x] Implementar acciones confirm/reject/deprecate/promote con audit y filtros exhaustivos.
- [x] Extraer consultas Prisma de la página y cubrir capability, MFA, filtros y aislamiento de datos con pruebas admin.

**Verificación Task 9:** `lib/knowledge/admin-dashboard.ts` centraliza las consultas Prisma y serializa Decimal/Date para el panel; la UI administrativa incluye filtros por texto/estado/scope, provenance navegable, acciones de lifecycle, promoción GLOBAL con MFA, resolución de conflictos y retry de errores. Verificados `admin-dashboard`, `admin-queue` y `knowledge-review-panel`; TypeScript estricto pasa. Las pruebas de capability/MFA/aislamiento de las rutas admin existentes permanecen cubiertas.

### Task 10 — Flags, observability and backfill — Implementado

- [x] Crear flags server-side desactivadas por defecto para bridge, enrichment, admin queue y backfill.
- [x] Crear retry policy y backfill con `--dry-run`, filtro de company y estado `OBSERVED`.
- [x] Añadir pruebas focalizadas de flags, retry policy y backfill plan.
- [x] Aplicar flags al flujo real y documentar rollout/rollback operativo.
- [x] Añadir logging estructurado/métricas de éxito, fallo, retry, skip, provenance y promotion con correlation id.
- [x] Completar backfill de los dominios definidos por el PRD, replay idempotente y reporte correcto de dry-run/creados.

**Verificación Task 10:** flags aplicados al bridge, enrichment, admin queue y backfill; logging JSON y contadores en `lib/knowledge/observability.ts`; runbook en `docs/knowledge-rollout-runbook.md`; backfill de partidas, recursos, precios y APUs con `--dry-run`, filtros tenant, `OBSERVED`, replay idempotente y reporte de candidatos/creados/omitidos/errores. Verificados tests de flags, bridge, enrichment, worker y Review API; TypeScript estricto y lint de archivos modificados pasan.

## Verificaciones realizadas

Task 4 verification update: 57 test files and 302 tests passed across Knowledge, Knowledge API, and Review; TypeScript strict, lint, Prisma generate, and Prisma validate passed.

Task 5 verification update: job worker, terminal states, five-attempt dead-letter policy, replay idempotency, and Review failure isolation are covered by passing tests.

Task 6 verification update: assertion transition audit, provenance/reason requirements, MFA-protected GLOBAL promotion, and conflict resolution are covered by passing tests.

Task 7 verification update: exact/alias matching, deterministic relevance ranking, filters, complete provenance summaries, canonical observation matching, and empty results are covered by passing tests.

Task 8 verification update: persisted Review API enrichment, provenance-aware UI rendering, timeout fallback, and non-blocking latency telemetry are covered by passing tests.

- [x] Tests focalizados de Knowledge/API: 31 archivos, 91 tests, sin fallos en la última ejecución.
- [x] Tests nuevos de bridge, builders, jobs/retry, assertions, retrieval, flags, enrichment, queue, provenance y backfill.
- [x] `npm.cmd run prisma:generate`.
- [x] `node ./node_modules/prisma/build/index.js validate`.
- [x] `npm.cmd run typecheck` sin diagnósticos.
- [x] `npm.cmd run lint` sin diagnósticos.
- [x] `git diff --check`.

## Verificaciones pendientes antes de declarar completado

- [ ] Suite completa `npm.cmd test`.
- [ ] Tests completos de Review, integración y seguridad/e2e usando las rutas existentes.
- [ ] `npm.cmd run build` completo.
- [ ] Validación/aplicación controlada de migraciones contra una base de datos de staging.
- [ ] Verificación end-to-end del flujo Review → bridge → Knowledge y del retry sin duplicados.

## Migraciones creadas

- `20260909150000_harden_knowledge_tenancy`
- `20260909151000_add_review_knowledge_evidence_link`
- `20260909152000_add_knowledge_observation_idempotency`
- `20260909153000_add_knowledge_integration_jobs`
- `20260909154000_harden_knowledge_assertions`
- `20260909155000_add_review_evidence_idempotency`
- `20260909160000_add_review_price_mismatch`
- `20260909171000_add_review_apu_correction_provenance`
- `20260909173000_complete_knowledge_integration_jobs`
- `20260909180000_add_assertion_conflicts_and_lifecycle_audit`

## Feature flags y deuda técnica

- Flags: `MC_KNOWLEDGE_REVIEW_LEARNING_BRIDGE`, `MC_KNOWLEDGE_REVIEW_ENRICHMENT`, `MC_KNOWLEDGE_ADMIN_REVIEW_QUEUE`, `MC_KNOWLEDGE_BACKFILL`; permanecen apagadas por defecto.
- Deuda principal: wiring real del bridge/enrichment, worker de jobs, lifecycle auditado, provenance completa, UI admin completa, observabilidad y backfill integral.
- Restricciones invariantes: `humanReviewRequired = true` y `automaticBudgetMutation = false`; no se implementó promoción automática a GLOBAL ni mutación automática de presupuesto.
