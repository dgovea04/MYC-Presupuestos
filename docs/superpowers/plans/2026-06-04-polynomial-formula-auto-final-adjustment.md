# Polynomial Formula Auto Final Adjustment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an optional `Aplicar ajuste automatico` action that turns the current preliminary polynomial formula monomials into a previewed final grouping that follows Peruvian formula-polynomial rules.

**Architecture:** Keep all grouping and learning logic in pure services under `lib/polynomial-formula/`. The existing smart monomial generation remains the preliminary stage; the new final-adjustment engine consumes current editable monomials, optional experience hints, and returns a preview proposal that the UI applies only after confirmation.

**Tech Stack:** Next.js App Router, TypeScript strict mode, Decimal.js, Vitest, React client components, Tailwind/shadcn-style local components, lucide-react.

---

## Scope Check

This plan implements one feature area: automatic final adjustment of an existing polynomial formula proposal. It includes the pure final-adjustment engine, experience scoring, preview UI, editor integration, and tests. It does not add server persistence for explicit merge-history records in this first pass; experience is provided through a typed interface and covered by pure tests so persistence can be added later without changing the engine contract.

## File Structure

- Create: `lib/polynomial-formula/final-adjustment-types.ts`
  - Defines engine options, diagnostics, merge-plan entries, experience hints, and result types.
- Create: `lib/polynomial-formula/final-adjustment-engine.ts`
  - Pure deterministic grouping engine. It preserves labor/general expenses, merges low-incidence monomials, reduces to 8 maximum, uses experience hints as scoring boosts, recalculates coefficients, and emits diagnostics.
- Create: `lib/polynomial-formula/final-adjustment-engine.test.ts`
  - Focused domain tests for normative constraints, affinity ranking, experience influence, and preview result shape.
- Create: `components/budget/polynomial-auto-adjustment-preview-dialog.tsx`
  - Client preview dialog that shows before/after monomial groups, merge reasons, diagnostics, and `Aplicar propuesta`.
- Create: `components/budget/polynomial-auto-adjustment-preview-dialog.test.tsx`
  - UI tests that verify preview rendering, cancel behavior, blocking errors, and apply callback.
- Modify: `components/budget/polynomial-monomials-table.tsx`
  - Adds `onAutoAdjustMonomials` prop and renders `Aplicar ajuste automatico` next to `Juntar monomios`.
- Modify: `components/budget/polynomial-formula-editor.tsx`
  - Computes preview with the pure engine, opens dialog, applies proposal only after confirmation, and preserves summary/K preview invalidation.
- Create: `components/budget/polynomial-formula-editor.auto-adjustment.test.tsx`
  - Covers preview-before-apply behavior in the formula editor.

---

### Task 1: Add Final Adjustment Types

**Files:**
- Create: `lib/polynomial-formula/final-adjustment-types.ts`

- [ ] **Step 1: Create the type module**

Create `lib/polynomial-formula/final-adjustment-types.ts` with:

```ts
import type { PolynomialCostGroupKey, PolynomialMonomialRecord } from "@/types/polynomial-formula";

export type FinalAdjustmentDiagnosticSeverity = "INFO" | "WARNING" | "ERROR";

export type FinalAdjustmentDiagnosticCode =
  | "FINAL_MONOMIAL_COUNT_BELOW_MINIMUM"
  | "FINAL_MONOMIAL_COUNT_ABOVE_MAXIMUM"
  | "LOW_COEFFICIENT_MERGED"
  | "LOW_COEFFICIENT_UNRESOLVED"
  | "CROSS_AFFINITY_FALLBACK"
  | "EXPERIENCE_HINT_USED"
  | "EXPERIENCE_HINT_REJECTED"
  | "COEFFICIENT_NORMALIZED";

export type FinalAdjustmentDiagnostic = {
  readonly code: FinalAdjustmentDiagnosticCode;
  readonly severity: FinalAdjustmentDiagnosticSeverity;
  readonly message: string;
  readonly monomialIds?: readonly string[];
};

export type FinalAdjustmentMergeReason =
  | "SAME_IU_CODE"
  | "SAME_IU_FAMILY"
  | "COMPATIBLE_FAMILY"
  | "SAME_BROAD_GROUP"
  | "HIGHEST_INCIDENCE_FALLBACK"
  | "EXPERIENCE_HINT";

export type FinalAdjustmentMergePlanEntry = {
  readonly targetMonomialId: string;
  readonly sourceMonomialIds: readonly string[];
  readonly reason: FinalAdjustmentMergeReason;
  readonly explanation: string;
};

export type FinalAdjustmentExperienceHint = {
  readonly sourceIuFamily?: string;
  readonly sourceUnifiedIndexCode?: string;
  readonly targetIuFamily?: string;
  readonly targetUnifiedIndexCode?: string;
  readonly targetCode?: string;
  readonly targetName?: string;
  readonly costGroupKey?: PolynomialCostGroupKey;
  readonly weight: number;
  readonly evidenceLabel: string;
};

export type FinalAdjustmentOptions = {
  readonly minCoefficient: string;
  readonly minMonomials: number;
  readonly maxMonomials: number;
  readonly coefficientDecimals: number;
  readonly experienceHints?: readonly FinalAdjustmentExperienceHint[];
};

export type FinalAdjustmentResult = {
  readonly originalMonomials: readonly PolynomialMonomialRecord[];
  readonly finalMonomials: readonly PolynomialMonomialRecord[];
  readonly mergePlan: readonly FinalAdjustmentMergePlanEntry[];
  readonly diagnostics: readonly FinalAdjustmentDiagnostic[];
  readonly canApply: boolean;
};

export const DEFAULT_FINAL_ADJUSTMENT_OPTIONS: FinalAdjustmentOptions = {
  minCoefficient: "0.050",
  minMonomials: 5,
  maxMonomials: 8,
  coefficientDecimals: 3,
  experienceHints: [],
};
```

- [ ] **Step 2: Run type-aware tests for import health**

Run:

```bash
npm run test -- lib/polynomial-formula/smart-monomial-engine.test.ts
```

Expected: PASS. This only checks that adding the module did not disturb existing polynomial formula tests.

- [ ] **Step 3: Commit**

```bash
git add lib/polynomial-formula/final-adjustment-types.ts
git commit -m "Add polynomial final adjustment types"
```

---

### Task 2: Build The Pure Final Adjustment Engine

**Files:**
- Create: `lib/polynomial-formula/final-adjustment-engine.ts`
- Create: `lib/polynomial-formula/final-adjustment-engine.test.ts`
- Read: `lib/calculations/polynomial-formula.ts`
- Read: `lib/polynomial-formula/iu-family-classifier.ts`

- [ ] **Step 1: Write failing tests for final normative grouping**

Create `lib/polynomial-formula/final-adjustment-engine.test.ts` with:

```ts
import { describe, expect, it } from "vitest";

import { createPolynomialFinalAdjustmentProposal } from "@/lib/polynomial-formula/final-adjustment-engine";
import type { PolynomialCostGroupKey, PolynomialMonomialRecord } from "@/types/polynomial-formula";

function monomial(input: {
  id: string;
  code: string;
  name: string;
  costGroupKey: PolynomialCostGroupKey;
  amount: string;
  coefficient: string;
  iuFamily?: string;
  unifiedIndexCode?: string;
  unifiedIndexName?: string;
}): PolynomialMonomialRecord {
  return {
    id: input.id,
    formulaId: "formula-1",
    code: input.code,
    name: input.name,
    costGroupKey: input.costGroupKey,
    amount: input.amount,
    coefficient: input.coefficient,
    baseIndexCode: input.unifiedIndexCode ?? input.code,
    baseIndexName: input.unifiedIndexName ?? input.name,
    baseIndexValue: "100",
    adjustmentIndexCode: null,
    adjustmentIndexName: null,
    adjustmentIndexValue: null,
    sortOrder: 0,
    composition: [
      {
        id: `${input.id}-component`,
        monomialId: input.id,
        amount: input.amount,
        unifiedIndexCode: input.unifiedIndexCode,
        unifiedIndexName: input.unifiedIndexName,
        iuFamily: input.iuFamily,
        participationPercentage: "1",
        coefficientContribution: input.coefficient,
      },
    ],
  };
}

function coefficients(result: ReturnType<typeof createPolynomialFinalAdjustmentProposal>) {
  return result.finalMonomials.map((item) => item.coefficient);
}

describe("createPolynomialFinalAdjustmentProposal", () => {
  it("reduces preliminary monomials to a valid final formula without mutating input", () => {
    const input = [
      monomial({ id: "mo", code: "MO", name: "Mano de obra", costGroupKey: "LABOR", amount: "390", coefficient: "0.390", iuFamily: "LABOR", unifiedIndexCode: "47" }),
      monomial({ id: "cement", code: "CE", name: "Cemento", costGroupKey: "MATERIALS", amount: "64", coefficient: "0.064", iuFamily: "CEMENT", unifiedIndexCode: "21" }),
      monomial({ id: "aggregate", code: "AG", name: "Agregado", costGroupKey: "MATERIALS", amount: "24", coefficient: "0.024", iuFamily: "AGGREGATES", unifiedIndexCode: "5" }),
      monomial({ id: "masonry", code: "LA", name: "Ladrillos", costGroupKey: "MATERIALS", amount: "91", coefficient: "0.091", iuFamily: "MASONRY", unifiedIndexCode: "17" }),
      monomial({ id: "tile", code: "BA", name: "Baldosa", costGroupKey: "MATERIALS", amount: "64", coefficient: "0.064", iuFamily: "FINISHES", unifiedIndexCode: "16" }),
      monomial({ id: "ceramic", code: "CR", name: "Ceramica", costGroupKey: "MATERIALS", amount: "24", coefficient: "0.024", iuFamily: "FINISHES", unifiedIndexCode: "24" }),
      monomial({ id: "wood-strip", code: "MT", name: "Madera tira", costGroupKey: "MATERIALS", amount: "17", coefficient: "0.017", iuFamily: "WOOD", unifiedIndexCode: "41" }),
      monomial({ id: "wood", code: "MA", name: "Madera", costGroupKey: "MATERIALS", amount: "47", coefficient: "0.047", iuFamily: "WOOD", unifiedIndexCode: "43" }),
      monomial({ id: "paint", code: "PI", name: "Pintura", costGroupKey: "MATERIALS", amount: "30", coefficient: "0.030", iuFamily: "FINISHES", unifiedIndexCode: "54" }),
      monomial({ id: "gg", code: "GG", name: "Gastos generales", costGroupKey: "GENERAL_EXPENSES_PROFIT", amount: "250", coefficient: "0.250", iuFamily: "GENERAL_EXPENSES", unifiedIndexCode: "39" }),
    ];

    const result = createPolynomialFinalAdjustmentProposal(input);

    expect(result.canApply).toBe(true);
    expect(result.finalMonomials).toHaveLength(5);
    expect(result.finalMonomials.map((item) => item.code)).toEqual(["MO", "CE", "LA", "BA", "GG"]);
    expect(result.finalMonomials.every((item) => Number(item.coefficient) >= 0.05)).toBe(true);
    expect(coefficients(result).reduce((sum, value) => sum + Number(value), 0).toFixed(3)).toBe("1.000");
    expect(result.mergePlan.length).toBeGreaterThan(0);
    expect(input.find((item) => item.id === "aggregate")?.amount).toBe("24");
  });

  it("keeps labor and general expenses independent when low-incidence items need merging", () => {
    const result = createPolynomialFinalAdjustmentProposal([
      monomial({ id: "mo", code: "MO", name: "Mano de obra", costGroupKey: "LABOR", amount: "370", coefficient: "0.370", iuFamily: "LABOR", unifiedIndexCode: "47" }),
      monomial({ id: "steel", code: "AC", name: "Acero", costGroupKey: "MATERIALS", amount: "180", coefficient: "0.180", iuFamily: "STEEL", unifiedIndexCode: "3" }),
      monomial({ id: "steel-small", code: "AL", name: "Acero liso", costGroupKey: "MATERIALS", amount: "15", coefficient: "0.015", iuFamily: "STEEL", unifiedIndexCode: "2" }),
      monomial({ id: "gg", code: "GG", name: "Gastos generales", costGroupKey: "GENERAL_EXPENSES_PROFIT", amount: "435", coefficient: "0.435", iuFamily: "GENERAL_EXPENSES", unifiedIndexCode: "39" }),
    ]);

    expect(result.finalMonomials.map((item) => item.id)).toContain("mo");
    expect(result.finalMonomials.map((item) => item.id)).toContain("gg");
    expect(result.finalMonomials.find((item) => item.id === "mo")?.composition).toHaveLength(1);
    expect(result.finalMonomials.find((item) => item.id === "gg")?.composition).toHaveLength(1);
    expect(result.finalMonomials.find((item) => item.id === "steel")?.composition.map((row) => row.unifiedIndexCode)).toEqual(["3", "2"]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
node ./node_modules/vitest/vitest.mjs run lib/polynomial-formula/final-adjustment-engine.test.ts
```

Expected: FAIL because `final-adjustment-engine.ts` does not exist.

- [ ] **Step 3: Implement the engine**

Create `lib/polynomial-formula/final-adjustment-engine.ts` with:

```ts
import Decimal from "decimal.js";

import { calculateMonomialCoefficients } from "@/lib/calculations/polynomial-formula";
import {
  DEFAULT_FINAL_ADJUSTMENT_OPTIONS,
  type FinalAdjustmentDiagnostic,
  type FinalAdjustmentExperienceHint,
  type FinalAdjustmentMergePlanEntry,
  type FinalAdjustmentMergeReason,
  type FinalAdjustmentOptions,
  type FinalAdjustmentResult,
} from "@/lib/polynomial-formula/final-adjustment-types";
import { normalizeUnifiedIndexCodeForPolynomialFormula } from "@/lib/polynomial-formula/iu-family-classifier";
import type { PolynomialMonomialCompositionRecord, PolynomialMonomialRecord } from "@/types/polynomial-formula";

const ZERO = new Decimal(0);
const COMPOSITION_DECIMALS = 6;

const compatibleFamilyClusters: readonly (readonly string[])[] = [
  ["CEMENT", "AGGREGATES", "MASONRY"],
  ["STEEL"],
  ["WOOD"],
  ["FINISHES"],
  ["SANITARY_INSTALLATIONS"],
  ["ELECTRICAL_INSTALLATIONS"],
  ["EQUIPMENT"],
  ["OTHERS"],
];

type MutableMonomial = PolynomialMonomialRecord & {
  amountDecimal: Decimal;
};

function toDecimal(value: string): Decimal {
  return new Decimal(value);
}

function formatFixed(value: Decimal.Value, decimalPlaces: number): string {
  return new Decimal(value).toDecimalPlaces(decimalPlaces).toFixed(decimalPlaces);
}

function cloneMonomial(monomial: PolynomialMonomialRecord): MutableMonomial {
  return {
    ...monomial,
    composition: monomial.composition.map((row) => ({ ...row })),
    amountDecimal: toDecimal(monomial.amount),
  };
}

function primaryIuFamily(monomial: PolynomialMonomialRecord): string | undefined {
  return monomial.composition.find((row) => row.iuFamily)?.iuFamily ?? undefined;
}

function primaryUnifiedIndexCode(monomial: PolynomialMonomialRecord): string | undefined {
  return normalizeUnifiedIndexCodeForPolynomialFormula(
    monomial.composition.find((row) => row.unifiedIndexCode)?.unifiedIndexCode ?? monomial.baseIndexCode,
  );
}

function isLocked(monomial: PolynomialMonomialRecord): boolean {
  return monomial.costGroupKey === "LABOR" || monomial.costGroupKey === "GENERAL_EXPENSES_PROFIT";
}

function clusterIndex(family: string | undefined): number {
  if (!family) return Number.MAX_SAFE_INTEGER;
  const index = compatibleFamilyClusters.findIndex((cluster) => cluster.includes(family));
  return index === -1 ? Number.MAX_SAFE_INTEGER : index;
}

function experienceScore(
  source: PolynomialMonomialRecord,
  target: PolynomialMonomialRecord,
  hints: readonly FinalAdjustmentExperienceHint[],
): number {
  const sourceFamily = primaryIuFamily(source);
  const targetFamily = primaryIuFamily(target);
  const sourceCode = primaryUnifiedIndexCode(source);
  const targetCode = primaryUnifiedIndexCode(target);

  return hints.reduce((score, hint) => {
    const sourceMatches =
      (!hint.sourceIuFamily || hint.sourceIuFamily === sourceFamily) &&
      (!hint.sourceUnifiedIndexCode || normalizeUnifiedIndexCodeForPolynomialFormula(hint.sourceUnifiedIndexCode) === sourceCode);
    const targetMatches =
      (!hint.targetIuFamily || hint.targetIuFamily === targetFamily) &&
      (!hint.targetUnifiedIndexCode || normalizeUnifiedIndexCodeForPolynomialFormula(hint.targetUnifiedIndexCode) === targetCode) &&
      (!hint.targetCode || hint.targetCode === target.code) &&
      (!hint.costGroupKey || hint.costGroupKey === target.costGroupKey);

    return sourceMatches && targetMatches ? score + hint.weight : score;
  }, 0);
}

function affinityScore(
  source: PolynomialMonomialRecord,
  target: PolynomialMonomialRecord,
  hints: readonly FinalAdjustmentExperienceHint[],
): { score: number; reason: FinalAdjustmentMergeReason } {
  const sourceCode = primaryUnifiedIndexCode(source);
  const targetCode = primaryUnifiedIndexCode(target);
  const sourceFamily = primaryIuFamily(source);
  const targetFamily = primaryIuFamily(target);
  const learnedScore = experienceScore(source, target, hints);

  if (learnedScore > 0) return { score: 1000 + learnedScore, reason: "EXPERIENCE_HINT" };
  if (sourceCode && sourceCode === targetCode) return { score: 900, reason: "SAME_IU_CODE" };
  if (sourceFamily && sourceFamily === targetFamily) return { score: 800, reason: "SAME_IU_FAMILY" };
  if (clusterIndex(sourceFamily) === clusterIndex(targetFamily)) return { score: 700, reason: "COMPATIBLE_FAMILY" };
  if (source.costGroupKey === target.costGroupKey) return { score: 600, reason: "SAME_BROAD_GROUP" };
  return { score: 100, reason: "HIGHEST_INCIDENCE_FALLBACK" };
}

function chooseTarget(
  source: MutableMonomial,
  candidates: readonly MutableMonomial[],
  hints: readonly FinalAdjustmentExperienceHint[],
): { target: MutableMonomial; reason: FinalAdjustmentMergeReason } {
  const ranked = candidates
    .filter((candidate) => candidate.id !== source.id)
    .map((candidate) => {
      const affinity = affinityScore(source, candidate, hints);
      return { candidate, ...affinity };
    })
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      const amountComparison = right.candidate.amountDecimal.comparedTo(left.candidate.amountDecimal);
      if (amountComparison !== 0) return amountComparison;
      return left.candidate.sortOrder - right.candidate.sortOrder;
    });

  const selected = ranked[0];
  if (!selected) {
    throw new Error("No hay monomios disponibles para agrupar.");
  }

  return { target: selected.candidate, reason: selected.reason };
}

function mergeIntoTarget(
  target: MutableMonomial,
  source: MutableMonomial,
  reason: FinalAdjustmentMergeReason,
  mergePlan: FinalAdjustmentMergePlanEntry[],
): void {
  target.amountDecimal = target.amountDecimal.plus(source.amountDecimal);
  target.amount = formatFixed(target.amountDecimal, 4);
  target.composition = [
    ...target.composition,
    ...source.composition.map((row) => ({
      ...row,
      monomialId: target.id,
    })),
  ];
  mergePlan.push({
    targetMonomialId: target.id,
    sourceMonomialIds: [source.id],
    reason,
    explanation: `${source.code} se agrupa en ${target.code} por ${reason}.`,
  });
}

function normalizeCoefficients(monomials: MutableMonomial[], coefficientDecimals: number): PolynomialMonomialRecord[] {
  const totalAmount = monomials.reduce((total, monomial) => total.plus(monomial.amountDecimal), ZERO);
  const allocations = calculateMonomialCoefficients(
    monomials.map((monomial) => ({
      key: monomial.costGroupKey,
      amount: formatFixed(monomial.amountDecimal, 4),
    })),
  );

  return monomials.map((monomial, index) => {
    const amount = formatFixed(monomial.amountDecimal, 4);
    const coefficient = allocations[index]?.coefficient ?? formatFixed(ZERO, coefficientDecimals);
    const composition = monomial.composition.map((row): PolynomialMonomialCompositionRecord => ({
      ...row,
      monomialId: monomial.id,
      participationPercentage: monomial.amountDecimal.equals(ZERO)
        ? formatFixed(ZERO, COMPOSITION_DECIMALS)
        : formatFixed(toDecimal(row.amount).dividedBy(monomial.amountDecimal), COMPOSITION_DECIMALS),
      coefficientContribution: totalAmount.equals(ZERO)
        ? formatFixed(ZERO, COMPOSITION_DECIMALS)
        : formatFixed(toDecimal(row.amount).dividedBy(totalAmount), COMPOSITION_DECIMALS),
    }));

    return {
      ...monomial,
      amount,
      coefficient,
      sortOrder: index,
      composition,
    };
  });
}

export function createPolynomialFinalAdjustmentProposal(
  monomials: readonly PolynomialMonomialRecord[],
  options: Partial<FinalAdjustmentOptions> = {},
): FinalAdjustmentResult {
  const resolvedOptions = {
    ...DEFAULT_FINAL_ADJUSTMENT_OPTIONS,
    ...options,
    experienceHints: options.experienceHints ?? DEFAULT_FINAL_ADJUSTMENT_OPTIONS.experienceHints,
  };
  const minCoefficient = toDecimal(resolvedOptions.minCoefficient);
  const working = monomials.map(cloneMonomial);
  const mergePlan: FinalAdjustmentMergePlanEntry[] = [];
  const diagnostics: FinalAdjustmentDiagnostic[] = [];

  let changed = true;
  while (changed) {
    changed = false;
    const low = working
      .filter((monomial) => !isLocked(monomial) && monomial.amountDecimal.greaterThan(ZERO))
      .map((monomial) => ({
        monomial,
        coefficient: monomial.amountDecimal.dividedBy(working.reduce((total, item) => total.plus(item.amountDecimal), ZERO)),
      }))
      .filter(({ coefficient }) => coefficient.lessThan(minCoefficient))
      .sort((left, right) => left.coefficient.comparedTo(right.coefficient))[0]?.monomial;

    if (low) {
      const candidates = working.filter((candidate) => candidate.id !== low.id);
      const { target, reason } = chooseTarget(low, candidates, resolvedOptions.experienceHints ?? []);
      mergeIntoTarget(target, low, reason, mergePlan);
      working.splice(working.findIndex((item) => item.id === low.id), 1);
      diagnostics.push({
        code: "LOW_COEFFICIENT_MERGED",
        severity: "INFO",
        message: `${low.code} se agrupo porque estaba por debajo de ${resolvedOptions.minCoefficient}.`,
        monomialIds: [low.id, target.id],
      });
      if (reason === "EXPERIENCE_HINT") {
        diagnostics.push({
          code: "EXPERIENCE_HINT_USED",
          severity: "INFO",
          message: `${low.code} uso aprendizaje por experiencia para elegir ${target.code}.`,
          monomialIds: [low.id, target.id],
        });
      }
      if (reason === "HIGHEST_INCIDENCE_FALLBACK") {
        diagnostics.push({
          code: "CROSS_AFFINITY_FALLBACK",
          severity: "WARNING",
          message: `${low.code} se agrupo por mayor incidencia al no encontrar afinidad suficiente.`,
          monomialIds: [low.id, target.id],
        });
      }
      changed = true;
    }
  }

  while (working.length > resolvedOptions.maxMonomials) {
    const source = [...working]
      .filter((monomial) => !isLocked(monomial))
      .sort((left, right) => left.amountDecimal.comparedTo(right.amountDecimal))[0];

    if (!source) break;

    const { target, reason } = chooseTarget(
      source,
      working.filter((monomial) => monomial.id !== source.id),
      resolvedOptions.experienceHints ?? [],
    );
    mergeIntoTarget(target, source, reason, mergePlan);
    working.splice(working.findIndex((item) => item.id === source.id), 1);
  }

  const finalMonomials = normalizeCoefficients(working, resolvedOptions.coefficientDecimals);
  const unresolvedLow = finalMonomials.filter((monomial) => toDecimal(monomial.coefficient).lessThan(minCoefficient));

  if (finalMonomials.length < resolvedOptions.minMonomials) {
    diagnostics.push({
      code: "FINAL_MONOMIAL_COUNT_BELOW_MINIMUM",
      severity: "WARNING",
      message: `La composicion real solo permite ${finalMonomials.length} monomios economicos sin inventar terminos.`,
    });
  }

  if (finalMonomials.length > resolvedOptions.maxMonomials) {
    diagnostics.push({
      code: "FINAL_MONOMIAL_COUNT_ABOVE_MAXIMUM",
      severity: "ERROR",
      message: `La propuesta mantiene ${finalMonomials.length} monomios y supera el maximo de ${resolvedOptions.maxMonomials}.`,
    });
  }

  if (unresolvedLow.length > 0) {
    diagnostics.push({
      code: "LOW_COEFFICIENT_UNRESOLVED",
      severity: "ERROR",
      message: "La propuesta conserva monomios con coeficiente menor a 0.050.",
      monomialIds: unresolvedLow.map((monomial) => monomial.id),
    });
  }

  diagnostics.push({
    code: "COEFFICIENT_NORMALIZED",
    severity: "INFO",
    message: "Coeficientes recalculados a tres decimales con suma 1.000.",
  });

  return {
    originalMonomials: monomials.map((monomial) => ({
      ...monomial,
      composition: monomial.composition.map((row) => ({ ...row })),
    })),
    finalMonomials,
    mergePlan,
    diagnostics,
    canApply: !diagnostics.some((diagnostic) => diagnostic.severity === "ERROR"),
  };
}
```

- [ ] **Step 4: Run final adjustment tests**

Run:

```bash
node ./node_modules/vitest/vitest.mjs run lib/polynomial-formula/final-adjustment-engine.test.ts
```

Expected: PASS.

- [ ] **Step 5: Run related calculation tests**

Run:

```bash
node ./node_modules/vitest/vitest.mjs run lib/calculations/polynomial-formula.test.ts lib/polynomial-formula/smart-monomial-engine.test.ts lib/polynomial-formula/final-adjustment-engine.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/polynomial-formula/final-adjustment-engine.ts lib/polynomial-formula/final-adjustment-engine.test.ts
git commit -m "Add polynomial final adjustment engine"
```

---

### Task 3: Add Experience Hint Tests And Behavior

**Files:**
- Modify: `lib/polynomial-formula/final-adjustment-engine.test.ts`
- Modify: `lib/polynomial-formula/final-adjustment-engine.ts`

- [ ] **Step 1: Add experience-focused tests**

Append these tests inside the existing `describe` block in `lib/polynomial-formula/final-adjustment-engine.test.ts`:

```ts
  it("uses experience hints as a scoring boost for compatible manual merge patterns", () => {
    const result = createPolynomialFinalAdjustmentProposal(
      [
        monomial({ id: "main-wood", code: "MA", name: "Madera", costGroupKey: "MATERIALS", amount: "75", coefficient: "0.075", iuFamily: "WOOD", unifiedIndexCode: "43" }),
        monomial({ id: "main-finish", code: "AC", name: "Acabados", costGroupKey: "MATERIALS", amount: "80", coefficient: "0.080", iuFamily: "FINISHES", unifiedIndexCode: "54" }),
        monomial({ id: "small-wood", code: "MT", name: "Madera menor", costGroupKey: "MATERIALS", amount: "20", coefficient: "0.020", iuFamily: "WOOD", unifiedIndexCode: "41" }),
        monomial({ id: "gg", code: "GG", name: "Gastos generales", costGroupKey: "GENERAL_EXPENSES_PROFIT", amount: "825", coefficient: "0.825", iuFamily: "GENERAL_EXPENSES", unifiedIndexCode: "39" }),
      ],
      {
        experienceHints: [
          {
            sourceIuFamily: "WOOD",
            targetIuFamily: "FINISHES",
            targetCode: "AC",
            costGroupKey: "MATERIALS",
            weight: 200,
            evidenceLabel: "Proyecto anterior: madera menor agrupada en acabados",
          },
        ],
      },
    );

    expect(result.finalMonomials.find((item) => item.id === "main-finish")?.composition.map((row) => row.unifiedIndexCode)).toContain("41");
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toContain("EXPERIENCE_HINT_USED");
  });

  it("does not let experience hints merge locked labor or general expense monomials as source", () => {
    const result = createPolynomialFinalAdjustmentProposal(
      [
        monomial({ id: "mo", code: "MO", name: "Mano de obra", costGroupKey: "LABOR", amount: "40", coefficient: "0.040", iuFamily: "LABOR", unifiedIndexCode: "47" }),
        monomial({ id: "mat", code: "MA", name: "Materiales", costGroupKey: "MATERIALS", amount: "460", coefficient: "0.460", iuFamily: "FINISHES", unifiedIndexCode: "54" }),
        monomial({ id: "gg", code: "GG", name: "Gastos generales", costGroupKey: "GENERAL_EXPENSES_PROFIT", amount: "500", coefficient: "0.500", iuFamily: "GENERAL_EXPENSES", unifiedIndexCode: "39" }),
      ],
      {
        experienceHints: [
          {
            sourceIuFamily: "LABOR",
            targetIuFamily: "FINISHES",
            targetCode: "MA",
            weight: 999,
            evidenceLabel: "Invalid learned pattern",
          },
        ],
      },
    );

    expect(result.finalMonomials.map((item) => item.id)).toContain("mo");
    expect(result.finalMonomials.find((item) => item.id === "mo")?.composition).toHaveLength(1);
  });
```

- [ ] **Step 2: Run tests to verify the experience contract**

Run:

```bash
node ./node_modules/vitest/vitest.mjs run lib/polynomial-formula/final-adjustment-engine.test.ts
```

Expected: PASS. The Task 2 implementation already makes `EXPERIENCE_HINT` outrank same-family affinity for merge-target selection while preserving locked monomials as sources.

- [ ] **Step 3: Confirm locked monomial source preservation**

Inspect `createPolynomialFinalAdjustmentProposal` and confirm the low-coefficient source filter preserves locked monomials:

```ts
const low = working
  .filter((monomial) => !isLocked(monomial) && monomial.amountDecimal.greaterThan(ZERO))
```

Expected: locked labor/general expenses remain in the final monomial list even if their coefficient is low.

- [ ] **Step 4: Run tests**

Run:

```bash
node ./node_modules/vitest/vitest.mjs run lib/polynomial-formula/final-adjustment-engine.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/polynomial-formula/final-adjustment-engine.ts lib/polynomial-formula/final-adjustment-engine.test.ts
git commit -m "Cover polynomial adjustment experience hints"
```

---

### Task 4: Add Auto Adjustment Preview Dialog

**Files:**
- Create: `components/budget/polynomial-auto-adjustment-preview-dialog.tsx`
- Create: `components/budget/polynomial-auto-adjustment-preview-dialog.test.tsx`

- [ ] **Step 1: Write dialog tests**

Create `components/budget/polynomial-auto-adjustment-preview-dialog.test.tsx`:

```tsx
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PolynomialAutoAdjustmentPreviewDialog } from "@/components/budget/polynomial-auto-adjustment-preview-dialog";
import type { FinalAdjustmentResult } from "@/lib/polynomial-formula/final-adjustment-types";
import type { PolynomialMonomialRecord } from "@/types/polynomial-formula";

let activeContainer: HTMLDivElement | null = null;

function monomial(id: string, code: string, coefficient: string): PolynomialMonomialRecord {
  return {
    id,
    formulaId: "formula-1",
    code,
    name: code,
    costGroupKey: code === "MO" ? "LABOR" : code === "GG" ? "GENERAL_EXPENSES_PROFIT" : "MATERIALS",
    amount: "100.0000",
    coefficient,
    baseIndexCode: code,
    baseIndexName: code,
    baseIndexValue: "100",
    adjustmentIndexCode: null,
    adjustmentIndexName: null,
    adjustmentIndexValue: null,
    sortOrder: 0,
    composition: [],
  };
}

function result(canApply = true): FinalAdjustmentResult {
  return {
    originalMonomials: [monomial("mo", "MO", "0.390"), monomial("small", "PI", "0.030")],
    finalMonomials: [monomial("mo", "MO", "0.390"), monomial("finish", "AC", "0.360"), monomial("gg", "GG", "0.250")],
    mergePlan: [
      {
        targetMonomialId: "finish",
        sourceMonomialIds: ["small"],
        reason: "COMPATIBLE_FAMILY",
        explanation: "PI se agrupa en AC por familias compatibles.",
      },
    ],
    diagnostics: [
      {
        code: canApply ? "LOW_COEFFICIENT_MERGED" : "LOW_COEFFICIENT_UNRESOLVED",
        severity: canApply ? "INFO" : "ERROR",
        message: canApply ? "PI se agrupo." : "Coeficiente bajo sin resolver.",
      },
    ],
    canApply,
  };
}

afterEach(() => {
  if (activeContainer) {
    activeContainer.remove();
    activeContainer = null;
  }
});

async function renderDialog(props: {
  preview: FinalAdjustmentResult | null;
  onApply?: () => void;
  onClose?: () => void;
}) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  activeContainer = container;
  const root = createRoot(container);

  await act(async () => {
    root.render(
      <PolynomialAutoAdjustmentPreviewDialog
        open={Boolean(props.preview)}
        preview={props.preview}
        onApply={props.onApply ?? vi.fn()}
        onClose={props.onClose ?? vi.fn()}
      />,
    );
  });

  return container;
}

describe("PolynomialAutoAdjustmentPreviewDialog", () => {
  it("shows before and after counts, merge explanations, and applies an allowed proposal", async () => {
    const onApply = vi.fn();
    const container = await renderDialog({ preview: result(), onApply });

    expect(container.textContent).toContain("Ajuste automatico");
    expect(container.textContent).toContain("2 actuales");
    expect(container.textContent).toContain("3 propuestos");
    expect(container.textContent).toContain("PI se agrupa en AC");

    const applyButton = [...container.querySelectorAll("button")].find((button) =>
      button.textContent?.includes("Aplicar propuesta"),
    );
    expect(applyButton).toBeTruthy();

    await act(async () => {
      applyButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onApply).toHaveBeenCalledTimes(1);
  });

  it("disables apply when the proposal has blocking errors", async () => {
    const onApply = vi.fn();
    const container = await renderDialog({ preview: result(false), onApply });
    const applyButton = [...container.querySelectorAll("button")].find((button) =>
      button.textContent?.includes("Aplicar propuesta"),
    );

    expect(applyButton).toBeInstanceOf(HTMLButtonElement);
    expect((applyButton as HTMLButtonElement).disabled).toBe(true);
    expect(container.textContent).toContain("Coeficiente bajo sin resolver");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
node ./node_modules/vitest/vitest.mjs run components/budget/polynomial-auto-adjustment-preview-dialog.test.tsx
```

Expected: FAIL because the dialog component does not exist.

- [ ] **Step 3: Implement dialog**

Create `components/budget/polynomial-auto-adjustment-preview-dialog.tsx`:

```tsx
"use client";

import * as Dialog from "@radix-ui/react-dialog";

import { Button } from "@/components/ui/button";
import type { FinalAdjustmentResult } from "@/lib/polynomial-formula/final-adjustment-types";

export function PolynomialAutoAdjustmentPreviewDialog({
  open,
  preview,
  onApply,
  onClose,
}: {
  open: boolean;
  preview: FinalAdjustmentResult | null;
  onApply: () => void;
  onClose: () => void;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[120] bg-slate-950/35 backdrop-blur-[2px]" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[130] max-h-[86vh] w-[min(920px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 overflow-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-4">
            <div>
              <Dialog.Title className="text-base font-semibold text-slate-950">
                Ajuste automatico de formula
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-slate-500">
                Revisa la propuesta final antes de reemplazar los monomios editables.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <Button type="button" variant="ghost" size="sm">
                Cerrar
              </Button>
            </Dialog.Close>
          </div>

          {preview ? (
            <div className="mt-4 space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Antes</p>
                  <p className="mt-2 text-lg font-semibold text-slate-950">
                    {preview.originalMonomials.length} actuales
                  </p>
                </div>
                <div className="rounded-xl border border-sky-200 bg-sky-50 p-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-sky-700">Despues</p>
                  <p className="mt-2 text-lg font-semibold text-slate-950">
                    {preview.finalMonomials.length} propuestos
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium text-slate-900">Monomios finales</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {preview.finalMonomials.map((monomial) => (
                    <div key={monomial.id} className="rounded-xl border border-slate-200 p-3">
                      <p className="text-sm font-semibold text-slate-950">
                        {monomial.code} - {monomial.name}
                      </p>
                      <p className="mt-1 text-xs tabular-nums text-slate-500">
                        Coeficiente {Number(monomial.coefficient).toFixed(3)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium text-slate-900">Fusiones propuestas</p>
                {preview.mergePlan.length > 0 ? (
                  <ul className="space-y-2">
                    {preview.mergePlan.map((entry, index) => (
                      <li key={`${entry.targetMonomialId}-${index}`} className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                        {entry.explanation}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-500">
                    La propuesta no necesita fusiones adicionales.
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium text-slate-900">Diagnosticos</p>
                {preview.diagnostics.map((diagnostic, index) => (
                  <p
                    key={`${diagnostic.code}-${index}`}
                    className={diagnostic.severity === "ERROR" ? "text-sm text-rose-700" : "text-sm text-slate-600"}
                  >
                    {diagnostic.message}
                  </p>
                ))}
              </div>

              <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 pt-4">
                <Button type="button" variant="outline" onClick={onClose}>
                  Cancelar
                </Button>
                <Button type="button" onClick={onApply} disabled={!preview.canApply}>
                  Aplicar propuesta
                </Button>
              </div>
            </div>
          ) : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
```

- [ ] **Step 4: Run dialog tests**

Run:

```bash
node ./node_modules/vitest/vitest.mjs run components/budget/polynomial-auto-adjustment-preview-dialog.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/budget/polynomial-auto-adjustment-preview-dialog.tsx components/budget/polynomial-auto-adjustment-preview-dialog.test.tsx
git commit -m "Add polynomial auto adjustment preview dialog"
```

---

### Task 5: Add Auto Adjustment Action To The Monomial Table

**Files:**
- Modify: `components/budget/polynomial-monomials-table.tsx`
- Test: `components/budget/polynomial-auto-adjustment-preview-dialog.test.tsx`

- [ ] **Step 1: Extend table props**

In `components/budget/polynomial-monomials-table.tsx`, update the component signature:

```ts
export function PolynomialMonomialsTable({
  monomials,
  baseIndexOptions,
  baseIndicesLoading,
  currencyDecimals,
  onChangeMonomial,
  onMergeMonomials,
  onAutoAdjustMonomials,
}: {
  monomials: PolynomialMonomialRecord[];
  baseIndexOptions: UnifiedIndexRecord[];
  baseIndicesLoading: boolean;
  currencyDecimals: number;
  onChangeMonomial: (monomial: PolynomialMonomialRecord) => void;
  onMergeMonomials?: (targetMonomialId: string, sourceMonomialIds: string[]) => void;
  onAutoAdjustMonomials?: () => void;
}) {
```

- [ ] **Step 2: Render the new button beside merge**

Replace the existing merge panel button block with:

```tsx
            <div className="flex flex-wrap gap-2">
              {onAutoAdjustMonomials ? (
                <Button type="button" size="sm" variant="outline" onClick={onAutoAdjustMonomials}>
                  Aplicar ajuste automatico
                </Button>
              ) : null}
              <Button type="button" size="sm" onClick={mergeSelectedMonomials} disabled={!canMerge}>
                <Combine className="mr-2 h-4 w-4" />
                Juntar monomios
              </Button>
            </div>
```

- [ ] **Step 3: Run lint for this file**

Run:

```bash
npm run lint -- components/budget/polynomial-monomials-table.tsx
```

Expected: PASS. If the project lint script ignores extra args, run full `npm run lint`.

- [ ] **Step 4: Commit**

```bash
git add components/budget/polynomial-monomials-table.tsx
git commit -m "Add polynomial auto adjustment table action"
```

---

### Task 6: Integrate Preview And Apply Flow In The Formula Editor

**Files:**
- Modify: `components/budget/polynomial-formula-editor.tsx`
- Test: `components/budget/polynomial-auto-adjustment-preview-dialog.test.tsx`
- Test: `lib/polynomial-formula/final-adjustment-engine.test.ts`

- [ ] **Step 1: Add imports**

In `components/budget/polynomial-formula-editor.tsx`, add:

```ts
import { PolynomialAutoAdjustmentPreviewDialog } from "@/components/budget/polynomial-auto-adjustment-preview-dialog";
import { createPolynomialFinalAdjustmentProposal } from "@/lib/polynomial-formula/final-adjustment-engine";
import type { FinalAdjustmentResult } from "@/lib/polynomial-formula/final-adjustment-types";
```

- [ ] **Step 2: Add preview state**

Inside `PolynomialFormulaEditor`, near existing `saveState` state declarations, add:

```ts
  const [autoAdjustmentPreview, setAutoAdjustmentPreview] = useState<FinalAdjustmentResult | null>(null);
```

- [ ] **Step 3: Add handlers**

Add these functions near `mergeMonomials`:

```ts
  function openAutoAdjustmentPreview() {
    if (!formula) return;

    const preview = createPolynomialFinalAdjustmentProposal(formula.monomials);
    setAutoAdjustmentPreview(preview);
  }

  function applyAutoAdjustmentPreview() {
    setFormula((current) => {
      if (!current || !autoAdjustmentPreview?.canApply) return current;

      const next = {
        ...current,
        monomials: autoAdjustmentPreview.finalMonomials.map((monomial, index) => ({
          ...monomial,
          sortOrder: index,
          composition: monomial.composition.map((row) => ({ ...row })),
        })),
      };

      setSummary(createFormulaSummary(next));
      setKPreview(null);
      setKPreviewError("");
      setFeedback("Ajuste automatico aplicado. Revisa indices base antes de guardar.");
      return next;
    });
    setAutoAdjustmentPreview(null);
  }
```

- [ ] **Step 4: Pass the action to the table**

Update the `PolynomialMonomialsTable` usage:

```tsx
          <PolynomialMonomialsTable
            monomials={formula.monomials}
            baseIndexOptions={baseIndexOptions}
            baseIndicesLoading={baseIndicesLoading}
            currencyDecimals={currencyDecimals}
            onChangeMonomial={updateMonomial}
            onMergeMonomials={mergeMonomials}
            onAutoAdjustMonomials={openAutoAdjustmentPreview}
          />
```

- [ ] **Step 5: Render the dialog**

Render below `PolynomialMonomialsTable`:

```tsx
          <PolynomialAutoAdjustmentPreviewDialog
            open={autoAdjustmentPreview !== null}
            preview={autoAdjustmentPreview}
            onApply={applyAutoAdjustmentPreview}
            onClose={() => setAutoAdjustmentPreview(null)}
          />
```

- [ ] **Step 6: Run component and domain tests**

Run:

```bash
node ./node_modules/vitest/vitest.mjs run components/budget/polynomial-auto-adjustment-preview-dialog.test.tsx lib/polynomial-formula/final-adjustment-engine.test.ts
```

Expected: PASS.

- [ ] **Step 7: Run lint**

Run:

```bash
npm run lint
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add components/budget/polynomial-formula-editor.tsx
git commit -m "Wire polynomial auto adjustment preview flow"
```

---

### Task 7: Add Editor-Level Regression Coverage

**Files:**
- Create: `components/budget/polynomial-formula-editor.auto-adjustment.test.tsx`
- Test: `components/budget/polynomial-formula-editor.auto-adjustment.test.tsx`

- [ ] **Step 1: Confirm no existing focused auto-adjustment test exists**

Run:

```bash
rg -n "PolynomialFormulaEditor|PolynomialMonomialsTable|polynomial formula" components/budget -g "*.test.tsx"
```

Expected: no existing `polynomial-formula-editor.auto-adjustment.test.tsx` file is present before this task; create that focused file in the next step.

- [ ] **Step 2: Add regression test for preview-before-apply**

Create `components/budget/polynomial-formula-editor.auto-adjustment.test.tsx` with:

```tsx
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PolynomialFormulaEditor } from "@/components/budget/polynomial-formula-editor";
import { FormattingSettingsProvider } from "@/components/providers/formatting-settings-provider";
import { AppViewModeProvider } from "@/components/view-mode/app-view-mode-provider";
import type { PolynomialFormulaSectionData } from "@/types/budget-sections";

let activeContainer: HTMLDivElement | null = null;

afterEach(() => {
  vi.restoreAllMocks();
  activeContainer?.remove();
  activeContainer = null;
});

function section(): PolynomialFormulaSectionData {
  return {
    id: "polynomial",
    title: "Formula polinomica",
    budgetId: "budget-1",
    currency: "PEN",
    coefficients: [],
    summary: {
      hasFormula: true,
      monomialCount: 4,
      totalBaseAmount: "1000.0000",
      status: "DRAFT",
    },
    formula: {
      id: "formula-1",
      budgetId: "budget-1",
      name: "Formula",
      baseMonth: 1,
      baseYear: 2026,
      totalBaseAmount: "1000.0000",
      status: "DRAFT",
      monomials: [
        {
          id: "mo",
          formulaId: "formula-1",
          code: "MO",
          name: "Mano de obra",
          costGroupKey: "LABOR",
          amount: "390.0000",
          coefficient: "0.390",
          baseIndexCode: "47",
          baseIndexName: "Mano de obra",
          baseIndexValue: "100",
          adjustmentIndexCode: null,
          adjustmentIndexName: null,
          adjustmentIndexValue: null,
          sortOrder: 0,
          composition: [],
        },
        {
          id: "small",
          formulaId: "formula-1",
          code: "PI",
          name: "Pintura",
          costGroupKey: "MATERIALS",
          amount: "30.0000",
          coefficient: "0.030",
          baseIndexCode: "54",
          baseIndexName: "Pintura",
          baseIndexValue: "100",
          adjustmentIndexCode: null,
          adjustmentIndexName: null,
          adjustmentIndexValue: null,
          sortOrder: 1,
          composition: [
            {
              id: "small-component",
              monomialId: "small",
              amount: "30.0000",
              unifiedIndexCode: "54",
              unifiedIndexName: "Pintura",
              iuFamily: "FINISHES",
              participationPercentage: "1",
              coefficientContribution: "0.030",
            },
          ],
        },
        {
          id: "finish",
          formulaId: "formula-1",
          code: "AC",
          name: "Acabados",
          costGroupKey: "MATERIALS",
          amount: "320.0000",
          coefficient: "0.320",
          baseIndexCode: "16",
          baseIndexName: "Acabados",
          baseIndexValue: "100",
          adjustmentIndexCode: null,
          adjustmentIndexName: null,
          adjustmentIndexValue: null,
          sortOrder: 2,
          composition: [
            {
              id: "finish-component",
              monomialId: "finish",
              amount: "320.0000",
              unifiedIndexCode: "16",
              unifiedIndexName: "Acabados",
              iuFamily: "FINISHES",
              participationPercentage: "1",
              coefficientContribution: "0.320",
            },
          ],
        },
        {
          id: "gg",
          formulaId: "formula-1",
          code: "GG",
          name: "Gastos generales",
          costGroupKey: "GENERAL_EXPENSES_PROFIT",
          amount: "260.0000",
          coefficient: "0.260",
          baseIndexCode: "39",
          baseIndexName: "Indice general",
          baseIndexValue: "100",
          adjustmentIndexCode: null,
          adjustmentIndexName: null,
          adjustmentIndexValue: null,
          sortOrder: 3,
          composition: [],
        },
      ],
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
  };
}

function settings() {
  return {
    defaultCurrency: "PEN",
    currencyDecimals: 2,
    quantityDecimals: 2,
    percentageDecimals: 2,
    dateFormat: "dd/MM/yyyy",
    excelRowHeight: 32,
    excelShowFieldBorders: true,
  };
}

describe("PolynomialFormulaEditor automatic adjustment", () => {
  it("opens a preview and applies the final proposal only after confirmation", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    activeContainer = container;
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <FormattingSettingsProvider settings={settings()}>
          <AppViewModeProvider>
            <PolynomialFormulaEditor
              section={section()}
              adjustments={[]}
              canUsePolynomialAdjustments
            />
          </AppViewModeProvider>
        </FormattingSettingsProvider>,
      );
    });

    const autoButton = [...container.querySelectorAll("button")].find((button) =>
      button.textContent?.includes("Aplicar ajuste automatico"),
    );
    expect(autoButton).toBeTruthy();

    await act(async () => {
      autoButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.textContent).toContain("Ajuste automatico de formula");
    expect(container.textContent).toContain("4 actuales");

    await act(async () => {
      [...container.querySelectorAll("button")]
        .find((button) => button.textContent?.includes("Cancelar"))
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.textContent).not.toContain("Ajuste automatico de formula");
    expect(container.textContent).toContain("PI");
  });
});
```

- [ ] **Step 3: Run the focused test**

Run:

```bash
node ./node_modules/vitest/vitest.mjs run components/budget/polynomial-formula-editor.auto-adjustment.test.tsx
```

Expected: PASS.

- [ ] **Step 4: Run broader budget component tests**

Run:

```bash
node ./node_modules/vitest/vitest.mjs run components/budget/polynomial-formula-editor.auto-adjustment.test.tsx components/budget/budget-editor.view-mode.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/budget/polynomial-formula-editor.auto-adjustment.test.tsx
git commit -m "Cover polynomial auto adjustment editor flow"
```

---

### Task 8: Final Verification

**Files:**
- No code changes expected.

- [ ] **Step 1: Run all tests**

Run:

```bash
npm run test
```

Expected: PASS with all Vitest files green.

- [ ] **Step 2: Run lint**

Run:

```bash
npm run lint
```

Expected: PASS.

- [ ] **Step 3: Review status**

Run:

```bash
git status --short
```

Expected: only known local artifacts remain untracked if they existed before implementation:

```text
?? .merge-temp/
?? data-for-seed/formula-polinomica/~$07_indices_unificados_de_precios_de_la_construccion_ene26.xlsx
?? dev-server.log
```

- [ ] **Step 4: Commit any final test-only correction**

When Task 8 introduces a test-only correction, commit the explicit changed test file:

```bash
git add components/budget/polynomial-formula-editor.auto-adjustment.test.tsx
git commit -m "Stabilize polynomial auto adjustment tests"
```

Expected: no commit is needed when Tasks 1-7 already pass.
