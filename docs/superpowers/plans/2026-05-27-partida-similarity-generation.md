# Partida Similarity Generation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement deterministic semi-manual partida generation by similarity for MYC Presupuestos.

**Architecture:** Pure TypeScript services in `lib/partida-generation` calculate variables, similarity, aggregation, and price matching. Next.js route handlers expose search, aggregate, and save endpoints backed by Prisma/PostgreSQL. A client sheet in `components/partidas` lets users review all candidates and suggested insumos before saving.

**Tech Stack:** Next.js App Router, TypeScript strict mode, Prisma/PostgreSQL, decimal.js, Vitest, Tailwind CSS.

---

### Task 1: Domain Engine

**Files:**
- Create: `types/partida-generation.ts`
- Create: `lib/partida-generation/text.ts`
- Create: `lib/partida-generation/variables.ts`
- Create: `lib/partida-generation/similarity.ts`
- Create: `lib/partida-generation/aggregation.ts`
- Test: `lib/partida-generation/variables.test.ts`
- Test: `lib/partida-generation/similarity.test.ts`
- Test: `lib/partida-generation/aggregation.test.ts`

- [ ] Write failing tests for extraction, ranking, quantity stats, confidence bands, and catalog-only prices.
- [ ] Implement the smallest deterministic services that pass.
- [ ] Keep all quantity and money math decimal-safe.

### Task 2: Persistence And API

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260527153000_add_partida_similarity_generation/migration.sql`
- Create: `lib/validations/partida-generation.ts`
- Create: `lib/data/partida-generation.ts`
- Create: `app/api/partidas/similarity/search/route.ts`
- Create: `app/api/partidas/similarity/aggregate/route.ts`
- Create: `app/api/partidas/similarity/save/route.ts`
- Test: `lib/data/partida-generation.test.ts`

- [ ] Add traceability tables and indexes.
- [ ] Validate all API payloads with Zod.
- [ ] Save only reviewed partidas and traceability.

### Task 3: Review UI

**Files:**
- Create: `components/partidas/partida-similarity-generator-sheet.tsx`
- Modify: `components/partidas/partidas-table.tsx`

- [ ] Add the catalog action to open the generator.
- [ ] Build search, candidate selection, aggregation, editable review, and save states.
- [ ] Ensure generated rows are still unsaved until explicit confirmation.

### Task 4: Verification

**Commands:**
- `npm run test -- lib/partida-generation/variables.test.ts lib/partida-generation/similarity.test.ts lib/partida-generation/aggregation.test.ts`
- `npm run test`
- `npm run lint`
- `node ./node_modules/next/dist/bin/next build`

- [ ] Run focused red/green tests.
- [ ] Run full test, lint, and build verification.
