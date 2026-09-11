# Aprendizaje controlado desde importaciones Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task with review checkpoints. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Alimentar MC Knowledge con datos de importaciones como observaciones trazables y promoverlos únicamente mediante revisión humana.

**Architecture:** Mantener `lib/knowledge` como dominio central. Cada importador entrega un contrato común de extracción; un servicio crea fuentes, evidencias y observaciones idempotentes en scope PROJECT. La revisión administrativa decide confirmación y promoción sin alterar el dato original.

**Tech Stack:** Next.js App Router, TypeScript strict, Prisma/PostgreSQL, Vitest, Decimal existente, UI administrativa actual.

**Spec:** `docs/superpowers/specs/2026-09-11-import-learning-controlled-design.md`

## Global Constraints

- Usar TypeScript strict y no introducir `any`.
- Mantener cálculos financieros decimal-safe.
- No promover automáticamente datos ni mutar presupuestos.
- Mantener scopes PROJECT → COMPANY → GLOBAL.
- Conservar source, evidence, fecha, unidad, contexto y confianza.
- Toda funcionalidad nueva debe tener prueba escrita antes del código.

---

### Task 1: Definir contrato común de extracción

**Files:** Create `lib/knowledge/import-learning-types.ts`; Test `lib/knowledge/import-learning-types.test.ts`

- [ ] Definir `ImportLearningBatch`, `ImportLearningObservation`, `ImportLearningEntityCandidate` y unión de dominios `ITEM | RESOURCE | PRICE | YIELD | APU`.
- [ ] Incluir `sourceType`, `sourceId`, `evidence`, `projectId`, `companyId`, `observedAt`, `confidence` e `originalRecordId`.
- [ ] Probar que campos obligatorios, unidades y valores Decimal se validan sin convertir precisión.
- [ ] Ejecutar `npm.cmd run test -- --run lib/knowledge/import-learning-types.test.ts`.

### Task 2: Crear adaptador de importación a Knowledge

**Files:** Create `lib/knowledge/import-learning.ts`; Test `lib/knowledge/import-learning.test.ts`; Modify `lib/knowledge/integrations.ts`

- [ ] Escribir pruebas para crear `KnowledgeSource`, `KnowledgeEvidence` y observaciones `OBSERVED` con claves idempotentes.
- [ ] Implementar `recordImportLearningBatch(input)` usando upsert/replay seguro y resolución canónica inequívoca.
- [ ] Separar resultados `created`, `skipped` y `conflicts`; nunca usar un `Resource.id` operativo como canónico.
- [ ] Rechazar promoción cuando falte evidencia, haya unidad incompatible o existan múltiples matches.
- [ ] Ejecutar las pruebas unitarias y de replay.

### Task 3: Conectar los importadores

**Files:** Modify `app/api/imports/s10/import/route.ts`, `mcp/import/route.ts`, `rw7/import/route.ts`, `pdf/import/route.ts`, `db/import/route.ts`, `delphin/import/route.ts`; Test each existing route test

- [ ] Añadir extracción del snapshot/draft ya normalizado, sin duplicar parsers.
- [ ] Invocar el adaptador después de persistir el proyecto y antes de responder.
- [ ] Mantener best-effort: el fallo crea/reintenta un job y no convierte una importación exitosa en HTTP 400/500.
- [ ] Verificar source types: `S10_IMPORT`, `MCP_IMPORT`, `RW7_IMPORT`, `PDF_IMPORT`, `DB_IMPORT`, `DELPHIN_IMPORT`.
- [ ] Añadir una expectativa de batch/evento por cada endpoint y ejecutar sus pruebas.

### Task 4: Persistir jobs y reintentos de aprendizaje

**Files:** Modify `lib/knowledge/integration-jobs.ts`; Test `lib/knowledge/integration-jobs.test.ts`; Prisma schema/migration only if required

- [ ] Añadir tipo de job para `IMPORT_LEARNING` y payload idempotente por importación/dominio/registro.
- [ ] Cubrir estados `PENDING`, `PROCESSING`, `SUCCEEDED`, `RETRYABLE_FAILED`, `DEAD_LETTER`.
- [ ] Probar que un error de una fila no descarta filas independientes y que el replay no duplica datos.
- [ ] Ejecutar prueba de retry con límite de cinco intentos y backoff existente.

### Task 5: Implementar bandeja de revisión y decisiones

**Files:** Create/Modify `lib/knowledge/admin-learning.ts`, `app/api/admin/knowledge/import-learning/route.ts`, `components/admin/knowledge-learning-panel.tsx`; Tests alongside each file

- [ ] Exponer listado paginado por estado, formato, dominio, empresa, proyecto, región y confianza.
- [ ] Implementar acciones confirm/reject/correct/promote con autorización centralizada.
- [ ] Guardar actor, decisión, valor anterior/nuevo, motivo y correlation ID.
- [ ] Probar que VIEWER no puede decidir, EDITOR puede revisar en su tenant y GLOBAL requiere capacidad administrativa.
- [ ] Mostrar evidencia y diferencias sin ocultar el dato observado original.

### Task 6: Promoción controlada y retrieval

**Files:** Modify `lib/knowledge/assertions.ts`, `canonical-items.ts`, `canonical-resources.ts`, `retrieval-v1.ts`; Tests corresponding

- [ ] Implementar promoción explícita a COMPANY o GLOBAL solo desde una decisión confirmada.
- [ ] Exigir mínimo configurable de confirmaciones para estado `VERIFIED`; iniciar con 3 proyectos distintos.
- [ ] Hacer que retrieval diferencie `OBSERVED`, `CONFIRMED`, `VERIFIED` y `CANONICAL`.
- [ ] Probar scopes, estados, unidades, aliases y rechazo de datos de otro tenant.

### Task 7: Rollout, observabilidad y documentación operativa

**Files:** Modify `lib/knowledge/feature-flags.ts`; Create `docs/import-learning-operations.md`; Tests for flag behavior

- [ ] Añadir flag contextual `importLearningBridge` apagado por defecto.
- [ ] Habilitar primero por empresa/proyecto piloto y registrar métricas de filas creadas, conflictos, skips y promociones.
- [ ] Documentar replay, dry-run, dead letters, rollback del flag y auditoría.
- [ ] Ejecutar suite Knowledge, rutas de importación, typecheck, lint y build.

### Task 8: Verificación final

- [ ] Ejecutar `npm.cmd run test`.
- [ ] Ejecutar `npm.cmd run lint`.
- [ ] Ejecutar `npx.cmd tsc --noEmit`.
- [ ] Ejecutar `node ./node_modules/next/dist/bin/next build`.
- [ ] Registrar resultados y cualquier bloqueo ambiental en la documentación operativa.
