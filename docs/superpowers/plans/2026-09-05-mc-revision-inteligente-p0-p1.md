# MC Revisión Inteligente P0/P1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Completar los bloques P0/P1 de Revisión Inteligente con almacenamiento seguro, provenance temporal, detección/OCR, jobs resilientes, reprocesamiento, clasificación sugerida y selección de hojas XLSX.

**Architecture:** Mantener los servicios de `lib/review-intelligence` como dominio puro y añadir adaptadores explícitos para almacenamiento, OCR y ejecución de jobs. Las rutas sólo autentican, autorizan, validan payloads y coordinan servicios; la UI consume contratos persistidos y nunca modifica el presupuesto automáticamente.

**Tech Stack:** Next.js App Router 16, TypeScript strict, Prisma 7, PostgreSQL, Zod 4, Decimal.js, ExcelJS, Vitest, React Testing Library y almacenamiento local fuera de `public/` con interfaz S3-compatible.

**Spec:** `docs/superpowers/specs/2026-09-05-mc-revision-inteligente-p0-p1-design.md`

## Global Constraints

- `humanReviewRequired` permanece siempre en `true`.
- `automaticBudgetMutation` permanece siempre en `false`.
- Todos los accesos se filtran por `companyId`, `projectId` y permisos del usuario.
- Los archivos originales se almacenan fuera de `public/`.
- La API no expone `storageKey` ni URLs permanentes.
- Los importes y diferencias financieras usan `Decimal`.
- Macros, fórmulas externas, scripts y enlaces embebidos no se ejecutan.
- Las evidencias de páginas/hojas no procesadas no generan `MISSING_DOCUMENTATION`.
- Las decisiones y resultados históricos no se sobrescriben.
- Cada cambio de producción debe tener una prueba que haya fallado antes de la implementación.

---

### Task 1: Contratos persistentes de storage, OCR y extracción parcial

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `lib/review-intelligence/storage.ts`
- Create: `lib/review-intelligence/ocr.ts`
- Modify: `lib/review-intelligence/types.ts`
- Modify: `lib/review-intelligence/validation.ts`
- Test: `lib/review-intelligence/storage.test.ts`
- Test: `lib/review-intelligence/ocr.test.ts`

**Interfaces:**
- Produce `ReviewDocumentStorage` with `put`, `createTemporaryReadUrl` and `delete`.
- Produce `OcrAdapter` with `extractPages(input): Promise<OcrExtractionResult>`.
- Add explicit extraction coverage types: `PROCESSED`, `OCR_REQUIRED`, `FAILED`.
- Persist extraction method, confidence and affected pages/worksheets without changing existing finding contracts.

- [ ] **Step 1: Write failing storage tests** for tenant-scoped paths, SHA-256 integrity, temporary URL expiry and deletion outside `public/`.
- [ ] **Step 2: Run RED** with `npm.cmd run test -- lib/review-intelligence/storage.test.ts`; confirm the adapter contract is missing.
- [ ] **Step 3: Write failing OCR tests** for a PDF page without selectable text, missing OCR provider and successful OCR evidence metadata.
- [ ] **Step 4: Run RED** with `npm.cmd run test -- lib/review-intelligence/ocr.test.ts`; confirm the expected OCR behavior is absent.
- [ ] **Step 5: Add Prisma fields/enums** for storage metadata and page/worksheet coverage, preserving existing versions and relations.
- [ ] **Step 6: Implement the local adapter** using a configured directory outside `public/`, deterministic tenant/version paths, signed short-lived tokens and no permanent URL.
- [ ] **Step 7: Implement the OCR boundary** as an injected adapter with a safe unavailable-provider result; do not add a provider dependency until the repository has a supported runtime provider.
- [ ] **Step 8: Run both test files** and `npm.cmd run typecheck`.
- [ ] **Step 9: Commit** with `git add prisma/schema.prisma lib/review-intelligence && git commit -m "feat: add secure review storage and ocr contracts"`.

### Task 2: Persist uploaded binaries and secure provenance

**Files:**
- Modify: `lib/review-intelligence/documents.ts`
- Modify: `app/api/projects/[id]/review-documents/route.ts`
- Modify: `app/api/review-evidence/[id]/view/route.ts`
- Modify: `lib/review-intelligence/findings.ts`
- Test: `app/api/projects/[id]/review-documents/route.test.ts`
- Test: `app/api/review-evidence/[id]/view/route.test.ts`
- Test: `lib/review-intelligence/documents.test.ts`

**Interfaces:**
- Upload persists the validated bytes before extraction and records the resulting storage metadata.
- Evidence view returns either a structured authorized view or a short-lived source URL with expiry.
- Delete removes binary and derived content but preserves minimal audit records without original content.

- [ ] **Step 1: Add failing route tests** proving uploaded bytes are sent to storage and cross-tenant provenance is rejected.
- [ ] **Step 2: Run RED** with `npm.cmd run test -- app/api/projects/[id]/review-documents/route.test.ts app/api/review-evidence/[id]/view/route.test.ts`.
- [ ] **Step 3: Add failing document-service tests** for storage failure rollback and idempotent replay.
- [ ] **Step 4: Run RED** with `npm.cmd run test -- lib/review-intelligence/documents.test.ts`.
- [ ] **Step 5: Inject `ReviewDocumentStorage`** into upload and persist the storage key only server-side.
- [ ] **Step 6: Update provenance access** to validate evidence, version, project, company and role before creating a temporary URL.
- [ ] **Step 7: Update deletion** to remove storage and derived evidence in one transaction while retaining sanitized audit events.
- [ ] **Step 8: Run targeted routes, typecheck and `git diff --check`**.
- [ ] **Step 9: Commit** with `git add app/api lib/review-intelligence prisma/schema.prisma && git commit -m "feat: persist secure review document provenance"`.

### Task 3: Digital extraction coverage and OCR routing

**Files:**
- Modify: `lib/review-intelligence/extractors.ts`
- Modify: `lib/review-intelligence/extraction-persistence.ts`
- Modify: `lib/review-intelligence/rules.ts`
- Modify: `lib/review-intelligence/pipeline.ts`
- Test: `lib/review-intelligence/extractors.test.ts`
- Test: `lib/review-intelligence/extraction-persistence.test.ts`
- Test: `lib/review-intelligence/rules.test.ts`

**Interfaces:**
- `extractDocument` reports processed and uncovered PDF pages plus selected XLSX sheets.
- `extractAndPersistDocumentVersion` persists coverage and OCR metadata.
- `evaluateFindingRules` receives coverage exclusions and never emits missing-documentation findings for uncovered areas.

- [ ] **Step 1: Add failing extractor tests** for text-rich pages, scanned pages, unavailable OCR and page-level warnings.
- [ ] **Step 2: Run RED** with `npm.cmd run test -- lib/review-intelligence/extractors.test.ts`.
- [ ] **Step 3: Add failing persistence/rules tests** for coverage metadata and disabled absence findings.
- [ ] **Step 4: Run RED** with `npm.cmd run test -- lib/review-intelligence/extraction-persistence.test.ts lib/review-intelligence/rules.test.ts`.
- [ ] **Step 5: Implement page coverage detection** using existing digital PDF extraction; mark pages with insufficient text as `OCR_REQUIRED` without inventing coordinates.
- [ ] **Step 6: Invoke the injected OCR adapter** only for uncovered pages and merge evidence idempotently by source hash.
- [ ] **Step 7: Add coverage-aware rule input** so missing-documentation is suppressed for incomplete source areas.
- [ ] **Step 8: Run targeted tests and verify decimal calculations remain unchanged.**
- [ ] **Step 9: Commit** with `git add lib/review-intelligence && git commit -m "feat: add coverage-aware review extraction"`.

### Task 4: XLSX sheet selection and classification suggestion

**Files:**
- Create: `lib/review-intelligence/classification.ts`
- Modify: `lib/review-intelligence/extractors.ts`
- Modify: `lib/review-intelligence/validation.ts`
- Modify: `app/api/projects/[id]/review-documents/route.ts`
- Modify: `app/api/review-documents/[id]/classification/route.ts`
- Modify: `app/api/budgets/[id]/review-runs/route.ts`
- Modify: `components/review-intelligence/document-manager.tsx`
- Modify: `components/review-intelligence/review-intelligence-page.tsx`
- Test: `lib/review-intelligence/classification.test.ts`
- Test: `lib/review-intelligence/extractors.test.ts`
- Test: `components/review-intelligence/review-intelligence-page.test.tsx`

**Interfaces:**
- `suggestDocumentClassification(input): ClassificationSuggestion` is deterministic and explainable.
- `ReviewConfiguration` accepts `xlsxSheetNames?: string[]`.
- The UI allows confirming a classification suggestion and selecting XLSX sheets before execution.

- [ ] **Step 1: Write failing classification tests** for filename, headers, extension and fallback `OTHER` signals.
- [ ] **Step 2: Run RED** with `npm.cmd run test -- lib/review-intelligence/classification.test.ts`.
- [ ] **Step 3: Write failing XLSX tests** for selected sheets and real `sheet/range` provenance.
- [ ] **Step 4: Run RED** with `npm.cmd run test -- lib/review-intelligence/extractors.test.ts`.
- [ ] **Step 5: Implement deterministic suggestions** with score, signals and no automatic category mutation.
- [ ] **Step 6: Persist confirmed classification** and mark related review runs stale through the existing staleness service.
- [ ] **Step 7: Pass selected sheet names** from the UI to configuration and filter extraction before creating evidence.
- [ ] **Step 8: Run component, route and domain tests.**
- [ ] **Step 9: Commit** with `git add app/api components/review-intelligence lib/review-intelligence && git commit -m "feat: add review classification and xlsx sheet selection"`.

### Task 5: Job retry, timeout and company concurrency

**Files:**
- Modify: `lib/review-intelligence/jobs.ts`
- Modify: `lib/review-intelligence/pipeline.ts`
- Modify: `prisma/schema.prisma`
- Test: `lib/review-intelligence/jobs.test.ts`
- Test: `lib/review-intelligence/pipeline.test.ts`

**Interfaces:**
- `runReviewJob` preserves its public signature while using persisted attempts and stage deadlines.
- Add `ReviewJobPolicy` with `maxAttempts`, `stageTimeoutMs`, `backoffMs` and `maxConcurrentPerCompany`.
- Add `retryReviewRun(reviewRunId, companyId)` that resumes from the failed checkpoint.

- [ ] **Step 1: Write failing tests** for retryable failure, deterministic backoff calculation, timeout-to-failure, company concurrency rejection and resume from checkpoint.
- [ ] **Step 2: Run RED** with `npm.cmd run test -- lib/review-intelligence/jobs.test.ts lib/review-intelligence/pipeline.test.ts`.
- [ ] **Step 3: Add persisted job metadata** for attempt count, next retry time, stage deadline and failure code.
- [ ] **Step 4: Implement retry policy** without sleeping in tests; use injected clock/scheduler so production backoff is testable.
- [ ] **Step 5: Implement timeout checks** at stage boundaries and persist an inspectable failure event.
- [ ] **Step 6: Enforce company-level active-run count** transactionally before claiming a run.
- [ ] **Step 7: Add retry API/service behavior** that preserves evidence/findings and resumes idempotently.
- [ ] **Step 8: Run targeted tests, typecheck and lint.**
- [ ] **Step 9: Commit** with `git add lib/review-intelligence prisma/schema.prisma && git commit -m "feat: harden review job execution"`.

### Task 6: Selective page/sheet reprocessing

**Files:**
- Create: `app/api/review-documents/[id]/reprocess/route.ts`
- Modify: `lib/review-intelligence/extraction-persistence.ts`
- Modify: `lib/review-intelligence/extractors.ts`
- Modify: `components/review-intelligence/document-manager.tsx`
- Test: `app/api/review-documents/[id]/reprocess/route.test.ts`
- Test: `lib/review-intelligence/extraction-persistence.test.ts`
- Test: `components/review-intelligence/review-intelligence-page.test.tsx`

**Interfaces:**
- `reprocessDocumentCoverage(input)` accepts only authorized page numbers or sheet names and returns updated coverage.
- Reprocessing does not delete valid evidence and does not duplicate existing evidence or findings.

- [ ] **Step 1: Write failing route tests** for authorization, invalid page/sheet selection, idempotent replay and partial success.
- [ ] **Step 2: Run RED** with `npm.cmd run test -- app/api/review-documents/[id]/reprocess/route.test.ts`.
- [ ] **Step 3: Add failing persistence tests** for merging new evidence with existing hashes.
- [ ] **Step 4: Run RED** with `npm.cmd run test -- lib/review-intelligence/extraction-persistence.test.ts`.
- [ ] **Step 5: Implement scoped extraction** for only requested pages/sheets and persist warnings for failures.
- [ ] **Step 6: Mark affected completed runs stale** and expose a new run/retry action without mutating budget data.
- [ ] **Step 7: Add accessible UI actions** for warnings and affected pages/sheets.
- [ ] **Step 8: Run targeted API, persistence and component tests.**
- [ ] **Step 9: Commit** with `git add app/api components/review-intelligence lib/review-intelligence && git commit -m "feat: add selective review source reprocessing"`.

### Task 7: End-to-end review flow and security verification

**Files:**
- Create: `tests/e2e/review-intelligence.spec.ts`
- Modify: `playwright.config.ts` only if the existing authenticated fixture requires a review-specific setup.
- Modify: `docs/review-intelligence-operations.md`

**Interfaces:**
- E2E covers upload, classification confirmation, XLSX sheet selection, review execution, warning display, evidence opening and human decision.

- [ ] **Step 1: Create failing E2E scenarios** using a small PDF/XLSX fixture and two workspaces.
- [ ] **Step 2: Run RED** with `npm.cmd run test:e2e -- tests/e2e/review-intelligence.spec.ts` and document environment blockers if the authenticated fixture is unavailable.
- [ ] **Step 3: Implement only test fixtures/setup required** to exercise the real routes and UI.
- [ ] **Step 4: Run the E2E suite** and verify cross-tenant access is rejected.
- [ ] **Step 5: Update operations documentation** with storage directory, URL expiry, OCR configuration, retry policy and reprocessing procedure.
- [ ] **Step 6: Commit** with `git add tests/e2e docs/review-intelligence-operations.md playwright.config.ts && git commit -m "test: verify intelligent review end to end"`.

### Task 8: Final verification and remaining global regressions

**Files:**
- Modify: only files required by failing tests after diagnosis.
- Test: existing global suite plus all review-intelligence tests.

- [ ] **Step 1: Run** `npm.cmd run test -- lib/review-intelligence app/api/review-runs app/api/review-findings app/api/review-links app/api/review-evidence app/api/projects/[id]/review-documents app/api/budgets/[id]/review-runs components/review-intelligence lib/ai/review-intelligence-tools.test.ts`.
- [ ] **Step 2: Run** `npm.cmd run typecheck`.
- [ ] **Step 3: Run** `npm.cmd run lint` and resolve only errors; preserve unrelated warnings unless they block the build.
- [ ] **Step 4: Run** `npm.cmd run build`.
- [ ] **Step 5: Run** `git diff --check` and inspect `git status --short`.
- [ ] **Step 6: Re-run the two known unrelated failures** and fix them only if the changed review UI introduced a regression; otherwise document them separately.
- [ ] **Step 7: Commit** the final verification/doc updates with `git add . && git commit -m "chore: verify intelligent review p0 p1"`.

## Plan self-review

- Storage, provenance, OCR, partial coverage, jobs, reprocessing, classification, XLSX selection, E2E and final verification each have an independent task.
- The plan keeps OCR/provider and storage implementation behind injectable interfaces.
- No task allows automatic budget mutation or cross-tenant access.
- Tests are specified before production changes and each task ends with a runnable verification command.
- The plan intentionally leaves cloud deployment and distributed workers outside this increment, as stated in the design spec.
