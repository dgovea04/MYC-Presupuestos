# MC Revisión Inteligente V0.1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Extend the existing V0 review workflow with CSV sources, reproducible summary exports, finding assignment, and comparison between review runs.

**Architecture:** Keep parsing, serialization, assignment, and run-diff logic in `lib/review-intelligence`; expose scoped App Router endpoints; add focused UI actions to the existing review page. Prisma changes are limited to the assignment relation and CSV document metadata needed by the current provenance model. No budget mutation is introduced.

**Tech Stack:** Next.js App Router, TypeScript strict mode, Prisma, Zod, Decimal.js, Vitest, React/Tailwind.

**Spec:** Approved in chat from `prd/PRD-MC-Revision-Inteligente-V0.md`, section 29 V0.1.

## Global Constraints

- Financial calculations use decimal-safe math.
- Polynomial coefficient calculations use 3 decimals.
- Calculation logic remains isolated from UI and testable.
- Every request is scoped by company and project/budget authorization.
- Exports are read-only and include evidence/provenance references.
- No automatic mutation of the authoritative budget.

---

### Task 1: CSV extraction and provenance

**Files:**
- Modify: `lib/review-intelligence/documents.ts`, CSV validation/extraction modules used by the existing document pipeline
- Modify: `prisma/schema.prisma` only if the current document metadata cannot represent CSV sheet/row coverage
- Test: `lib/review-intelligence/csv.test.ts`, existing document/pipeline tests

**Interfaces:**
- Produce `parseCsvDocument(input: { bytes: Uint8Array; fileName: string }): CsvExtractionResult` with rows, headers, delimiter, encoding, warnings, and cell locations.
- Reuse `ReviewEvidence` metadata and `DocumentVersion` provenance; do not introduce an unscoped CSV data store.

- [ ] Add failing tests for comma/semicolon delimiters, quoted values, UTF-8/Latin-1 fallback, missing headers, and row/column locations.
- [ ] Run the focused CSV test and verify it fails before implementation.
- [ ] Implement bounded parser behavior using existing dependency policy and normalized metadata.
- [ ] Connect CSV MIME/extension validation and extraction persistence to the review pipeline.
- [ ] Run CSV, extraction persistence, and pipeline tests.

### Task 2: Reproducible summary export

**Files:**
- Create: `lib/review-intelligence/exports.ts`
- Create: `lib/review-intelligence/exports.test.ts`
- Create: `app/api/budgets/[id]/review-runs/[runId]/export/route.ts`
- Create: `app/api/budgets/[id]/review-runs/[runId]/export/route.test.ts`
- Modify: `components/review-intelligence/review-intelligence-page.tsx` and related dashboard components

**Interfaces:**
- Produce `buildReviewSummaryExport(input: ReviewSummaryExportInput): { csv: string; json: ReviewSummaryExport }`.
- Support `format=csv|json`; include run metadata, aggregate metrics, every finding in scope, status/resolution, priority, impact, and source location.

- [ ] Add failing tests for stable CSV headers/order, escaping, Decimal string preservation, and JSON parity.
- [ ] Run focused export tests and verify failure.
- [ ] Implement pure export serializer with deterministic ordering and no locale-dependent number conversion.
- [ ] Add authorized read-only route with `Content-Disposition` download headers.
- [ ] Add an export action to the existing review UI and cover it with a component test.
- [ ] Run focused API, serializer, and UI tests.

### Task 3: Finding assignment

**Files:**
- Modify: `prisma/schema.prisma` with nullable `assignedToId`, assignment timestamps, and User/ReviewFinding relations
- Create: `lib/review-intelligence/assignments.ts`
- Create: `lib/review-intelligence/assignments.test.ts`
- Create: `app/api/budgets/[id]/review-runs/[runId]/findings/[findingId]/assignment/route.ts`
- Create: `app/api/budgets/[id]/review-runs/[runId]/findings/[findingId]/assignment/route.test.ts`
- Modify: `lib/review-intelligence/findings.ts`, finding types, queue, and detail UI

**Interfaces:**
- Produce `assignFinding(input: { findingId: string; assigneeId: string | null; actorUserId: string; companyId: string; projectId: string; expectedUpdatedAt: Date }): Promise<AssignedFinding>`.
- Assignment is restricted to project/company members, uses optimistic concurrency, and writes `FINDING_ASSIGNED` audit events.

- [ ] Add failing tests for assign/unassign, cross-company rejection, non-member rejection, stale update, and audit payload.
- [ ] Run focused assignment tests and verify failure.
- [ ] Add migration/schema generation and implement the transactional service.
- [ ] Add scoped API GET/PUT endpoint and queue filter by assignee.
- [ ] Add UI assignee control with accessible loading/error states.
- [ ] Run Prisma validation, assignment tests, and affected component/API tests.

### Task 4: Comparison between executions

**Files:**
- Create: `lib/review-intelligence/run-comparison.ts`
- Create: `lib/review-intelligence/run-comparison.test.ts`
- Create: `app/api/budgets/[id]/review-runs/compare/route.ts`
- Create: `app/api/budgets/[id]/review-runs/compare/route.test.ts`
- Modify: `components/review-intelligence/review-intelligence-page.tsx`, dashboard, and run history UI

**Interfaces:**
- Produce `compareReviewRuns(input: { baseRunId: string; compareRunId: string; companyId: string; projectId: string; budgetId: string }): ReviewRunComparison`.
- Classify findings by stable identity `(budgetItemId, findingType, evidenceId)` as `NEW`, `PERSISTENT`, `RESOLVED`, or `CHANGED`; compare metrics and preserve both run timestamps/statuses.

- [ ] Add failing tests for all classifications, changed comparison values, missing runs, and cross-budget rejection.
- [ ] Run focused comparison tests and verify failure.
- [ ] Implement pure comparison with deterministic sorting and string-safe Decimal comparisons.
- [ ] Add scoped API endpoint and UI selector/result panel.
- [ ] Run comparison/API/UI tests.

### Task 5: Full verification and documentation

**Files:**
- Modify: `docs/review-intelligence-v0-final.md` or create a V0.1 operations note
- Test: affected unit/API/component suites and full `npm run test`, `npm run lint`, and build/type validation

- [ ] Run the focused suites for all four capabilities.
- [ ] Run `npm run test` and fix regressions without changing unrelated local work.
- [ ] Run `npm run lint` and the project build/type validation.
- [ ] Document CSV limits, export contract, assignment permissions, comparison identity, and rollback/migration notes.
- [ ] Review `git diff` to confirm only V0.1 files plus the pre-existing local changes are included.

## Self-review

- Coverage: all five V0.1 roadmap bullets are mapped to Tasks 1–4; verification/documentation is Task 5.
- Scope: CSV, export, assignment, and comparison remain separate testable units over the existing V0 contracts.
- Type consistency: serializer, assignment, and comparison interfaces are defined before their routes/UI consumers.
- Safety: tenant scope, optimistic concurrency, auditability, decimal-safe serialization, and no budget mutation are explicit.
