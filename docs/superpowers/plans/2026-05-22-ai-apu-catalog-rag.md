# AI APU Catalog RAG Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the MVP intelligent APU generator that retrieves similar partidas and valid catalog resources before asking Ollama for a structured, editable proposal.

**Architecture:** Keep calculation and validation logic in `lib/ai/*` services, expose the feature through a new App Router route handler, and keep UI behavior as preview-only until the user applies changes. The catalog remains the source of truth: generated rows must reference existing resources or be reported as suggested new resources.

**Tech Stack:** Next.js App Router route handlers, TypeScript strict mode, Zod, Prisma, decimal.js, Vitest, Ollama integration already present in `lib/ai/service.ts`.

---

### Task 1: Catalog Search And Context

**Files:**
- Create: `lib/ai/catalog-search.ts`
- Create: `lib/ai/apu-context-builder.ts`
- Test: `lib/ai/catalog-search.test.ts`
- Test: `lib/ai/apu-context-builder.test.ts`

- [ ] Write failing tests for normalized keyword similarity, top-k partida retrieval, top-k resource retrieval, and compact context shape.
- [ ] Implement token normalization, deterministic scoring, and compact serializable context with top 5 partidas and top 30 resources.
- [ ] Run `npm run test -- lib/ai/catalog-search.test.ts lib/ai/apu-context-builder.test.ts`.

### Task 2: Structured Proposal Schema And Validator

**Files:**
- Modify: `lib/ai/types.ts`
- Modify: `lib/ai/structured-output.ts`
- Create: `lib/ai/apu-validator.ts`
- Test: `lib/ai/apu-validator.test.ts`

- [ ] Write failing tests proving generated resources must exist in the catalog and units must match exactly.
- [ ] Add structured proposal types and Zod schema for catalog-backed APU output.
- [ ] Implement validation warnings for missing IDs, unit mismatch, duplicates, suspicious quantities, low confidence, and missing resources.
- [ ] Run `npm run test -- lib/ai/apu-validator.test.ts`.

### Task 3: Generator And API Route

**Files:**
- Create: `lib/ai/apu-generator.ts`
- Modify: `lib/ai/prompts.ts`
- Create: `app/api/ai/apu/generate/route.ts`
- Test: `lib/ai/apu-generator.test.ts`

- [ ] Write failing tests for prompt context, model call dependency injection, and validated response shape.
- [ ] Implement `generateCatalogBackedApuProposal` with injectable catalog data and AI response generator.
- [ ] Add a route handler that authenticates the session, loads user resources, builds context, calls the generator, and returns the editable proposal.
- [ ] Run `npm run test -- lib/ai/apu-generator.test.ts`.

### Task 4: UI Integration

**Files:**
- Modify: `lib/ai/apu-suggestion.ts`
- Modify: `components/partidas/partida-apu-sheet.tsx`
- Modify: `components/apu/apu-editor-sheet.tsx`
- Test: `lib/ai/apu-suggestion.test.ts`

- [ ] Write failing tests that convert catalog-backed proposals into editable APU rows without inventing resources.
- [ ] Update both APU editors to call `/api/ai/apu/generate`, show similar partidas and validation warnings, and apply only catalog-backed rows.
- [ ] Keep manual review and user apply behavior unchanged.
- [ ] Run `npm run test -- lib/ai/apu-suggestion.test.ts`.

### Task 5: Verification

**Files:**
- No new files.

- [ ] Run targeted AI/APU tests.
- [ ] Run `npm run lint`.
- [ ] Run `npm run test`.
- [ ] Run `node ./node_modules/next/dist/bin/next build`.
