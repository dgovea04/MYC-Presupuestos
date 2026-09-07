# Comentarios, integraciones controladas y aprendizaje privado — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` to implement this plan task-by-task with an independent review after each task.

**Goal:** Entregar tres capacidades V1 independientes: colaboración segura, integraciones con staging/preview/rollback y aprendizaje privado aislado por empresa.

**Architecture:** Reutilizar los modelos y servicios de colaboración existentes, envolver los importadores/exportadores mediante adaptadores con sesiones idempotentes y persistir ejemplos privados derivados únicamente de decisiones confirmadas. Cada etapa tendrá un flag de activación por empresa, permisos servidor y contratos API separados.

**Tech Stack:** Next.js App Router, TypeScript strict, Prisma/PostgreSQL, Decimal.js, Vitest, Playwright, Tailwind/shadcn existentes.

**Spec:** `docs/superpowers/specs/2026-09-06-collaboration-integrations-private-learning-design.md`

## Global Constraints

- Nunca confiar en `companyId`, `projectId`, `budgetId` o permisos enviados por el cliente.
- Aislar todas las consultas privadas por `companyId` y validar membresía/proyecto en servidor.
- Mantener cálculos financieros Decimal-safe y TypeScript sin `any`.
- Ningún comentario, integración, sugerencia ni ejemplo aprendido modifica automáticamente el presupuesto.
- Toda mutación debe ser idempotente mediante `requestId`, clave de operación o restricción única.
- Toda escritura presupuestaria debe registrar `BudgetChangeEvent` y respetar control de concurrencia optimista.
- Los proveedores externos no reciben datos privados sin configuración explícita de la empresa.
- Cada task termina con pruebas enfocadas y un commit revisable.

---

## Stage 1 — Colaboración segura

### Task 1: Contratos, autorización y flags de colaboración

**Files:**
- Modify: `lib/validations/collaboration.ts`
- Modify: `lib/collaboration/authorization.ts`
- Modify: `lib/collaboration/types.ts`
- Create: `lib/collaboration/feature-flags.ts`
- Test: `lib/validations/collaboration.test.ts`
- Test: `lib/collaboration/authorization.test.ts`

**Interfaces:**
- Produce `CollaborationEntityType = "BUDGET" | "BUDGET_ITEM" | "APU" | "METRADO" | "REVIEW_FINDING"`.
- Produce `assertBudgetCollaborationAccess(input: { userId: string; budgetId: string; action: CollaborationAction }): Promise<AuthorizedBudgetContext>`.
- Produce `isCollaborationEnabled(companyId: string): Promise<boolean>`.

- [ ] **Step 1: Write the failing tests**

Cubrir lectura/escritura cross-company, proyecto incorrecto, permiso de solo lectura, entidades inexistentes, payloads sobredimensionados, menciones desconocidas y flag desactivado.

- [ ] **Step 2: Run tests to verify failure**

Run: `npm.cmd test -- lib/validations/collaboration.test.ts lib/collaboration/authorization.test.ts`

Expected: FAIL por las validaciones de acción/flag y la autorización de contexto todavía incompletas.

- [ ] **Step 3: Implement minimal contracts**

Centralizar la consulta autorizada del presupuesto/proyecto/empresa; ignorar IDs de tenant recibidos por el cliente; validar `entityType/entityId` contra el presupuesto; aplicar límites de cuerpo y menciones; devolver errores tipados sin filtrar datos de otra empresa.

- [ ] **Step 4: Run focused tests**

Run: `npm.cmd test -- lib/validations/collaboration.test.ts lib/collaboration/authorization.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add lib/validations/collaboration.ts lib/validations/collaboration.test.ts lib/collaboration/authorization.ts lib/collaboration/authorization.test.ts lib/collaboration/types.ts lib/collaboration/feature-flags.ts
git commit -m "feat: harden collaboration authorization contracts"
```

### Task 2: Comentarios, respuestas, menciones y resolución

**Files:**
- Modify: `lib/collaboration/comments.ts`
- Modify: `lib/collaboration/serializers.ts`
- Modify: `app/api/budgets/[id]/collaboration/comments/route.ts`
- Modify: `app/api/budgets/[id]/collaboration/comments/[commentId]/route.ts`
- Modify: `app/api/budgets/[id]/collaboration/comments/route.test.ts`
- Create: `lib/collaboration/notifications.ts`
- Test: `lib/collaboration/comments.test.ts`

**Interfaces:**
- `listCollaborationComments(context, entity): Promise<CollaborationCommentView[]>` devuelve árbol de respuestas ordenado por `createdAt`.
- `createCollaborationComment(context, input: { entityType; entityId; parentCommentId?; body; mentions }): Promise<CollaborationCommentView>`.
- `resolveCollaborationComment(context, commentId, resolved: boolean, expectedUpdatedAt): Promise<CollaborationCommentView>`.
- `emitCollaborationNotification(event: CollaborationNotificationEvent): Promise<void>` usa una clave única de evento.

- [ ] **Step 1: Write failing API/service tests**

Probar comentario raíz, respuesta autorizada, mención válida, mención de usuario fuera del proyecto, edición con `expectedUpdatedAt`, resolución/reapertura, límite de longitud, deduplicación de notificación y aislamiento tenant.

- [ ] **Step 2: Run focused tests**

Run: `npm.cmd test -- lib/collaboration/comments.test.ts app/api/budgets/[id]/collaboration/comments/route.test.ts`

Expected: FAIL en respuestas/notificaciones/resolución o validación de menciones.

- [ ] **Step 3: Implement service and routes**

Reutilizar `CollaborationComment`; validar padre en el mismo presupuesto/entidad compatible; guardar menciones ya validadas; usar `expectedUpdatedAt` para conflicto 409; emitir notificaciones sin incluir el cuerpo completo en logs.

- [ ] **Step 4: Run focused tests**

Run: `npm.cmd test -- lib/collaboration/comments.test.ts app/api/budgets/[id]/collaboration/comments/route.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add lib/collaboration/comments.ts lib/collaboration/serializers.ts lib/collaboration/notifications.ts app/api/budgets/[id]/collaboration/comments
git commit -m "feat: add secure collaboration comment workflow"
```

### Task 3: UI de comentarios y presencia contextual

**Files:**
- Modify: `components/budget/budget-collaboration-wrapper.tsx`
- Modify: `components/budget/budget-collaboration-bar.tsx`
- Modify: `components/budget/budget-change-history-sheet.tsx`
- Create: `components/collaboration/collaboration-comments-panel.tsx`
- Create: `components/collaboration/collaboration-comments-panel.test.tsx`
- Create: `lib/client/collaboration-comments.ts`
- Test: `components/budget/collaboration-sheets-loading.test.tsx`

**Interfaces:**
- `CollaborationCommentsPanel({ budgetId, entityType, entityId, canComment }): JSX.Element`.
- `useCollaborationComments(input): { comments; loading; error; create; resolve; refresh }`.

- [ ] **Step 1: Write failing component/client tests**

Verificar render de árbol, respuesta, mención, estado resuelto, conflicto 409, estados de carga/error, `aria-label` y ausencia de acciones para viewer.

- [ ] **Step 2: Run focused tests**

Run: `npm.cmd test -- components/collaboration/collaboration-comments-panel.test.tsx components/budget/collaboration-sheets-loading.test.tsx`

Expected: FAIL porque el panel y cliente no existen.

- [ ] **Step 3: Implement UI and client service**

Integrar el panel en el wrapper existente; mantener densidad/estilo del presupuesto; usar textarea accesible, composer de menciones validado y acciones resolver/reabrir; no guardar datos sensibles en localStorage.

- [ ] **Step 4: Run focused tests**

Run: `npm.cmd test -- components/collaboration/collaboration-comments-panel.test.tsx components/budget/collaboration-sheets-loading.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add components/collaboration components/budget/budget-collaboration-wrapper.tsx components/budget/budget-collaboration-bar.tsx components/budget/budget-change-history-sheet.tsx lib/client/collaboration-comments.ts
git commit -m "feat: add contextual collaboration comments UI"
```

### Task 4: Conflictos, auditoría, snapshots y operación colaborativa

**Files:**
- Modify: `lib/collaboration/edit-sessions.ts`
- Modify: `lib/collaboration/presence.ts`
- Modify: `lib/collaboration/events.ts`
- Modify: `lib/collaboration/versions.ts`
- Modify: `app/api/budgets/[id]/collaboration/stream/route.ts`
- Modify: `app/api/budgets/[id]/collaboration/edit-sessions/route.ts`
- Modify: `app/api/budgets/[id]/collaboration/presence/route.ts`
- Modify: `app/api/budgets/[id]/collaboration/history/route.ts`
- Test: `lib/collaboration/edit-sessions.test.ts`
- Test: `lib/collaboration/versions.test.ts`
- Test: `app/api/budgets/[id]/collaboration/history/route.test.ts`

**Interfaces:**
- `claimEditSession(input): Promise<EditSessionResult>` returns `CLAIMED | CONFLICT | EXPIRED_REPLACED`.
- `appendBudgetChangeEvent(input): Promise<BudgetChangeEventView>` is idempotent by `requestId`.
- `createBudgetVersionSnapshot(input): Promise<BudgetVersionSnapshotView>`.

- [ ] **Step 1: Write failing concurrency/lease tests**

Cubrir heartbeat, expiración, doble claim, actor fuera del proyecto, evento duplicado, snapshot previo a cambio y restauración explícita.

- [ ] **Step 2: Run focused tests**

Run: `npm.cmd test -- lib/collaboration/edit-sessions.test.ts lib/collaboration/versions.test.ts app/api/budgets/[id]/collaboration/history/route.test.ts`

Expected: FAIL en casos de concurrencia o idempotencia no cubiertos.

- [ ] **Step 3: Implement hardening**

Usar timestamps del servidor, expirar leases al leer/escribir, devolver 409 en conflicto optimista, hacer únicos los eventos por `requestId` cuando exista y conservar snapshots antes de mutaciones confirmadas.

- [ ] **Step 4: Run focused tests**

Run: `npm.cmd test -- lib/collaboration app/api/budgets/[id]/collaboration`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add lib/collaboration app/api/budgets/[id]/collaboration
git commit -m "feat: harden collaborative edits and audit history"
```

### Task 5: Migración y rollout de colaboración

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260906170000_collaboration_rollout/migration.sql`
- Modify: `docs/review-intelligence-operations.md`
- Create: `docs/collaboration-operations.md`
- Test: `prisma/schema.prisma` validation and collaboration API tests

- [ ] **Step 1: Write migration/rollout tests**

Verificar que el flag por empresa deshabilita endpoints/UI, que datos existentes son legibles, que índices cubren presupuesto/entidad/fecha y que la migración no elimina historial.

- [ ] **Step 2: Run schema checks**

Run: `npm.cmd run prisma:generate` and `node ./node_modules/prisma/build/index.js validate`

Expected: FAIL until the migration/schema contract is complete.

- [ ] **Step 3: Implement migration and documentation**

Agregar solo columnas/índices necesarios para flags, notificaciones y claves idempotentes; documentar activación gradual, métricas, expiración de leases y rollback.

- [ ] **Step 4: Run checks**

Run: `npm.cmd run prisma:generate`; `node ./node_modules/prisma/build/index.js validate`; `npm.cmd test -- lib/collaboration app/api/budgets/[id]/collaboration`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add prisma/schema.prisma prisma/migrations docs/collaboration-operations.md docs/review-intelligence-operations.md
git commit -m "feat: add collaboration rollout controls"
```

---

## Stage 2 — Integraciones controladas

### Task 6: Contrato de adaptadores y modelos de sesión

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260906171000_add_integration_sessions/migration.sql`
- Create: `lib/integrations/types.ts`
- Create: `lib/integrations/adapter.ts`
- Create: `lib/integrations/registry.ts`
- Create: `lib/integrations/sessions.ts`
- Test: `lib/integrations/sessions.test.ts`
- Test: `lib/integrations/registry.test.ts`

**Interfaces:**
- `IntegrationSessionStatus = "DRAFT" | "STAGED" | "VALIDATED" | "PREVIEW_READY" | "CONFIRMED" | "APPLIED" | "ROLLED_BACK" | "FAILED"`.
- `IntegrationAdapter<TExternal, TStaged>` exposes `capabilities`, `stage`, `validate`, `preview`, `apply`, `rollback`.
- `createIntegrationSession(input): Promise<IntegrationSessionView>`.
- `transitionIntegrationSession(input): Promise<IntegrationSessionView>` rejects invalid transitions.

- [ ] **Step 1: Write failing state-machine tests**

Cubrir transiciones válidas, transiciones inválidas, ownership por empresa/proyecto, hash de payload, `requestId` duplicado y estados terminales.

- [ ] **Step 2: Run tests**

Run: `npm.cmd test -- lib/integrations/sessions.test.ts lib/integrations/registry.test.ts`

Expected: FAIL porque los modelos/contratos no existen.

- [ ] **Step 3: Implement schema and registry**

Crear `IntegrationSession`, `IntegrationConflict` e `IntegrationMapping`; guardar payload staging en almacenamiento existente o referencia segura, nunca en logs; declarar capacidades del adaptador y validar transiciones en servicio.

- [ ] **Step 4: Run tests and Prisma checks**

Run: `npm.cmd test -- lib/integrations/sessions.test.ts lib/integrations/registry.test.ts`; `npm.cmd run prisma:generate`; `node ./node_modules/prisma/build/index.js validate`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add prisma/schema.prisma prisma/migrations lib/integrations
git commit -m "feat: add controlled integration session contracts"
```

### Task 7: Adaptadores XLSX/CSV/S10 y staging

**Files:**
- Create: `lib/integrations/adapters/xlsx-csv.ts`
- Create: `lib/integrations/adapters/s10.ts`
- Create: `lib/integrations/staging.ts`
- Modify: `lib/exports/centralized.ts`
- Modify: `lib/mcp/import-preview.ts`
- Modify: `lib/s10/import-preview.ts`
- Test: `lib/integrations/adapters/xlsx-csv.test.ts`
- Test: `lib/integrations/adapters/s10.test.ts`
- Test: `lib/integrations/staging.test.ts`

**Interfaces:**
- `stageXlsxCsv(input): Promise<StagedIntegrationData>` normalizes rows without writing budgets.
- `stageS10(input): Promise<StagedIntegrationData>` reuses S10 snapshot/preview contracts.
- `validateStagedData(input): Promise<IntegrationValidationResult>` returns conflicts and deterministic counts.

- [ ] **Step 1: Write failing adapter tests**

Cubrir duplicate codes, decimal separators, incompatible units, missing required relationships, unsupported sheet/format, S10 identity conflicts, formulas/links not executed and provenance por fila.

- [ ] **Step 2: Run tests**

Run: `npm.cmd test -- lib/integrations/adapters lib/integrations/staging.test.ts`

Expected: FAIL hasta registrar adaptadores y validadores.

- [ ] **Step 3: Implement staging adapters**

Reutilizar parsers existentes; producir registros tipados con external key, internal candidate, Decimal fields, source hash and conflict details; no mutar `Budget`/`BudgetItem` durante staging.

- [ ] **Step 4: Run tests**

Run: `npm.cmd test -- lib/integrations/adapters lib/integrations/staging.test.ts lib/mcp/import-preview.test.ts lib/s10/import-preview.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add lib/integrations lib/exports/centralized.ts lib/mcp/import-preview.ts lib/s10/import-preview.ts
git commit -m "feat: stage xlsx csv and s10 integrations"
```

### Task 8: Preview, mapping, confirmación, aplicación y rollback

**Files:**
- Create: `app/api/budgets/[id]/integrations/sessions/route.ts`
- Create: `app/api/budgets/[id]/integrations/sessions/[sessionId]/validate/route.ts`
- Create: `app/api/budgets/[id]/integrations/sessions/[sessionId]/preview/route.ts`
- Create: `app/api/budgets/[id]/integrations/sessions/[sessionId]/confirm/route.ts`
- Create: `app/api/budgets/[id]/integrations/sessions/[sessionId]/rollback/route.ts`
- Create: `lib/integrations/apply.ts`
- Create: `lib/integrations/rollback.ts`
- Test: `app/api/budgets/[id]/integrations/sessions/route.test.ts`
- Test: `lib/integrations/apply.test.ts`
- Test: `lib/integrations/rollback.test.ts`

**Interfaces:**
- `applyIntegrationSession(input: { sessionId; confirmationToken; expectedVersion; requestId }): Promise<IntegrationApplyResult>`.
- `rollbackIntegrationSession(input: { sessionId; requestId }): Promise<RollbackResult>`.

- [ ] **Step 1: Write failing API/application tests**

Verificar que una sesión inválida no escribe, preview lista altas/cambios/conflictos, confirmación exige token y versión, retry no duplica cambios/eventos, snapshot se crea antes de aplicar y rollback restaura el estado esperado.

- [ ] **Step 2: Run tests**

Run: `npm.cmd test -- app/api/budgets/[id]/integrations lib/integrations/apply.test.ts lib/integrations/rollback.test.ts`

Expected: FAIL hasta implementar aplicación transaccional.

- [ ] **Step 3: Implement routes and services**

Autorizar la sesión, bloquear doble aplicación, verificar conflictos no resueltos, crear snapshot, aplicar cambios en transacción, emitir `BudgetChangeEvent` con `source = INTEGRATION`, guardar resultado y permitir rollback único por sesión.

- [ ] **Step 4: Run tests**

Run: `npm.cmd test -- app/api/budgets/[id]/integrations lib/integrations/apply.test.ts lib/integrations/rollback.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add app/api/budgets/[id]/integrations lib/integrations/apply.ts lib/integrations/rollback.ts
git commit -m "feat: apply and rollback controlled integrations"
```

### Task 9: UI de integración y rollout

**Files:**
- Create: `components/integrations/integration-session-panel.tsx`
- Create: `components/integrations/integration-preview-table.tsx`
- Create: `components/integrations/integration-session-panel.test.tsx`
- Modify: `components/imports/s10-importer-page-content.tsx`
- Modify: `components/imports/mcp-importer-page-content.tsx`
- Modify: `components/exports/export-panel.tsx`
- Create: `docs/integrations-operations.md`

- [ ] **Step 1: Write failing UI tests**

Verificar estados de sesión, preview con conflictos, mapeos, confirmación explícita, botón rollback, error 409 y ausencia de botón aplicar para viewer.

- [ ] **Step 2: Run tests**

Run: `npm.cmd test -- components/integrations/integration-session-panel.test.tsx components/imports/s10-importer-page-content.test.tsx components/exports/export-panel.test.tsx`

Expected: FAIL porque la UI no consume sesiones controladas.

- [ ] **Step 3: Implement UI and operational docs**

Mostrar estado, conteos, conflictos y preview; exigir confirmación con resumen legible; conservar los flujos antiguos detrás del adaptador; documentar límites, métricas, rollback y activación por empresa.

- [ ] **Step 4: Run tests**

Run: `npm.cmd test -- components/integrations components/imports/s10-importer-page-content.test.tsx components/exports/export-panel.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add components/integrations components/imports components/exports/export-panel.tsx docs/integrations-operations.md
git commit -m "feat: add controlled integration preview UI"
```

---

## Stage 3 — Aprendizaje privado por empresa

### Task 10: Modelo, política de privacidad y captura de ejemplos

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260906172000_add_private_learning/migration.sql`
- Create: `lib/private-learning/types.ts`
- Create: `lib/private-learning/policy.ts`
- Create: `lib/private-learning/examples.ts`
- Create: `lib/private-learning/sanitization.ts`
- Test: `lib/private-learning/policy.test.ts`
- Test: `lib/private-learning/examples.test.ts`
- Test: `lib/private-learning/sanitization.test.ts`

**Interfaces:**
- `PrivateLearningExample` model with `companyId`, `sourceType`, `sourceId`, `signalType`, `inputJson`, `resultJson`, `contentHash`, `schemaVersion`, `status`, `expiresAt`, `createdById`, `revokedAt`.
- `PrivateLearningUsage` model with `companyId`, `exampleId`, `budgetId?`, `requestId`, `createdAt`.
- `captureConfirmedExample(input): Promise<PrivateLearningExampleView | null>` returns null for unconfirmed/disabled sources.
- `sanitizePrivateLearningPayload(input): SanitizedLearningPayload` removes secrets, tokens, full files and unnecessary personal data.

- [ ] **Step 1: Write failing privacy tests**

Cubrir captura solo desde decisiones confirmadas, empresa deshabilitada, payload con secreto/token, deduplicación hash, revocación, expiración y intento cross-company.

- [ ] **Step 2: Run tests**

Run: `npm.cmd test -- lib/private-learning`

Expected: FAIL porque los modelos/servicios no existen.

- [ ] **Step 3: Implement schema and capture service**

Crear `PrivateLearningExample` y `PrivateLearningUsage`, política one-to-one por empresa con `enabled` y retención de 365 días por defecto, sanitización determinista, unique hash por empresa/esquema y captura desde vínculos/hallazgos/mapeos confirmados.

- [ ] **Step 4: Run tests and Prisma checks**

Run: `npm.cmd test -- lib/private-learning`; `npm.cmd run prisma:generate`; `node ./node_modules/prisma/build/index.js validate`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add prisma/schema.prisma prisma/migrations lib/private-learning
git commit -m "feat: store private company learning examples"
```

### Task 11: Recuperación privada, provenance y revocación

**Files:**
- Create: `lib/private-learning/retrieval.ts`
- Create: `app/api/companies/[companyId]/private-learning/examples/route.ts`
- Create: `app/api/companies/[companyId]/private-learning/examples/[exampleId]/revoke/route.ts`
- Create: `app/api/budgets/[id]/private-learning/suggestions/route.ts`
- Create: `lib/private-learning/retention.ts`
- Test: `lib/private-learning/retrieval.test.ts`
- Test: `app/api/companies/[companyId]/private-learning/examples/route.test.ts`
- Test: `app/api/budgets/[id]/private-learning/suggestions/route.test.ts`

**Interfaces:**
- `retrievePrivateExamples(input: { companyId; signalType; normalizedInput; limit }): Promise<PrivateLearningSuggestion[]>` filters `ACTIVE`, same company, non-expired, same schema and compatible signal.
- `recordPrivateLearningUsage(input): Promise<void>` is idempotent by `requestId + exampleId`.
- `revokePrivateLearningExample(input): Promise<void>` removes the example from retrieval immediately.

- [ ] **Step 1: Write failing retrieval/isolation tests**

Cubrir ranking determinista, no fuga entre compañías, exclusión revocada/expirada, provenance, usage audit, disabled policy, limit and request idempotency.

- [ ] **Step 2: Run tests**

Run: `npm.cmd test -- lib/private-learning/retrieval.test.ts lib/private-learning/retention.test.ts app/api/companies/[companyId]/private-learning/examples/route.test.ts app/api/budgets/[id]/private-learning/suggestions/route.test.ts`

Expected: FAIL hasta implementar recuperación y endpoints.

- [ ] **Step 3: Implement retrieval and retention**

Usar índice estructurado determinista inicialmente; no enviar payload a proveedores externos; registrar uso con IDs opacos; ejecutar retención por `expiresAt`; devolver provenance, confianza y acción sugerida sin mutar presupuesto.

- [ ] **Step 4: Run tests**

Run: `npm.cmd test -- lib/private-learning app/api/companies/[companyId]/private-learning app/api/budgets/[id]/private-learning`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add lib/private-learning app/api/companies/[companyId]/private-learning app/api/budgets/[id]/private-learning
git commit -m "feat: retrieve private company learning safely"
```

### Task 12: UI, configuración, observabilidad y controles de proveedor

**Files:**
- Create: `components/private-learning/private-learning-settings.tsx`
- Create: `components/private-learning/private-learning-example-list.tsx`
- Create: `components/private-learning/private-learning-settings.test.tsx`
- Modify: `components/review-intelligence/finding-detail.tsx`
- Modify: `components/review-intelligence/review-dashboard.tsx`
- Create: `lib/private-learning/metrics.ts`
- Create: `docs/private-learning-operations.md`
- Test: `lib/private-learning/metrics.test.ts`

- [ ] **Step 1: Write failing UI/metrics tests**

Verificar activar/desactivar por empresa, retención visible, lista/revocación, provenance de sugerencia, estado “no modifica presupuesto”, métricas sin datos privados y bloqueo de proveedor no autorizado.

- [ ] **Step 2: Run tests**

Run: `npm.cmd test -- components/private-learning lib/private-learning/metrics.test.ts components/review-intelligence`

Expected: FAIL hasta exponer configuración y provenance.

- [ ] **Step 3: Implement UI and observability**

Añadir configuración protegida por permiso de empresa, lista paginada de ejemplos sin mostrar payload sensible completo, revocación explícita, provenance en hallazgo/sugerencia y métricas agregadas sin contenido privado.

- [ ] **Step 4: Run tests**

Run: `npm.cmd test -- components/private-learning lib/private-learning components/review-intelligence`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add components/private-learning components/review-intelligence/finding-detail.tsx components/review-intelligence/review-dashboard.tsx lib/private-learning docs/private-learning-operations.md
git commit -m "feat: expose private learning controls and provenance"
```

---

## Final cross-stage verification

### Task 13: E2E, seguridad, migraciones y rollout gradual

**Files:**
- Create: `tests/e2e/collaboration-integrations-private-learning.spec.ts`
- Modify: `docs/collaboration-operations.md`
- Modify: `docs/integrations-operations.md`
- Modify: `docs/private-learning-operations.md`
- Create: `lib/security/tenant-isolation-audit.ts`
- Test: `lib/security/tenant-isolation-audit.test.ts`

- [ ] **Step 1: Write failing end-to-end scenarios**

Cubrir: comentario y respuesta; conflicto optimista; integración inválida sin escritura; preview → confirmación → rollback; ejemplo confirmado recuperable por la misma empresa; ejemplo invisible para otra empresa; revocación; desactivación por flag.

- [ ] **Step 2: Run focused E2E/tests**

Run: `npm.cmd test -- lib/collaboration lib/integrations lib/private-learning lib/security`; `npx.cmd playwright test tests/e2e/collaboration-integrations-private-learning.spec.ts --list`

Expected: FAIL hasta conectar los tres flujos completos.

- [ ] **Step 3: Implement cross-stage audit and E2E**

Validar automáticamente que cada query privada tiene filtro de empresa, que cada mutación requiere autorización y que el flujo de integración no omite snapshot/evento. Usar fixtures sintéticos, no datos reales de empresas.

- [ ] **Step 4: Run final verification**

Run each command separately:

```powershell
npm.cmd test -- lib/collaboration lib/integrations lib/private-learning lib/security components/collaboration components/integrations components/private-learning
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
npm.cmd run prisma:generate
node ./node_modules/prisma/build/index.js validate
npx.cmd playwright test tests/e2e/collaboration-integrations-private-learning.spec.ts
git diff --check
```

Expected: all commands exit 0 in an environment with `DATABASE_URL`, authentication secrets and Playwright report permissions configured.

- [ ] **Step 5: Commit**

```powershell
git add tests/e2e docs lib/security
git commit -m "test: verify collaboration integrations and private learning"
```

## Rollout order

1. Merge Stage 1 behind `collaborationEnabled`; enable for an internal company and validate authorization/conflict metrics.
2. Merge Stage 2 behind `controlledIntegrationsEnabled`; enable preview-only first, then confirmation for a pilot company.
3. Merge Stage 3 behind `privateLearningEnabled`; default disabled, enable only after retention, revocation and tenant-isolation tests pass.
4. Promote each flag independently; rollback by disabling the flag before database rollback.

## Final acceptance checklist

- [ ] Comments/responses/menciones/resolution pass cross-company and cross-project isolation tests.
- [ ] Presence/edit sessions expire and optimistic conflicts return 409 without silent overwrite.
- [ ] Integration staging and preview never mutate budgets.
- [ ] Confirmation is explicit, idempotent and audited.
- [ ] Rollback restores the pre-session snapshot and is audited.
- [ ] Private examples are captured only from confirmed decisions.
- [ ] Private retrieval never crosses `companyId`, excludes revoked/expired examples and records usage.
- [ ] UI shows provenance and the human-review/no-automatic-mutation guardrail.
- [ ] Full focused tests, typecheck, lint, Prisma validation, build and E2E are green.
