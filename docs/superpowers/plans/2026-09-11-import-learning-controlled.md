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

- [x] Definir `ImportLearningBatch`, `ImportLearningObservation`, `ImportLearningEntityCandidate` y unión de dominios `ITEM | RESOURCE | PRICE | YIELD | APU`.
- [x] Incluir `sourceType`, `sourceId`, `evidence`, `projectId`, `companyId`, `observedAt`, `confidence` e `originalRecordId`.
- [x] Probar que campos obligatorios, unidades y valores Decimal se validan sin convertir precisión.
- [x] Ejecutar `npm.cmd run test -- --run lib/knowledge/import-learning-types.test.ts`.

### Task 2: Crear adaptador de importación a Knowledge

**Files:** Create `lib/knowledge/import-learning.ts`; Test `lib/knowledge/import-learning.test.ts`; Modify `lib/knowledge/integrations.ts`

- [x] Escribir pruebas para crear `KnowledgeSource`, `KnowledgeEvidence` y observaciones `OBSERVED` con claves idempotentes.
- [x] Implementar `recordImportLearningBatch(input)` usando upsert/replay seguro y resolución canónica inequívoca.
- [x] Separar resultados `created`, `skipped` y `conflicts`; nunca usar un `Resource.id` operativo como canónico.
- [x] Rechazar promoción cuando falte evidencia, haya unidad incompatible o existan múltiples matches.
- [x] Ejecutar las pruebas unitarias y de replay.

### Task 3: Conectar los importadores

**Files:** Modify `app/api/imports/s10/import/route.ts`, `mcp/import/route.ts`, `rw7/import/route.ts`, `pdf/import/route.ts`, `db/import/route.ts`, `delphin/import/route.ts`; Test each existing route test

- [x] Añadir extracción del snapshot/draft ya normalizado, sin duplicar parsers.
- [x] Invocar el adaptador después de persistir el proyecto y antes de responder.
- [x] Mantener best-effort: el fallo crea/reintenta un job y no convierte una importación exitosa en HTTP 400/500.
- [x] Verificar source types: `S10_IMPORT`, `MCP_IMPORT`, `RW7_IMPORT`, `PDF_IMPORT`, `DB_IMPORT`, `DELPHIN_IMPORT`.
- [x] Añadir una expectativa de batch/evento por cada endpoint y ejecutar sus pruebas.

### Task 4: Persistir jobs y reintentos de aprendizaje

**Files:** Modify `lib/knowledge/integration-jobs.ts`; Test `lib/knowledge/integration-jobs.test.ts`; Prisma schema/migration only if required

- [x] Añadir tipo de job para `IMPORT_LEARNING` y payload idempotente por importación/dominio/registro.
- [x] Cubrir estados `PENDING`, `PROCESSING`, `SUCCEEDED`, `RETRYABLE_FAILED`, `DEAD_LETTER`.
- [x] Probar que un error de una fila no descarta filas independientes y que el replay no duplica datos.
- [x] Ejecutar prueba de retry con límite de cinco intentos y backoff existente.

### Task 5: Implementar bandeja de revisión y decisiones

**Files:** Create/Modify `lib/knowledge/admin-learning.ts`, `app/api/admin/knowledge/import-learning/route.ts`, `components/admin/knowledge-learning-panel.tsx`; Tests alongside each file

- [x] Exponer listado paginado por estado, formato, dominio, empresa, proyecto, región y confianza.
- [x] Implementar acciones confirm/reject/correct/promote con autorización centralizada.
- [x] Guardar actor, decisión, valor anterior/nuevo, motivo y correlation ID.
- [x] Probar que VIEWER no puede decidir, EDITOR puede revisar en su tenant y GLOBAL requiere capacidad administrativa.
- [x] Mostrar evidencia y diferencias sin ocultar el dato observado original.

### Task 6: Promoción controlada y retrieval

**Files:** Modify `lib/knowledge/assertions.ts`, `canonical-items.ts`, `canonical-resources.ts`, `retrieval-v1.ts`; Tests corresponding

- [x] Implementar promoción explícita a COMPANY o GLOBAL solo desde una decisión confirmada.
- [x] Exigir mínimo configurable de confirmaciones para estado `VERIFIED`; iniciar con 3 proyectos distintos.
- [x] Hacer que retrieval diferencie `OBSERVED`, `CONFIRMED`, `VERIFIED` y `CANONICAL`.
- [x] Probar scopes, estados, unidades, aliases y rechazo de datos de otro tenant.

### Task 7: Rollout, observabilidad y documentación operativa

**Files:** Modify `lib/knowledge/feature-flags.ts`; Create `docs/import-learning-operations.md`; Tests for flag behavior

- [x] Añadir flag contextual `importLearningBridge` apagado por defecto.
- [x] Habilitar primero por empresa/proyecto piloto y registrar métricas de filas creadas, conflictos, skips y promociones.
- [x] Documentar replay, dry-run, dead letters, rollback del flag y auditoría.
- [x] Ejecutar suite Knowledge, rutas de importación, typecheck, lint y build.

### Task 8: Verificación final

- [x] Ejecutar `npm.cmd run test`.
- [x] Ejecutar `npm.cmd run lint`.
- [x] Ejecutar `npm.cmd run typecheck` mediante `tsconfig.build.json`.
- [x] Ejecutar `node ./node_modules/next/dist/bin/next build`.
- [x] Registrar resultados y cualquier bloqueo ambiental en la documentación operativa.

## Estado de cierre — 2026-09-11

La implementación no está completamente cerrada. Se verificó que el núcleo de import-learning, la administración específica, los jobs y el retrieval ya tienen implementación y pruebas focalizadas: la suite dirigida pasó con 5 archivos y 21 pruebas.

### Cerrado o implementado actualmente

- Contrato común de extracción y preservación de valores decimales como texto.
- Adaptador idempotente con provenance, conflictos y resolución de entidades.
- Conexión de los seis importadores y comportamiento best-effort.
- Jobs `IMPORT_LEARNING`, validación inicial del payload, reintentos y `DEAD_LETTER`.
- Bandeja administrativa específica: filtros principales, paginación por página, corrección con nueva assertion y auditoría before/after.
- Retrieval con estados, scopes, regiones y todos los niveles de confianza.
- Feature flags y documentación operativa base.

### Pendientes para declarar el plan totalmente cerrado

- Verificar consistencia de corroboración por valor, unidad, entidad y región en escenarios completos de negocio.
- Si se exige que también pase `npx.cmd tsc --noEmit`, habrá que sanear los errores preexistentes de tests, Prisma/NextAuth, scripts y tipos de dominio; ese comando no corresponde al typecheck oficial de producción.
- Mantener las casillas individuales alineadas con evidencia de cada requisito.

### Verificación de esta actualización

- Suite dirigida: `5` archivos, `21` pruebas aprobadas.
- Typecheck oficial: aprobado con `npm.cmd run typecheck` mediante `tsconfig.build.json`.
- Matriz de autorización: verificada con `36` pruebas en 7 suites; se corrigió el intento de mutar conocimiento GLOBAL desde un tenant.
- Promoción basada en decisión: verificada con `16` pruebas; `CANONICAL` ahora exige `FindingDecision` confirmada, del mismo tenant y con resolución `CONFIRMED_ISSUE` o `CORRECTED`; se conserva MFA para GLOBAL.
- Métricas operativas: implementada persistencia idempotente en `knowledge_metric_events`, con escritura best-effort, índices por métrica/tenant/fecha y 25 pruebas relacionadas aprobadas.

- Integración con catálogos canónicos: implementada para `IMPORT_ITEM` y `IMPORT_RESOURCE`, con reutilización/creación por scope y unidad, bloqueo de ambigüedad, provenance idempotente y referencia catalogada en la assertion; 15 pruebas específicas aprobadas.

### Estado explícito de tareas parciales

- La semántica de éxito parcial por fila, filas omitidas y errores de infraestructura está cerrada y cubierta por pruebas unitarias y de retry.
- La promoción `VERIFIED` exige el mínimo configurable de tres proyectos distintos y está cubierta por pruebas.
- La habilitación piloto por empresa/proyecto está implementada y probada; permanece parcial únicamente la corroboración integral por valor, unidad, entidad y región.
- La suite completa, lint, build y el typecheck oficial están aprobados. El comando directo `npx.cmd tsc --noEmit` incluye tests y scripts fuera del build y conserva errores preexistentes fuera del alcance del typecheck de producción.

### Verificación global — 2026-09-11

- Suite completa: aprobada, `741` archivos y `5.645` pruebas.
- Typecheck global oficial: aprobado con `npm.cmd run typecheck` mediante `tsconfig.build.json`; el comando directo `npx.cmd tsc --noEmit` incluye tests y scripts fuera del build y no representa el typecheck de producción.
