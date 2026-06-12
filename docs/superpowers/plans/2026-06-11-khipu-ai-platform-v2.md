# Khipu AI Platform V2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Evolve Khipu from Ollama-first AI endpoints into a multi-provider construction-cost copilot with a single gateway, mandatory context, project memory, provider quality feedback, and skill-based task routing.

**Architecture:** Keep existing routes working while moving all AI execution behind `POST /api/ai/execute` and a reusable `executeAiTask()` service. Context assembly becomes mandatory before every model call and combines project context, history, project memory, retrieval evidence, and the user request. Providers are adapters behind a gateway contract, so Ollama, ChatGPT Bridge, OpenAI, and Gemini can be routed or replaced without leaking provider details into UI/routes.

**Tech Stack:** Next.js App Router, TypeScript strict mode, Prisma/PostgreSQL, Zod, Vitest, existing Ollama/Bridge code, direct `fetch` adapters for OpenAI and Gemini, Decimal-safe calculations where cost/risk math is added later.

---

## Scope And Sequencing

The PRD covers several independent subsystems. Implement it as six releases instead of one large branch:

1. **V2.1 Quality Feedback System:** Finish the already-started metrics layer and align it with PRD terminology.
2. **V2.2 Project Memory:** Add persistent project memory and include it in prompts.
3. **V2.3 Mandatory Context Builder:** Centralize project context, history, memory, retrieval evidence, and request payload.
4. **V2.4 AI Gateway + OpenAI Provider:** Add `/api/ai/execute`, provider routing, and OpenAI.
5. **V2.5 Gemini Provider + Fallbacks:** Add Gemini and end-to-end fallback behavior.
6. **V2.6 Skill Engine:** Route official tasks through domain skills. Leave Monte Carlo assistant as V3 because the schema already has risk simulation primitives and the PRD labels it roadmap work.

## Current Baseline

Already present:

- UI: `app/ai/page.tsx`, `components/ai/AIWorkspace.tsx`, `components/ai/ContextSidebar.tsx`
- Routes: `app/api/ai/chat`, `chat/stream`, `apu`, `apu/generate`, `review`, `autocomplete`, `health`
- Runtime: `lib/ai/service.ts`, `lib/ai/runtime.ts`, `lib/ai/models.ts`, `lib/ai/ollama.ts`
- Prompts/payloads: `lib/ai/prompts.ts`, `lib/ai/task-payloads.ts`, `lib/ai/structured-output.ts`, `lib/ai/validation.ts`
- Context/retrieval/history: `lib/ai/context-builder.ts`, `lib/ai/retrieval-context.ts`, `lib/ai/project-history.ts`, `lib/ai/project-history-route.ts`
- Catalog-backed APU: `lib/ai/apu-generator.ts`, `lib/ai/catalog-search.ts`
- Feedback in progress: `lib/ai/suggestion-feedback.ts`, project feedback routes/tests
- Prisma models already include `AiProjectHistoryEntry`, `AiSuggestionFeedbackEvent`, risk variables/runs, generated partidas, catalog partidas/resources.

## File Map

Create:

- `app/api/ai/execute/route.ts` - canonical AI execution endpoint.
- `app/api/ai/execute/route.test.ts` - route contract tests.
- `lib/ai/gateway/types.ts` - provider/task/context/result contracts.
- `lib/ai/gateway/router.ts` - `provider: "auto"` routing and fallback chain.
- `lib/ai/gateway/execute.ts` - `executeAiTask()` orchestration.
- `lib/ai/gateway/providers/ollama-provider.ts` - adapter over existing Ollama service functions.
- `lib/ai/gateway/providers/openai-provider.ts` - OpenAI Responses API adapter via `fetch`.
- `lib/ai/gateway/providers/gemini-provider.ts` - Gemini adapter via `fetch`.
- `lib/ai/gateway/providers/bridge-provider.ts` - explicit server-side unsupported/manual bridge result contract, with UI bridge staying client-side.
- `lib/ai/gateway/hash.ts` - stable prompt/response hashes for feedback.
- `lib/ai/context/project-context.ts` - project/budget/APU context loading owned by current user.
- `lib/ai/context/project-memory.ts` - CRUD/query helpers for memory facts.
- `lib/ai/context/assembled-context.ts` - mandatory context builder.
- `lib/ai/context/assembled-context.test.ts`
- `lib/ai/project-memory.test.ts`
- `app/api/projects/[id]/ai-memory/route.ts` - list/create memory facts.
- `app/api/projects/[id]/ai-memory/[memoryId]/route.ts` - update/delete memory facts if UI needs curation.
- `app/api/projects/[id]/ai-memory/route.test.ts`
- `lib/ai/skills/types.ts`
- `lib/ai/skills/registry.ts`
- `lib/ai/skills/skill-apu.ts`
- `lib/ai/skills/skill-budget.ts`
- `lib/ai/skills/skill-metrados.ts`
- `lib/ai/skills/skill-formula-polinomica.ts`
- `lib/ai/skills/skill-risk.ts`
- `lib/ai/skills/skill-catalog.ts`
- `lib/ai/skills/registry.test.ts`

Modify:

- `prisma/schema.prisma` - add memory model and feedback V2 fields/model.
- `lib/ai/types.ts` - expand official task/provider/result types.
- `lib/ai/task-payloads.ts` - map PRD task names to payload contracts.
- `lib/ai/validation.ts` - add execute/memory schemas.
- `lib/ai/prompts.ts` - accept assembled context blocks instead of optional evidence only.
- `lib/ai/service.ts` - keep as compatibility layer or delegate to gateway.
- `lib/ai/runtime.ts` - report provider health, not only Ollama health.
- `lib/ai/usage.ts` - record provider/model from gateway results.
- `lib/ai/project-history.ts` - store provider/task metadata if not already available through result.
- `lib/ai/suggestion-feedback.ts` - compute acceptance/edit/discard/provider quality metrics from V2 feedback.
- Existing AI routes - call `executeAiTask()` or `/api/ai/execute` internally while preserving request/response shapes.
- `components/ai/AIWorkspace.tsx` - optionally move new actions to `/api/ai/execute` once backend compatibility is green.
- Existing tests under `lib/ai/*.test.ts`, `app/api/ai/**/*.test.ts`, `components/ai/*.test.ts`.

---

### Task 1: Normalize Official Task And Provider Contracts

**Files:**
- Create: `lib/ai/gateway/types.ts`
- Modify: `lib/ai/types.ts`
- Modify: `lib/ai/task-payloads.ts`
- Modify: `lib/ai/validation.ts`
- Test: `lib/ai/task-payloads.test.ts`

- [ ] **Step 1: Define canonical PRD enums and contracts**

Add provider/task types that include:

```ts
export type AiProviderId = "auto" | "ollama" | "chatgpt_bridge" | "openai" | "gemini";

export type KhipuAiTask =
  | "review_apu"
  | "generate_apu"
  | "suggest_insumos"
  | "review_budget"
  | "generate_partida"
  | "review_formula_polinomica"
  | "review_quantity_takeoff"
  | "montecarlo_risk_analysis"
  | "chat"
  | "autocomplete";
```

The gateway request shape should be:

```ts
export type ExecuteAiTaskInput = {
  provider: AiProviderId;
  task: KhipuAiTask;
  payload: Record<string, unknown>;
  projectId?: string;
  userId: string;
  stream?: boolean;
};
```

- [ ] **Step 2: Add Zod schema for `/api/ai/execute`**

Extend `lib/ai/validation.ts` with `aiExecuteRequestSchema`:

```ts
export const aiExecuteRequestSchema = z.object({
  provider: z.enum(["auto", "ollama", "chatgpt_bridge", "openai", "gemini"]).default("auto"),
  task: z.enum([
    "review_apu",
    "generate_apu",
    "suggest_insumos",
    "review_budget",
    "generate_partida",
    "review_formula_polinomica",
    "review_quantity_takeoff",
    "montecarlo_risk_analysis",
    "chat",
    "autocomplete",
  ]),
  payload: z.record(z.string(), z.unknown()).default({}),
  projectId: projectIdSchema,
});
```

- [ ] **Step 3: Keep legacy action mapping**

Update `lib/ai/task-payloads.ts` so old actions map to official tasks:

```ts
const LEGACY_ACTION_TO_TASK = {
  chat: "chat",
  apu: "generate_apu",
  review: "review_budget",
  autocomplete: "autocomplete",
} as const;
```

Also add a payload builder that accepts `KhipuAiTask` directly.

- [ ] **Step 4: Run focused tests**

Run:

```bash
npm run test -- lib/ai/task-payloads.test.ts
```

Expected: existing tests pass after updating expected task names where needed.

---

### Task 2: Add Project Memory Persistence

**Files:**
- Modify: `prisma/schema.prisma`
- Create: Prisma migration via `npm run prisma:migrate`
- Create: `lib/ai/context/project-memory.ts`
- Create: `lib/ai/project-memory.test.ts`
- Create: `app/api/projects/[id]/ai-memory/route.ts`
- Create: `app/api/projects/[id]/ai-memory/route.test.ts`

- [ ] **Step 1: Add Prisma model**

Add:

```prisma
enum AiProjectMemoryType {
  FACT
  PREFERENCE
  CONSTRAINT
  ASSUMPTION
}

model AiProjectMemory {
  id         String              @id @default(cuid())
  projectId  String
  memoryType AiProjectMemoryType @default(FACT)
  fact       String
  confidence Decimal             @default(0.8) @db.Decimal(4, 3)
  source     String
  createdAt  DateTime            @default(now())
  updatedAt  DateTime            @updatedAt
  project    Project             @relation(fields: [projectId], references: [id], onDelete: Cascade)

  @@index([projectId, createdAt(sort: Desc)])
  @@index([memoryType])
  @@map("project_ai_memory")
}
```

Add `aiMemory AiProjectMemory[]` to `Project`.

- [ ] **Step 2: Generate migration**

Run:

```bash
npm run prisma:migrate -- --name add-khipu-project-memory
```

Expected: migration creates `project_ai_memory` and the enum.

- [ ] **Step 3: Implement memory service**

Implement ownership-aware helpers:

```ts
export async function getProjectAiMemory({ projectId, userId, limit = 12 }: {
  projectId: string;
  userId: string;
  limit?: number;
}): Promise<ProjectAiMemoryFact[]> { ... }

export async function recordProjectAiMemory(input: {
  projectId: string;
  userId: string;
  memoryType: "FACT" | "PREFERENCE" | "CONSTRAINT" | "ASSUMPTION";
  fact: string;
  confidence?: string;
  source: string;
}): Promise<ProjectAiMemoryFact | null> { ... }
```

Use Prisma `Decimal` or string serialization for confidence. Do not use `number` for stored confidence math.

- [ ] **Step 4: Test ownership and formatting**

Tests should verify:

- User only reads memory for owned projects.
- Empty project returns `[]`.
- Long facts are trimmed to a defined limit, for example 500 chars.
- Confidence serializes as a string with 3 decimals.

- [ ] **Step 5: Add memory API**

`GET /api/projects/[id]/ai-memory` returns facts. `POST` creates a fact:

```json
{
  "memoryType": "FACT",
  "fact": "Proyecto utiliza excavadora CAT 320",
  "confidence": "0.850",
  "source": "user"
}
```

---

### Task 3: Build Mandatory Assembled Context

**Files:**
- Create: `lib/ai/context/project-context.ts`
- Create: `lib/ai/context/assembled-context.ts`
- Create: `lib/ai/context/assembled-context.test.ts`
- Modify: `lib/ai/prompts.ts`
- Modify: `lib/ai/retrieval-context.ts`

- [ ] **Step 1: Create context shape**

Define:

```ts
export type KhipuAssembledContext = {
  projectContext: string;
  projectHistory: AiProjectHistoryEntry[];
  projectMemory: ProjectAiMemoryFact[];
  retrievalEvidence: AiEvidence[];
  userRequest: {
    task: KhipuAiTask;
    payload: Record<string, unknown>;
  };
};
```

- [ ] **Step 2: Load all context for project-bound calls**

`buildKhipuAssembledContext()` must always call:

1. `getProjectContextSummary()`
2. `getAiProjectHistory()`
3. `getProjectAiMemory()`
4. `buildAiRetrievalEvidence()`

If `projectId` is absent, return empty project/history/memory sections but still include retrieval evidence for payload text where possible.

- [ ] **Step 3: Format one prompt block**

Add:

```ts
export function formatAssembledContextBlock(context: KhipuAssembledContext): string
```

Sections should be stable and testable:

- `Contexto del proyecto`
- `Historial reciente`
- `Memoria del proyecto`
- `Fuentes consultadas`
- `Solicitud del usuario`

- [ ] **Step 4: Update prompt builders**

Change `buildChatMessages()` and `buildTaskPayloadMessages()` so they accept either legacy `context/evidence` or a preformatted `assembledContextBlock`. During compatibility phase, existing routes can still pass legacy data.

- [ ] **Step 5: Test mandatory retrieval**

Add tests proving `buildKhipuAssembledContext()` includes retrieval evidence even when route callers omit `evidence`.

---

### Task 4: Implement Gateway Router And Ollama Adapter

**Files:**
- Create: `lib/ai/gateway/router.ts`
- Create: `lib/ai/gateway/providers/ollama-provider.ts`
- Create: `lib/ai/gateway/execute.ts`
- Create: `lib/ai/gateway/hash.ts`
- Test: `lib/ai/gateway/router.test.ts`
- Test: `lib/ai/gateway/execute.test.ts`

- [ ] **Step 1: Implement auto routing**

Rules from PRD:

```ts
const AUTO_PROVIDER_BY_TASK: Record<KhipuAiTask, AiProviderId> = {
  autocomplete: "ollama",
  review_apu: "openai",
  review_budget: "openai",
  generate_apu: "openai",
  generate_partida: "openai",
  suggest_insumos: "ollama",
  review_formula_polinomica: "openai",
  review_quantity_takeoff: "openai",
  montecarlo_risk_analysis: "gemini",
  chat: process.env.NODE_ENV === "development" ? "chatgpt_bridge" : "openai",
};
```

Fallback chain:

```ts
["openai", "gemini", "ollama"]
```

For `chatgpt_bridge`, server routes should not silently depend on a browser extension. In server execution, route `chatgpt_bridge` to a clear `AiRuntimeError("unsupported_provider")` unless the request comes from a client-side bridge flow.

- [ ] **Step 2: Wrap Ollama provider**

Adapter returns:

```ts
{
  answer,
  provider: "ollama",
  model,
  requestedModel,
  fallbackUsed,
  warnings,
  latencyMs,
  structuredData,
  promptHash,
  responseHash
}
```

Reuse `askOllama`, `streamOllamaChat`, structured repair, and existing token accounting behavior.

- [ ] **Step 3: Add stable hashes**

Use Node `crypto`:

```ts
createHash("sha256").update(stableJson(value)).digest("hex")
```

`stableJson` must sort object keys recursively so hashes are deterministic in tests.

- [ ] **Step 4: Test router behavior**

Tests:

- `provider: "auto", task: "autocomplete"` resolves Ollama.
- `provider: "auto", task: "review_budget"` resolves OpenAI.
- OpenAI failure falls back to Gemini, then Ollama.
- Explicit `provider: "ollama"` does not fall back to OpenAI/Gemini.

---

### Task 5: Add `/api/ai/execute` And Preserve Legacy Routes

**Files:**
- Create: `app/api/ai/execute/route.ts`
- Create: `app/api/ai/execute/route.test.ts`
- Modify: `app/api/ai/chat/route.ts`
- Modify: `app/api/ai/chat/stream/route.ts`
- Modify: `app/api/ai/apu/route.ts`
- Modify: `app/api/ai/review/route.ts`
- Modify: `app/api/ai/autocomplete/route.ts`

- [ ] **Step 1: Add canonical endpoint**

The route:

1. Uses `withAiRoute`.
2. Parses `aiExecuteRequestSchema`.
3. Calls `executeAiTask()`.
4. Records project history when `projectId` is present.
5. Returns the gateway result.

- [ ] **Step 2: Keep existing endpoints as compatibility wrappers**

Existing routes should call `executeAiTask()` with equivalent official task names:

- `chat` -> `chat`
- `apu` -> `generate_apu`
- `review` -> `review_budget`
- `autocomplete` -> `autocomplete`

Preserve current response shapes so `AIWorkspace` tests do not need a large rewrite.

- [ ] **Step 3: Streaming route**

Keep `chat/stream` on Ollama first for now. Add a follow-up note in the code only if needed: streaming multi-provider support should be a later task once OpenAI/Gemini adapters are stable.

- [ ] **Step 4: Route tests**

Add tests for:

- Unauthorized requests return 401 through existing wrapper behavior.
- Invalid task returns 400.
- Valid `review_budget` delegates to gateway.
- Legacy `/api/ai/review` returns the same top-level fields as before.

---

### Task 6: Implement OpenAI Provider

**Files:**
- Create: `lib/ai/gateway/providers/openai-provider.ts`
- Test: `lib/ai/gateway/providers/openai-provider.test.ts`
- Modify: `.env.example` if present
- Modify: `lib/ai/runtime.ts`

- [ ] **Step 1: Read official docs before coding**

Because this project uses modern Next.js and the OpenAI API changes over time, read the local Next guide in `node_modules/next/dist/docs/` relevant to route handlers before editing route code. For OpenAI API details, use official OpenAI docs only.

- [ ] **Step 2: Add provider adapter**

Use `fetch` directly to avoid a new dependency. Initial config:

```ts
const OPENAI_MODELS = {
  default: "gpt-5",
  mini: "gpt-5-mini",
} as const;
```

Inputs:

- `OPENAI_API_KEY`
- optional `OPENAI_MODEL`

If the key is missing, throw an `AiRuntimeError` that lets the gateway try the next fallback provider for `auto`.

- [ ] **Step 3: Preserve structured output flow**

For JSON tasks, request JSON output and validate through existing Zod schemas. Keep repair behavior provider-neutral where possible.

- [ ] **Step 4: Record usage**

If token usage is returned by the provider, store actual tokens. Otherwise keep current estimate fallback.

- [ ] **Step 5: Tests**

Mock `fetch` and test:

- Missing API key creates provider-unavailable error.
- Successful response maps answer/model/provider.
- Non-2xx response fails with status details but does not expose API keys.
- JSON response passes through structured parser.

---

### Task 7: Implement Gemini Provider

**Files:**
- Create: `lib/ai/gateway/providers/gemini-provider.ts`
- Test: `lib/ai/gateway/providers/gemini-provider.test.ts`
- Modify: `.env.example` if present
- Modify: `lib/ai/runtime.ts`

- [ ] **Step 1: Add provider adapter**

Use `fetch` directly. Initial config:

```ts
const GEMINI_MODELS = {
  pro: "gemini-2.5-pro",
  flash: "gemini-2.5-flash",
} as const;
```

Inputs:

- `GEMINI_API_KEY`
- optional `GEMINI_MODEL`

- [ ] **Step 2: Route long document tasks**

`review_quantity_takeoff`, `montecarlo_risk_analysis`, and large payloads should prefer Gemini when `provider` is `auto`.

- [ ] **Step 3: Tests**

Mock `fetch` and verify:

- Missing key falls back in auto mode.
- Gemini response maps into the same `AiEndpointResult` contract.
- Large payload routing resolves Gemini.

---

### Task 8: Upgrade Quality Feedback To V2 Metrics

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `lib/ai/suggestion-feedback.ts`
- Modify: `app/api/projects/[id]/ai-feedback/summary/route.ts`
- Modify: `app/api/projects/[id]/ai-feedback/latest/route.ts`
- Modify: `app/api/projects/[id]/ai-history/[historyEntryId]/feedback/route.ts`
- Test: existing feedback route/service tests

- [ ] **Step 1: Choose migration approach**

Prefer evolving the existing feedback service without breaking current UI. Add canonical fields required by the PRD:

```prisma
provider       String?
model          String?
task           String?
suggestionType String?
actionType     String?
promptHash     String?
responseHash   String?
```

Keep existing `feedbackType` for compatibility. Map:

- `APPLIED` -> `Applied`
- `EDITED` -> `Edited`
- `DISMISSED` -> `Discarded`

- [ ] **Step 2: Compute metrics**

Summary should return:

```ts
{
  applied,
  edited,
  discarded,
  total,
  acceptanceRate,
  editRate,
  discardRate,
  providerQuality: [
    { provider: "openai", total: 10, acceptanceRate: "0.700" }
  ]
}
```

Use 3-decimal string rates for stable display and tests.

- [ ] **Step 3: Attach hashes/provider metadata**

When recording feedback for a history entry, copy provider/model/task/hash metadata from the history/gateway result. If older entries lack hashes, compute `responseHash` from `answer` and leave `promptHash` null.

- [ ] **Step 4: Tests**

Update tests to cover applied/edit/discard rates and provider comparison.

---

### Task 9: Implement Skill Engine Registry

**Files:**
- Create: `lib/ai/skills/types.ts`
- Create: `lib/ai/skills/registry.ts`
- Create: skill files listed in File Map
- Create: `lib/ai/skills/registry.test.ts`
- Modify: `lib/ai/gateway/execute.ts`

- [ ] **Step 1: Define skill contract**

```ts
export type KhipuSkill = {
  id: "skill-apu" | "skill-budget" | "skill-metrados" | "skill-formula-polinomica" | "skill-risk" | "skill-catalog";
  tasks: KhipuAiTask[];
  buildMessages(input: SkillMessageInput): AiMessage[];
  schema?: z.ZodType<unknown>;
};
```

- [ ] **Step 2: Register official tasks**

Mapping:

- `skill-apu`: `review_apu`, `generate_apu`
- `skill-budget`: `review_budget`
- `skill-metrados`: `review_quantity_takeoff`
- `skill-formula-polinomica`: `review_formula_polinomica`
- `skill-risk`: `montecarlo_risk_analysis`
- `skill-catalog`: `suggest_insumos`, `generate_partida`
- `chat` and `autocomplete` use lightweight default skills.

- [ ] **Step 3: Enforce catalog rule**

In `skill-catalog`, prompt and backend validation must require:

1. Search similar partidas.
2. Search similar insumos.
3. Score candidates.
4. Propose existing resources.
5. Only create suggested-new-resource entries when no match exists.

Reuse `lib/ai/apu-generator.ts` and `lib/ai/catalog-search.ts` instead of duplicating scoring logic.

- [ ] **Step 4: Tests**

Verify each official task resolves a skill and that unknown task names are rejected by validation before registry lookup.

---

### Task 10: Health, Settings, And UI Integration

**Files:**
- Modify: `lib/ai/runtime.ts`
- Modify: `app/api/ai/health/route.ts`
- Modify: `app/api/ai/health/route.test.ts`
- Modify: `components/settings/local-ai-settings-card.tsx`
- Modify: `components/ai/AIWorkspace.tsx`
- Modify: matching component tests

- [ ] **Step 1: Provider health**

Report:

- Ollama reachable/models.
- OpenAI configured/not configured.
- Gemini configured/not configured.
- Bridge client state remains UI-only.
- Current auto-route table.

- [ ] **Step 2: Workspace execution**

Move non-stream actions to `/api/ai/execute` once route tests are green. Keep streaming chat on `/api/ai/chat/stream` until multi-provider streaming is explicitly implemented.

- [ ] **Step 3: Feedback UI**

Ensure Applied/Edited/Discarded actions still work and summary cards use V2 rates. Do not add large marketing-style panels; keep the workspace technical and compact.

---

### Task 11: V3 Monte Carlo Assistant Preparation

**Files:**
- Modify later: `lib/risk/*` or existing risk simulation modules
- Modify later: `lib/ai/skills/skill-risk.ts`

- [ ] **Step 1: Keep V2 risk skill advisory**

For V2.6, `montecarlo_risk_analysis` should explain available variables and missing data but not invent simulation results.

- [ ] **Step 2: V3 implementation boundary**

Implement actual P50/P80/P90/costo esperado/histogramas only after confirming existing risk calculation services. All financial/risk calculations must use decimal-safe math and existing risk tables.

---

## Verification Commands

Run focused tests after each task:

```bash
npm run test -- lib/ai/task-payloads.test.ts
npm run test -- lib/ai/context/assembled-context.test.ts
npm run test -- lib/ai/gateway/router.test.ts
npm run test -- lib/ai/gateway/execute.test.ts
npm run test -- app/api/ai/execute/route.test.ts
npm run test -- app/api/projects/[id]/ai-memory/route.test.ts
npm run test -- app/api/projects/[id]/ai-feedback/summary/route.test.ts
```

Before merging each release:

```bash
npm run test
npm run lint
```

For route-handler edits, read the relevant local Next.js docs under:

```text
node_modules/next/dist/docs/
```

## Release Acceptance Criteria

V2.1:

- Feedback summary exposes applied/edit/discard rates and provider quality.
- Existing feedback UI/tests still pass.

V2.2:

- Project memory can be created/listed only by the project owner.
- Memory facts appear in assembled AI context.

V2.3:

- Every non-health AI execution path builds assembled context before provider call.
- Retrieval evidence is no longer optional at the gateway layer.

V2.4:

- `/api/ai/execute` works with `provider: "auto"`.
- OpenAI provider is available when `OPENAI_API_KEY` is configured.
- Existing `/api/ai/*` routes remain compatible.

V2.5:

- Gemini provider works when `GEMINI_API_KEY` is configured.
- Auto fallback order is OpenAI -> Gemini -> Ollama.

V2.6:

- Every official PRD task resolves through a skill.
- Catalog intelligence uses existing resources first and marks new resources as suggestions only.

## Open Decisions

- Whether ChatGPT Bridge should remain a client-only development tool or receive a server-side queue. The current bridge is browser-event based, so server `/api/ai/execute` should not pretend it can call it directly.
- Whether to rename existing `AiSuggestionFeedbackEvent` table to `khipu_suggestion_feedback` or keep it and add V2 fields. Keeping the existing table is lower risk for current routes; a rename is cleaner but requires careful migration/backfill.
- Which exact OpenAI/Gemini API versions/models are approved for production. Confirm against official docs at implementation time.
