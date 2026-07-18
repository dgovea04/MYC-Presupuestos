# Khipu Risk Agent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build auditable Monte Carlo risk scenarios, automatic risk variable suggestions, and Khipu agent tools that save and execute simulations only after user confirmation.

**Architecture:** Keep the current risk engine and UI intact while adding focused services around it: deterministic suggestions, scenario persistence, server-authoritative simulation execution, and agent tools. Khipu reads and suggests freely, but all financial writes go through existing approval policy.

**Tech Stack:** Next.js App Router, TypeScript strict mode, Prisma/PostgreSQL, Zod, Vitest, React Testing Library, decimal.js, existing Khipu agent tool registry.

## Global Constraints

- Use TypeScript strict mode.
- Never use `any` in new code.
- Financial calculations must use decimal-safe math.
- Keep calculation logic isolated from UI.
- All formulas must be testable.
- Prefer reusable services.
- Use clean architecture.
- Khipu may not save variables, correlations, scenarios, or simulation runs without explicit confirmation.
- Khipu may not invent P50, P80, P90, histograms, or schedule duration percentiles.
- Do not replace the current risk architecture without reason.

---

## File Structure

- Modify `types/risk.ts`: add scenario, suggestion, seed, snapshot, and tool-facing types.
- Modify `prisma/schema.prisma`: add risk scenario model and audit fields.
- Create `prisma/migrations/<timestamp>_add_risk_scenarios_and_run_audit/migration.sql`: database migration.
- Modify `lib/validations/risk.ts`: add scenario, suggestion, and run request schemas.
- Modify `lib/risk/monte-carlo-engine.ts`: add seeded randomness support without changing existing default behavior.
- Modify `lib/risk/statistics.ts`: centralize decimal-safe summary rounding helpers.
- Create `lib/risk/suggestions.ts`: deterministic variable suggestion service.
- Create `lib/risk/scenarios.ts`: scenario persistence and normalization service.
- Create `lib/risk/simulation-service.ts`: server-side authoritative simulation runner.
- Modify `lib/risk/data.ts`: read scenario-aware risk payloads and serialize new fields.
- Create API routes under `app/api/budgets/[id]/risk-analysis/scenarios/` and `app/api/budgets/[id]/risk-analysis/suggestions/`.
- Modify `components/risk/risk-analysis-dashboard.tsx`: wire suggestion review panel.
- Create `components/risk/risk-suggestions-panel.tsx`: review, edit, accept, reject, save, run.
- Create `lib/ai/agent/tools/risk.ts`: Khipu risk tools.
- Modify `lib/ai/agent/tools/index.ts`: export/register risk tools.
- Modify `lib/ai/agent/tool-metadata.ts`: expose risk tools in UI.
- Modify `lib/ai/agent/workflows.ts`: add risk specialist bundle and workflow.
- Modify `lib/risk/pdf-report.ts`: include scenario and audit metadata.
- Modify `lib/mcp/serializers/risk.ts`: export scenario and snapshot metadata.

---

### Task 1: Risk Scenario And Audit Types

**Files:**
- Modify: `types/risk.ts`
- Modify: `lib/validations/risk.ts`
- Test: `app/api/budgets/[id]/risk-analysis/route.test.ts`

**Interfaces:**
- Produces: `RiskScenarioRecord`, `RiskVariableSuggestion`, `RiskSimulationModelSnapshot`, `RiskSimulationRunRequest`
- Consumes: existing `RiskVariableRecord`, `RiskCorrelationRecord`, `RiskSimulationSummary`

- [ ] **Step 1: Add failing validation tests**

Add tests that parse a valid risk variable suggestion and reject invalid ranges:

```ts
import { riskVariableSuggestionSchema } from "@/lib/validations/risk";

it("validates a risk variable suggestion", () => {
  const parsed = riskVariableSuggestionSchema.parse({
    id: "suggestion-1",
    budgetId: "budget-1",
    budgetItemId: "item-1",
    variableType: "QUANTITY",
    distributionType: "PERT",
    minimum: 9.5,
    mostLikely: 10,
    maximum: 11,
    confidence: 0.82,
    reason: "Partida de alto impacto con metrado sensible.",
    source: "HEURISTIC",
    impactScore: 1200,
  });

  expect(parsed.confidence).toBe(0.82);
});

it("rejects a risk variable suggestion with inverted range", () => {
  expect(() =>
    riskVariableSuggestionSchema.parse({
      id: "suggestion-1",
      budgetId: "budget-1",
      budgetItemId: "item-1",
      variableType: "QUANTITY",
      distributionType: "PERT",
      minimum: 12,
      mostLikely: 10,
      maximum: 11,
      confidence: 0.82,
      reason: "Rango invalido.",
      source: "HEURISTIC",
      impactScore: 1200,
    }),
  ).toThrow();
});
```

- [ ] **Step 2: Run tests and verify failure**

Run: `npm run test -- app/api/budgets/[id]/risk-analysis/route.test.ts`

Expected: FAIL because `riskVariableSuggestionSchema` is not exported.

- [ ] **Step 3: Add shared risk types**

Add to `types/risk.ts`:

```ts
export type RiskScenarioSource = "MANUAL" | "AGENT";
export type RiskScenarioStatus = "DRAFT" | "APPROVED" | "ARCHIVED";
export type RiskInputSource = "MANUAL" | "AGENT" | "HEURISTIC";
export type RiskSuggestionStrategy = "balanced" | "conservative" | "aggressive";

export type RiskScenarioRecord = {
  id: string;
  budgetId: string;
  name: string;
  description: string | null;
  source: RiskScenarioSource;
  status: RiskScenarioStatus;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
};

export type RiskVariableSuggestion = {
  id: string;
  budgetId: string;
  budgetItemId: string;
  variableType: RiskVariableType;
  distributionType: RiskDistributionType;
  minimum: number;
  mostLikely: number;
  maximum: number;
  confidence: number;
  reason: string;
  source: "HEURISTIC" | "AGENT";
  impactScore: number;
};

export type RiskSimulationModelSnapshot = {
  budgetId: string;
  scenarioId: string | null;
  baseTotal: number;
  iterations: number;
  seed: string;
  engineVersion: string;
  itemIds: string[];
  variableIds: string[];
  correlationIds: string[];
  createdAt: string;
};

export type RiskSimulationRunRequest = {
  budgetId: string;
  scenarioId?: string;
  seed?: string;
};
```

Extend `RiskVariableRecord` and `RiskCorrelationRecord` with optional source metadata:

```ts
scenarioId?: string | null;
source?: RiskInputSource;
confidence?: number | null;
rationale?: string | null;
```

Extend `RiskSimulationSummary`:

```ts
scenarioId?: string | null;
seed?: string | null;
engineVersion?: string | null;
modelSnapshot?: RiskSimulationModelSnapshot | null;
```

- [ ] **Step 4: Add Zod schemas**

Add to `lib/validations/risk.ts`:

```ts
export const riskInputSourceSchema = z.enum(["MANUAL", "AGENT", "HEURISTIC"]);
export const riskSuggestionStrategySchema = z.enum(["balanced", "conservative", "aggressive"]);

export const riskVariableSuggestionSchema = riskVariableInputSchema
  .omit({ delete: true })
  .extend({
    id: z.string().min(1),
    budgetId: z.string().min(1),
    confidence: z.number().finite().min(0).max(1),
    reason: z.string().min(1),
    source: z.enum(["HEURISTIC", "AGENT"]),
    impactScore: z.number().finite().nonnegative(),
  });

export const riskSimulationRunRequestSchema = z.object({
  budgetId: z.string().min(1),
  scenarioId: z.string().min(1).optional(),
  seed: z.string().min(1).optional(),
});
```

- [ ] **Step 5: Run tests and verify pass**

Run: `npm run test -- app/api/budgets/[id]/risk-analysis/route.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add types/risk.ts lib/validations/risk.ts app/api/budgets/[id]/risk-analysis/route.test.ts
git commit -m "feat: add risk scenario and suggestion contracts"
```

---

### Task 2: Prisma Scenario Persistence

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_add_risk_scenarios_and_run_audit/migration.sql`
- Test: `lib/risk/scenarios.test.ts`

**Interfaces:**
- Consumes: `RiskScenarioRecord`
- Produces: Prisma models `RiskScenario`, extended `RiskVariable`, `RiskCorrelation`, `RiskSimulationRun`

- [ ] **Step 1: Write failing persistence tests**

Create `lib/risk/scenarios.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { saveRiskScenario } from "@/lib/risk/scenarios";
import { prisma } from "@/lib/db/prisma";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    budget: { findFirst: vi.fn() },
    $transaction: vi.fn(),
  },
}));

describe("saveRiskScenario", () => {
  it("rejects inaccessible budgets", async () => {
    vi.mocked(prisma.budget.findFirst).mockResolvedValueOnce(null);

    await expect(
      saveRiskScenario("budget-1", "user-1", {
        name: "Escenario Khipu",
        description: "Riesgos sugeridos",
        variables: [],
        correlations: [],
      }),
    ).rejects.toThrow("No tienes permisos");
  });
});
```

- [ ] **Step 2: Run test and verify failure**

Run: `npm run test -- lib/risk/scenarios.test.ts`

Expected: FAIL because `lib/risk/scenarios.ts` does not exist.

- [ ] **Step 3: Extend Prisma schema**

Add enums near risk enums:

```prisma
enum RiskScenarioSource {
  MANUAL
  AGENT
}

enum RiskScenarioStatus {
  DRAFT
  APPROVED
  ARCHIVED
}

enum RiskInputSource {
  MANUAL
  AGENT
  HEURISTIC
}
```

Add model:

```prisma
model RiskScenario {
  id              String             @id @default(cuid())
  budgetId        String
  name            String
  description     String?
  source          RiskScenarioSource @default(MANUAL)
  status          RiskScenarioStatus @default(DRAFT)
  createdByUserId String
  createdAt       DateTime           @default(now())
  updatedAt       DateTime           @updatedAt
  budget          Budget             @relation(fields: [budgetId], references: [id], onDelete: Cascade)
  createdBy       User               @relation(fields: [createdByUserId], references: [id], onDelete: Cascade)
  variables       RiskVariable[]
  correlations    RiskCorrelation[]
  simulationRuns  RiskSimulationRun[]

  @@index([budgetId, updatedAt(sort: Desc)])
}
```

Extend existing models:

```prisma
scenarioId String?
source     RiskInputSource @default(MANUAL)
confidence Decimal? @db.Decimal(5, 4)
rationale  String?
scenario   RiskScenario? @relation(fields: [scenarioId], references: [id], onDelete: Cascade)
```

For `RiskSimulationRun`, add:

```prisma
scenarioId      String?
seed            String?
engineVersion   String?
modelSnapshot   Json?
createdByUserId String?
scenario        RiskScenario? @relation(fields: [scenarioId], references: [id], onDelete: SetNull)
createdBy       User? @relation(fields: [createdByUserId], references: [id], onDelete: SetNull)
```

Do not use a normal Prisma `@@unique([budgetId, scenarioId, budgetItemId, variableType])` for this rule. PostgreSQL allows multiple `NULL` values in unique indexes, so that would allow duplicate global variables where `scenarioId` is `NULL`.

Replace the current Prisma unique key with query indexes only:

```prisma
@@index([budgetId, budgetItemId, variableType])
@@index([budgetId, scenarioId, budgetItemId, variableType])
```

- [ ] **Step 4: Create SQL migration**

Create migration SQL matching the Prisma schema. Include:

```sql
CREATE TYPE "RiskScenarioSource" AS ENUM ('MANUAL', 'AGENT');
CREATE TYPE "RiskScenarioStatus" AS ENUM ('DRAFT', 'APPROVED', 'ARCHIVED');
CREATE TYPE "RiskInputSource" AS ENUM ('MANUAL', 'AGENT', 'HEURISTIC');
```

Create `RiskScenario`, add columns, drop the old unique index, and create two partial unique indexes:

```sql
DROP INDEX IF EXISTS "RiskVariable_budgetId_budgetItemId_variableType_key";

CREATE UNIQUE INDEX "RiskVariable_budget_global_unique"
ON "RiskVariable"("budgetId", "budgetItemId", "variableType")
WHERE "scenarioId" IS NULL;

CREATE UNIQUE INDEX "RiskVariable_budget_scenario_unique"
ON "RiskVariable"("budgetId", "scenarioId", "budgetItemId", "variableType")
WHERE "scenarioId" IS NOT NULL;
```

- [ ] **Step 5: Add minimal scenario service**

Create `lib/risk/scenarios.ts`:

```ts
import { prisma } from "@/lib/db/prisma";
import type { RiskCorrelationRecord, RiskVariableRecord } from "@/types/risk";

export type SaveRiskScenarioInput = {
  name: string;
  description?: string | null;
  variables: RiskVariableRecord[];
  correlations: RiskCorrelationRecord[];
};

export async function saveRiskScenario(
  budgetId: string,
  userId: string,
  input: SaveRiskScenarioInput,
) {
  const budget = await prisma.budget.findFirst({
    where: {
      id: budgetId,
      project: {
        company: {
          memberships: { some: { userId, status: "ACTIVE" } },
        },
      },
    },
    select: { id: true },
  });

  if (!budget) {
    throw new Error("No tienes permisos para guardar este escenario de riesgo.");
  }

  return prisma.$transaction(async (tx) => {
    const scenario = await tx.riskScenario.create({
      data: {
        budgetId,
        name: input.name,
        description: input.description ?? null,
        source: "AGENT",
        status: "APPROVED",
        createdByUserId: userId,
      },
    });

    return scenario;
  });
}
```

- [ ] **Step 6: Run tests**

Run: `npm run test -- lib/risk/scenarios.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add prisma/schema.prisma prisma/migrations lib/risk/scenarios.ts lib/risk/scenarios.test.ts
git commit -m "feat: add risk scenario persistence model"
```

---

### Task 3: Seeded Simulation And Snapshot Builder

**Files:**
- Modify: `lib/risk/monte-carlo-engine.ts`
- Create: `lib/risk/simulation-service.ts`
- Test: `lib/risk/monte-carlo-engine.test.ts`
- Test: `lib/risk/simulation-service.test.ts`

**Interfaces:**
- Produces: `createSeededRandom(seed: string): () => number`
- Produces: `buildRiskSimulationSnapshot(input): RiskSimulationModelSnapshot`
- Produces: `runAndSaveRiskSimulation(budgetId, userId, request): Promise<RiskSimulationSummary>`

- [ ] **Step 1: Add failing seeded simulation test**

Add to `lib/risk/monte-carlo-engine.test.ts`:

```ts
it("produces deterministic summaries when a seed is provided", () => {
  const input = createSimulationInput();
  const first = runMonteCarloSimulation(input, { seed: "risk-seed-1" });
  const second = runMonteCarloSimulation(input, { seed: "risk-seed-1" });

  expect(first.p80).toBe(second.p80);
  expect(first.histogramBins).toEqual(second.histogramBins);
});
```

- [ ] **Step 2: Run test and verify failure**

Run: `npm run test -- lib/risk/monte-carlo-engine.test.ts`

Expected: FAIL because `seed` is not part of options.

- [ ] **Step 3: Implement seeded random**

In `lib/risk/monte-carlo-engine.ts`, extend options:

```ts
export type MonteCarloSimulationOptions = {
  seed?: string;
  random?: () => number;
  onProgress?: (completedIterations: number, totalIterations: number) => void;
  progressInterval?: number;
  histogramBinCount?: number;
  sCurvePointCount?: number;
};
```

Add:

```ts
export function createSeededRandom(seed: string): () => number {
  let state = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    state ^= seed.charCodeAt(index);
    state = Math.imul(state, 16777619);
  }

  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}
```

Change random selection:

```ts
const random = options.random ?? (options.seed ? createSeededRandom(options.seed) : Math.random);
```

- [ ] **Step 4: Create snapshot tests**

Create `lib/risk/simulation-service.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildRiskSimulationSnapshot } from "@/lib/risk/simulation-service";

describe("buildRiskSimulationSnapshot", () => {
  it("captures ids and engine metadata for audit", () => {
    const snapshot = buildRiskSimulationSnapshot({
      budgetId: "budget-1",
      scenarioId: "scenario-1",
      baseTotal: 1000,
      iterations: 10000,
      seed: "seed-1",
      engineVersion: "risk-engine-v2",
      itemIds: ["item-1"],
      variableIds: ["risk-1"],
      correlationIds: ["corr-1"],
      createdAt: "2026-07-17T00:00:00.000Z",
    });

    expect(snapshot).toMatchObject({
      budgetId: "budget-1",
      scenarioId: "scenario-1",
      seed: "seed-1",
      engineVersion: "risk-engine-v2",
    });
  });
});
```

- [ ] **Step 5: Implement snapshot builder**

Create `lib/risk/simulation-service.ts`:

```ts
import type { RiskSimulationModelSnapshot } from "@/types/risk";

export const RISK_ENGINE_VERSION = "risk-engine-v2";

export function buildRiskSimulationSnapshot(input: RiskSimulationModelSnapshot): RiskSimulationModelSnapshot {
  return {
    budgetId: input.budgetId,
    scenarioId: input.scenarioId,
    baseTotal: input.baseTotal,
    iterations: input.iterations,
    seed: input.seed,
    engineVersion: input.engineVersion,
    itemIds: [...input.itemIds],
    variableIds: [...input.variableIds],
    correlationIds: [...input.correlationIds],
    createdAt: input.createdAt,
  };
}
```

- [ ] **Step 6: Run tests**

Run: `npm run test -- lib/risk/monte-carlo-engine.test.ts lib/risk/simulation-service.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add lib/risk/monte-carlo-engine.ts lib/risk/monte-carlo-engine.test.ts lib/risk/simulation-service.ts lib/risk/simulation-service.test.ts
git commit -m "feat: add deterministic risk simulation audit data"
```

---

### Task 4: Deterministic Risk Suggestions

**Files:**
- Create: `lib/risk/suggestions.ts`
- Test: `lib/risk/suggestions.test.ts`

**Interfaces:**
- Produces: `suggestRiskVariables(input: SuggestRiskVariablesInput): RiskVariableSuggestion[]`
- Consumes: `RiskAnalysisPayload`, `RiskWorkScheduleSummary`, `RiskSuggestionStrategy`

- [ ] **Step 1: Write failing tests**

Create `lib/risk/suggestions.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { suggestRiskVariables } from "@/lib/risk/suggestions";
import type { RiskAnalysisPayload } from "@/types/risk";

function payload(): RiskAnalysisPayload {
  return {
    budget: {
      id: "budget-1",
      projectId: "project-1",
      name: "Obra",
      kind: "SUB_BUDGET",
      currency: "PEN",
      baseTotal: 1500,
    },
    items: [
      {
        itemId: "item-1",
        budgetId: "budget-1",
        sourceBudgetName: "Estructuras",
        code: "01.01",
        description: "Concreto",
        unit: "m3",
        baseQuantity: 10,
        unitPrice: 100,
        baseTotal: 1000,
        updatedAt: "2026-07-17T00:00:00.000Z",
      },
      {
        itemId: "item-2",
        budgetId: "budget-1",
        sourceBudgetName: "Estructuras",
        code: "01.02",
        description: "Acero",
        unit: "kg",
        baseQuantity: 5,
        unitPrice: 100,
        baseTotal: 500,
        updatedAt: "2026-07-17T00:00:00.000Z",
      },
    ],
    variables: [],
    correlations: [],
    latestRun: null,
  };
}

describe("suggestRiskVariables", () => {
  it("suggests high-impact quantity risk first", () => {
    const suggestions = suggestRiskVariables({
      payload: payload(),
      strategy: "balanced",
      maxSuggestions: 1,
      workScheduleSummary: null,
    });

    expect(suggestions).toHaveLength(1);
    expect(suggestions[0]).toMatchObject({
      budgetItemId: "item-1",
      variableType: "QUANTITY",
      distributionType: "PERT",
      minimum: 9.5,
      mostLikely: 10,
      maximum: 11,
    });
  });
});
```

- [ ] **Step 2: Run test and verify failure**

Run: `npm run test -- lib/risk/suggestions.test.ts`

Expected: FAIL because module does not exist.

- [ ] **Step 3: Implement suggestions service**

Create `lib/risk/suggestions.ts`:

```ts
import Decimal from "decimal.js";
import type {
  RiskAnalysisPayload,
  RiskSuggestionStrategy,
  RiskVariableSuggestion,
  RiskWorkScheduleSummary,
} from "@/types/risk";

export type SuggestRiskVariablesInput = {
  payload: RiskAnalysisPayload;
  workScheduleSummary: RiskWorkScheduleSummary | null;
  strategy: RiskSuggestionStrategy;
  maxSuggestions: number;
};

const STRATEGY_RANGE = {
  balanced: { quantityMax: 1.1, priceMax: 1.08, durationMax: 1.25 },
  conservative: { quantityMax: 1.15, priceMax: 1.12, durationMax: 1.35 },
  aggressive: { quantityMax: 1.05, priceMax: 1.04, durationMax: 1.15 },
} as const;

export function suggestRiskVariables(input: SuggestRiskVariablesInput): RiskVariableSuggestion[] {
  const existingKeys = new Set(input.payload.variables.map((variable) => `${variable.budgetItemId}:${variable.variableType}`));
  const criticalIds = new Set((input.workScheduleSummary?.criticalItems ?? []).map((item) => item.budgetItemId));
  const range = STRATEGY_RANGE[input.strategy];

  const suggestions = input.payload.items.flatMap((item) => {
    const rows: RiskVariableSuggestion[] = [];
    const impactScore = new Decimal(item.baseTotal).toNumber();

    if (!existingKeys.has(`${item.itemId}:QUANTITY`) && item.baseQuantity > 0) {
      rows.push({
        id: `suggestion:${item.itemId}:quantity`,
        budgetId: input.payload.budget.id,
        budgetItemId: item.itemId,
        variableType: "QUANTITY",
        distributionType: "PERT",
        minimum: roundRisk(item.baseQuantity * 0.95),
        mostLikely: roundRisk(item.baseQuantity),
        maximum: roundRisk(item.baseQuantity * range.quantityMax),
        confidence: criticalIds.has(item.itemId) ? 0.86 : 0.74,
        reason: "Partida con impacto relevante en el costo directo y metrado sensible.",
        source: "HEURISTIC",
        impactScore,
      });
    }

    if (!existingKeys.has(`${item.itemId}:UNIT_PRICE`) && item.unitPrice > 0 && item.unitPrice * item.baseQuantity >= item.baseTotal * 0.95) {
      rows.push({
        id: `suggestion:${item.itemId}:unit-price`,
        budgetId: input.payload.budget.id,
        budgetItemId: item.itemId,
        variableType: "UNIT_PRICE",
        distributionType: "PERT",
        minimum: roundRisk(item.unitPrice * 0.97),
        mostLikely: roundRisk(item.unitPrice),
        maximum: roundRisk(item.unitPrice * range.priceMax),
        confidence: 0.7,
        reason: "Precio unitario relevante para el parcial de la partida.",
        source: "HEURISTIC",
        impactScore: impactScore * 0.85,
      });
    }

    if (criticalIds.has(item.itemId) && !existingKeys.has(`${item.itemId}:DURATION`)) {
      const criticalItem = input.workScheduleSummary?.criticalItems.find((candidate) => candidate.budgetItemId === item.itemId);
      if (criticalItem?.durationDays && criticalItem.durationDays > 0) {
        rows.push({
          id: `suggestion:${item.itemId}:duration`,
          budgetId: input.payload.budget.id,
          budgetItemId: item.itemId,
          variableType: "DURATION",
          distributionType: "PERT",
          minimum: Math.max(1, Math.round(criticalItem.durationDays * 0.9)),
          mostLikely: criticalItem.durationDays,
          maximum: Math.max(1, Math.round(criticalItem.durationDays * range.durationMax)),
          confidence: 0.82,
          reason: "Partida critica del cronograma con exposicion de plazo.",
          source: "HEURISTIC",
          impactScore: impactScore * 1.1,
        });
      }
    }

    return rows;
  });

  return suggestions
    .sort((left, right) => right.impactScore - left.impactScore)
    .slice(0, Math.max(1, input.maxSuggestions));
}

function roundRisk(value: number): number {
  return Math.round((value + Number.EPSILON) * 10000) / 10000;
}
```

- [ ] **Step 4: Run tests**

Run: `npm run test -- lib/risk/suggestions.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/risk/suggestions.ts lib/risk/suggestions.test.ts
git commit -m "feat: suggest monte carlo risk variables"
```

---

### Task 5: Suggestions And Scenario API Routes

**Files:**
- Create: `app/api/budgets/[id]/risk-analysis/suggestions/route.ts`
- Create: `app/api/budgets/[id]/risk-analysis/suggestions/route.test.ts`
- Create: `app/api/budgets/[id]/risk-analysis/scenarios/route.ts`
- Create: `app/api/budgets/[id]/risk-analysis/scenarios/route.test.ts`

**Interfaces:**
- Consumes: `suggestRiskVariables`, `saveRiskScenario`
- Produces: authenticated endpoints for UI and agent tools

- [ ] **Step 1: Write route tests**

Create suggestions route test:

```ts
import { describe, expect, it, vi } from "vitest";
import { POST } from "./route";

vi.mock("@/lib/auth", () => ({ auth: vi.fn().mockResolvedValue({ user: { id: "user-1" } }) }));
vi.mock("@/lib/entitlements/access", () => ({ assertFeatureAccess: vi.fn() }));
vi.mock("@/lib/risk/data", () => ({ getRiskAnalysisPayload: vi.fn().mockResolvedValue({ budget: { id: "budget-1" }, items: [], variables: [], correlations: [], latestRun: null }) }));
vi.mock("@/lib/risk/suggestions", () => ({ suggestRiskVariables: vi.fn().mockReturnValue([]) }));

describe("risk suggestions route", () => {
  it("returns suggestions for authenticated users", async () => {
    const response = await POST(new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({ strategy: "balanced", maxSuggestions: 12 }),
    }), { params: Promise.resolve({ id: "budget-1" }) });

    expect(response.status).toBe(200);
  });
});
```

- [ ] **Step 2: Implement suggestions route**

Create `app/api/budgets/[id]/risk-analysis/suggestions/route.ts`:

```ts
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { assertFeatureAccess } from "@/lib/entitlements/access";
import { getRiskAnalysisPayload } from "@/lib/risk/data";
import { suggestRiskVariables } from "@/lib/risk/suggestions";
import { riskSuggestionStrategySchema } from "@/lib/validations/risk";
import { z } from "zod";

const requestSchema = z.object({
  strategy: riskSuggestionStrategySchema.default("balanced"),
  maxSuggestions: z.number().int().min(1).max(50).default(12),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { id } = await params;
  await assertFeatureAccess({ userId: session.user.id, feature: "risk_analysis" });
  const body = requestSchema.parse(await request.json());
  const payload = await getRiskAnalysisPayload(id, session.user.id);

  return NextResponse.json({
    suggestions: suggestRiskVariables({
      payload,
      workScheduleSummary: null,
      strategy: body.strategy,
      maxSuggestions: body.maxSuggestions,
    }),
  });
}
```

- [ ] **Step 3: Implement scenario route**

Create `app/api/budgets/[id]/risk-analysis/scenarios/route.ts` with authenticated `POST` that calls `saveRiskScenario`. Use `assertFeatureAccess({ userId, feature: "risk_analysis" })`.

- [ ] **Step 4: Run route tests**

Run: `npm run test -- app/api/budgets/[id]/risk-analysis/suggestions/route.test.ts app/api/budgets/[id]/risk-analysis/scenarios/route.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/api/budgets/[id]/risk-analysis/suggestions app/api/budgets/[id]/risk-analysis/scenarios
git commit -m "feat: add risk suggestion and scenario routes"
```

---

### Task 6: Khipu Risk Agent Tools

**Files:**
- Create: `lib/ai/agent/tools/risk.ts`
- Modify: `lib/ai/agent/tools/index.ts`
- Modify: `lib/ai/agent/tool-metadata.ts`
- Test: `lib/ai/agent/tools/risk.test.ts`

**Interfaces:**
- Produces tools: `getRiskAnalysis`, `suggestRiskVariables`, `previewRiskScenario`, `saveRiskScenario`, `runRiskSimulation`, `summarizeRiskSimulation`

- [ ] **Step 1: Write failing tool test**

Create `lib/ai/agent/tools/risk.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { riskTools } from "@/lib/ai/agent/tools/risk";

describe("riskTools", () => {
  it("registers read and financial risk tools", () => {
    expect(riskTools.map((tool) => tool.name)).toEqual([
      "getRiskAnalysis",
      "suggestRiskVariables",
      "previewRiskScenario",
      "saveRiskScenario",
      "runRiskSimulation",
      "summarizeRiskSimulation",
    ]);
    expect(riskTools.find((tool) => tool.name === "saveRiskScenario")?.risk).toBe("financial");
    expect(riskTools.find((tool) => tool.name === "runRiskSimulation")?.risk).toBe("financial");
  });
});
```

- [ ] **Step 2: Implement tool module**

Create `lib/ai/agent/tools/risk.ts`:

```ts
import { z } from "zod";
import type { AgentToolDefinition } from "@/lib/ai/agent/types";
import { getRiskAnalysisPayload } from "@/lib/risk/data";
import { suggestRiskVariables as buildSuggestions } from "@/lib/risk/suggestions";
import { saveRiskScenario as persistRiskScenario } from "@/lib/risk/scenarios";
import { riskCorrelationInputSchema, riskVariableInputSchema } from "@/lib/validations/risk";

const budgetInput = z.object({ budgetId: z.string().min(1) });

const suggestInput = budgetInput.extend({
  strategy: z.enum(["balanced", "conservative", "aggressive"]).default("balanced"),
  maxSuggestions: z.number().int().min(1).max(50).default(12),
});

export const getRiskAnalysisTool: AgentToolDefinition<z.infer<typeof budgetInput>, Record<string, unknown>> = {
  name: "getRiskAnalysis",
  description: "Lee variables, correlaciones y ultima simulacion de riesgo Monte Carlo para un presupuesto.",
  risk: "read",
  requiresProjectId: false,
  inputSchema: budgetInput,
  execute: async (input, context) => getRiskAnalysisPayload(input.budgetId, context.userId),
  summarizeResult: (result) => `Analisis de riesgo cargado para presupuesto ${(result.budget as { name?: string }).name ?? ""}.`,
};

export const suggestRiskVariablesTool: AgentToolDefinition<z.infer<typeof suggestInput>, Record<string, unknown>> = {
  name: "suggestRiskVariables",
  description: "Sugiere variables de riesgo con min, probable, max y razon. No guarda cambios.",
  risk: "read",
  requiresProjectId: false,
  inputSchema: suggestInput,
  execute: async (input, context) => {
    const payload = await getRiskAnalysisPayload(input.budgetId, context.userId);
    return {
      suggestions: buildSuggestions({
        payload,
        workScheduleSummary: null,
        strategy: input.strategy,
        maxSuggestions: input.maxSuggestions,
      }),
    };
  },
  summarizeResult: (result) => `${(result.suggestions as unknown[]).length} variables de riesgo sugeridas.`,
};

export const previewRiskScenarioTool = {
  name: "previewRiskScenario",
  description: "Valida un borrador de escenario de riesgo antes de guardarlo.",
  risk: "read",
  requiresProjectId: false,
  inputSchema: z.object({
    budgetId: z.string().min(1),
    name: z.string().min(1),
    variables: z.array(riskVariableInputSchema),
    correlations: z.array(riskCorrelationInputSchema).default([]),
  }),
  execute: async (input) => ({
    budgetId: input.budgetId,
    name: input.name,
    variableCount: input.variables.length,
    correlationCount: input.correlations.length,
    valid: input.variables.length > 0,
    warnings: input.variables.length === 0 ? ["El escenario no contiene variables."] : [],
  }),
  summarizeResult: (result) => `Escenario revisado: ${result.variableCount} variables.`,
} satisfies AgentToolDefinition<Record<string, unknown>, Record<string, unknown>>;

export const saveRiskScenarioTool = {
  name: "saveRiskScenario",
  description: "Guarda un escenario de riesgo aprobado por el usuario.",
  risk: "financial",
  requiresProjectId: false,
  inputSchema: z.object({
    budgetId: z.string().min(1),
    name: z.string().min(1),
    description: z.string().optional(),
    variables: z.array(riskVariableInputSchema),
    correlations: z.array(riskCorrelationInputSchema).default([]),
  }),
  execute: async (input, context) => persistRiskScenario(input.budgetId, context.userId, {
    name: input.name,
    description: input.description ?? null,
    variables: input.variables,
    correlations: input.correlations,
  }),
  summarizeResult: () => "Escenario de riesgo guardado.",
} satisfies AgentToolDefinition<Record<string, unknown>, Record<string, unknown>>;

export const runRiskSimulationTool = {
  name: "runRiskSimulation",
  description: "Ejecuta y guarda una simulacion Monte Carlo real despues de confirmacion.",
  risk: "financial",
  requiresProjectId: false,
  inputSchema: z.object({
    budgetId: z.string().min(1),
    scenarioId: z.string().optional(),
    seed: z.string().optional(),
  }),
  execute: async (input) => ({
    budgetId: input.budgetId,
    scenarioId: input.scenarioId ?? null,
    pendingServerRunner: true,
    message: "La ejecucion server-side se conecta en la tarea de simulation-service.",
  }),
  summarizeResult: () => "Simulacion de riesgo solicitada.",
} satisfies AgentToolDefinition<Record<string, unknown>, Record<string, unknown>>;

export const summarizeRiskSimulationTool = {
  name: "summarizeRiskSimulation",
  description: "Resume resultados reales de una simulacion Monte Carlo guardada.",
  risk: "read",
  requiresProjectId: false,
  inputSchema: budgetInput.extend({ runId: z.string().optional() }),
  execute: async (input, context) => {
    const payload = await getRiskAnalysisPayload(input.budgetId, context.userId);
    return { latestRun: payload.latestRun, budget: payload.budget };
  },
  summarizeResult: () => "Resumen de simulacion de riesgo generado.",
} satisfies AgentToolDefinition<Record<string, unknown>, Record<string, unknown>>;

export const riskTools = [
  getRiskAnalysisTool,
  suggestRiskVariablesTool,
  previewRiskScenarioTool,
  saveRiskScenarioTool,
  runRiskSimulationTool,
  summarizeRiskSimulationTool,
];
```

- [ ] **Step 3: Register tools**

Modify `lib/ai/agent/tools/index.ts`:

```ts
import { riskTools } from "./risk";
export { riskTools };
```

Add `...riskTools` to `allTools`.

- [ ] **Step 4: Add metadata**

Add entries to `lib/ai/agent/tool-metadata.ts`:

```ts
{ name: "getRiskAnalysis", description: "Lee el analisis de riesgo Monte Carlo de un presupuesto.", risk: "read" },
{ name: "suggestRiskVariables", description: "Sugiere variables de riesgo sin guardar cambios.", risk: "read" },
{ name: "previewRiskScenario", description: "Valida un escenario de riesgo antes de guardarlo.", risk: "read" },
{ name: "saveRiskScenario", description: "Guarda un escenario de riesgo aprobado.", risk: "financial" },
{ name: "runRiskSimulation", description: "Ejecuta y guarda una simulacion Monte Carlo aprobada.", risk: "financial" },
{ name: "summarizeRiskSimulation", description: "Resume resultados reales de riesgo Monte Carlo.", risk: "read" },
```

- [ ] **Step 5: Run tests**

Run: `npm run test -- lib/ai/agent/tools/risk.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/ai/agent/tools/risk.ts lib/ai/agent/tools/risk.test.ts lib/ai/agent/tools/index.ts lib/ai/agent/tool-metadata.ts
git commit -m "feat: add khipu risk agent tools"
```

---

### Task 7: Risk Specialist Workflow

**Files:**
- Modify: `lib/ai/agent/workflows.ts`
- Test: `lib/ai/agent/workflows.test.ts`

**Interfaces:**
- Produces specialist bundle `risk-agent`
- Produces workflow template `analizar-riesgo-monte-carlo`

- [ ] **Step 1: Add failing workflow test**

Add:

```ts
import { getBundleBySlug, getWorkflowTemplate } from "@/lib/ai/agent/workflows";

it("registers risk specialist workflow", () => {
  const bundle = getBundleBySlug("risk-agent");
  const workflow = getWorkflowTemplate("analizar-riesgo-monte-carlo");

  expect(bundle?.toolNames).toContain("suggestRiskVariables");
  expect(bundle?.toolNames).toContain("runRiskSimulation");
  expect(workflow?.bundleSlug).toBe("risk-agent");
});
```

- [ ] **Step 2: Add bundle and workflow**

Add to `SPECIALIST_BUNDLES`:

```ts
{
  slug: "risk-agent",
  name: "Riesgo Monte Carlo",
  description: "Especialista en variables de riesgo, escenarios, contingencia y simulacion Monte Carlo.",
  icon: "R",
  toolNames: [
    "searchBudgets",
    "calculateBudget",
    "calculateCriticalPath",
    "getRiskAnalysis",
    "suggestRiskVariables",
    "previewRiskScenario",
    "saveRiskScenario",
    "runRiskSimulation",
    "summarizeRiskSimulation",
  ],
  systemPrompt: [
    "Eres un especialista en riesgo Monte Carlo para presupuestos de obra.",
    "Primero lee el presupuesto y el analisis de riesgo existente.",
    "Puedes sugerir variables sin aprobacion, pero no guardes ni ejecutes simulaciones sin confirmacion explicita.",
    "No inventes P50, P80, P90, histogramas ni duraciones probabilisticas.",
    "Despues de una simulacion real, resume contingencia, drivers principales y riesgos de plazo.",
  ].join(" "),
}
```

Add to `WORKFLOW_TEMPLATES`:

```ts
{
  slug: "analizar-riesgo-monte-carlo",
  name: "Analizar riesgo Monte Carlo",
  description: "Sugiere variables, prepara un escenario y ejecuta Monte Carlo despues de aprobacion.",
  bundleSlug: "risk-agent",
  initialGoal: "Analizar el riesgo Monte Carlo del presupuesto actual. Primero usa getRiskAnalysis. Luego usa suggestRiskVariables con estrategia balanced y presenta las variables sugeridas para revision. No uses saveRiskScenario ni runRiskSimulation hasta que el usuario confirme guardar y ejecutar.",
  defaultMode: "goal",
}
```

- [ ] **Step 3: Run tests**

Run: `npm run test -- lib/ai/agent/workflows.test.ts`

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add lib/ai/agent/workflows.ts lib/ai/agent/workflows.test.ts
git commit -m "feat: add monte carlo risk agent workflow"
```

---

### Task 8: Risk Suggestion Review UI

**Files:**
- Create: `components/risk/risk-suggestions-panel.tsx`
- Create: `components/risk/risk-suggestions-panel.test.tsx`
- Modify: `components/risk/risk-analysis-dashboard.tsx`

**Interfaces:**
- Consumes: `RiskVariableSuggestion[]`
- Produces callbacks: `onSaveAndRun(variables: RiskVariableRecord[]): Promise<void>`

- [ ] **Step 1: Write UI test**

Create `components/risk/risk-suggestions-panel.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { RiskSuggestionsPanel } from "@/components/risk/risk-suggestions-panel";

it("renders Khipu suggestions for review", () => {
  render(
    <RiskSuggestionsPanel
      disabled={false}
      suggestions={[
        {
          id: "suggestion-1",
          budgetId: "budget-1",
          budgetItemId: "item-1",
          variableType: "QUANTITY",
          distributionType: "PERT",
          minimum: 9.5,
          mostLikely: 10,
          maximum: 11,
          confidence: 0.8,
          reason: "Partida de alto impacto.",
          source: "HEURISTIC",
          impactScore: 1000,
        },
      ]}
      onRequestSuggestions={async () => undefined}
      onSaveAndRun={async () => undefined}
    />,
  );

  expect(screen.getByText("Sugerencias de Khipu")).toBeInTheDocument();
  expect(screen.getByText("Partida de alto impacto.")).toBeInTheDocument();
});
```

- [ ] **Step 2: Implement panel**

Create `components/risk/risk-suggestions-panel.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Bot, Check, Play, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { RiskVariableRecord, RiskVariableSuggestion } from "@/types/risk";

export function RiskSuggestionsPanel({
  disabled,
  onRequestSuggestions,
  onSaveAndRun,
  suggestions,
}: {
  disabled: boolean;
  onRequestSuggestions: () => Promise<void>;
  onSaveAndRun: (variables: RiskVariableRecord[]) => Promise<void>;
  suggestions: RiskVariableSuggestion[];
}) {
  const [acceptedIds, setAcceptedIds] = useState(() => new Set(suggestions.map((suggestion) => suggestion.id)));

  const acceptedSuggestions = suggestions.filter((suggestion) => acceptedIds.has(suggestion.id));

  return (
    <Card className="theme-surface-card">
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Bot className="h-4 w-4" />
          Sugerencias de Khipu
        </CardTitle>
        <Button disabled={disabled} onClick={onRequestSuggestions} type="button" variant="outline">
          Sugerir variables
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {suggestions.map((suggestion) => {
          const accepted = acceptedIds.has(suggestion.id);
          return (
            <div key={suggestion.id} className="rounded-xl border p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">{suggestion.variableType} | {suggestion.distributionType}</p>
                  <p className="theme-muted-text text-xs">{suggestion.reason}</p>
                  <p className="mt-2 text-xs">Min {suggestion.minimum} | Probable {suggestion.mostLikely} | Max {suggestion.maximum}</p>
                </div>
                <Button
                  aria-label={accepted ? "Rechazar sugerencia" : "Aceptar sugerencia"}
                  className="h-8 w-8 px-0"
                  type="button"
                  variant={accepted ? "outline" : "ghost"}
                  onClick={() => {
                    setAcceptedIds((current) => {
                      const next = new Set(current);
                      if (next.has(suggestion.id)) next.delete(suggestion.id);
                      else next.add(suggestion.id);
                      return next;
                    });
                  }}
                >
                  {accepted ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          );
        })}
        <Button
          disabled={disabled || acceptedSuggestions.length === 0}
          onClick={() => onSaveAndRun(acceptedSuggestions.map(toVariableRecord))}
          type="button"
        >
          <Play className="mr-2 h-4 w-4" />
          Guardar y ejecutar simulacion
        </Button>
      </CardContent>
    </Card>
  );
}

function toVariableRecord(suggestion: RiskVariableSuggestion): RiskVariableRecord {
  return {
    id: suggestion.id,
    budgetId: suggestion.budgetId,
    budgetItemId: suggestion.budgetItemId,
    variableType: suggestion.variableType,
    distributionType: suggestion.distributionType,
    minimum: suggestion.minimum,
    mostLikely: suggestion.mostLikely,
    maximum: suggestion.maximum,
    enabled: true,
    source: suggestion.source,
    confidence: suggestion.confidence,
    rationale: suggestion.reason,
  };
}
```

- [ ] **Step 3: Wire dashboard**

In `components/risk/risk-analysis-dashboard.tsx`, add state for suggestions, a `requestSuggestions` fetch to `/suggestions`, and render `RiskSuggestionsPanel` above correlations.

- [ ] **Step 4: Run UI tests**

Run: `npm run test -- components/risk/risk-suggestions-panel.test.tsx components/risk/risk-analysis-dashboard.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/risk/risk-suggestions-panel.tsx components/risk/risk-suggestions-panel.test.tsx components/risk/risk-analysis-dashboard.tsx components/risk/risk-analysis-dashboard.test.tsx
git commit -m "feat: add khipu risk suggestion review panel"
```

---

### Task 9: Server-Side Run From Scenario

**Files:**
- Modify: `lib/risk/simulation-service.ts`
- Modify: `app/api/budgets/[id]/risk-analysis/runs/route.ts`
- Test: `lib/risk/simulation-service.test.ts`
- Test: `app/api/budgets/[id]/risk-analysis/runs/route.test.ts`

**Interfaces:**
- Produces: `runAndSaveRiskSimulation(request): Promise<RiskSimulationSummary>`
- Consumes: `runMonteCarloSimulation`

- [ ] **Step 1: Add failing service test**

Add:

```ts
it("requires server-side run requests to match the selected budget", async () => {
  await expect(
    runAndSaveRiskSimulation("budget-1", "user-1", { budgetId: "other-budget" }),
  ).rejects.toThrow("no corresponde");
});
```

- [ ] **Step 2: Implement server runner**

In `lib/risk/simulation-service.ts`, add:

```ts
import { MONTE_CARLO_ITERATIONS, type RiskSimulationRunRequest } from "@/types/risk";
import { getRiskAnalysisPayload, saveRiskSimulationRun } from "@/lib/risk/data";
import { runMonteCarloSimulation } from "@/lib/risk/monte-carlo-engine";

export async function runAndSaveRiskSimulation(
  budgetId: string,
  userId: string,
  request: RiskSimulationRunRequest,
) {
  if (request.budgetId !== budgetId) {
    throw new Error("La simulacion no corresponde al presupuesto seleccionado.");
  }

  const payload = await getRiskAnalysisPayload(budgetId, userId);
  const seed = request.seed ?? `${budgetId}:${Date.now()}`;
  const summary = runMonteCarloSimulation({
    budgetId,
    baseTotal: payload.budget.baseTotal,
    iterations: MONTE_CARLO_ITERATIONS,
    items: payload.items,
    variables: payload.variables,
    correlations: payload.correlations,
    workSchedule: null,
  }, { seed });

  return saveRiskSimulationRun(budgetId, userId, {
    ...summary,
    seed,
    scenarioId: request.scenarioId ?? null,
    engineVersion: RISK_ENGINE_VERSION,
    modelSnapshot: buildRiskSimulationSnapshot({
      budgetId,
      scenarioId: request.scenarioId ?? null,
      baseTotal: payload.budget.baseTotal,
      iterations: MONTE_CARLO_ITERATIONS,
      seed,
      engineVersion: RISK_ENGINE_VERSION,
      itemIds: payload.items.map((item) => item.itemId),
      variableIds: payload.variables.map((variable) => variable.id),
      correlationIds: payload.correlations.map((correlation) => correlation.id),
      createdAt: new Date().toISOString(),
    }),
  });
}
```

- [ ] **Step 3: Update runs route**

Allow route to accept either an existing full summary or a server run request. Prefer server run when body has only `{ budgetId, scenarioId, seed }`.

- [ ] **Step 4: Run tests**

Run: `npm run test -- lib/risk/simulation-service.test.ts app/api/budgets/[id]/risk-analysis/runs/route.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/risk/simulation-service.ts lib/risk/simulation-service.test.ts app/api/budgets/[id]/risk-analysis/runs/route.ts app/api/budgets/[id]/risk-analysis/runs/route.test.ts
git commit -m "feat: run risk simulations server-side"
```

---

### Task 10: Reports, MCP Export, And Verification

**Files:**
- Modify: `lib/risk/pdf-report.ts`
- Modify: `lib/risk/pdf-report.test.ts`
- Modify: `lib/mcp/serializers/risk.ts`
- Modify: `lib/mcp/export-snapshot.test.ts`

**Interfaces:**
- Consumes: scenario/run audit metadata.
- Produces: PDF/MCP outputs including scenario, seed, engine version, and snapshot summary.

- [ ] **Step 1: Add PDF test**

Add assertion that generated tables include scenario and seed when present:

```ts
expect(JSON.stringify(tables)).toContain("risk-engine-v2");
expect(JSON.stringify(tables)).toContain("seed-1");
```

- [ ] **Step 2: Add MCP serializer fields**

Extend `McpSerializedRisk.simulationRuns[]` with:

```ts
scenarioId?: string | null;
seed?: string | null;
engineVersion?: string | null;
modelSnapshot?: unknown;
```

- [ ] **Step 3: Run tests**

Run: `npm run test -- lib/risk/pdf-report.test.ts lib/mcp/export-snapshot.test.ts`

Expected: PASS.

- [ ] **Step 4: Run focused risk suite**

Run: `npm run test -- lib/risk`

Expected: PASS.

- [ ] **Step 5: Run lint**

Run: `npm run lint`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/risk/pdf-report.ts lib/risk/pdf-report.test.ts lib/mcp/serializers/risk.ts lib/mcp/export-snapshot.test.ts
git commit -m "feat: export risk scenario audit metadata"
```

---

## Self-Review

Spec coverage:

- Precision and reproducibility: Tasks 1, 3, 9, 10.
- Suggestions: Tasks 1, 4, 5, 8.
- Scenarios: Tasks 1, 2, 5, 9, 10.
- Khipu agent tools: Tasks 6 and 7.
- Human confirmation: Tasks 6, 7, and 8 use read tools for suggestion and financial tools for saving/running.
- Reporting and MCP: Task 10.

Type consistency:

- `RiskVariableSuggestion` is defined in Task 1 and consumed in Tasks 4 and 8.
- `RiskSimulationModelSnapshot` is defined in Task 1 and consumed in Tasks 3, 9, and 10.
- Tool names in Task 6 match workflow names in Task 7.

Execution order:

Tasks are ordered so contracts exist before services, services before routes/UI, and tools before workflow registration.
