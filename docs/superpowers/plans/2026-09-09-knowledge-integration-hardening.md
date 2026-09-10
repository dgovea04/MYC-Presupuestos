# Knowledge Integration Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task with review checkpoints. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Completar la integración Review Intelligence → MC Knowledge Perú con autorización centralizada, provenance de migración, mapping APU canónico, retrieval controlado por flag y verificación reproducible.

**Architecture:** Se conservará la arquitectura actual de `lib/knowledge`, Prisma y App Router. La autorización será una frontera pública única; el backfill separará planificación pura de persistencia idempotente; retrieval y admin queue evaluarán el mismo flag contextual antes de consultar datos.

**Tech Stack:** Next.js 16 App Router, TypeScript strict, Prisma 7 + PostgreSQL, Vitest, Playwright, ESLint 9, `decimal.js` donde intervengan cálculos existentes.

**Spec:** `docs/superpowers/specs/2026-09-09-knowledge-integration-hardening-design.md`

## Global Constraints

- Usar TypeScript strict mode y no introducir `any`.
- Mantener los cálculos financieros decimal-safe y aislados de UI.
- No promover automáticamente datos históricos ni mutar presupuestos.
- Mantener scopes `PROJECT → COMPANY → GLOBAL` y restricciones GLOBAL existentes.
- No tocar `presupuesto-ejemplo/pdf escaneado/`, que es un cambio no relacionado del usuario.
- Escribir pruebas antes de producción para cada comportamiento nuevo o corregido.
- Ejecutar verificaciones frescas antes de declarar cada etapa terminada.

---

### Task 1: Formalizar la frontera de autorización Knowledge

Status: VERIFIED — implementation, route tests, and scoped review complete.

**Files:**
- Modify: `lib/knowledge/api-access.ts`
- Test: `lib/knowledge/api-access.test.ts`
- Modify: rutas bajo `app/api/knowledge/**` y `app/api/admin/knowledge/**` que llamen directamente a `assertWorkspaceMembership`, `assertProjectInWorkspace` o `assertKnowledgeEntityAccess`

**Interfaces:**
- Produce `assertKnowledgeReadAccess(options)` y `assertKnowledgeWriteAccess(options)`, ambos `Promise<KnowledgeOwnership>`.
- `options` incluye `actorUserId`, `companyId`, `projectId?`, `scope?`, `entityType?`, `entityId?`, `minimumRole?` y `capability?` según el patrón ya usado por capabilities.
- Las rutas no consultarán la entidad antes de ejecutar la autorización de entidad; un error de ownership será indistinguible de acceso denegado.

- [ ] **Step 1: Escribir pruebas RED** para lectura VIEWER permitida en compañía, lectura de proyecto fuera de compañía denegada, escritura EDITOR requerida, entidad GLOBAL restringida a capability administrativa y entidad inexistente denegada sin filtración.

```ts
it("permite lectura company con rol VIEWER", async () => {
  await expect(assertKnowledgeReadAccess({ actorUserId: "u1", companyId: "c1", scope: "COMPANY", minimumRole: "VIEWER" })).resolves.toMatchObject({ scope: "COMPANY", companyId: "c1" });
});

it("rechaza escritura con rol VIEWER", async () => {
  await expect(assertKnowledgeWriteAccess({ actorUserId: "u1", companyId: "c1", scope: "COMPANY", minimumRole: "EDITOR" })).rejects.toThrow();
});
```

- [ ] **Step 2: Ejecutar la prueba y confirmar RED**.

Run: `npm.cmd test -- lib/knowledge/api-access.test.ts`

Expected: falla porque las funciones nuevas no existen o porque las rutas aún no usan la frontera.

- [ ] **Step 3: Implementar el mínimo** reutilizando `assertWorkspaceMembership`, `assertProjectInWorkspace`, `findKnowledgeEntityOwnership` y las capacidades administrativas existentes. No duplicar consultas de ownership en rutas.

- [ ] **Step 4: Migrar las rutas** una por una y mantener el contrato HTTP actual: 401 sin sesión, 403 por autorización, 400 por parámetros inválidos.

- [ ] **Step 5: Ejecutar pruebas de autorización y rutas**.

Run: `npm.cmd test -- lib/knowledge/api-access.test.ts app/api/knowledge/route-auth.test.ts app/api/knowledge/aliases-route-auth.test.ts app/api/admin/knowledge/queue/route.test.ts`

Expected: PASS sin regresiones de seguridad.

- [ ] **Step 6: Commit**.

```text
git add lib/knowledge/api-access.ts lib/knowledge/api-access.test.ts app/api/knowledge app/api/admin/knowledge
git commit -m "feat: centralize knowledge authorization"
```

### Task 2: Hacer idempotente y navegable la provenance de backfill

Status: VERIFIED — implementation, migration, replay/dry-run tests, and scoped review complete.

**Files:**
- Modify: `scripts/backfill-knowledge.ts`
- Modify: `lib/knowledge/backfill.ts`
- Modify: `lib/knowledge/provenance.ts` and/or `lib/knowledge/provenance-bridge.ts` only where existing helpers support the required links
- Test: `lib/knowledge/backfill.test.ts`
- Test: `lib/knowledge/provenance-bridge.test.ts`
- Modify: `prisma/schema.prisma` only if an existing model lacks the stable idempotency/source-link field required by the approved design
- Create: Prisma migration only if schema modification is necessary

**Interfaces:**
- Produce a pure `buildMigrationSourceKey({ companyId, projectId, correlationId }): string`.
- Produce a pure `buildMigrationEvidenceKey({ sourceKey, domain, sourceRecordId }): string`.
- Backfill persistence consumes those keys and writes `KnowledgeSource` with `sourceType: "MIGRATION"`, then `KnowledgeEvidence` and existing domain links.

- [ ] **Step 1: Escribir pruebas RED** para stable source/evidence keys, dry-run with no writes, and replay returning skipped rather than duplicate source/evidence.

- [ ] **Step 2: Ejecutar `npm.cmd test -- lib/knowledge/backfill.test.ts lib/knowledge/provenance-bridge.test.ts` y confirmar RED**.

- [ ] **Step 3: Extraer los builders puros** desde el script para que correlation, tenant, domain y original ID formen claves deterministas; no usar timestamps como parte de la identidad.

- [ ] **Step 4: Crear/reutilizar source MIGRATION** con metadata de script, actor `migration`, correlation ID y tenant. En dry-run, calcular candidatos sin `create`, `upsert`, `update` ni transacción de escritura.

- [ ] **Step 5: Enlazar evidence** para items, resources, prices y APU versions; verificar que el explorer existente pueda navegar desde cada entidad hacia el registro original.

- [ ] **Step 6: Ejecutar pruebas unitarias y revisar el diff de Prisma**. Si hace falta migración, generar una migración explícita y actualizar el cliente; si no hace falta, no cambiar el schema.

- [ ] **Step 7: Commit**.

```text
git add scripts/backfill-knowledge.ts lib/knowledge/backfill.ts lib/knowledge/provenance.ts lib/knowledge/provenance-bridge.ts lib/knowledge/backfill.test.ts lib/knowledge/provenance-bridge.test.ts prisma/schema.prisma prisma/migrations
git commit -m "feat: add migration provenance to knowledge backfill"
```

### Task 3: Corregir resolución APU → canonical resources

Status: VERIFIED — resolver, persistence mapping, tests, and scoped review complete.

**Files:**
- Modify: `scripts/backfill-knowledge.ts`
- Modify: `lib/knowledge/backfill.ts`
- Modify: `lib/knowledge/canonical-resources.ts` only for reusable lookup behavior
- Test: `lib/knowledge/backfill.test.ts`
- Test: `lib/knowledge/review-canonical-resolution.test.ts` when shared resolver behavior changes

**Interfaces:**
- Produce `resolveBackfillCanonicalResource(input, index): { kind: "matched"; canonicalResourceId: string } | { kind: "skipped"; reason: "NO_MATCH" | "AMBIGUOUS" }`.
- The resolver receives source `description`, `unit`, `companyId` and the canonical index; it never treats an operational `Resource.id` as a canonical ID.

- [ ] **Step 1: Escribir pruebas RED** para exact match by normalized name/unit, alias match, no match and ambiguous match. Assert that matched output contains canonical ID, never source Resource ID.

```ts
it("no confunde el Resource.id con canonicalResourceId", () => {
  const result = resolveBackfillCanonicalResource({ resourceId: "resource-1", description: "Cemento", unit: "kg", companyId: "c1" }, indexWithCanonical("canonical-1"));
  expect(result).toEqual({ kind: "matched", canonicalResourceId: "canonical-1" });
  expect(result).not.toEqual(expect.objectContaining({ canonicalResourceId: "resource-1" }));
});
```

- [ ] **Step 2: Ejecutar la prueba y confirmar RED**.

Run: `npm.cmd test -- lib/knowledge/backfill.test.ts`

- [ ] **Step 3: Implementar el resolver** sobre normalización y aliases existentes. Si hay cero candidatos devolver `NO_MATCH`; si hay más de uno inequívoco devolver `AMBIGUOUS`; no seleccionar el primero en un empate.

- [ ] **Step 4: Usar el resolver al crear filas APU**. Un match escribe la relación canónica; no-match/ambiguous incrementa `skipped`, agrega razón y crea evidence/conflict únicamente según el modelo existente.

- [ ] **Step 5: Ejecutar pruebas de backfill y canonical resolution**.

Run: `npm.cmd test -- lib/knowledge/backfill.test.ts lib/knowledge/review-canonical-resolution.test.ts`

- [ ] **Step 6: Commit**.

```text
git add scripts/backfill-knowledge.ts lib/knowledge/backfill.ts lib/knowledge/canonical-resources.ts lib/knowledge/backfill.test.ts lib/knowledge/review-canonical-resolution.test.ts
git commit -m "fix: map backfilled apu resources canonically"
```

### Task 4: Añadir y aplicar `knowledge_retrieval_v1`

Status: VERIFIED — flag precedence, API contracts, tests, and scoped review complete.

**Files:**
- Modify: `lib/knowledge/feature-flags.ts`
- Test: `lib/knowledge/feature-flags.test.ts`
- Modify: `app/api/knowledge/retrieval/route.ts`
- Modify: `app/api/admin/knowledge/queue/route.ts`
- Test: `app/api/knowledge/retrieval/route.test.ts`
- Test: `app/api/admin/knowledge/queue/route.test.ts`
- Modify: other `app/api/knowledge/**` routes identified by `rg "retrieveKnowledgeV1|getKnowledgeAdminQueue"`

**Interfaces:**
- Extend `KnowledgeFeature` with `retrievalV1` mapped to `MC_KNOWLEDGE_RETRIEVAL_V1`.
- Add `isKnowledgeFeatureEnabled(feature, context?)` compatibility without weakening existing environment behavior; context carries optional `companyId` and `projectId` for overrides if the registry already supports them.

- [ ] **Step 1: Escribir pruebas RED** for enabled retrieval, disabled retrieval without invoking `retrieveKnowledgeV1`, disabled admin queue, and company/project override precedence.

- [ ] **Step 2: Ejecutar las pruebas y confirmar RED**.

Run: `npm.cmd test -- lib/knowledge/feature-flags.test.ts app/api/knowledge/retrieval/route.test.ts app/api/admin/knowledge/queue/route.test.ts`

- [ ] **Step 3: Añadir la flag tipada** y una respuesta controlada `503` con `{ error: "Knowledge retrieval disabled", feature: "retrievalV1" }` cuando retrieval esté apagado. Mantener 401/403 antes de evaluar la feature.

- [ ] **Step 4: Aplicar autorización centralizada y flag** a retrieval y queue; validar `companyId`/`projectId` antes de consultar queue. No habilitar mutaciones por activar retrieval.

- [ ] **Step 5: Ejecutar todas las pruebas de flags y rutas**.

Run: `npm.cmd test -- lib/knowledge/feature-flags.test.ts app/api/knowledge/retrieval/route.test.ts app/api/admin/knowledge/queue/route.test.ts`

- [ ] **Step 6: Commit**.

```text
git add lib/knowledge/feature-flags.ts lib/knowledge/feature-flags.test.ts app/api/knowledge app/api/admin/knowledge
git commit -m "feat: gate knowledge retrieval by rollout flag"
```

### Task 5: Crear replay/dry-run real contra PostgreSQL local

Status: VERIFIED — real local PostgreSQL replay/dry-run integration and scoped review complete.

**Files:**
- Modify: `scripts/backfill-knowledge.ts` to export a callable `runKnowledgeBackfill(options)` while preserving CLI behavior
- Create: `scripts/backfill-knowledge.integration.test.ts`
- Modify: `vitest.config.ts` only to include the integration file without running it when `DATABASE_URL` is absent
- Modify: `README.md` or a focused runbook under `docs/` with the exact local command and cleanup procedure

**Interfaces:**
- `runKnowledgeBackfill(options): Promise<KnowledgeBackfillReport>` accepts `companyId?`, `projectId?`, `dryRun`, `correlationId`, and injected Prisma client only if existing test patterns require it.
- `KnowledgeBackfillReport` exposes `candidates`, `created`, `skipped`, `errors`, `dryRun`, `companyId`, `projectId`, `correlationId`.

- [ ] **Step 1: Escribir la prueba de integración** con `describe.skipIf(!process.env.DATABASE_URL)` and fixture tenant/project/resource/item/APU IDs created through Prisma.

- [ ] **Step 2: Ejecutar la prueba con `DATABASE_URL` local y confirmar RED** por la API callable o por los contadores/provenance faltantes.

Run: `$env:DATABASE_URL='postgresql://...'; npm.cmd test -- scripts/backfill-knowledge.integration.test.ts`

- [ ] **Step 3: Extraer la función ejecutable** del top-level CLI y cerrar Prisma de forma segura solo en el entrypoint, permitiendo que Vitest reutilice la conexión.

- [ ] **Step 4: Implementar assertions de integración**: dry-run no cambia conteos; primera corrida crea source/evidence/entities; replay crea cero; no-match y ambiguous aparecen en skipped; conflicto de versión y error por fila quedan en reportes.

- [ ] **Step 5: Ejecutar la prueba con PostgreSQL local**, luego repetirla para verificar replay real y consultar provenance por ID.

- [ ] **Step 6: Documentar el comando** con `DATABASE_URL`, `MC_KNOWLEDGE_BACKFILL=true`, `--dry-run`, `--company`/`--project` y limpieza de fixtures usando IDs concretos de la prueba.

- [ ] **Step 7: Commit**.

```text
git add scripts/backfill-knowledge.ts scripts/backfill-knowledge.integration.test.ts vitest.config.ts README.md docs
git commit -m "test: verify knowledge backfill replay against postgres"
```

### Task 6: Ejecutar suite y corregir el lint preexistente

Status: VERIFIED — full suite, typecheck, lint, build, and scoped review complete.

**Files:**
- Modify: `components/imports/pdf-importer-page-content.tsx`
- Test: existing PDF import tests selected by `rg --files components app | rg "pdf-import|imports.*test"`
- No changes to unrelated files reported by lint.

- [ ] **Step 1: Ejecutar baseline completo** antes de corregir el lint y guardar errores con comando/archivo.

Run: `npm.cmd test`

Run: `npm.cmd run typecheck`

Run: `npm.cmd run lint`

Run: `npm.cmd run build`

- [ ] **Step 2: Escribir una regresión mínima** si el uso de `Date.now()` afecta output observable; si solo es una regla de lint, adaptar el valor a inicialización estable (`useState` lazy o valor derivado de props) sin cambiar el comportamiento del importador.

- [ ] **Step 3: Ejecutar el test/regla específica y confirmar que el error desaparece**.

Run: `npm.cmd run lint -- components/imports/pdf-importer-page-content.tsx`

- [ ] **Step 4: Ejecutar suite y typecheck completos**.

Run: `npm.cmd test`

Run: `npm.cmd run typecheck`

- [ ] **Step 5: Commit**.

```text
git add components/imports/pdf-importer-page-content.tsx
git commit -m "fix: stabilize pdf importer render timestamp"
```

### Task 7: Prueba E2E Review → bridge → Knowledge → retry

Status: IMPLEMENTED / ENVIRONMENT BLOCKED — fixture validation and safeguards verified; real isolated PostgreSQL E2E assertions await `E2E_REVIEW_BRIDGE_*`.

**Files:**
- Modify: `tests/e2e/review-intelligence.spec.ts`
- Modify: `playwright.config.ts` only if the existing app server/env cannot expose the required local flags
- Modify: `scripts/configure-e2e-user.ts` only for existing authentication setup needed by the test

- [ ] **Step 1: Escribir el escenario E2E** usando un proyecto aislado: habilitar bridge, enrichment, retrieval V1, admin queue y backfill según el mecanismo actual; crear o seleccionar finding; registrar decisión; esperar el evento/resultado Knowledge; forzar o provocar retry; verificar estado final y ausencia de duplicados.

- [ ] **Step 2: Ejecutar solo el escenario y confirmar RED** si falta alguna transición observable.

Run: `npm.cmd run test:e2e -- tests/e2e/review-intelligence.spec.ts --grep "bridge.*retry"`

- [ ] **Step 3: Ajustar solo contratos de espera/assertion** o la integración faltante descubierta por el escenario; no usar sleeps fijos cuando exista polling por estado.

- [ ] **Step 4: Ejecutar el archivo E2E completo**.

Run: `npm.cmd run test:e2e -- tests/e2e/review-intelligence.spec.ts`

- [ ] **Step 5: Commit**.

```text
git add tests/e2e/review-intelligence.spec.ts playwright.config.ts scripts/configure-e2e-user.ts
git commit -m "test: cover review knowledge retry flow"
```

### Task 8: Verificación final y handoff

Status: PARTIAL — suite/typecheck/lint/build and repository checks verified; final E2E remains environment-blocked.

**Files:**
- Review: `docs/superpowers/specs/2026-09-09-knowledge-integration-hardening-design.md`
- Review: `docs/superpowers/plans/2026-09-09-knowledge-integration-hardening.md`
- Create: `docs/knowledge-integration-verification-2026-09-09.md`

- [ ] **Step 1: Ejecutar verificación fresca completa**.

Run: `npm.cmd test`

Run: `npm.cmd run typecheck`

Run: `npm.cmd run lint`

Run: `npm.cmd run build`

Run: `npm.cmd run test:e2e -- tests/e2e/review-intelligence.spec.ts`

- [ ] **Step 2: Revisar `git diff --check`, `git status --short` y que el directorio no relacionado siga sin modificaciones del agente**.

- [ ] **Step 3: Escribir el reporte** con fecha, comandos, exit codes, conteo de tests, resultado PostgreSQL, resultado E2E y cualquier bloqueo ambiental reproducible.

- [ ] **Step 4: Marcar en este plan únicamente las tareas verificadas** y ejecutar `git diff --check` nuevamente.

- [ ] **Step 5: Commit del reporte**.

```text
git add docs/knowledge-integration-verification-2026-09-09.md docs/superpowers/plans/2026-09-09-knowledge-integration-hardening.md
git commit -m "docs: record knowledge integration verification"
```

## Cobertura de la especificación

- Autorización centralizada: Task 1.
- Provenance MIGRATION y evidence navegable: Task 2.
- Mapping APU canónico y conflictos: Task 3.
- Flag contextual y APIs: Task 4.
- Replay/dry-run PostgreSQL: Task 5.
- Suite, typecheck, lint y build: Task 6 y Task 8.
- E2E Review → bridge → Knowledge → retry: Task 7 y Task 8.
- Exclusiones de observabilidad persistente, UI administrativa y mutación automática: Global Constraints y Task 8.

## Self-review del plan

- No contiene marcadores de trabajo incompleto ni pasos sin archivo, interfaz o comando verificable.
- Las firmas producidas por Tasks 1, 2, 3, 4 y 5 se reutilizan con los mismos nombres en las tareas posteriores.
- Cada requisito de la especificación tiene al menos una tarea y un criterio de verificación.
- La prueba PostgreSQL está condicionada por `DATABASE_URL` para no convertir la suite normal en una dependencia ambiental, pero el criterio de aceptación exige ejecutarla explícitamente cuando PostgreSQL local esté disponible.
