# MC Knowledge Perú V0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the structured, provenance-aware MC Knowledge Perú V0 core and its first internal integrations without duplicating existing operational domains.

**Architecture:** Prisma/PostgreSQL stores Knowledge entities and immutable events. Pure TypeScript services validate scopes, normalize names, resolve candidates, create observations and retrieve visible knowledge; existing Budget, Resource, APU and Review models remain authoritative for operational work.

**Tech Stack:** Next.js App Router, TypeScript strict, Prisma, PostgreSQL, Vitest, existing workspace authorization and logging utilities.

**Spec:** `docs/superpowers/specs/2026-09-07-mc-knowledge-peru-v0-design.md`

## Global Constraints

- “Observation ≠ Knowledge ≠ Canonical Knowledge.”
- “No promotion automática a Global.”
- “Company A cannot read Company B.”
- Financial values use Prisma `Decimal`; no `number` for monetary calculations.
- Keep calculation logic isolated from UI and preserve existing operational models.
- No public benchmark, ML, embeddings, scraping, marketplace or external provider integration in this V0.

---

### Task 1: Audit and schema foundation

**Files:**
- Create: `docs/mc-knowledge-audit.md`
- Create: `docs/superpowers/specs/2026-09-07-mc-knowledge-peru-v0-design.md`
- Create: `prisma/migrations/<timestamp>_add_mc_knowledge_v0/migration.sql`
- Modify: `prisma/schema.prisma`
- Test: `lib/knowledge/schema-contract.test.ts`

**Interfaces:** Add the enums and models described in the design spec, with composite indexes on scope/tenant, entity, observed date and idempotency key. Expose generated Prisma types to later services.

- [x] Document repository mapping, risks and accepted scope.
- [x] Add enums and models with explicit nullable tenant fields and foreign keys where existing models are authoritative.
- [x] Generate and inspect the migration without applying destructive changes.
- [x] Add schema contract coverage through Prisma validation and generated-client compilation.
- [x] Run Prisma validation and focused tests.

### Task 2: Validation, scope and normalization services

**Files:**
- Create: `lib/knowledge/types.ts`
- Create: `lib/knowledge/validation.ts`
- Create: `lib/knowledge/scope.ts`
- Create: `lib/knowledge/normalization.ts`
- Test: `lib/knowledge/validation.test.ts`
- Test: `lib/knowledge/scope.test.ts`
- Test: `lib/knowledge/normalization.test.ts`

**Interfaces:** Implement `validateKnowledgeScope`, `assertKnowledgeScopeAccess`, `normalizeKnowledgeText`, `normalizeKnowledgeUnit` and typed input validators. Normalization removes case/spacing/accent noise while preserving the display value.

- [x] Write failing tests for complete/incomplete scopes, cross-company access, accent/whitespace normalization and unit aliases.
- [x] Run focused tests and confirm expected failures.
- [x] Implement the smallest pure functions satisfying those tests.
- [x] Run focused tests and TypeScript checks.

### Task 3: Sources, evidence and idempotent events

**Files:**
- Create: `lib/knowledge/events.ts`
- Create: `lib/knowledge/provenance.ts`
- Create: `lib/knowledge/events.test.ts`
- Create: `lib/knowledge/provenance.test.ts`
- Create: `app/api/knowledge/events/route.ts`
- Create: `app/api/knowledge/events/route.test.ts`

**Interfaces:** `recordKnowledgeEvent(input, actor)` validates provenance and scope, creates the event transactionally, and returns `{ event, created }`; repeated keys return the original event only when payload hashes match.

- [x] Test valid event creation, duplicate replay, duplicate-key payload conflict and unauthorized scope at service level.
- [ ] Verify red tests.
- [x] Implement transaction, canonical payload hashing and structured event persistence.
- [x] Verify green service tests and route compilation; route integration tests remain pending.

### Task 4: Canonical items/resources and aliases

**Files:**
- Create: `lib/knowledge/canonical-items.ts`
- Create: `lib/knowledge/canonical-resources.ts`
- Create: `lib/knowledge/entity-candidates.ts`
- Test: corresponding `*.test.ts` files
- Create: `app/api/knowledge/items/route.ts`
- Create: `app/api/knowledge/resources/route.ts`

**Interfaces:** `createCanonicalItem`, `createCanonicalResource`, `addAlias`, `findExactCandidates` return non-destructive candidates ordered by normalized exact match, alias match and deterministic text similarity.

- [x] Test aliases, duplicate normalized names, category/unit validation and candidate ordering at service level.
- [x] Verify red tests.
- [x] Implement services with no automatic merges.
- [x] Add tenant-aware canonical entity route reads/writes and verify compilation.

### Task 5: APU versions, regions and suppliers

**Files:**
- Create: `lib/knowledge/apu.ts`
- Create: `lib/knowledge/regions.ts`
- Create: `lib/knowledge/suppliers.ts`
- Test: corresponding `*.test.ts` files
- Modify: `prisma/schema.prisma` only if relation fixes are required by Task 1

**Interfaces:** `createApuVersionFromExistingApu`, `listApuVersions`, `createRegion`, `createSupplier`; APU snapshots include source APU id, content hash, resource rows, performance and provenance.

- [x] Test version creation on structural APU changes and stable content hash on identical input.
- [ ] Verify red tests.
- [x] Implement Decimal-safe snapshot serialization and hierarchical region validation.
- [ ] Verify green tests.

### Task 6: Price and yield observations

**Files:**
- Create: `lib/knowledge/observations.ts`
- Test: `lib/knowledge/observations.test.ts`
- Create: `app/api/knowledge/price-observations/route.ts`
- Create: `app/api/knowledge/yield-observations/route.ts`

**Interfaces:** `createPriceObservation` and `createYieldObservation` validate positive Decimal values, required provenance, compatible units and scope; neither function promotes assertions.

- [x] Test valid observations, invalid Decimal input and scope validation at service level.
- [x] Verify red tests.
- [x] Implement Decimal-safe observation persistence.
- [x] Add source/evidence provenance checks and authenticated source/evidence/observation routes; workspace authorization for scoped events and retrieval is enforced.
- [ ] Add event linkage and route tests.

### Task 7: Retrieval and integrations

**Files:**
- Create: `lib/knowledge/retrieval.ts`
- Test: `lib/knowledge/retrieval.test.ts`
- Modify: existing Presupuestos/Revisor event-producing services identified during audit
- Create: `app/api/knowledge/retrieval/route.ts`

**Interfaces:** `retrieveKnowledge({ companyId, projectId, query, kind, limit })` applies scope precedence and returns provenance-bearing candidates. Integrations emit events only after explicit user actions, review confirmations or completed imports.

- [x] Test project/company/global precedence and cross-tenant exclusion at query construction level.
- [x] Verify red tests.
- [x] Implement basic structured retrieval.
- [x] Add protected retrieval route and internal admin review page.
- [x] Add event adapters for Revisor decisions and S10/MCP import completion.
- [x] Verify existing integration tests without automatic budget mutation; dedicated adapter tests remain pending.

### Task 8: Internal review UI and final verification

**Files:**
- Create: `app/admin/knowledge/page.tsx`
- Create: `components/admin/knowledge-review-panel.tsx`
- Create: `components/admin/knowledge-review-panel.test.tsx`
- Modify: feature registry/capability definitions if required by existing conventions
- Create: `docs/mc-knowledge-operations.md`

- [x] Implement server-authorized page with partidas, recursos, observaciones, eventos and provenance context.
- [x] Add interactive candidate review actions; dedicated UI/route tests remain recommended follow-up.
- [ ] Document rollout flags, privacy rules, operational logs and technical debt.
- [x] Run Knowledge tests, scoped ESLint, TypeScript, Prisma validation/migration status and production build.
- [x] Review migration SQL and confirm no cross-tenant relation permits leakage.

## Coverage review

The plan covers the PRD acceptance criteria for canonical entities, aliases, APU history, observations, provenance, events, scope isolation, integrations, retrieval, admin review, migrations, tests and documentation. Embeddings, benchmarks, anomaly detection and ML are intentionally deferred because they are explicitly post-core phases in the PRD.

## Implementation checkpoint

Completed in the current increment: schema/migration, audit/spec documentation, scope enforcement primitives, deterministic normalization, Decimal validation, idempotent event persistence service, canonical item/resource services with aliases and protected routes, Decimal-safe APU snapshots, price/yield observations, source/evidence provenance, protected event/retrieval APIs, basic retrieval, S10/MCP import events, Revisor decision events, canonical alias confirmation, region/supplier services and admin routes, `/admin/knowledge`, and dedicated route/UI/security tests. Remaining follow-up: broader integration/security matrix. Verification completed: Knowledge tests, route/UI tests, scoped ESLint, TypeScript, Prisma validation/migration status and production build.
