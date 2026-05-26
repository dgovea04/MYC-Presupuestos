# Monte Carlo Risk Analysis Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a persistent Monte Carlo risk analysis module for MYC Presupuestos Phase 1: quantity deviation risk, triangular distribution, 10,000 iterations, histogram, S-curve, percentiles, and statistical KPIs.

**Architecture:** Add Prisma persistence for risk variables and summarized simulation runs, isolate pure simulation/statistics logic in `lib/risk`, run heavy simulation work in a browser worker, expose budget-scoped APIs, and render a client dashboard from a server-loaded budget route. General budgets analyze child sub-budget items; sub budgets analyze their own items.

**Tech Stack:** Next.js App Router, TypeScript strict mode, Prisma, Zod, Zustand, TanStack Table, Recharts, Radix Dialog, Vitest, Tailwind CSS.

---

## File Structure

Create:

- `types/risk.ts`: Shared serializable domain types used by data services, API routes, worker, and UI.
- `lib/risk/statistics.ts`: Pure statistical helpers: percentiles, variance, standard deviation, skewness, kurtosis, histogram, S-curve.
- `lib/risk/monte-carlo-engine.ts`: Pure triangular sampling and simulation engine.
- `lib/risk/monte-carlo-engine.test.ts`: Unit tests for engine and statistics.
- `lib/risk/data.ts`: Server-only Prisma data service for risk analysis context, variables, and run summaries.
- `lib/validations/risk.ts`: Zod schemas for risk variable and run summary persistence.
- `lib/risk/store.ts`: Zustand store for dashboard state.
- `lib/risk/monte-carlo.worker.ts`: Browser worker entry that runs the simulation.
- `lib/risk/monte-carlo-worker-client.ts`: Client helper to start/stop worker simulations.
- `app/api/budgets/[id]/risk-analysis/route.ts`: GET risk context.
- `app/api/budgets/[id]/risk-analysis/variables/route.ts`: PUT persisted variables.
- `app/api/budgets/[id]/risk-analysis/runs/route.ts`: POST latest run summary.
- `app/budgets/[id]/risk-analysis/page.tsx`: Server route page.
- `components/risk/risk-analysis-dashboard.tsx`: Main client dashboard.
- `components/risk/simulation-toolbar.tsx`: Header/actions/progress.
- `components/risk/risk-kpi-cards.tsx`: KPI grid.
- `components/risk/risk-variables-table.tsx`: TanStack Table variable workbook.
- `components/risk/risk-variable-modal.tsx`: Radix modal for triangular ranges.
- `components/risk/histogram-chart.tsx`: Recharts histogram.
- `components/risk/s-curve-chart.tsx`: Recharts cumulative curve.
- `components/risk/percentiles-table.tsx`: Percentile summary table.
- `components/risk/risk-validation-panel.tsx`: Validation/quality messages.
- `components/risk/risk-analysis-dashboard.test.tsx`: UI smoke tests.
- `app/api/budgets/[id]/risk-analysis/route.test.ts`: API/data validation tests.
- `prisma/migrations/<timestamp>_add_monte_carlo_risk_analysis/migration.sql`: Prisma migration generated from schema changes.

Modify:

- `prisma/schema.prisma`: Add risk enums/models/relations.
- `package.json` and `package-lock.json`: Add `recharts`.
- `app/budgets/[id]/page.tsx`: Add quick action card for general budget risk analysis.
- `components/budget/budget-editor.tsx`: Add visible sub-budget action/link to risk analysis.

---

### Task 1: Add Recharts Dependency

**Files:**

- Modify: `package.json`
- Modify: `package-lock.json`

- [ ] **Step 1: Install Recharts**

Run:

```bash
npm install recharts
```

Expected:

- `package.json` contains `"recharts": "<installed-version>"`.
- `package-lock.json` is updated.

- [ ] **Step 2: Confirm dependency is present**

Run:

```bash
node -e "const pkg=require('./package.json'); if (!pkg.dependencies.recharts) process.exit(1); console.log(pkg.dependencies.recharts)"
```

Expected: prints the installed Recharts version and exits with code 0.

- [ ] **Step 3: Commit**

Run:

```bash
git add package.json package-lock.json
git commit -m "chore: add recharts for risk charts"
```

Expected: commit succeeds with only dependency files staged.

---

### Task 2: Add Prisma Risk Persistence

**Files:**

- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_add_monte_carlo_risk_analysis/migration.sql`

- [ ] **Step 1: Add enums and relations in Prisma schema**

In `prisma/schema.prisma`, add these enums near the other enum declarations:

```prisma
enum RiskVariableType {
  QUANTITY
}

enum RiskDistributionType {
  TRIANGULAR
}
```

Add these relations inside `model Budget`:

```prisma
  riskVariables        RiskVariable[]
  riskSimulationRuns   RiskSimulationRun[]
```

Add this relation inside `model BudgetItem`:

```prisma
  riskVariables RiskVariable[]
```

Add these models after `model BudgetItem`:

```prisma
model RiskVariable {
  id               String               @id @default(cuid())
  budgetId         String
  budgetItemId     String
  variableType     RiskVariableType     @default(QUANTITY)
  distributionType RiskDistributionType @default(TRIANGULAR)
  minimum          Decimal              @default(0) @db.Decimal(18, 4)
  mostLikely       Decimal              @default(0) @db.Decimal(18, 4)
  maximum          Decimal              @default(0) @db.Decimal(18, 4)
  enabled          Boolean              @default(true)
  createdAt        DateTime             @default(now())
  updatedAt        DateTime             @updatedAt
  budget           Budget               @relation(fields: [budgetId], references: [id], onDelete: Cascade)
  budgetItem       BudgetItem           @relation(fields: [budgetItemId], references: [id], onDelete: Cascade)

  @@unique([budgetId, budgetItemId, variableType])
  @@index([budgetId])
  @@index([budgetItemId])
}

model RiskSimulationRun {
  id                String   @id @default(cuid())
  budgetId          String
  iterations        Int
  baseTotal         Decimal  @default(0) @db.Decimal(18, 4)
  mean              Decimal  @default(0) @db.Decimal(18, 4)
  median            Decimal  @default(0) @db.Decimal(18, 4)
  variance          Decimal  @default(0) @db.Decimal(24, 6)
  standardDeviation Decimal  @default(0) @db.Decimal(18, 4)
  skewness          Decimal  @default(0) @db.Decimal(18, 6)
  kurtosis          Decimal  @default(0) @db.Decimal(18, 6)
  p10               Decimal  @default(0) @db.Decimal(18, 4)
  p50               Decimal  @default(0) @db.Decimal(18, 4)
  p80               Decimal  @default(0) @db.Decimal(18, 4)
  p90               Decimal  @default(0) @db.Decimal(18, 4)
  p95               Decimal  @default(0) @db.Decimal(18, 4)
  histogramBins     Json
  sCurvePoints      Json
  createdAt         DateTime @default(now())
  budget            Budget   @relation(fields: [budgetId], references: [id], onDelete: Cascade)

  @@index([budgetId, createdAt(sort: Desc)])
}
```

- [ ] **Step 2: Generate migration**

Run:

```bash
npm run prisma:migrate -- --name add_monte_carlo_risk_analysis
```

Expected:

- Prisma creates a migration folder under `prisma/migrations`.
- Prisma Client is regenerated.
- No schema validation errors.

- [ ] **Step 3: Inspect generated SQL**

Run:

```bash
Get-Content -Path (Get-ChildItem prisma/migrations -Directory | Sort-Object Name | Select-Object -Last 1).FullName/migration.sql
```

Expected:

- SQL creates `RiskVariableType`, `RiskDistributionType`, `RiskVariable`, and `RiskSimulationRun`.
- SQL adds indexes and unique constraint matching the schema.

- [ ] **Step 4: Commit**

Run:

```bash
git add prisma/schema.prisma prisma/migrations package-lock.json package.json
git commit -m "feat: add risk analysis persistence"
```

Expected: commit includes schema and generated migration. Include package files only if Prisma touched lock metadata.

---

### Task 3: Define Risk Types, Statistics, And Simulation Engine

**Files:**

- Create: `types/risk.ts`
- Create: `lib/risk/statistics.ts`
- Create: `lib/risk/monte-carlo-engine.ts`
- Create: `lib/risk/monte-carlo-engine.test.ts`

- [ ] **Step 1: Create shared risk types**

Create `types/risk.ts`:

```ts
export const MONTE_CARLO_ITERATIONS = 10000;

export type RiskVariableType = "QUANTITY";
export type RiskDistributionType = "TRIANGULAR";

export type RiskBudgetKind = "GENERAL" | "SUB_BUDGET";

export type RiskBudgetContext = {
  id: string;
  projectId: string;
  name: string;
  kind: RiskBudgetKind;
  currency: string;
  baseTotal: number;
};

export type RiskBudgetItem = {
  itemId: string;
  budgetId: string;
  sourceBudgetName: string;
  code: string;
  description: string;
  unit: string;
  baseQuantity: number;
  unitPrice: number;
  baseTotal: number;
};

export type RiskVariableRecord = {
  id: string;
  budgetId: string;
  budgetItemId: string;
  variableType: RiskVariableType;
  distributionType: RiskDistributionType;
  minimum: number;
  mostLikely: number;
  maximum: number;
  enabled: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type RiskHistogramBin = {
  min: number;
  max: number;
  midpoint: number;
  frequency: number;
  probability: number;
};

export type RiskSCurvePoint = {
  cost: number;
  cumulativeProbability: number;
};

export type RiskPercentileKey = "p10" | "p50" | "p80" | "p90" | "p95";

export type RiskSimulationSummary = {
  id?: string;
  budgetId: string;
  iterations: number;
  baseTotal: number;
  mean: number;
  median: number;
  variance: number;
  standardDeviation: number;
  skewness: number;
  kurtosis: number;
  p10: number;
  p50: number;
  p80: number;
  p90: number;
  p95: number;
  histogramBins: RiskHistogramBin[];
  sCurvePoints: RiskSCurvePoint[];
  createdAt?: string;
};

export type RiskAnalysisPayload = {
  budget: RiskBudgetContext;
  items: RiskBudgetItem[];
  variables: RiskVariableRecord[];
  latestRun: RiskSimulationSummary | null;
};

export type RiskSimulationInput = {
  budgetId: string;
  baseTotal: number;
  iterations: number;
  items: RiskBudgetItem[];
  variables: RiskVariableRecord[];
};

export type RiskWorkerProgressMessage = {
  type: "progress";
  completedIterations: number;
  totalIterations: number;
};

export type RiskWorkerResultMessage = {
  type: "result";
  summary: RiskSimulationSummary;
};

export type RiskWorkerErrorMessage = {
  type: "error";
  message: string;
};

export type RiskWorkerMessage = RiskWorkerProgressMessage | RiskWorkerResultMessage | RiskWorkerErrorMessage;
```

- [ ] **Step 2: Write failing tests for statistics and engine**

Create `lib/risk/monte-carlo-engine.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  buildHistogram,
  buildSCurve,
  calculateKurtosis,
  calculateMean,
  calculatePercentile,
  calculateSkewness,
  calculateStandardDeviation,
  calculateVariance,
} from "@/lib/risk/statistics";
import { runMonteCarloSimulation, sampleTriangular } from "@/lib/risk/monte-carlo-engine";

describe("risk statistics", () => {
  const values = [10, 20, 30, 40, 50];

  it("calculates percentiles using linear interpolation", () => {
    expect(calculatePercentile(values, 0.1)).toBe(14);
    expect(calculatePercentile(values, 0.5)).toBe(30);
    expect(calculatePercentile(values, 0.9)).toBe(46);
  });

  it("calculates variance and standard deviation", () => {
    expect(calculateMean(values)).toBe(30);
    expect(calculateVariance(values)).toBe(200);
    expect(calculateStandardDeviation(values)).toBeCloseTo(14.1421, 4);
  });

  it("calculates skewness and kurtosis for symmetric data", () => {
    expect(calculateSkewness(values)).toBeCloseTo(0, 8);
    expect(calculateKurtosis(values)).toBeCloseTo(-1.3, 8);
  });

  it("builds histogram bins and s-curve points", () => {
    const histogram = buildHistogram(values, 5);
    const sCurve = buildSCurve(values, 5);

    expect(histogram).toHaveLength(5);
    expect(histogram.reduce((sum, bin) => sum + bin.frequency, 0)).toBe(5);
    expect(sCurve.at(-1)?.cumulativeProbability).toBe(1);
  });
});

describe("monte carlo engine", () => {
  it("samples triangular values inside the configured range", () => {
    const value = sampleTriangular({ minimum: 10, mostLikely: 15, maximum: 20 }, () => 0.5);
    expect(value).toBeGreaterThanOrEqual(10);
    expect(value).toBeLessThanOrEqual(20);
  });

  it("rejects invalid triangular ranges", () => {
    expect(() => sampleTriangular({ minimum: 20, mostLikely: 15, maximum: 10 }, () => 0.5)).toThrow("triangular");
  });

  it("runs a deterministic simulation and returns required metrics", () => {
    const summary = runMonteCarloSimulation(
      {
        budgetId: "budget-1",
        baseTotal: 1000,
        iterations: 4,
        items: [
          {
            itemId: "item-1",
            budgetId: "child-1",
            sourceBudgetName: "Estructuras",
            code: "01.01",
            description: "Excavacion",
            unit: "m3",
            baseQuantity: 10,
            unitPrice: 100,
            baseTotal: 1000,
          },
        ],
        variables: [
          {
            id: "risk-1",
            budgetId: "budget-1",
            budgetItemId: "item-1",
            variableType: "QUANTITY",
            distributionType: "TRIANGULAR",
            minimum: 8,
            mostLikely: 10,
            maximum: 12,
            enabled: true,
          },
        ],
      },
      {
        random: () => 0.5,
        histogramBinCount: 4,
        sCurvePointCount: 4,
      },
    );

    expect(summary.iterations).toBe(4);
    expect(summary.p50).toBeGreaterThan(0);
    expect(summary.histogramBins).toHaveLength(4);
    expect(summary.sCurvePoints).toHaveLength(4);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run:

```bash
npm run test -- lib/risk/monte-carlo-engine.test.ts
```

Expected: FAIL because `lib/risk/statistics.ts` and `lib/risk/monte-carlo-engine.ts` do not exist yet.

- [ ] **Step 4: Implement statistics helpers**

Create `lib/risk/statistics.ts`:

```ts
import type { RiskHistogramBin, RiskSCurvePoint } from "@/types/risk";

export function sortNumeric(values: number[]) {
  return [...values].sort((left, right) => left - right);
}

export function roundFinancial(value: number) {
  return Math.round((value + Number.EPSILON) * 10000) / 10000;
}

export function calculateMean(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function calculatePercentile(values: number[], percentile: number) {
  if (values.length === 0) return 0;
  if (percentile <= 0) return sortNumeric(values)[0] ?? 0;
  if (percentile >= 1) return sortNumeric(values).at(-1) ?? 0;

  const sorted = sortNumeric(values);
  const index = (sorted.length - 1) * percentile;
  const lowerIndex = Math.floor(index);
  const upperIndex = Math.ceil(index);
  const lower = sorted[lowerIndex] ?? 0;
  const upper = sorted[upperIndex] ?? lower;
  const weight = index - lowerIndex;

  return lower + (upper - lower) * weight;
}

export function calculateMedian(values: number[]) {
  return calculatePercentile(values, 0.5);
}

export function calculateVariance(values: number[]) {
  if (values.length === 0) return 0;
  const mean = calculateMean(values);
  return values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
}

export function calculateStandardDeviation(values: number[]) {
  return Math.sqrt(calculateVariance(values));
}

export function calculateSkewness(values: number[]) {
  if (values.length === 0) return 0;
  const mean = calculateMean(values);
  const standardDeviation = calculateStandardDeviation(values);
  if (standardDeviation === 0) return 0;

  return values.reduce((sum, value) => sum + ((value - mean) / standardDeviation) ** 3, 0) / values.length;
}

export function calculateKurtosis(values: number[]) {
  if (values.length === 0) return 0;
  const mean = calculateMean(values);
  const standardDeviation = calculateStandardDeviation(values);
  if (standardDeviation === 0) return 0;

  const fourthMoment = values.reduce((sum, value) => sum + ((value - mean) / standardDeviation) ** 4, 0) / values.length;
  return fourthMoment - 3;
}

export function buildHistogram(values: number[], requestedBinCount = 30): RiskHistogramBin[] {
  if (values.length === 0) return [];
  const sorted = sortNumeric(values);
  const min = sorted[0] ?? 0;
  const max = sorted.at(-1) ?? min;
  const binCount = Math.max(1, requestedBinCount);

  if (min === max) {
    return [{ min, max, midpoint: min, frequency: values.length, probability: 1 }];
  }

  const width = (max - min) / binCount;
  const bins = Array.from({ length: binCount }, (_, index) => {
    const binMin = min + width * index;
    const binMax = index === binCount - 1 ? max : binMin + width;
    return {
      min: roundFinancial(binMin),
      max: roundFinancial(binMax),
      midpoint: roundFinancial((binMin + binMax) / 2),
      frequency: 0,
      probability: 0,
    };
  });

  for (const value of values) {
    const rawIndex = Math.floor((value - min) / width);
    const index = Math.min(Math.max(rawIndex, 0), binCount - 1);
    const bin = bins[index];
    if (bin) bin.frequency += 1;
  }

  return bins.map((bin) => ({
    ...bin,
    probability: bin.frequency / values.length,
  }));
}

export function buildSCurve(values: number[], requestedPointCount = 100): RiskSCurvePoint[] {
  if (values.length === 0) return [];
  const sorted = sortNumeric(values);
  const pointCount = Math.min(Math.max(1, requestedPointCount), sorted.length);

  if (pointCount === 1) {
    return [{ cost: roundFinancial(sorted[0] ?? 0), cumulativeProbability: 1 }];
  }

  return Array.from({ length: pointCount }, (_, index) => {
    const sortedIndex = Math.round((index / (pointCount - 1)) * (sorted.length - 1));
    return {
      cost: roundFinancial(sorted[sortedIndex] ?? 0),
      cumulativeProbability: (sortedIndex + 1) / sorted.length,
    };
  });
}
```

- [ ] **Step 5: Implement Monte Carlo engine**

Create `lib/risk/monte-carlo-engine.ts`:

```ts
import type { RiskSimulationInput, RiskSimulationSummary, RiskVariableRecord } from "@/types/risk";
import {
  buildHistogram,
  buildSCurve,
  calculateKurtosis,
  calculateMean,
  calculateMedian,
  calculatePercentile,
  calculateSkewness,
  calculateStandardDeviation,
  calculateVariance,
  roundFinancial,
} from "@/lib/risk/statistics";

type TriangularParameters = {
  minimum: number;
  mostLikely: number;
  maximum: number;
};

type SimulationOptions = {
  random?: () => number;
  onProgress?: (completedIterations: number, totalIterations: number) => void;
  progressInterval?: number;
  histogramBinCount?: number;
  sCurvePointCount?: number;
};

export function sampleTriangular(parameters: TriangularParameters, random: () => number = Math.random) {
  const { maximum, minimum, mostLikely } = parameters;

  if (minimum < 0 || mostLikely < 0 || maximum < 0 || minimum > mostLikely || mostLikely > maximum) {
    throw new Error("Invalid triangular distribution parameters.");
  }

  if (minimum === maximum) return minimum;

  const value = random();
  const modeRatio = (mostLikely - minimum) / (maximum - minimum);

  if (value < modeRatio) {
    return minimum + Math.sqrt(value * (maximum - minimum) * (mostLikely - minimum));
  }

  return maximum - Math.sqrt((1 - value) * (maximum - minimum) * (maximum - mostLikely));
}

export function runMonteCarloSimulation(input: RiskSimulationInput, options: SimulationOptions = {}): RiskSimulationSummary {
  const random = options.random ?? Math.random;
  const enabledVariables = input.variables.filter((variable) => variable.enabled);
  const itemsById = new Map(input.items.map((item) => [item.itemId, item]));
  const progressInterval = options.progressInterval ?? 500;
  const totals: number[] = [];

  for (let iteration = 0; iteration < input.iterations; iteration += 1) {
    let total = input.baseTotal;

    for (const variable of enabledVariables) {
      assertSupportedVariable(variable);
      const item = itemsById.get(variable.budgetItemId);
      if (!item) continue;

      const simulatedQuantity = sampleTriangular(
        {
          minimum: variable.minimum,
          mostLikely: variable.mostLikely,
          maximum: variable.maximum,
        },
        random,
      );
      const simulatedTotal = simulatedQuantity * item.unitPrice;
      total = total - item.baseTotal + simulatedTotal;
    }

    totals.push(roundFinancial(total));

    if (options.onProgress && ((iteration + 1) % progressInterval === 0 || iteration + 1 === input.iterations)) {
      options.onProgress(iteration + 1, input.iterations);
    }
  }

  const mean = calculateMean(totals);
  const median = calculateMedian(totals);
  const variance = calculateVariance(totals);

  return {
    budgetId: input.budgetId,
    iterations: input.iterations,
    baseTotal: roundFinancial(input.baseTotal),
    mean: roundFinancial(mean),
    median: roundFinancial(median),
    variance: roundFinancial(variance),
    standardDeviation: roundFinancial(calculateStandardDeviation(totals)),
    skewness: calculateSkewness(totals),
    kurtosis: calculateKurtosis(totals),
    p10: roundFinancial(calculatePercentile(totals, 0.1)),
    p50: roundFinancial(calculatePercentile(totals, 0.5)),
    p80: roundFinancial(calculatePercentile(totals, 0.8)),
    p90: roundFinancial(calculatePercentile(totals, 0.9)),
    p95: roundFinancial(calculatePercentile(totals, 0.95)),
    histogramBins: buildHistogram(totals, options.histogramBinCount ?? 30),
    sCurvePoints: buildSCurve(totals, options.sCurvePointCount ?? 100),
  };
}

function assertSupportedVariable(variable: RiskVariableRecord) {
  if (variable.variableType !== "QUANTITY" || variable.distributionType !== "TRIANGULAR") {
    throw new Error("Only quantity triangular risk variables are supported in Phase 1.");
  }
}
```

- [ ] **Step 6: Run tests**

Run:

```bash
npm run test -- lib/risk/monte-carlo-engine.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

Run:

```bash
git add types/risk.ts lib/risk/statistics.ts lib/risk/monte-carlo-engine.ts lib/risk/monte-carlo-engine.test.ts
git commit -m "feat: add monte carlo risk engine"
```

Expected: commit includes only risk types, engine, statistics, and tests.

---

### Task 4: Add Risk Validation And Data Services

**Files:**

- Create: `lib/validations/risk.ts`
- Create: `lib/risk/data.ts`
- Create: `app/api/budgets/[id]/risk-analysis/route.test.ts`

- [ ] **Step 1: Create validation schemas**

Create `lib/validations/risk.ts`:

```ts
import { z } from "zod";
import { MONTE_CARLO_ITERATIONS } from "@/types/risk";

export const riskVariableInputSchema = z
  .object({
    id: z.string().optional(),
    budgetItemId: z.string().min(1),
    variableType: z.literal("QUANTITY"),
    distributionType: z.literal("TRIANGULAR"),
    minimum: z.number().finite().nonnegative(),
    mostLikely: z.number().finite().nonnegative(),
    maximum: z.number().finite().nonnegative(),
    enabled: z.boolean(),
    delete: z.boolean().optional(),
  })
  .refine((input) => input.minimum <= input.mostLikely, {
    message: "El minimo no puede ser mayor que el valor probable.",
    path: ["minimum"],
  })
  .refine((input) => input.mostLikely <= input.maximum, {
    message: "El valor probable no puede ser mayor que el maximo.",
    path: ["mostLikely"],
  });

export const riskVariablesSaveSchema = z.object({
  variables: z.array(riskVariableInputSchema),
});

export const riskHistogramBinSchema = z.object({
  min: z.number().finite(),
  max: z.number().finite(),
  midpoint: z.number().finite(),
  frequency: z.number().int().nonnegative(),
  probability: z.number().finite().nonnegative(),
});

export const riskSCurvePointSchema = z.object({
  cost: z.number().finite(),
  cumulativeProbability: z.number().finite().min(0).max(1),
});

export const riskSimulationRunInputSchema = z.object({
  iterations: z.literal(MONTE_CARLO_ITERATIONS),
  baseTotal: z.number().finite().nonnegative(),
  mean: z.number().finite().nonnegative(),
  median: z.number().finite().nonnegative(),
  variance: z.number().finite().nonnegative(),
  standardDeviation: z.number().finite().nonnegative(),
  skewness: z.number().finite(),
  kurtosis: z.number().finite(),
  p10: z.number().finite().nonnegative(),
  p50: z.number().finite().nonnegative(),
  p80: z.number().finite().nonnegative(),
  p90: z.number().finite().nonnegative(),
  p95: z.number().finite().nonnegative(),
  histogramBins: z.array(riskHistogramBinSchema).min(1),
  sCurvePoints: z.array(riskSCurvePointSchema).min(1),
});

export type RiskVariablesSaveInput = z.infer<typeof riskVariablesSaveSchema>;
export type RiskSimulationRunInput = z.infer<typeof riskSimulationRunInputSchema>;
```

- [ ] **Step 2: Create data service**

Create `lib/risk/data.ts`:

```ts
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { decimalToNumber } from "@/lib/db/serializers";
import { calculateBudgetRecord } from "@/lib/calculations/budget";
import type { RiskAnalysisPayload, RiskBudgetItem, RiskSimulationSummary, RiskVariableRecord } from "@/types/risk";
import { riskSimulationRunInputSchema, riskVariablesSaveSchema, type RiskSimulationRunInput, type RiskVariablesSaveInput } from "@/lib/validations/risk";

type BudgetWithItems = Prisma.BudgetGetPayload<{
  include: {
    items: true;
    childBudgets: {
      include: {
        items: true;
      };
    };
  };
}>;

export async function getRiskAnalysisPayload(budgetId: string, userId: string): Promise<RiskAnalysisPayload> {
  const budget = await findAccessibleBudgetWithItems(budgetId, userId);
  if (!budget) {
    throw new Error("No tienes permisos para acceder a este presupuesto.");
  }

  const items = normalizeRiskBudgetItems(budget);
  const [variables, latestRun] = await Promise.all([
    prisma.riskVariable.findMany({
      where: { budgetId },
      orderBy: { createdAt: "asc" },
    }),
    prisma.riskSimulationRun.findFirst({
      where: { budgetId },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return {
    budget: {
      id: budget.id,
      projectId: budget.projectId,
      name: budget.name,
      kind: budget.kind,
      currency: budget.currency,
      baseTotal: decimalToNumber(budget.totalAmount),
    },
    items,
    variables: variables.map(serializeRiskVariable),
    latestRun: latestRun ? serializeRiskSimulationRun(latestRun) : null,
  };
}

export async function saveRiskVariables(budgetId: string, userId: string, input: RiskVariablesSaveInput): Promise<RiskAnalysisPayload> {
  const parsed = riskVariablesSaveSchema.parse(input);
  const budget = await findAccessibleBudgetWithItems(budgetId, userId);
  if (!budget) {
    throw new Error("No tienes permisos para modificar este presupuesto.");
  }

  const accessibleItemIds = new Set(normalizeRiskBudgetItems(budget).map((item) => item.itemId));

  await prisma.$transaction(async (tx) => {
    for (const variable of parsed.variables) {
      if (!accessibleItemIds.has(variable.budgetItemId)) {
        throw new Error("La partida seleccionada no pertenece al alcance del presupuesto.");
      }

      if (variable.delete) {
        await tx.riskVariable.deleteMany({
          where: {
            budgetId,
            budgetItemId: variable.budgetItemId,
            variableType: variable.variableType,
          },
        });
        continue;
      }

      await tx.riskVariable.upsert({
        where: {
          budgetId_budgetItemId_variableType: {
            budgetId,
            budgetItemId: variable.budgetItemId,
            variableType: variable.variableType,
          },
        },
        update: {
          distributionType: variable.distributionType,
          minimum: variable.minimum,
          mostLikely: variable.mostLikely,
          maximum: variable.maximum,
          enabled: variable.enabled,
        },
        create: {
          budgetId,
          budgetItemId: variable.budgetItemId,
          variableType: variable.variableType,
          distributionType: variable.distributionType,
          minimum: variable.minimum,
          mostLikely: variable.mostLikely,
          maximum: variable.maximum,
          enabled: variable.enabled,
        },
      });
    }
  });

  return getRiskAnalysisPayload(budgetId, userId);
}

export async function saveRiskSimulationRun(budgetId: string, userId: string, input: RiskSimulationRunInput): Promise<RiskSimulationSummary> {
  const parsed = riskSimulationRunInputSchema.parse(input);
  const budget = await findAccessibleBudgetWithItems(budgetId, userId);
  if (!budget) {
    throw new Error("No tienes permisos para guardar esta simulacion.");
  }

  const created = await prisma.riskSimulationRun.create({
    data: {
      budgetId,
      iterations: parsed.iterations,
      baseTotal: parsed.baseTotal,
      mean: parsed.mean,
      median: parsed.median,
      variance: parsed.variance,
      standardDeviation: parsed.standardDeviation,
      skewness: parsed.skewness,
      kurtosis: parsed.kurtosis,
      p10: parsed.p10,
      p50: parsed.p50,
      p80: parsed.p80,
      p90: parsed.p90,
      p95: parsed.p95,
      histogramBins: parsed.histogramBins,
      sCurvePoints: parsed.sCurvePoints,
    },
  });

  return serializeRiskSimulationRun(created);
}

function normalizeRiskBudgetItems(budget: BudgetWithItems): RiskBudgetItem[] {
  if (budget.kind === "GENERAL") {
    return budget.childBudgets.flatMap((childBudget) => normalizeSingleBudgetItems(childBudget.name, childBudget.id, childBudget.items));
  }

  return normalizeSingleBudgetItems(budget.name, budget.id, budget.items);
}

function normalizeSingleBudgetItems(
  sourceBudgetName: string,
  budgetId: string,
  items: BudgetWithItems["items"],
): RiskBudgetItem[] {
  const calculated = calculateBudgetRecord({
    id: budgetId,
    projectId: "",
    kind: "SUB_BUDGET",
    name: sourceBudgetName,
    currency: "PEN",
    igvRate: 0,
    generalExpensesRate: 0,
    utilityRate: 0,
    totalDirectCost: 0,
    totalGeneralExpenses: 0,
    totalUtility: 0,
    totalTax: 0,
    totalAmount: 0,
    levels: [],
    items: items.map((item) => ({
      id: item.id,
      budgetId: item.budgetId,
      levelId: item.levelId,
      code: item.code,
      description: item.description,
      unit: item.unit,
      quantity: decimalToNumber(item.quantity),
      unitPrice: decimalToNumber(item.unitPrice),
      partial: decimalToNumber(item.partial),
      sortOrder: item.sortOrder,
      apu: null,
    })),
  });

  return calculated.items.map((item) => ({
    itemId: item.id,
    budgetId,
    sourceBudgetName,
    code: item.code,
    description: item.description,
    unit: item.unit,
    baseQuantity: item.quantity,
    unitPrice: item.unitPrice,
    baseTotal: item.partial,
  }));
}

async function findAccessibleBudgetWithItems(budgetId: string, userId: string) {
  return prisma.budget.findFirst({
    where: {
      id: budgetId,
      project: {
        company: {
          userId,
        },
      },
    },
    include: {
      items: {
        orderBy: { sortOrder: "asc" },
      },
      childBudgets: {
        orderBy: { createdAt: "asc" },
        include: {
          items: {
            orderBy: { sortOrder: "asc" },
          },
        },
      },
    },
  });
}

function serializeRiskVariable(variable: {
  id: string;
  budgetId: string;
  budgetItemId: string;
  variableType: "QUANTITY";
  distributionType: "TRIANGULAR";
  minimum: Prisma.Decimal;
  mostLikely: Prisma.Decimal;
  maximum: Prisma.Decimal;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}): RiskVariableRecord {
  return {
    id: variable.id,
    budgetId: variable.budgetId,
    budgetItemId: variable.budgetItemId,
    variableType: variable.variableType,
    distributionType: variable.distributionType,
    minimum: decimalToNumber(variable.minimum),
    mostLikely: decimalToNumber(variable.mostLikely),
    maximum: decimalToNumber(variable.maximum),
    enabled: variable.enabled,
    createdAt: variable.createdAt.toISOString(),
    updatedAt: variable.updatedAt.toISOString(),
  };
}

function serializeRiskSimulationRun(run: {
  id: string;
  budgetId: string;
  iterations: number;
  baseTotal: Prisma.Decimal;
  mean: Prisma.Decimal;
  median: Prisma.Decimal;
  variance: Prisma.Decimal;
  standardDeviation: Prisma.Decimal;
  skewness: Prisma.Decimal;
  kurtosis: Prisma.Decimal;
  p10: Prisma.Decimal;
  p50: Prisma.Decimal;
  p80: Prisma.Decimal;
  p90: Prisma.Decimal;
  p95: Prisma.Decimal;
  histogramBins: Prisma.JsonValue;
  sCurvePoints: Prisma.JsonValue;
  createdAt: Date;
}): RiskSimulationSummary {
  return {
    id: run.id,
    budgetId: run.budgetId,
    iterations: run.iterations,
    baseTotal: decimalToNumber(run.baseTotal),
    mean: decimalToNumber(run.mean),
    median: decimalToNumber(run.median),
    variance: decimalToNumber(run.variance),
    standardDeviation: decimalToNumber(run.standardDeviation),
    skewness: decimalToNumber(run.skewness),
    kurtosis: decimalToNumber(run.kurtosis),
    p10: decimalToNumber(run.p10),
    p50: decimalToNumber(run.p50),
    p80: decimalToNumber(run.p80),
    p90: decimalToNumber(run.p90),
    p95: decimalToNumber(run.p95),
    histogramBins: Array.isArray(run.histogramBins) ? run.histogramBins as RiskSimulationSummary["histogramBins"] : [],
    sCurvePoints: Array.isArray(run.sCurvePoints) ? run.sCurvePoints as RiskSimulationSummary["sCurvePoints"] : [],
    createdAt: run.createdAt.toISOString(),
  };
}
```

- [ ] **Step 3: Add route/data tests**

Create `app/api/budgets/[id]/risk-analysis/route.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { riskSimulationRunInputSchema, riskVariablesSaveSchema } from "@/lib/validations/risk";
import { MONTE_CARLO_ITERATIONS } from "@/types/risk";

describe("risk validation", () => {
  it("accepts valid triangular quantity variables", () => {
    const parsed = riskVariablesSaveSchema.parse({
      variables: [
        {
          budgetItemId: "item-1",
          variableType: "QUANTITY",
          distributionType: "TRIANGULAR",
          minimum: 8,
          mostLikely: 10,
          maximum: 12,
          enabled: true,
        },
      ],
    });

    expect(parsed.variables[0]?.minimum).toBe(8);
  });

  it("rejects inverted triangular ranges", () => {
    expect(() =>
      riskVariablesSaveSchema.parse({
        variables: [
          {
            budgetItemId: "item-1",
            variableType: "QUANTITY",
            distributionType: "TRIANGULAR",
            minimum: 12,
            mostLikely: 10,
            maximum: 8,
            enabled: true,
          },
        ],
      }),
    ).toThrow();
  });

  it("requires the fixed phase-one iteration count for persisted runs", () => {
    const parsed = riskSimulationRunInputSchema.parse({
      iterations: MONTE_CARLO_ITERATIONS,
      baseTotal: 1000,
      mean: 1100,
      median: 1090,
      variance: 20,
      standardDeviation: 4.4721,
      skewness: 0,
      kurtosis: -1.2,
      p10: 950,
      p50: 1090,
      p80: 1150,
      p90: 1200,
      p95: 1250,
      histogramBins: [{ min: 900, max: 1000, midpoint: 950, frequency: 1, probability: 1 }],
      sCurvePoints: [{ cost: 1000, cumulativeProbability: 1 }],
    });

    expect(parsed.iterations).toBe(MONTE_CARLO_ITERATIONS);
  });
});
```

- [ ] **Step 4: Run tests**

Run:

```bash
npm run test -- app/api/budgets/[id]/risk-analysis/route.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add lib/validations/risk.ts lib/risk/data.ts app/api/budgets/[id]/risk-analysis/route.test.ts
git commit -m "feat: add risk analysis data services"
```

Expected: commit succeeds with validation, data service, and validation tests.

---

### Task 5: Add Risk API Routes

**Files:**

- Create: `app/api/budgets/[id]/risk-analysis/route.ts`
- Create: `app/api/budgets/[id]/risk-analysis/variables/route.ts`
- Create: `app/api/budgets/[id]/risk-analysis/runs/route.ts`

- [ ] **Step 1: Create GET route**

Create `app/api/budgets/[id]/risk-analysis/route.ts`:

```ts
import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth/session";
import { getRiskAnalysisPayload } from "@/lib/risk/data";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAuthSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const payload = await getRiskAnalysisPayload(id, session.user.id);
    return NextResponse.json(payload);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo cargar el analisis de riesgos" },
      { status: 400 },
    );
  }
}
```

- [ ] **Step 2: Create variables route**

Create `app/api/budgets/[id]/risk-analysis/variables/route.ts`:

```ts
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getAuthSession } from "@/lib/auth/session";
import { saveRiskVariables } from "@/lib/risk/data";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAuthSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const payload = await request.json();
    const result = await saveRiskVariables(id, session.user.id, payload);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: "Revisa los rangos de riesgo ingresados." }, { status: 400 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudieron guardar las variables de riesgo" },
      { status: 400 },
    );
  }
}
```

- [ ] **Step 3: Create runs route**

Create `app/api/budgets/[id]/risk-analysis/runs/route.ts`:

```ts
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getAuthSession } from "@/lib/auth/session";
import { saveRiskSimulationRun } from "@/lib/risk/data";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAuthSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const payload = await request.json();
    const result = await saveRiskSimulationRun(id, session.user.id, payload);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: "El resumen de simulacion no tiene el formato esperado." }, { status: 400 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo guardar la simulacion" },
      { status: 400 },
    );
  }
}
```

- [ ] **Step 4: Run targeted tests**

Run:

```bash
npm run test -- app/api/budgets/[id]/risk-analysis/route.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add app/api/budgets/[id]/risk-analysis
git commit -m "feat: add risk analysis api routes"
```

Expected: commit includes only new API route files.

---

### Task 6: Add Worker And Zustand Store

**Files:**

- Create: `lib/risk/monte-carlo.worker.ts`
- Create: `lib/risk/monte-carlo-worker-client.ts`
- Create: `lib/risk/store.ts`

- [ ] **Step 1: Create worker entry**

Create `lib/risk/monte-carlo.worker.ts`:

```ts
import type { RiskSimulationInput, RiskWorkerMessage } from "@/types/risk";
import { runMonteCarloSimulation } from "@/lib/risk/monte-carlo-engine";

const ctx: Worker = self as unknown as Worker;

ctx.onmessage = (event: MessageEvent<RiskSimulationInput>) => {
  try {
    const summary = runMonteCarloSimulation(event.data, {
      onProgress: (completedIterations, totalIterations) => {
        ctx.postMessage({ type: "progress", completedIterations, totalIterations } satisfies RiskWorkerMessage);
      },
    });

    ctx.postMessage({ type: "result", summary } satisfies RiskWorkerMessage);
  } catch (error) {
    ctx.postMessage({
      type: "error",
      message: error instanceof Error ? error.message : "No se pudo ejecutar la simulacion.",
    } satisfies RiskWorkerMessage);
  }
};
```

- [ ] **Step 2: Create worker client**

Create `lib/risk/monte-carlo-worker-client.ts`:

```ts
import type { RiskSimulationInput, RiskSimulationSummary, RiskWorkerMessage } from "@/types/risk";

export type RiskWorkerController = {
  cancel: () => void;
};

export function runRiskSimulationWorker({
  input,
  onProgress,
  onResult,
  onError,
}: {
  input: RiskSimulationInput;
  onProgress: (completedIterations: number, totalIterations: number) => void;
  onResult: (summary: RiskSimulationSummary) => void;
  onError: (message: string) => void;
}): RiskWorkerController {
  const worker = new Worker(new URL("./monte-carlo.worker.ts", import.meta.url), { type: "module" });

  worker.onmessage = (event: MessageEvent<RiskWorkerMessage>) => {
    const message = event.data;

    if (message.type === "progress") {
      onProgress(message.completedIterations, message.totalIterations);
      return;
    }

    if (message.type === "result") {
      onResult(message.summary);
      worker.terminate();
      return;
    }

    onError(message.message);
    worker.terminate();
  };

  worker.onerror = () => {
    onError("No se pudo iniciar el worker de simulacion.");
    worker.terminate();
  };

  worker.postMessage(input);

  return {
    cancel: () => worker.terminate(),
  };
}
```

- [ ] **Step 3: Create Zustand store**

Create `lib/risk/store.ts`:

```ts
"use client";

import { create } from "zustand";
import type { RiskSimulationSummary, RiskVariableRecord } from "@/types/risk";

type SimulationStatus = "idle" | "running" | "completed" | "failed";

type RiskStoreState = {
  variables: RiskVariableRecord[];
  latestRun: RiskSimulationSummary | null;
  status: SimulationStatus;
  progress: number;
  error: string;
  editingItemId: string | null;
  setVariables: (variables: RiskVariableRecord[]) => void;
  setLatestRun: (latestRun: RiskSimulationSummary | null) => void;
  startSimulation: () => void;
  setProgress: (completedIterations: number, totalIterations: number) => void;
  completeSimulation: (summary: RiskSimulationSummary) => void;
  failSimulation: (message: string) => void;
  setEditingItemId: (itemId: string | null) => void;
};

export const useRiskAnalysisStore = create<RiskStoreState>((set) => ({
  variables: [],
  latestRun: null,
  status: "idle",
  progress: 0,
  error: "",
  editingItemId: null,
  setVariables: (variables) => set({ variables }),
  setLatestRun: (latestRun) => set({ latestRun }),
  startSimulation: () => set({ status: "running", progress: 0, error: "" }),
  setProgress: (completedIterations, totalIterations) =>
    set({ progress: totalIterations > 0 ? completedIterations / totalIterations : 0 }),
  completeSimulation: (summary) => set({ latestRun: summary, status: "completed", progress: 1, error: "" }),
  failSimulation: (message) => set({ status: "failed", error: message }),
  setEditingItemId: (editingItemId) => set({ editingItemId }),
}));
```

- [ ] **Step 4: Run engine tests**

Run:

```bash
npm run test -- lib/risk/monte-carlo-engine.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add lib/risk/monte-carlo.worker.ts lib/risk/monte-carlo-worker-client.ts lib/risk/store.ts
git commit -m "feat: add risk simulation worker state"
```

Expected: commit includes worker and store files.

---

### Task 7: Build Risk Dashboard UI

**Files:**

- Create: `components/risk/risk-analysis-dashboard.tsx`
- Create: `components/risk/simulation-toolbar.tsx`
- Create: `components/risk/risk-kpi-cards.tsx`
- Create: `components/risk/risk-variables-table.tsx`
- Create: `components/risk/risk-variable-modal.tsx`
- Create: `components/risk/histogram-chart.tsx`
- Create: `components/risk/s-curve-chart.tsx`
- Create: `components/risk/percentiles-table.tsx`
- Create: `components/risk/risk-validation-panel.tsx`
- Create: `components/risk/risk-analysis-dashboard.test.tsx`

- [ ] **Step 1: Create formatting helpers inside dashboard file**

Create `components/risk/risk-analysis-dashboard.tsx` with imports, state initialization, simulation action, API saves, and composition:

```tsx
"use client";

import { useEffect, useMemo, useRef } from "react";
import type { RiskAnalysisPayload, RiskSimulationInput, RiskVariableRecord } from "@/types/risk";
import { MONTE_CARLO_ITERATIONS } from "@/types/risk";
import { runRiskSimulationWorker, type RiskWorkerController } from "@/lib/risk/monte-carlo-worker-client";
import { useRiskAnalysisStore } from "@/lib/risk/store";
import { formatCurrency, formatNumber } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { SimulationToolbar } from "@/components/risk/simulation-toolbar";
import { RiskKPICards } from "@/components/risk/risk-kpi-cards";
import { RiskVariablesTable } from "@/components/risk/risk-variables-table";
import { RiskVariableModal } from "@/components/risk/risk-variable-modal";
import { HistogramChart } from "@/components/risk/histogram-chart";
import { SCurveChart } from "@/components/risk/s-curve-chart";
import { PercentilesTable } from "@/components/risk/percentiles-table";
import { RiskValidationPanel } from "@/components/risk/risk-validation-panel";

export function RiskAnalysisDashboard({ payload, currencyDecimals }: { payload: RiskAnalysisPayload; currencyDecimals: number }) {
  const workerRef = useRef<RiskWorkerController | null>(null);
  const {
    completeSimulation,
    editingItemId,
    error,
    failSimulation,
    latestRun,
    progress,
    setEditingItemId,
    setLatestRun,
    setProgress,
    setVariables,
    startSimulation,
    status,
    variables,
  } = useRiskAnalysisStore();

  useEffect(() => {
    setVariables(payload.variables);
    setLatestRun(payload.latestRun);
  }, [payload.latestRun, payload.variables, setLatestRun, setVariables]);

  useEffect(() => {
    return () => workerRef.current?.cancel();
  }, []);

  const enabledVariables = useMemo(() => variables.filter((variable) => variable.enabled), [variables]);
  const editingItem = payload.items.find((item) => item.itemId === editingItemId) ?? null;
  const editingVariable = variables.find((variable) => variable.budgetItemId === editingItemId) ?? null;

  const runSimulation = () => {
    if (status === "running") return;

    const input: RiskSimulationInput = {
      budgetId: payload.budget.id,
      baseTotal: payload.budget.baseTotal,
      iterations: MONTE_CARLO_ITERATIONS,
      items: payload.items,
      variables,
    };

    startSimulation();
    workerRef.current?.cancel();
    workerRef.current = runRiskSimulationWorker({
      input,
      onProgress: setProgress,
      onResult: (summary) => {
        completeSimulation(summary);
        void persistRun(summary);
      },
      onError: failSimulation,
    });
  };

  const saveVariable = async (variable: RiskVariableRecord) => {
    const response = await fetch(`/api/budgets/${payload.budget.id}/risk-analysis/variables`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ variables: [variable] }),
    });

    const result = await response.json();
    if (!response.ok) {
      throw new Error(readApiError(result, "No se pudo guardar la variable de riesgo."));
    }

    setVariables(result.variables);
    setLatestRun(result.latestRun);
    setEditingItemId(null);
  };

  const deleteVariable = async (variable: RiskVariableRecord) => {
    const response = await fetch(`/api/budgets/${payload.budget.id}/risk-analysis/variables`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ variables: [{ ...variable, delete: true }] }),
    });

    const result = await response.json();
    if (!response.ok) {
      throw new Error(readApiError(result, "No se pudo eliminar la variable de riesgo."));
    }

    setVariables(result.variables);
    setLatestRun(result.latestRun);
    setEditingItemId(null);
  };

  const persistRun = async (summary: NonNullable<typeof latestRun>) => {
    const response = await fetch(`/api/budgets/${payload.budget.id}/risk-analysis/runs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(summary),
    });

    if (response.ok) {
      const result = await response.json();
      setLatestRun(result);
    }
  };

  return (
    <div className="space-y-5">
      <SimulationToolbar
        baseTotal={formatCurrency(payload.budget.baseTotal, payload.budget.currency, currencyDecimals)}
        budgetKind={payload.budget.kind}
        budgetName={payload.budget.name}
        enabledVariables={enabledVariables.length}
        error={error}
        itemCount={payload.items.length}
        lastRunAt={latestRun?.createdAt ?? null}
        onRunSimulation={runSimulation}
        progress={progress}
        status={status}
      />

      <RiskKPICards currency={payload.budget.currency} currencyDecimals={currencyDecimals} result={latestRun} />

      <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="overflow-hidden border-slate-200">
          <CardContent className="p-0">
            <RiskVariablesTable
              currency={payload.budget.currency}
              currencyDecimals={currencyDecimals}
              items={payload.items}
              onEditVariable={setEditingItemId}
              variables={variables}
            />
          </CardContent>
        </Card>

        <RiskValidationPanel items={payload.items} variables={variables} />
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <HistogramChart currency={payload.budget.currency} currencyDecimals={currencyDecimals} result={latestRun} />
        <SCurveChart currency={payload.budget.currency} currencyDecimals={currencyDecimals} result={latestRun} />
      </div>

      <PercentilesTable
        baseTotal={payload.budget.baseTotal}
        currency={payload.budget.currency}
        currencyDecimals={currencyDecimals}
        result={latestRun}
      />

      <RiskVariableModal
        item={editingItem}
        onClose={() => setEditingItemId(null)}
        onDelete={editingVariable ? () => deleteVariable(editingVariable) : undefined}
        onSave={saveVariable}
        variable={editingVariable}
      />
    </div>
  );
}

function readApiError(payload: unknown, fallback: string) {
  return typeof payload === "object" && payload !== null && "error" in payload && typeof payload.error === "string"
    ? payload.error
    : fallback;
}
```

- [ ] **Step 2: Create toolbar**

Create `components/risk/simulation-toolbar.tsx`:

```tsx
import { Activity, Play, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ContextBadge } from "@/components/ui/context-badges";

type SimulationStatus = "idle" | "running" | "completed" | "failed";

export function SimulationToolbar({
  baseTotal,
  budgetKind,
  budgetName,
  enabledVariables,
  error,
  itemCount,
  lastRunAt,
  onRunSimulation,
  progress,
  status,
}: {
  baseTotal: string;
  budgetKind: "GENERAL" | "SUB_BUDGET";
  budgetName: string;
  enabledVariables: number;
  error: string;
  itemCount: number;
  lastRunAt: string | null;
  onRunSimulation: () => void;
  progress: number;
  status: SimulationStatus;
}) {
  const running = status === "running";

  return (
    <Card className="border-slate-200">
      <CardContent className="space-y-4 p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-sky-600 text-white">
                <Activity className="h-4 w-4" />
              </span>
              <h1 className="text-xl font-semibold text-slate-950">Riesgos Monte Carlo</h1>
              <ContextBadge label={budgetKind === "GENERAL" ? "Presupuesto General" : "Sub Presupuesto"} tone="slate" />
            </div>
            <p className="mt-2 text-sm text-slate-500">
              {budgetName} · Base {baseTotal} · {itemCount} partidas · {enabledVariables} variables activas
            </p>
          </div>

          <Button onClick={onRunSimulation} disabled={running || enabledVariables === 0}>
            <Play className="mr-2 h-4 w-4" />
            {running ? "Simulando..." : "Ejecutar simulacion"}
          </Button>
        </div>

        <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-center">
          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-sky-600 transition-all" style={{ width: `${Math.round(progress * 100)}%` }} />
          </div>
          <p className="text-xs text-slate-500">
            {lastRunAt ? `Ultima simulacion: ${new Date(lastRunAt).toLocaleString()}` : "Sin simulaciones guardadas"}
          </p>
        </div>

        {error ? (
          <div className="flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            <ShieldAlert className="h-4 w-4" />
            {error}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 3: Create KPI cards**

Create `components/risk/risk-kpi-cards.tsx`:

```tsx
import { BarChart3, Gauge, LineChart, Sigma } from "lucide-react";
import type { RiskSimulationSummary } from "@/types/risk";
import { InfoCard } from "@/components/ui/info-cards";
import { formatCurrency, formatNumber } from "@/lib/utils";

export function RiskKPICards({
  currency,
  currencyDecimals,
  result,
}: {
  currency: string;
  currencyDecimals: number;
  result: RiskSimulationSummary | null;
}) {
  const values = [
    { label: "P50", value: result ? formatCurrency(result.p50, currency, currencyDecimals) : "-", icon: Gauge },
    { label: "P80", value: result ? formatCurrency(result.p80, currency, currencyDecimals) : "-", icon: LineChart },
    { label: "P90", value: result ? formatCurrency(result.p90, currency, currencyDecimals) : "-", icon: BarChart3 },
    { label: "Desv. estandar", value: result ? formatCurrency(result.standardDeviation, currency, currencyDecimals) : "-", icon: Sigma },
    { label: "Varianza", value: result ? formatNumber(result.variance, 2) : "-", icon: Sigma },
    { label: "Curtosis", value: result ? formatNumber(result.kurtosis, 4) : "-", icon: Gauge },
  ];

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
      {values.map((item) => {
        const Icon = item.icon;
        return <InfoCard key={item.label} label={item.label} value={item.value} icon={<Icon className="h-4 w-4" />} />;
      })}
    </div>
  );
}
```

- [ ] **Step 4: Create variables table**

Create `components/risk/risk-variables-table.tsx`:

```tsx
"use client";

import { createColumnHelper, flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { Pencil } from "lucide-react";
import type { RiskBudgetItem, RiskVariableRecord } from "@/types/risk";
import { Button } from "@/components/ui/button";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { formatCurrency, formatNumber } from "@/lib/utils";

type RiskVariableRow = RiskBudgetItem & {
  variable: RiskVariableRecord | null;
};

const columnHelper = createColumnHelper<RiskVariableRow>();

export function RiskVariablesTable({
  currency,
  currencyDecimals,
  items,
  onEditVariable,
  variables,
}: {
  currency: string;
  currencyDecimals: number;
  items: RiskBudgetItem[];
  onEditVariable: (itemId: string) => void;
  variables: RiskVariableRecord[];
}) {
  const rows = items.map((item) => ({
    ...item,
    variable: variables.find((variable) => variable.budgetItemId === item.itemId) ?? null,
  }));

  const table = useReactTable({
    data: rows,
    columns: [
      columnHelper.accessor("code", { header: "Codigo", cell: (info) => info.getValue() || "-" }),
      columnHelper.accessor("description", { header: "Partida", cell: (info) => info.getValue() }),
      columnHelper.accessor("sourceBudgetName", { header: "Origen", cell: (info) => info.getValue() }),
      columnHelper.accessor("baseQuantity", { header: "Cant. base", cell: (info) => formatNumber(info.getValue(), 4) }),
      columnHelper.display({ id: "minimum", header: "Min", cell: ({ row }) => formatOptionalNumber(row.original.variable?.minimum) }),
      columnHelper.display({ id: "mostLikely", header: "Probable", cell: ({ row }) => formatOptionalNumber(row.original.variable?.mostLikely) }),
      columnHelper.display({ id: "maximum", header: "Max", cell: ({ row }) => formatOptionalNumber(row.original.variable?.maximum) }),
      columnHelper.display({
        id: "baseTotal",
        header: "Parcial base",
        cell: ({ row }) => formatCurrency(row.original.baseTotal, currency, currencyDecimals),
      }),
      columnHelper.display({
        id: "enabled",
        header: "Estado",
        cell: ({ row }) => (row.original.variable?.enabled ? "Activo" : row.original.variable ? "Inactivo" : "Sin variable"),
      }),
      columnHelper.display({
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <Button size="sm" variant="outline" onClick={() => onEditVariable(row.original.itemId)}>
            <Pencil className="mr-2 h-4 w-4" />
            Editar
          </Button>
        ),
      }),
    ],
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="max-h-[560px] overflow-auto">
      <Table className="min-w-[1100px]">
        <THead className="sticky top-0 z-10 bg-slate-100">
          {table.getHeaderGroups().map((headerGroup) => (
            <TR key={headerGroup.id} className="hover:bg-slate-100">
              {headerGroup.headers.map((header) => (
                <TH key={header.id} className="border-r border-slate-200 text-xs uppercase">
                  {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                </TH>
              ))}
            </TR>
          ))}
        </THead>
        <TBody>
          {table.getRowModel().rows.map((row) => (
            <TR key={row.id} className="h-11">
              {row.getVisibleCells().map((cell) => (
                <TD key={cell.id} className="border-r border-slate-100 px-3 py-2 text-xs">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TD>
              ))}
            </TR>
          ))}
        </TBody>
      </Table>
    </div>
  );
}

function formatOptionalNumber(value: number | undefined) {
  return typeof value === "number" ? formatNumber(value, 4) : "-";
}
```

- [ ] **Step 5: Create modal**

Create `components/risk/risk-variable-modal.tsx`:

```tsx
"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useEffect, useState } from "react";
import type { RiskBudgetItem, RiskVariableRecord } from "@/types/risk";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function RiskVariableModal({
  item,
  onClose,
  onDelete,
  onSave,
  variable,
}: {
  item: RiskBudgetItem | null;
  onClose: () => void;
  onDelete?: () => Promise<void>;
  onSave: (variable: RiskVariableRecord) => Promise<void>;
  variable: RiskVariableRecord | null;
}) {
  const [minimum, setMinimum] = useState("");
  const [mostLikely, setMostLikely] = useState("");
  const [maximum, setMaximum] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setMinimum(String(variable?.minimum ?? item?.baseQuantity ?? 0));
    setMostLikely(String(variable?.mostLikely ?? item?.baseQuantity ?? 0));
    setMaximum(String(variable?.maximum ?? item?.baseQuantity ?? 0));
    setEnabled(variable?.enabled ?? true);
    setError("");
  }, [item, variable]);

  if (!item) return null;

  const save = async () => {
    const min = Number(minimum);
    const likely = Number(mostLikely);
    const max = Number(maximum);

    if (!Number.isFinite(min) || !Number.isFinite(likely) || !Number.isFinite(max) || min < 0 || likely < 0 || max < 0) {
      setError("Ingresa valores numericos no negativos.");
      return;
    }

    if (min > likely || likely > max) {
      setError("El rango debe cumplir Min <= Probable <= Max.");
      return;
    }

    setSaving(true);
    try {
      await onSave({
        id: variable?.id ?? `${item.itemId}:quantity`,
        budgetId: variable?.budgetId ?? item.budgetId,
        budgetItemId: item.itemId,
        variableType: "QUANTITY",
        distributionType: "TRIANGULAR",
        minimum: min,
        mostLikely: likely,
        maximum: max,
        enabled,
      });
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "No se pudo guardar la variable.");
    } finally {
      setSaving(false);
    }
  };

  const deleteCurrent = async () => {
    if (!onDelete) return;
    setSaving(true);
    try {
      await onDelete();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "No se pudo eliminar la variable.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog.Root open onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-slate-950/30 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(92vw,560px)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Dialog.Title className="text-lg font-semibold text-slate-950">Variable de riesgo</Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-slate-500">
                {item.code || "Sin codigo"} · {item.description}
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700" type="button">
                <X className="h-4 w-4" />
              </button>
            </Dialog.Close>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            <Field label="Min" value={minimum} onChange={setMinimum} />
            <Field label="Probable" value={mostLikely} onChange={setMostLikely} />
            <Field label="Max" value={maximum} onChange={setMaximum} />
          </div>

          <label className="mt-4 flex items-center gap-2 text-sm text-slate-700">
            <input checked={enabled} onChange={(event) => setEnabled(event.target.checked)} type="checkbox" />
            Variable activa
          </label>

          {error ? <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

          <div className="mt-5 flex justify-between gap-3">
            <Button disabled={saving || !onDelete} onClick={deleteCurrent} type="button" variant="outline">
              Eliminar
            </Button>
            <div className="flex gap-2">
              <Button disabled={saving} onClick={onClose} type="button" variant="ghost">
                Cancelar
              </Button>
              <Button disabled={saving} onClick={save} type="button">
                Guardar
              </Button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function Field({ label, onChange, value }: { label: string; onChange: (value: string) => void; value: string }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input inputMode="decimal" value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}
```

- [ ] **Step 6: Create charts and percentile table**

Create `components/risk/histogram-chart.tsx`:

```tsx
"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { RiskSimulationSummary } from "@/types/risk";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";

export function HistogramChart({ currency, currencyDecimals, result }: { currency: string; currencyDecimals: number; result: RiskSimulationSummary | null }) {
  return (
    <Card className="border-slate-200">
      <CardHeader>
        <CardTitle>Histograma</CardTitle>
      </CardHeader>
      <CardContent className="h-80">
        {result ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={result.histogramBins}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis dataKey="midpoint" tickFormatter={(value) => formatCurrency(Number(value), currency, currencyDecimals)} tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(value) => [String(value), "Frecuencia"]} labelFormatter={(value) => formatCurrency(Number(value), currency, currencyDecimals)} />
              <Bar dataKey="frequency" fill="#2563EB" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-slate-500">Ejecuta una simulacion para ver el histograma.</div>
        )}
      </CardContent>
    </Card>
  );
}
```

Create `components/risk/s-curve-chart.tsx`:

```tsx
"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { RiskSimulationSummary } from "@/types/risk";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";

export function SCurveChart({ currency, currencyDecimals, result }: { currency: string; currencyDecimals: number; result: RiskSimulationSummary | null }) {
  return (
    <Card className="border-slate-200">
      <CardHeader>
        <CardTitle>Curva S acumulada</CardTitle>
      </CardHeader>
      <CardContent className="h-80">
        {result ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={result.sCurvePoints}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis dataKey="cost" tickFormatter={(value) => formatCurrency(Number(value), currency, currencyDecimals)} tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={(value) => `${Math.round(Number(value) * 100)}%`} tick={{ fontSize: 11 }} />
              <Tooltip
                formatter={(value) => [`${Math.round(Number(value) * 100)}%`, "Probabilidad acumulada"]}
                labelFormatter={(value) => formatCurrency(Number(value), currency, currencyDecimals)}
              />
              <Line type="monotone" dataKey="cumulativeProbability" stroke="#10B981" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-slate-500">Ejecuta una simulacion para ver la curva S.</div>
        )}
      </CardContent>
    </Card>
  );
}
```

Create `components/risk/percentiles-table.tsx`:

```tsx
import type { RiskPercentileKey, RiskSimulationSummary } from "@/types/risk";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { formatCurrency, formatNumber } from "@/lib/utils";

const percentileRows: Array<{ key: RiskPercentileKey; label: string }> = [
  { key: "p10", label: "P10" },
  { key: "p50", label: "P50" },
  { key: "p80", label: "P80" },
  { key: "p90", label: "P90" },
  { key: "p95", label: "P95" },
];

export function PercentilesTable({
  baseTotal,
  currency,
  currencyDecimals,
  result,
}: {
  baseTotal: number;
  currency: string;
  currencyDecimals: number;
  result: RiskSimulationSummary | null;
}) {
  return (
    <Card className="border-slate-200">
      <CardHeader>
        <CardTitle>Percentiles y contingencia</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <THead>
            <TR>
              <TH>Percentil</TH>
              <TH>Monto</TH>
              <TH>Diferencia vs base</TH>
              <TH>Contingencia</TH>
            </TR>
          </THead>
          <TBody>
            {percentileRows.map((row) => {
              const value = result?.[row.key] ?? 0;
              const delta = value - baseTotal;
              const contingency = baseTotal > 0 ? delta / baseTotal : 0;
              return (
                <TR key={row.key}>
                  <TD className="font-medium text-slate-900">{row.label}</TD>
                  <TD>{result ? formatCurrency(value, currency, currencyDecimals) : "-"}</TD>
                  <TD>{result ? formatCurrency(delta, currency, currencyDecimals) : "-"}</TD>
                  <TD>{result ? `${formatNumber(contingency * 100, 2)}%` : "-"}</TD>
                </TR>
              );
            })}
          </TBody>
        </Table>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 7: Create validation panel**

Create `components/risk/risk-validation-panel.tsx`:

```tsx
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import type { RiskBudgetItem, RiskVariableRecord } from "@/types/risk";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function RiskValidationPanel({ items, variables }: { items: RiskBudgetItem[]; variables: RiskVariableRecord[] }) {
  const itemIds = new Set(items.map((item) => item.itemId));
  const issues = [
    ...items.filter((item) => item.baseQuantity <= 0).map((item) => `${item.code || "Partida"} sin cantidad base positiva.`),
    ...items.filter((item) => item.unitPrice <= 0).map((item) => `${item.code || "Partida"} sin precio unitario positivo.`),
    ...variables
      .filter((variable) => variable.minimum > variable.mostLikely || variable.mostLikely > variable.maximum)
      .map(() => "Una variable no cumple Min <= Probable <= Max."),
    ...variables.filter((variable) => !itemIds.has(variable.budgetItemId)).map(() => "Una variable apunta a una partida fuera del alcance."),
  ];

  return (
    <Card className="border-slate-200">
      <CardHeader>
        <CardTitle>Control de calidad</CardTitle>
      </CardHeader>
      <CardContent>
        {issues.length === 0 ? (
          <div className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            <CheckCircle2 className="h-4 w-4" />
            Variables listas para simulacion.
          </div>
        ) : (
          <div className="space-y-2">
            {issues.map((issue, index) => (
              <div key={`${issue}-${index}`} className="flex items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                <AlertTriangle className="h-4 w-4" />
                {issue}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 8: Add smoke UI test**

Create `components/risk/risk-analysis-dashboard.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RiskAnalysisDashboard } from "@/components/risk/risk-analysis-dashboard";
import type { RiskAnalysisPayload } from "@/types/risk";

describe("RiskAnalysisDashboard", () => {
  it("renders risk dashboard without simulation results", () => {
    const payload: RiskAnalysisPayload = {
      budget: {
        id: "budget-1",
        projectId: "project-1",
        name: "Presupuesto General",
        kind: "GENERAL",
        currency: "PEN",
        baseTotal: 1000,
      },
      items: [
        {
          itemId: "item-1",
          budgetId: "child-1",
          sourceBudgetName: "Estructuras",
          code: "01.01",
          description: "Excavacion",
          unit: "m3",
          baseQuantity: 10,
          unitPrice: 100,
          baseTotal: 1000,
        },
      ],
      variables: [],
      latestRun: null,
    };

    render(<RiskAnalysisDashboard payload={payload} currencyDecimals={2} />);

    expect(screen.getByText("Riesgos Monte Carlo")).toBeInTheDocument();
    expect(screen.getByText("Excavacion")).toBeInTheDocument();
    expect(screen.getByText("Ejecuta una simulacion para ver el histograma.")).toBeInTheDocument();
  });
});
```

- [ ] **Step 9: Run UI test**

Run:

```bash
npm run test -- components/risk/risk-analysis-dashboard.test.tsx
```

Expected: PASS.

- [ ] **Step 10: Commit**

Run:

```bash
git add components/risk
git commit -m "feat: add monte carlo risk dashboard"
```

Expected: commit includes risk UI components and UI test.

---

### Task 8: Add Route Page And Navigation Entry Points

**Files:**

- Create: `app/budgets/[id]/risk-analysis/page.tsx`
- Modify: `app/budgets/[id]/page.tsx`
- Modify: `components/budget/budget-editor.tsx`

- [ ] **Step 1: Create route page**

Create `app/budgets/[id]/risk-analysis/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import { RiskAnalysisDashboard } from "@/components/risk/risk-analysis-dashboard";
import { AppShell } from "@/components/layout/app-shell";
import { getAuthSession } from "@/lib/auth/session";
import { getRiskAnalysisPayload } from "@/lib/risk/data";
import { getUserSettings } from "@/lib/data/settings";

export default async function BudgetRiskAnalysisPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getAuthSession();
  if (!session) {
    notFound();
  }

  const [settings, payload] = await Promise.all([
    getUserSettings(session.user.id),
    getRiskAnalysisPayload(id, session.user.id).catch(() => null),
  ]);

  if (!payload) {
    notFound();
  }

  return (
    <AppShell currentUser={session.user} settings={settings}>
      <RiskAnalysisDashboard payload={payload} currencyDecimals={settings.currencyDecimals} />
    </AppShell>
  );
}
```

- [ ] **Step 2: Add general budget quick action**

In `app/budgets/[id]/page.tsx`, add `ShieldAlert` or `Activity` to the lucide import:

```tsx
import { Activity, ArrowRight, Calculator, FileSpreadsheet, ListTree, ReceiptText, Sigma } from "lucide-react";
```

Inside the `BudgetQuickActionLink` list for general budgets, add:

```tsx
<BudgetQuickActionLink
  href={`/budgets/${budget.id}/risk-analysis`}
  title="Riesgos Monte Carlo"
  description="Simulacion probabilistica de metrados, percentiles y contingencias del presupuesto."
  icon={<Activity className="h-5 w-5" />}
  tone="primary"
/>
```

- [ ] **Step 3: Add sub-budget action in editor header**

In `components/budget/budget-editor.tsx`, add `Activity` and `Link` if not already available:

```tsx
import Link from "next/link";
import { Activity, BotMessageSquare, ChevronLeft, ChevronRight, ExternalLink, GripVertical, MoreHorizontal, Plus, Rows3, Sparkles, Type, WandSparkles } from "lucide-react";
```

Find the main editor header action group that already contains budget actions. Add:

```tsx
<Link href={`/budgets/${budget.id}/risk-analysis`}>
  <Button type="button" variant="outline">
    <Activity className="mr-2 h-4 w-4" />
    Riesgos
  </Button>
</Link>
```

If the file already imports `Link` or `Activity`, merge imports without duplication.

- [ ] **Step 4: Run route/UI tests**

Run:

```bash
npm run test -- components/risk/risk-analysis-dashboard.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add app/budgets/[id]/risk-analysis/page.tsx app/budgets/[id]/page.tsx components/budget/budget-editor.tsx
git commit -m "feat: add risk analysis route navigation"
```

Expected: commit includes route page and navigation entry points.

---

### Task 9: Final Verification And Build Fixes

**Files:**

- Modify only files required by failing tests, lint, or build.

- [ ] **Step 1: Run all tests**

Run:

```bash
npm run test
```

Expected: PASS. If a test fails, fix the smallest related implementation issue and rerun the failed test first, then rerun all tests.

- [ ] **Step 2: Run lint**

Run:

```bash
npm run lint
```

Expected: PASS. Fix only lint errors introduced by this feature.

- [ ] **Step 3: Run production build**

Run:

```bash
npm run build
```

Expected: PASS. If worker bundling fails, verify `new Worker(new URL("./monte-carlo.worker.ts", import.meta.url), { type: "module" })` remains in a client-only import path.

- [ ] **Step 4: Commit verification fixes**

If any verification fixes were needed, run:

```bash
git add <fixed-files>
git commit -m "fix: stabilize monte carlo risk analysis"
```

Expected: commit includes only verification fixes.

- [ ] **Step 5: Manual smoke check**

Run:

```bash
npm run dev
```

Open a budget URL:

```txt
http://localhost:3000/budgets/<budget-id>/risk-analysis
```

Expected:

- Page loads inside the app shell.
- Table displays budget items.
- Modal opens from an item row.
- Saving a triangular variable persists and closes modal.
- Running simulation shows progress and then updates KPIs, histogram, S-curve, and percentile table.
- Refreshing page shows persisted variables and latest run summary.

---

## Self-Review

Spec coverage:

- Persistent variables: Task 2 and Task 4.
- Latest summarized run: Task 2, Task 4, Task 5.
- General and sub-budget support: Task 4 and Task 8.
- Triangular quantity-only simulation: Task 3.
- 10,000 iterations: Task 3 and Task 6.
- Web worker: Task 6.
- Zustand: Task 6.
- TanStack Table: Task 7.
- Recharts: Task 1 and Task 7.
- KPI cards, histogram, S-curve, percentiles, modal: Task 7.
- Navigation: Task 8.
- Verification: Task 9.

Red-flag scan:

- The plan intentionally uses `<timestamp>` and `<budget-id>` only where the value is generated by a command or user data during execution.
- There are no unresolved implementation gaps.

Type consistency:

- Shared contracts come from `types/risk.ts`.
- `RiskSimulationSummary`, `RiskVariableRecord`, and `RiskAnalysisPayload` are used consistently by API, worker, store, and UI.
