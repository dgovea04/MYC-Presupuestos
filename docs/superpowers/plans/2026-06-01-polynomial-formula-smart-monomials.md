# Smart Polynomial Formula Monomials Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build intelligent polynomial formula monomial generation that starts from broad cost groups, expands materials by IU family, limits proposals to 10 groups, shows DEV composition detail, and lets users manually merge monomials.

**Architecture:** Keep calculation and grouping logic outside React. Add an internal IU family classifier and a pure smart-monomial engine, persist monomial composition snapshots, and update the formula editor to render validation diagnostics, composition detail, and manual merge actions.

**Tech Stack:** Next.js App Router, TypeScript strict mode, Prisma, Decimal.js, Vitest, Tailwind/shadcn-style local components.

---

## Scope Check

This plan implements one feature area: smart polynomial formula monomial generation and editing. It includes database shape, domain engine, data persistence, API payload validation, and UI because those pieces must change together to make a working, testable feature.

## File Structure

- Modify: `prisma/schema.prisma`
  - Add nullable composition snapshot fields to `PolynomialMonomialComponent`.
- Create: `prisma/migrations/20260601120000_add_polynomial_monomial_composition_snapshot/migration.sql`
  - Add nullable snapshot columns without disturbing existing rows.
- Modify: `types/polynomial-formula.ts`
  - Add `PolynomialMonomialCompositionRecord`.
  - Add `composition` to `PolynomialMonomialRecord`.
  - Add smart validation/diagnostic types.
- Modify: `lib/db/serializers.ts`
  - Serialize optional monomial component snapshots.
- Create: `lib/polynomial-formula/iu-family-classifier.ts`
  - Classify IU codes/names into internal polynomial families only.
- Create: `lib/polynomial-formula/iu-family-classifier.test.ts`
  - Cover classifier behavior.
- Create: `lib/calculations/polynomial-smart-monomials.ts`
  - Pure engine for broad groups, material expansion, preliminary grouping, manual merge, diagnostics.
- Create: `lib/calculations/polynomial-smart-monomials.test.ts`
  - Cover smart grouping and manual merge.
- Modify: `lib/polynomial-formula/types.ts`
  - Add reusable input/result types for smart grouping.
- Modify: `lib/calculations/polynomial-formula.ts`
  - Update maximum monomial rule from 8 to 10.
- Modify: `lib/calculations/polynomial-formula.test.ts`
  - Update max-count tests for the 10-monomial limit.
- Modify: `lib/validations/polynomial-formula.ts`
  - Allow up to 10 monomials.
  - Validate optional composition payload.
- Modify: `lib/data/polynomial-formulas.ts`
  - Replace coarse generation with smart proposal.
  - Persist composition snapshots.
  - Preserve composition during save and merge.
- Modify: `lib/data/polynomial-formulas.test.ts`
  - Update existing composition tests.
  - Add tests for smart generation integration.
- Modify: `components/budget/polynomial-validation-summary.tsx`
  - Render advanced diagnostics.
- Modify: `components/budget/polynomial-monomials-table.tsx`
  - Add selectable rows, expandable composition detail, merge action entry point.
- Create: `components/budget/polynomial-monomial-merge-dialog.tsx`
  - Merge selected monomials with code/name/representative IU.
- Modify: `components/budget/polynomial-formula-editor.tsx`
  - Compute diagnostics, handle merge, pass composition and callbacks to table.

---

### Task 1: Persist Composition Snapshot Fields

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260601120000_add_polynomial_monomial_composition_snapshot/migration.sql`

- [ ] **Step 1: Update Prisma model**

In `prisma/schema.prisma`, update `PolynomialMonomialComponent`:

```prisma
model PolynomialMonomialComponent {
  id                          String             @id @default(cuid())
  monomialId                  String
  budgetItemId                String?
  apuResourceId               String?
  resourceType                String?
  amount                      Decimal            @default(0) @db.Decimal(18, 2)
  unifiedIndexCode            String?
  unifiedIndexName            String?
  iuFamily                    String?
  participationPercentage     Decimal?           @db.Decimal(12, 6)
  coefficientContribution     Decimal?           @db.Decimal(12, 6)
  createdAt                   DateTime           @default(now())
  updatedAt                   DateTime           @updatedAt
  monomial                    PolynomialMonomial @relation(fields: [monomialId], references: [id], onDelete: Cascade)
  budgetItem                  BudgetItem?        @relation(fields: [budgetItemId], references: [id], onDelete: SetNull)
  apuResource                 ApuResource?       @relation(fields: [apuResourceId], references: [id], onDelete: SetNull)

  @@index([monomialId])
  @@index([budgetItemId])
  @@index([apuResourceId])
  @@index([unifiedIndexCode])
}
```

- [ ] **Step 2: Add migration SQL**

Create `prisma/migrations/20260601120000_add_polynomial_monomial_composition_snapshot/migration.sql`:

```sql
ALTER TABLE "polynomial_monomial_components"
ADD COLUMN "unifiedIndexCode" TEXT,
ADD COLUMN "unifiedIndexName" TEXT,
ADD COLUMN "iuFamily" TEXT,
ADD COLUMN "participationPercentage" DECIMAL(12, 6),
ADD COLUMN "coefficientContribution" DECIMAL(12, 6);

CREATE INDEX "polynomial_monomial_components_unifiedIndexCode_idx"
ON "polynomial_monomial_components"("unifiedIndexCode");
```

- [ ] **Step 3: Run Prisma validation**

Run: `npx prisma validate`

Expected: schema validates. If `npx` is unavailable in this repo, run `node ./node_modules/prisma/build/index.js validate`.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260601120000_add_polynomial_monomial_composition_snapshot/migration.sql
git commit -m "Add polynomial monomial composition snapshot fields"
```

---

### Task 2: Add Composition Types And Serializers

**Files:**
- Modify: `types/polynomial-formula.ts`
- Modify: `lib/db/serializers.ts`
- Test: `lib/data/polynomial-formulas.test.ts`

- [ ] **Step 1: Write failing serializer test**

In `lib/data/polynomial-formulas.test.ts`, extend the `serializes formula, valuation, unified index, and adjustment records` test monomial with `components`:

```ts
components: [
  {
    id: "component-1",
    monomialId: "monomial-1",
    budgetItemId: null,
    apuResourceId: "apu-resource-1",
    resourceType: "MO",
    amount: new Prisma.Decimal("2500.00"),
    unifiedIndexCode: "47",
    unifiedIndexName: "MANO DE OBRA",
    iuFamily: "LABOR",
    participationPercentage: new Prisma.Decimal("1.000000"),
    coefficientContribution: new Prisma.Decimal("0.046000"),
    createdAt: new Date("2026-01-15T00:00:00.000Z"),
    updatedAt: new Date("2026-01-16T00:00:00.000Z"),
  },
],
```

Add assertions:

```ts
expect(formula.monomials[0]?.composition).toEqual([
  {
    id: "component-1",
    monomialId: "monomial-1",
    budgetItemId: undefined,
    apuResourceId: "apu-resource-1",
    resourceType: "MO",
    amount: "2500.00",
    unifiedIndexCode: "47",
    unifiedIndexName: "MANO DE OBRA",
    iuFamily: "LABOR",
    participationPercentage: "1",
    coefficientContribution: "0.046",
    createdAt: "2026-01-15T00:00:00.000Z",
    updatedAt: "2026-01-16T00:00:00.000Z",
  },
]);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- lib/data/polynomial-formulas.test.ts`

Expected: TypeScript or assertion failure because `composition` is not serialized.

- [ ] **Step 3: Add record types**

In `types/polynomial-formula.ts`, add:

```ts
export type PolynomialMonomialCompositionRecord = {
  id: string;
  monomialId?: string;
  budgetItemId?: string;
  apuResourceId?: string;
  resourceType?: string;
  amount: string;
  unifiedIndexCode?: string;
  unifiedIndexName?: string;
  iuFamily?: string;
  participationPercentage?: string;
  coefficientContribution?: string;
  createdAt?: string;
  updatedAt?: string;
};
```

Then add to `PolynomialMonomialRecord`:

```ts
composition: PolynomialMonomialCompositionRecord[];
```

- [ ] **Step 4: Serialize composition**

In `lib/db/serializers.ts`, add:

```ts
import type {
  AdjustmentCalculationRecord,
  AdjustmentCalculationTermRecord,
  PolynomialFormulaRecord,
  PolynomialMonomialCompositionRecord,
  PolynomialMonomialRecord,
  UnifiedIndexRecord,
  ValuationRecord,
} from "@/types/polynomial-formula";
```

Add:

```ts
export function serializePolynomialMonomialComposition(component: {
  id: string;
  monomialId: string;
  budgetItemId: string | null;
  apuResourceId: string | null;
  resourceType: string | null;
  amount: Prisma.Decimal;
  unifiedIndexCode?: string | null;
  unifiedIndexName?: string | null;
  iuFamily?: string | null;
  participationPercentage?: Prisma.Decimal | null;
  coefficientContribution?: Prisma.Decimal | null;
  createdAt?: Date;
  updatedAt?: Date;
}): PolynomialMonomialCompositionRecord {
  return {
    id: component.id,
    monomialId: component.monomialId,
    budgetItemId: component.budgetItemId ?? undefined,
    apuResourceId: component.apuResourceId ?? undefined,
    resourceType: component.resourceType ?? undefined,
    amount: decimalToFixedString(component.amount, 2),
    unifiedIndexCode: component.unifiedIndexCode ?? undefined,
    unifiedIndexName: component.unifiedIndexName ?? undefined,
    iuFamily: component.iuFamily ?? undefined,
    participationPercentage:
      component.participationPercentage == null
        ? undefined
        : decimalToString(component.participationPercentage),
    coefficientContribution:
      component.coefficientContribution == null
        ? undefined
        : decimalToString(component.coefficientContribution),
    createdAt: component.createdAt?.toISOString(),
    updatedAt: component.updatedAt?.toISOString(),
  };
}
```

Update `serializePolynomialMonomial` input type to accept optional `components`:

```ts
components?: Array<Parameters<typeof serializePolynomialMonomialComposition>[0]>;
```

Return:

```ts
composition: monomial.components?.map(serializePolynomialMonomialComposition) ?? [],
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm run test -- lib/data/polynomial-formulas.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add types/polynomial-formula.ts lib/db/serializers.ts lib/data/polynomial-formulas.test.ts
git commit -m "Serialize polynomial monomial composition"
```

---

### Task 3: Add Internal IU Family Classifier

**Files:**
- Create: `lib/polynomial-formula/iu-family-classifier.ts`
- Create: `lib/polynomial-formula/iu-family-classifier.test.ts`

- [ ] **Step 1: Write failing tests**

Create `lib/polynomial-formula/iu-family-classifier.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import {
  classifyUnifiedIndexForPolynomialFormula,
  type PolynomialIuFamily,
} from "@/lib/polynomial-formula/iu-family-classifier";

describe("classifyUnifiedIndexForPolynomialFormula", () => {
  it.each([
    [{ code: "47", name: "MANO DE OBRA" }, "LABOR"],
    [{ code: "39", name: "INDICE GENERAL DE PRECIOS AL CONSUMIDOR" }, "GENERAL_EXPENSES"],
    [{ code: "3", name: "ACERO DE CONSTRUCCION CORRUGADO" }, "STEEL"],
    [{ code: "2", name: "ACERO DE CONSTRUCCION LISO" }, "STEEL"],
    [{ code: "21", name: "CEMENTO PORTLAND TIPO I" }, "CEMENT"],
    [{ code: "5", name: "AGREGADO GRUESO" }, "AGGREGATES"],
    [{ code: "17", name: "BLOQUES Y LADRILLOS" }, "MASONRY"],
    [{ code: "43", name: "MADERA NACIONAL PARA ENCOFRADO Y CARPINTERIA" }, "WOOD"],
    [{ code: "54", name: "PINTURA LATEX" }, "FINISHES"],
    [{ code: "72", name: "TUBERIA DE PVC" }, "SANITARY_INSTALLATIONS"],
    [{ code: "7", name: "ALAMBRE Y CABLE TW Y THW" }, "ELECTRICAL_INSTALLATIONS"],
  ] satisfies Array<[{ code: string; name: string }, PolynomialIuFamily]>)(
    "classifies $0.name as $1",
    (index, expected) => {
      expect(classifyUnifiedIndexForPolynomialFormula(index)).toBe(expected);
    },
  );

  it("falls back to OTHERS without mutating the input", () => {
    const index = { code: "999", name: "INSUMO ESPECIAL" };
    expect(classifyUnifiedIndexForPolynomialFormula(index)).toBe("OTHERS");
    expect(index).toEqual({ code: "999", name: "INSUMO ESPECIAL" });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- lib/polynomial-formula/iu-family-classifier.test.ts`

Expected: FAIL because classifier module does not exist.

- [ ] **Step 3: Implement classifier**

Create `lib/polynomial-formula/iu-family-classifier.ts`:

```ts
export type PolynomialIuFamily =
  | "LABOR"
  | "GENERAL_EXPENSES"
  | "STEEL"
  | "CEMENT"
  | "AGGREGATES"
  | "MASONRY"
  | "WOOD"
  | "FINISHES"
  | "SANITARY_INSTALLATIONS"
  | "ELECTRICAL_INSTALLATIONS"
  | "EQUIPMENT"
  | "OTHERS";

type UnifiedIndexFamilyInput = {
  code: string;
  name: string;
};

const familyByKnownCode: Record<string, PolynomialIuFamily> = {
  "47": "LABOR",
  "39": "GENERAL_EXPENSES",
  "2": "STEEL",
  "3": "STEEL",
  "21": "CEMENT",
  "5": "AGGREGATES",
  "17": "MASONRY",
  "43": "WOOD",
  "41": "WOOD",
  "54": "FINISHES",
  "16": "FINISHES",
  "24": "FINISHES",
  "72": "SANITARY_INSTALLATIONS",
  "65": "SANITARY_INSTALLATIONS",
  "7": "ELECTRICAL_INSTALLATIONS",
};

function normalizeToken(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

export function classifyUnifiedIndexForPolynomialFormula(
  index: UnifiedIndexFamilyInput,
): PolynomialIuFamily {
  const byCode = familyByKnownCode[index.code.trim()];
  if (byCode) return byCode;

  const name = normalizeToken(index.name);
  if (name.includes("MANO DE OBRA")) return "LABOR";
  if (name.includes("INDICE GENERAL")) return "GENERAL_EXPENSES";
  if (name.includes("ACERO")) return "STEEL";
  if (name.includes("CEMENTO")) return "CEMENT";
  if (name.includes("AGREGADO") || name.includes("ARENA")) return "AGGREGATES";
  if (name.includes("LADRILLO") || name.includes("BLOQUE")) return "MASONRY";
  if (name.includes("MADERA")) return "WOOD";
  if (name.includes("PINTURA") || name.includes("CERAMICA") || name.includes("BALDOSA")) {
    return "FINISHES";
  }
  if (name.includes("TUBERIA") || name.includes("PVC") || name.includes("SANITAR")) {
    return "SANITARY_INSTALLATIONS";
  }
  if (name.includes("CABLE") || name.includes("ALAMBRE") || name.includes("ELECTRIC")) {
    return "ELECTRICAL_INSTALLATIONS";
  }
  if (name.includes("EQUIPO") || name.includes("MAQUIN")) return "EQUIPMENT";

  return "OTHERS";
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- lib/polynomial-formula/iu-family-classifier.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/polynomial-formula/iu-family-classifier.ts lib/polynomial-formula/iu-family-classifier.test.ts
git commit -m "Add polynomial IU family classifier"
```

---

### Task 4: Add Smart Monomial Engine Types

**Files:**
- Modify: `lib/polynomial-formula/types.ts`

- [ ] **Step 1: Add smart engine type definitions**

Append to `lib/polynomial-formula/types.ts`:

```ts
import type { PolynomialIuFamily } from "@/lib/polynomial-formula/iu-family-classifier";
import type { PolynomialCostGroupKey } from "@/types/polynomial-formula";

export type SmartMonomialSourceComponent = {
  budgetItemId?: string;
  apuResourceId?: string;
  resourceType?: string;
  amount: DecimalString;
  unifiedIndexCode?: string;
  unifiedIndexName?: string;
  iuFamily?: PolynomialIuFamily;
};

export type SmartMonomialBroadGroupInput = {
  key: PolynomialCostGroupKey;
  amount: DecimalString;
  components: SmartMonomialSourceComponent[];
};

export type SmartMonomialInput = {
  id: string;
  code: string;
  name: string;
  costGroupKey: PolynomialCostGroupKey;
  amount: DecimalString;
  coefficient: DecimalString;
  baseIndexCode: string;
  baseIndexName: string;
  baseIndexValue: DecimalString;
  sortOrder: number;
  composition: SmartMonomialSourceComponent[];
};

export type SmartMonomialDiagnostic = {
  id: string;
  severity: "info" | "warning" | "error";
  message: string;
  monomialCode?: string;
};

export type SmartMonomialProposal = {
  monomials: SmartMonomialInput[];
  diagnostics: SmartMonomialDiagnostic[];
};
```

If this creates a duplicate import for `PolynomialCostGroupKey`, merge imports so the file has one import from `@/types/polynomial-formula`.

- [ ] **Step 2: Run TypeScript-facing tests**

Run: `npm run test -- lib/calculations/polynomial-formula.test.ts`

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add lib/polynomial-formula/types.ts
git commit -m "Add smart monomial engine types"
```

---

### Task 5: Build Smart Monomial Proposal Engine

**Files:**
- Create: `lib/calculations/polynomial-smart-monomials.ts`
- Create: `lib/calculations/polynomial-smart-monomials.test.ts`

- [ ] **Step 1: Write failing tests**

Create `lib/calculations/polynomial-smart-monomials.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import {
  buildSmartMonomialProposal,
  mergeSmartMonomials,
} from "@/lib/calculations/polynomial-smart-monomials";

const baseGroups = [
  {
    key: "LABOR" as const,
    amount: "300.0000",
    components: [
      {
        apuResourceId: "mo-1",
        resourceType: "MO",
        amount: "300.0000",
        unifiedIndexCode: "47",
        unifiedIndexName: "MANO DE OBRA",
      },
    ],
  },
  {
    key: "MATERIALS" as const,
    amount: "500.0000",
    components: [
      {
        apuResourceId: "steel-1",
        resourceType: "Material",
        amount: "180.0000",
        unifiedIndexCode: "3",
        unifiedIndexName: "ACERO DE CONSTRUCCION CORRUGADO",
      },
      {
        apuResourceId: "cement-1",
        resourceType: "Material",
        amount: "170.0000",
        unifiedIndexCode: "21",
        unifiedIndexName: "CEMENTO PORTLAND TIPO I",
      },
      {
        apuResourceId: "agg-1",
        resourceType: "Material",
        amount: "150.0000",
        unifiedIndexCode: "5",
        unifiedIndexName: "AGREGADO GRUESO",
      },
    ],
  },
  { key: "EQUIPMENT" as const, amount: "40.0000", components: [] },
  { key: "OTHERS" as const, amount: "0.0000", components: [] },
  { key: "GENERAL_EXPENSES_PROFIT" as const, amount: "160.0000", components: [] },
];

describe("buildSmartMonomialProposal", () => {
  it("preserves labor and general expenses while expanding materials by IU family", () => {
    const proposal = buildSmartMonomialProposal({
      budgetId: "budget-1",
      groups: baseGroups,
      maxMonomials: 10,
    });

    expect(proposal.monomials.map((monomial) => monomial.costGroupKey)).toContain("LABOR");
    expect(proposal.monomials.map((monomial) => monomial.costGroupKey)).toContain("GENERAL_EXPENSES_PROFIT");
    expect(proposal.monomials.map((monomial) => monomial.code)).toEqual([
      "MO",
      "AC",
      "CE",
      "AG",
      "GU",
    ]);
    expect(proposal.monomials.map((monomial) => monomial.coefficient)).toEqual([
      "0.300",
      "0.180",
      "0.170",
      "0.150",
      "0.200",
    ]);
  });

  it("flags equipment and others when they are below the threshold", () => {
    const proposal = buildSmartMonomialProposal({
      budgetId: "budget-1",
      groups: baseGroups,
      maxMonomials: 10,
    });

    expect(proposal.monomials.some((monomial) => monomial.code === "EQ")).toBe(false);
    expect(proposal.diagnostics.map((diagnostic) => diagnostic.id)).toEqual(
      expect.arrayContaining(["equipment-below-threshold", "others-below-threshold"]),
    );
  });

  it("limits preliminary proposals to ten monomials by merging the smallest groups", () => {
    const materialComponents = Array.from({ length: 12 }, (_, index) => ({
      apuResourceId: `mat-${index + 1}`,
      resourceType: "Material",
      amount: index < 3 ? "100.0000" : "10.0000",
      unifiedIndexCode: String(100 + index),
      unifiedIndexName: `MATERIAL ESPECIAL ${index + 1}`,
    }));

    const proposal = buildSmartMonomialProposal({
      budgetId: "budget-2",
      groups: [
        { key: "LABOR", amount: "100.0000", components: [] },
        { key: "MATERIALS", amount: "390.0000", components: materialComponents },
        { key: "EQUIPMENT", amount: "0.0000", components: [] },
        { key: "OTHERS", amount: "0.0000", components: [] },
        { key: "GENERAL_EXPENSES_PROFIT", amount: "100.0000", components: [] },
      ],
      maxMonomials: 10,
    });

    expect(proposal.monomials).toHaveLength(10);
    expect(proposal.diagnostics.some((diagnostic) => diagnostic.id === "proposal-trimmed-to-max")).toBe(true);
  });
});

describe("mergeSmartMonomials", () => {
  it("combines selected monomials and preserves composition", () => {
    const proposal = buildSmartMonomialProposal({
      budgetId: "budget-1",
      groups: baseGroups,
      maxMonomials: 10,
    });

    const merged = mergeSmartMonomials({
      monomials: proposal.monomials,
      selectedIds: ["budget-1-STEEL", "budget-1-CEMENT"],
      result: {
        code: "MT",
        name: "Materiales principales",
        baseIndexCode: "21",
        baseIndexName: "CEMENTO PORTLAND TIPO I",
      },
    });

    expect(merged.map((monomial) => monomial.code)).toEqual(["MO", "AG", "GU", "MT"]);
    expect(merged.find((monomial) => monomial.code === "MT")?.amount).toBe("350.0000");
    expect(merged.find((monomial) => monomial.code === "MT")?.coefficient).toBe("0.350");
    expect(merged.find((monomial) => monomial.code === "MT")?.composition).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- lib/calculations/polynomial-smart-monomials.test.ts`

Expected: FAIL because smart monomial module does not exist.

- [ ] **Step 3: Implement engine**

Create `lib/calculations/polynomial-smart-monomials.ts`:

```ts
import Decimal from "decimal.js";

import {
  calculateMonomialCoefficients,
  roundCoefficient,
} from "@/lib/calculations/polynomial-formula";
import {
  classifyUnifiedIndexForPolynomialFormula,
  type PolynomialIuFamily,
} from "@/lib/polynomial-formula/iu-family-classifier";
import type {
  SmartMonomialBroadGroupInput,
  SmartMonomialDiagnostic,
  SmartMonomialInput,
  SmartMonomialProposal,
  SmartMonomialSourceComponent,
} from "@/lib/polynomial-formula/types";
import type { PolynomialCostGroupKey } from "@/types/polynomial-formula";

const MINIMUM_MONOMIAL_COEFFICIENT = new Decimal("0.050");
const DEFAULT_BASE_INDEX_VALUE = "100";

type BuildSmartMonomialProposalInput = {
  budgetId: string;
  groups: SmartMonomialBroadGroupInput[];
  maxMonomials?: number;
};

type MergeSmartMonomialsInput = {
  monomials: SmartMonomialInput[];
  selectedIds: string[];
  result: {
    code: string;
    name: string;
    baseIndexCode: string;
    baseIndexName: string;
  };
};

const familyMetadata: Record<
  PolynomialIuFamily,
  { code: string; name: string; costGroupKey: PolynomialCostGroupKey }
> = {
  LABOR: { code: "MO", name: "Mano de obra", costGroupKey: "LABOR" },
  GENERAL_EXPENSES: {
    code: "GU",
    name: "Gastos generales y utilidad",
    costGroupKey: "GENERAL_EXPENSES_PROFIT",
  },
  STEEL: { code: "AC", name: "Acero", costGroupKey: "MATERIALS" },
  CEMENT: { code: "CE", name: "Cemento", costGroupKey: "MATERIALS" },
  AGGREGATES: { code: "AG", name: "Agregados", costGroupKey: "MATERIALS" },
  MASONRY: { code: "ALB", name: "Albanileria", costGroupKey: "MATERIALS" },
  WOOD: { code: "MA", name: "Madera", costGroupKey: "MATERIALS" },
  FINISHES: { code: "ACB", name: "Acabados", costGroupKey: "MATERIALS" },
  SANITARY_INSTALLATIONS: {
    code: "IS",
    name: "Instalaciones sanitarias",
    costGroupKey: "MATERIALS",
  },
  ELECTRICAL_INSTALLATIONS: {
    code: "IE",
    name: "Instalaciones electricas",
    costGroupKey: "MATERIALS",
  },
  EQUIPMENT: { code: "EQ", name: "Equipos", costGroupKey: "EQUIPMENT" },
  OTHERS: { code: "V", name: "Varios", costGroupKey: "OTHERS" },
};

function toDecimal(value: string) {
  return new Decimal(value || "0");
}

function formatAmount(value: Decimal.Value) {
  return new Decimal(value).toDecimalPlaces(4).toFixed(4);
}

function sumComponents(components: SmartMonomialSourceComponent[]) {
  return components.reduce((total, component) => total.plus(component.amount), new Decimal(0));
}

function normalizeComponent(component: SmartMonomialSourceComponent): SmartMonomialSourceComponent {
  if (!component.unifiedIndexCode || !component.unifiedIndexName) {
    return { ...component, iuFamily: component.iuFamily ?? "OTHERS" };
  }

  return {
    ...component,
    iuFamily:
      component.iuFamily ??
      classifyUnifiedIndexForPolynomialFormula({
        code: component.unifiedIndexCode,
        name: component.unifiedIndexName,
      }),
  };
}

function buildMonomialId(budgetId: string, familyOrKey: string) {
  return `${budgetId}-${familyOrKey}`;
}

function pickRepresentativeComponent(components: SmartMonomialSourceComponent[]) {
  return [...components].sort((left, right) =>
    toDecimal(right.amount).comparedTo(left.amount),
  )[0];
}

function createDraftMonomial(input: {
  id: string;
  family: PolynomialIuFamily;
  amount: string;
  coefficient: string;
  composition: SmartMonomialSourceComponent[];
  fallbackBaseIndexCode: string;
  fallbackBaseIndexName: string;
  sortOrder: number;
}): SmartMonomialInput {
  const metadata = familyMetadata[input.family];
  const representative = pickRepresentativeComponent(input.composition);

  return {
    id: input.id,
    code: metadata.code,
    name: metadata.name,
    costGroupKey: metadata.costGroupKey,
    amount: input.amount,
    coefficient: input.coefficient,
    baseIndexCode:
      representative?.unifiedIndexCode ?? input.fallbackBaseIndexCode,
    baseIndexName:
      representative?.unifiedIndexName ?? input.fallbackBaseIndexName,
    baseIndexValue: DEFAULT_BASE_INDEX_VALUE,
    sortOrder: input.sortOrder,
    composition: input.composition,
  };
}

function applyCoefficients(monomials: SmartMonomialInput[]) {
  const coefficients = calculateMonomialCoefficients(
    monomials.map((monomial) => ({
      key: monomial.costGroupKey,
      amount: monomial.amount,
    })),
  );

  return monomials.map((monomial, index) => ({
    ...monomial,
    coefficient: coefficients[index]?.coefficient ?? roundCoefficient("0"),
    sortOrder: index,
  }));
}

function mergeSmallestPair(monomials: SmartMonomialInput[]) {
  const candidates = [...monomials]
    .filter(
      (monomial) =>
        monomial.costGroupKey !== "LABOR" &&
        monomial.costGroupKey !== "GENERAL_EXPENSES_PROFIT",
    )
    .sort((left, right) => toDecimal(left.amount).comparedTo(right.amount));

  const [first, second] = candidates;
  if (!first || !second) return monomials;

  const keep = monomials.filter((monomial) => monomial.id !== first.id && monomial.id !== second.id);
  const amount = toDecimal(first.amount).plus(second.amount);
  const merged: SmartMonomialInput = {
    ...second,
    id: `${second.id}-${first.id}-merged`,
    code: second.code,
    name: `${second.name} + ${first.name}`,
    amount: formatAmount(amount),
    composition: [...second.composition, ...first.composition],
  };

  return applyCoefficients([...keep, merged]);
}

export function buildSmartMonomialProposal(
  input: BuildSmartMonomialProposalInput,
): SmartMonomialProposal {
  const maxMonomials = input.maxMonomials ?? 10;
  const diagnostics: SmartMonomialDiagnostic[] = [];
  const groupByKey = new Map(input.groups.map((group) => [group.key, group]));
  const drafts: SmartMonomialInput[] = [];

  const labor = groupByKey.get("LABOR");
  if (labor && toDecimal(labor.amount).greaterThan(0)) {
    drafts.push(
      createDraftMonomial({
        id: buildMonomialId(input.budgetId, "LABOR"),
        family: "LABOR",
        amount: labor.amount,
        coefficient: "0.000",
        composition: labor.components.map(normalizeComponent),
        fallbackBaseIndexCode: "47",
        fallbackBaseIndexName: "MANO DE OBRA",
        sortOrder: drafts.length,
      }),
    );
  }

  const materials = groupByKey.get("MATERIALS");
  if (materials) {
    const materialByFamily = new Map<PolynomialIuFamily, SmartMonomialSourceComponent[]>();
    for (const component of materials.components.map(normalizeComponent)) {
      const family = component.iuFamily ?? "OTHERS";
      materialByFamily.set(family, [...(materialByFamily.get(family) ?? []), component]);
    }

    for (const [family, components] of materialByFamily.entries()) {
      const amount = sumComponents(components);
      if (amount.lessThanOrEqualTo(0)) continue;

      drafts.push(
        createDraftMonomial({
          id: buildMonomialId(input.budgetId, family),
          family,
          amount: formatAmount(amount),
          coefficient: "0.000",
          composition: components,
          fallbackBaseIndexCode: components[0]?.unifiedIndexCode ?? "",
          fallbackBaseIndexName: components[0]?.unifiedIndexName ?? "Pendiente de asignar",
          sortOrder: drafts.length,
        }),
      );
    }
  }

  const equipment = groupByKey.get("EQUIPMENT");
  if (equipment && toDecimal(equipment.amount).greaterThan(0)) {
    drafts.push(
      createDraftMonomial({
        id: buildMonomialId(input.budgetId, "EQUIPMENT"),
        family: "EQUIPMENT",
        amount: equipment.amount,
        coefficient: "0.000",
        composition: equipment.components.map(normalizeComponent),
        fallbackBaseIndexCode: "48",
        fallbackBaseIndexName: "MAQUINARIA Y EQUIPO",
        sortOrder: drafts.length,
      }),
    );
  }

  const generalExpenses = groupByKey.get("GENERAL_EXPENSES_PROFIT");
  if (generalExpenses && toDecimal(generalExpenses.amount).greaterThan(0)) {
    drafts.push(
      createDraftMonomial({
        id: buildMonomialId(input.budgetId, "GENERAL_EXPENSES_PROFIT"),
        family: "GENERAL_EXPENSES",
        amount: generalExpenses.amount,
        coefficient: "0.000",
        composition: generalExpenses.components.map(normalizeComponent),
        fallbackBaseIndexCode: "39",
        fallbackBaseIndexName: "INDICE GENERAL DE PRECIOS AL CONSUMIDOR",
        sortOrder: drafts.length,
      }),
    );
  }

  const others = groupByKey.get("OTHERS");
  if (others && toDecimal(others.amount).greaterThan(0)) {
    diagnostics.push({
      id: "others-below-threshold",
      severity: "warning",
      message: "Varios debe unirse si no alcanza 0.050 de coeficiente.",
      monomialCode: "V",
    });
  } else {
    diagnostics.push({
      id: "others-below-threshold",
      severity: "info",
      message: "Varios no participa porque su monto es 0.000.",
      monomialCode: "V",
    });
  }

  let monomials = applyCoefficients(drafts);
  monomials = monomials.filter((monomial) => {
    if (monomial.costGroupKey !== "EQUIPMENT") return true;
    const keep = toDecimal(monomial.coefficient).greaterThanOrEqualTo(MINIMUM_MONOMIAL_COEFFICIENT);
    if (!keep) {
      diagnostics.push({
        id: "equipment-below-threshold",
        severity: "warning",
        message: "Equipos queda por debajo de 0.050 y se recomienda unirlo.",
        monomialCode: monomial.code,
      });
    }
    return keep;
  });

  monomials = applyCoefficients(monomials);
  while (monomials.length > maxMonomials) {
    monomials = mergeSmallestPair(monomials);
    if (!diagnostics.some((diagnostic) => diagnostic.id === "proposal-trimmed-to-max")) {
      diagnostics.push({
        id: "proposal-trimmed-to-max",
        severity: "warning",
        message: `La propuesta se redujo automaticamente a ${maxMonomials} monomios.`,
      });
    }
  }

  return { monomials: applyCoefficients(monomials), diagnostics };
}

export function mergeSmartMonomials(input: MergeSmartMonomialsInput): SmartMonomialInput[] {
  const selected = input.monomials.filter((monomial) => input.selectedIds.includes(monomial.id));
  if (selected.length < 2) return input.monomials;

  const unselected = input.monomials.filter((monomial) => !input.selectedIds.includes(monomial.id));
  const amount = selected.reduce((total, monomial) => total.plus(monomial.amount), new Decimal(0));
  const composition = selected.flatMap((monomial) => monomial.composition);
  const merged: SmartMonomialInput = {
    id: input.selectedIds.join("__"),
    code: input.result.code.trim(),
    name: input.result.name.trim(),
    costGroupKey: selected[0]?.costGroupKey ?? "MATERIALS",
    amount: formatAmount(amount),
    coefficient: "0.000",
    baseIndexCode: input.result.baseIndexCode.trim(),
    baseIndexName: input.result.baseIndexName.trim(),
    baseIndexValue: DEFAULT_BASE_INDEX_VALUE,
    sortOrder: unselected.length,
    composition,
  };

  return applyCoefficients([...unselected, merged]);
}
```

- [ ] **Step 4: Run tests**

Run: `npm run test -- lib/calculations/polynomial-smart-monomials.test.ts`

Expected: PASS. If ordering differs, adjust implementation sorting to keep anchors first, material families by descending amount, and GG last.

- [ ] **Step 5: Commit**

```bash
git add lib/calculations/polynomial-smart-monomials.ts lib/calculations/polynomial-smart-monomials.test.ts
git commit -m "Add smart polynomial monomial engine"
```

---

### Task 6: Update Max Monomial Limit From 8 To 10

**Files:**
- Modify: `lib/calculations/polynomial-formula.ts`
- Modify: `lib/calculations/polynomial-formula.test.ts`
- Modify: `lib/validations/polynomial-formula.ts`

- [ ] **Step 1: Update failing expectations**

In `lib/calculations/polynomial-formula.test.ts`, change the maximum monomial test to expect 11 to fail and 10 to pass:

```ts
it("allows up to ten monomials and rejects eleven", () => {
  const ten = Array.from({ length: 10 }, (_, index) => ({
    coefficient: "0.100",
    baseIndexValue: "100",
    adjustmentIndexValue: "100",
    name: `M${index + 1}`,
  }));
  const eleven = [
    ...ten,
    {
      coefficient: "0.000",
      baseIndexValue: "100",
      adjustmentIndexValue: "100",
      name: "M11",
    },
  ];

  expect(validatePolynomialFormula(ten).hasMaximumTermsValid).toBe(true);
  expect(validatePolynomialFormula(eleven).hasMaximumTermsValid).toBe(false);
});
```

Remove or replace the old "more than eight monomials" test.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- lib/calculations/polynomial-formula.test.ts`

Expected: FAIL because current maximum is 8.

- [ ] **Step 3: Update constants and schemas**

In `lib/calculations/polynomial-formula.ts`:

```ts
const MAXIMUM_MONOMIALS = 10;
```

In `lib/validations/polynomial-formula.ts`, change:

```ts
monomials: z.array(polynomialMonomialInputSchema).min(1).max(10),
```

And:

```ts
monomials: z.array(polynomialKCalculationMonomialSchema).min(1).max(10),
```

- [ ] **Step 4: Run tests**

Run: `npm run test -- lib/calculations/polynomial-formula.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/calculations/polynomial-formula.ts lib/calculations/polynomial-formula.test.ts lib/validations/polynomial-formula.ts
git commit -m "Allow ten polynomial monomials"
```

---

### Task 7: Integrate Smart Proposal Into Data Composition

**Files:**
- Modify: `lib/data/polynomial-formulas.ts`
- Modify: `lib/data/polynomial-formulas.test.ts`

- [ ] **Step 1: Write failing integration test**

In `lib/data/polynomial-formulas.test.ts`, add:

```ts
it("expands material resources into smart monomial families while preserving labor and GU", () => {
  const result = composeBudgetPolynomialFormulaInput({
    id: "budget-smart",
    projectId: "project-1",
    totalGeneralExpenses: 120,
    totalUtility: 80,
    items: [
      {
        id: "item-1",
        quantity: 1,
        apu: {
          resources: [
            {
              id: "mo",
              resourceType: "MO",
              subtotal: 300,
              resource: { category: "LABOR", iu: "47" },
            },
            {
              id: "steel",
              resourceType: "Material",
              subtotal: 180,
              resource: { category: "MATERIAL", iu: "3" },
            },
            {
              id: "cement",
              resourceType: "Material",
              subtotal: 170,
              resource: { category: "MATERIAL", iu: "21" },
            },
            {
              id: "aggregate",
              resourceType: "Material",
              subtotal: 150,
              resource: { category: "MATERIAL", iu: "5" },
            },
            {
              id: "equipment-low",
              resourceType: "Equipo",
              subtotal: 40,
              resource: { category: "EQUIPMENT", iu: "48" },
            },
          ],
        },
      },
    ],
  });

  expect(result.monomials.map((monomial) => monomial.code)).toEqual([
    "MO",
    "AC",
    "CE",
    "AG",
    "GU",
  ]);
  expect(result.componentsByGroup.get("MATERIALS")?.map((component) => component.unifiedIndexCode)).toEqual([
    "3",
    "21",
    "5",
  ]);
  expect(result.monomials.find((monomial) => monomial.code === "AC")?.composition[0]?.iuFamily).toBe("STEEL");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- lib/data/polynomial-formulas.test.ts`

Expected: FAIL because current composer returns coarse `MAT` and no composition.

- [ ] **Step 3: Extend component draft type**

In `lib/data/polynomial-formulas.ts`, update `MonomialComponentDraft`:

```ts
type MonomialComponentDraft = {
  budgetItemId?: string;
  apuResourceId?: string;
  resourceType?: string;
  amount: string;
  unifiedIndexCode?: string;
  unifiedIndexName?: string;
  iuFamily?: string;
  participationPercentage?: string;
  coefficientContribution?: string;
};
```

Update `PersistedMonomialComponentDraft` with matching nullable fields:

```ts
type PersistedMonomialComponentDraft = {
  budgetItemId: string | null;
  apuResourceId: string | null;
  resourceType: string | null;
  amount: string;
  unifiedIndexCode: string | null;
  unifiedIndexName: string | null;
  iuFamily: string | null;
  participationPercentage: string | null;
  coefficientContribution: string | null;
};
```

- [ ] **Step 4: Load IU names for known resource IU codes**

In `composeBudgetPolynomialFormulaInput`, resource records currently only expose `iu`. Add a small local mapping function for generation fallback:

```ts
function resolveKnownUnifiedIndexName(code: string | null | undefined) {
  const names: Record<string, string> = {
    "47": "MANO DE OBRA",
    "39": "INDICE GENERAL DE PRECIOS AL CONSUMIDOR",
    "3": "ACERO DE CONSTRUCCION CORRUGADO",
    "2": "ACERO DE CONSTRUCCION LISO",
    "21": "CEMENTO PORTLAND TIPO I",
    "5": "AGREGADO GRUESO",
    "17": "BLOQUES Y LADRILLOS",
    "43": "MADERA NACIONAL PARA ENCOFRADO Y CARPINTERIA",
    "54": "PINTURA LATEX",
    "72": "TUBERIA DE PVC",
    "65": "TUBERIA DE ACERO NEGRO Y/O GALVANIZADO",
    "7": "ALAMBRE Y CABLE TW Y THW",
  };

  if (!code) return undefined;
  return names[code.trim()];
}
```

This keeps the pure composer testable. Later DB enrichment can replace fallback names when needed.

- [ ] **Step 5: Feed components into smart engine**

Import:

```ts
import { buildSmartMonomialProposal } from "@/lib/calculations/polynomial-smart-monomials";
```

When pushing `componentsByGroup`, include IU snapshot:

```ts
const unifiedIndexCode = resource.resource?.iu ?? undefined;
componentsByGroup.get(groupKey)?.push({
  apuResourceId: resource.id,
  resourceType: resource.resourceType ?? resource.resource?.category ?? undefined,
  amount: formatFixed(amount, 4),
  unifiedIndexCode,
  unifiedIndexName: resolveKnownUnifiedIndexName(unifiedIndexCode),
});
```

After `groupedAmounts`, replace the old `calculateMonomialCoefficients(groupedAmounts.groups)` mapping with:

```ts
const smartProposal = buildSmartMonomialProposal({
  budgetId: budget.id,
  groups: groupedAmounts.groups.map((group) => ({
    key: group.key,
    amount: group.amount,
    components: componentsByGroup.get(group.key as GeneratedCostGroupKey) ?? [],
  })),
  maxMonomials: 10,
});

const monomials = smartProposal.monomials.map((monomial) => ({
  ...monomial,
  sortOrder: monomial.sortOrder,
}));
```

- [ ] **Step 6: Preserve composition in `sanitizePolynomialMonomialComponents`**

Update the returned object:

```ts
{
  budgetItemId,
  apuResourceId,
  resourceType: component.resourceType ?? null,
  amount: component.amount,
  unifiedIndexCode: component.unifiedIndexCode ?? null,
  unifiedIndexName: component.unifiedIndexName ?? null,
  iuFamily: component.iuFamily ?? null,
  participationPercentage: component.participationPercentage ?? null,
  coefficientContribution: component.coefficientContribution ?? null,
}
```

- [ ] **Step 7: Run tests**

Run: `npm run test -- lib/data/polynomial-formulas.test.ts lib/calculations/polynomial-smart-monomials.test.ts`

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add lib/data/polynomial-formulas.ts lib/data/polynomial-formulas.test.ts
git commit -m "Generate smart polynomial monomial proposals"
```

---

### Task 8: Persist Composition During Generate And Save

**Files:**
- Modify: `lib/data/polynomial-formulas.ts`
- Modify: `lib/db/serializers.ts`
- Modify: `lib/validations/polynomial-formula.ts`
- Test: `lib/data/polynomial-formulas.test.ts`

- [ ] **Step 1: Update validation schema for composition**

In `lib/validations/polynomial-formula.ts`, add:

```ts
const polynomialMonomialCompositionInputSchema = z.object({
  id: z.string().trim().optional(),
  budgetItemId: z.string().trim().nullable().optional(),
  apuResourceId: z.string().trim().nullable().optional(),
  resourceType: z.string().trim().nullable().optional(),
  amount: createDecimalStringSchema({ allowZero: true, fieldName: "El monto de composicion" }),
  unifiedIndexCode: z.string().trim().nullable().optional(),
  unifiedIndexName: z.string().trim().nullable().optional(),
  iuFamily: z.string().trim().nullable().optional(),
  participationPercentage: createDecimalStringSchema({
    allowZero: true,
    fieldName: "El porcentaje de participacion",
  })
    .nullable()
    .optional(),
  coefficientContribution: createDecimalStringSchema({
    allowZero: true,
    fieldName: "El coeficiente aportado",
  })
    .nullable()
    .optional(),
});
```

Add to `polynomialMonomialInputSchema`:

```ts
composition: z.array(polynomialMonomialCompositionInputSchema).optional(),
```

- [ ] **Step 2: Persist composition on generate**

In both create/update branches in `generatePolynomialFormulaFromBudget`, update `components.create`:

```ts
create: sanitizePolynomialMonomialComponents(monomial.composition ?? []).map((component) => ({
  budgetItemId: component.budgetItemId,
  apuResourceId: component.apuResourceId,
  resourceType: component.resourceType,
  amount: formatBaseAmount(component.amount),
  unifiedIndexCode: component.unifiedIndexCode,
  unifiedIndexName: component.unifiedIndexName,
  iuFamily: component.iuFamily,
  participationPercentage: component.participationPercentage,
  coefficientContribution: component.coefficientContribution,
})),
```

- [ ] **Step 3: Include components in formula query results**

Every `include: { monomials: { orderBy } }` that feeds `serializePolynomialFormula` must become:

```ts
include: {
  monomials: {
    orderBy: { sortOrder: "asc" },
    include: {
      components: {
        orderBy: { createdAt: "asc" },
      },
    },
  },
}
```

Apply this in:

- `getBudgetPolynomialFormulaSectionData`
- `generatePolynomialFormulaFromBudget`
- `savePolynomialFormula`
- `getAccessibleBudgetFormula` if it serializes or calculates using returned monomials

- [ ] **Step 4: Persist composition on save**

In `savePolynomialFormula`, when recreating monomials, prefer incoming `monomial.composition` if present:

```ts
const incomingComponents = monomial.composition ?? [];
const preservedComponents =
  incomingComponents.length > 0
    ? incomingComponents
    : preservedComponentsFromDatabase.map((component) => ({
        budgetItemId: component.budgetItemId ?? undefined,
        apuResourceId: component.apuResourceId ?? undefined,
        resourceType: component.resourceType ?? undefined,
        amount: component.amount.toFixed(4),
        unifiedIndexCode: component.unifiedIndexCode ?? undefined,
        unifiedIndexName: component.unifiedIndexName ?? undefined,
        iuFamily: component.iuFamily ?? undefined,
        participationPercentage: component.participationPercentage?.toString(),
        coefficientContribution: component.coefficientContribution?.toString(),
      }));
```

Then create components with all snapshot fields.

- [ ] **Step 5: Run focused tests**

Run: `npm run test -- lib/data/polynomial-formulas.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/data/polynomial-formulas.ts lib/db/serializers.ts lib/validations/polynomial-formula.ts lib/data/polynomial-formulas.test.ts
git commit -m "Persist polynomial monomial composition snapshots"
```

---

### Task 9: Add Advanced Diagnostics

**Files:**
- Modify: `types/polynomial-formula.ts`
- Modify: `lib/calculations/polynomial-smart-monomials.ts`
- Modify: `components/budget/polynomial-validation-summary.tsx`
- Test: `lib/calculations/polynomial-smart-monomials.test.ts`

- [ ] **Step 1: Add diagnostic type to shared types**

In `types/polynomial-formula.ts`, add:

```ts
export type PolynomialFormulaDiagnosticRecord = {
  id: string;
  severity: "info" | "warning" | "error";
  label: string;
  detail: string;
  monomialCode?: string;
};
```

- [ ] **Step 2: Add pure diagnostic function**

In `lib/calculations/polynomial-smart-monomials.ts`, export:

```ts
export function buildPolynomialFormulaDiagnostics(monomials: SmartMonomialInput[]) {
  const diagnostics: SmartMonomialDiagnostic[] = [];
  const codes = new Set(monomials.map((monomial) => monomial.code));

  if (!codes.has("MO")) {
    diagnostics.push({
      id: "missing-labor-anchor",
      severity: "error",
      message: "La formula debe conservar mano de obra como monomio.",
      monomialCode: "MO",
    });
  }

  if (!codes.has("GU")) {
    diagnostics.push({
      id: "missing-general-expenses-anchor",
      severity: "error",
      message: "La formula debe conservar gastos generales y utilidad como monomio.",
      monomialCode: "GU",
    });
  }

  if (monomials.length > 10) {
    diagnostics.push({
      id: "too-many-monomials",
      severity: "error",
      message: "La formula no debe tener mas de 10 monomios.",
    });
  }

  for (const monomial of monomials) {
    const isAnchor = monomial.code === "MO" || monomial.code === "GU";
    if (!isAnchor && toDecimal(monomial.coefficient).lessThan(MINIMUM_MONOMIAL_COEFFICIENT)) {
      diagnostics.push({
        id: `weak-${monomial.id}`,
        severity: "warning",
        message: `${monomial.code} tiene coeficiente menor a 0.050 y debe revisarse para union.`,
        monomialCode: monomial.code,
      });
    }
  }

  return diagnostics;
}
```

- [ ] **Step 3: Update validation component props**

In `components/budget/polynomial-validation-summary.tsx`, import `buildPolynomialFormulaDiagnostics` and map `PolynomialMonomialRecord` to smart input-compatible shape:

```ts
const operationalDiagnostics = buildPolynomialFormulaDiagnostics(
  monomials.map((monomial) => ({
    ...monomial,
    composition: monomial.composition,
  })),
);
```

Render badges:

```tsx
{operationalDiagnostics.map((diagnostic) => (
  <Badge
    key={diagnostic.id}
    className={
      diagnostic.severity === "error"
        ? "bg-rose-100 text-rose-700"
        : diagnostic.severity === "warning"
          ? "bg-amber-100 text-amber-700"
          : "bg-sky-100 text-sky-700"
    }
  >
    {diagnostic.message}
  </Badge>
))}
```

- [ ] **Step 4: Run tests and lint**

Run: `npm run test -- lib/calculations/polynomial-smart-monomials.test.ts`

Run: `npm run lint`

Expected: PASS for both.

- [ ] **Step 5: Commit**

```bash
git add types/polynomial-formula.ts lib/calculations/polynomial-smart-monomials.ts components/budget/polynomial-validation-summary.tsx lib/calculations/polynomial-smart-monomials.test.ts
git commit -m "Add advanced polynomial formula diagnostics"
```

---

### Task 10: Add DEV Composition Detail In Monomials Table

**Files:**
- Modify: `components/budget/polynomial-monomials-table.tsx`

- [ ] **Step 1: Add expansion state**

In `PolynomialMonomialsTable`, add:

```ts
const [expandedMonomialIds, setExpandedMonomialIds] = useState<Set<string>>(() => new Set());

function toggleExpandedMonomial(monomialId: string) {
  setExpandedMonomialIds((current) => {
    const next = new Set(current);
    if (next.has(monomialId)) next.delete(monomialId);
    else next.add(monomialId);
    return next;
  });
}
```

- [ ] **Step 2: Add expand button column**

Add a leading `TH`:

```tsx
<TH className="w-12">Detalle</TH>
```

Inside each row, add first cell:

```tsx
<TD className="align-top">
  <button
    type="button"
    onClick={() => toggleExpandedMonomial(monomial.id)}
    className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
    aria-expanded={expandedMonomialIds.has(monomial.id)}
  >
    {expandedMonomialIds.has(monomial.id) ? "-" : "+"}
  </button>
</TD>
```

- [ ] **Step 3: Render composition detail row**

After the main `TR`, add:

```tsx
{expandedMonomialIds.has(monomial.id) ? (
  <TR key={`${monomial.id}-composition`}>
    <TD colSpan={8} className="bg-slate-50 p-0">
      <div className="px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
          Detalle de composicion DEV
        </p>
        <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full min-w-[760px] text-xs">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-3 py-2 text-left">IU</th>
                <th className="px-3 py-2 text-left">Familia</th>
                <th className="px-3 py-2 text-right">Monto</th>
                <th className="px-3 py-2 text-right">% monomio</th>
                <th className="px-3 py-2 text-right">Coef. aportado</th>
              </tr>
            </thead>
            <tbody>
              {monomial.composition.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-3 text-center text-slate-500">
                    Sin composicion guardada.
                  </td>
                </tr>
              ) : (
                monomial.composition.map((component) => (
                  <tr key={component.id} className="border-t border-slate-100">
                    <td className="px-3 py-2">
                      {component.unifiedIndexCode ?? "-"} - {component.unifiedIndexName ?? "Sin IU"}
                    </td>
                    <td className="px-3 py-2">{component.iuFamily ?? "OTHERS"}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {formatAmountDisplay(component.amount, currencyDecimals)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {formatNumber(Number(component.participationPercentage ?? 0) * 100, 2)}%
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {formatThreeDecimals(component.coefficientContribution ?? "0")}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </TD>
  </TR>
) : null}
```

- [ ] **Step 4: Run lint**

Run: `npm run lint`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/budget/polynomial-monomials-table.tsx
git commit -m "Show polynomial monomial composition detail"
```

---

### Task 11: Add Manual Merge Dialog And Client Merge Flow

**Files:**
- Create: `components/budget/polynomial-monomial-merge-dialog.tsx`
- Modify: `components/budget/polynomial-monomials-table.tsx`
- Modify: `components/budget/polynomial-formula-editor.tsx`

- [ ] **Step 1: Create merge dialog component**

Create `components/budget/polynomial-monomial-merge-dialog.tsx`:

```tsx
"use client";

import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatNumber } from "@/lib/utils";
import type { PolynomialMonomialRecord } from "@/types/polynomial-formula";

type MergeResult = {
  code: string;
  name: string;
  baseIndexCode: string;
  baseIndexName: string;
};

export function PolynomialMonomialMergeDialog({
  open,
  selectedMonomials,
  currencyDecimals,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  selectedMonomials: PolynomialMonomialRecord[];
  currencyDecimals: number;
  onCancel: () => void;
  onConfirm: (result: MergeResult) => void;
}) {
  const primary = selectedMonomials[0];
  const [code, setCode] = useState(primary?.code ?? "");
  const [name, setName] = useState(primary?.name ?? "");
  const [baseIndexCode, setBaseIndexCode] = useState(primary?.baseIndexCode ?? "");
  const [baseIndexName, setBaseIndexName] = useState(primary?.baseIndexName ?? "");

  const amount = useMemo(
    () => selectedMonomials.reduce((total, monomial) => total + Number(monomial.amount), 0),
    [selectedMonomials],
  );
  const coefficient = useMemo(
    () => selectedMonomials.reduce((total, monomial) => total + Number(monomial.coefficient), 0),
    [selectedMonomials],
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 px-4">
      <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">Juntar monomios</h2>
            <p className="mt-1 text-sm text-slate-500">
              Define el monomio resultante y conserva la composicion IU combinada.
            </p>
          </div>
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cerrar
          </Button>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2">
          <label className="space-y-1 text-sm text-slate-600">
            Codigo
            <Input value={code} onChange={(event) => setCode(event.target.value)} />
          </label>
          <label className="space-y-1 text-sm text-slate-600">
            Nombre
            <Input value={name} onChange={(event) => setName(event.target.value)} />
          </label>
          <label className="space-y-1 text-sm text-slate-600">
            IU representante
            <Input value={baseIndexCode} onChange={(event) => setBaseIndexCode(event.target.value)} />
          </label>
          <label className="space-y-1 text-sm text-slate-600">
            Nombre IU
            <Input value={baseIndexName} onChange={(event) => setBaseIndexName(event.target.value)} />
          </label>
        </div>

        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
          <p>Monomios seleccionados: {selectedMonomials.map((monomial) => monomial.code).join(", ")}</p>
          <p>Monto combinado: {formatNumber(amount, currencyDecimals)}</p>
          <p>Coeficiente aproximado: {coefficient.toFixed(3)}</p>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={() =>
              onConfirm({
                code,
                name,
                baseIndexCode,
                baseIndexName,
              })
            }
            disabled={!code.trim() || !name.trim() || selectedMonomials.length < 2}
          >
            Juntar
          </Button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add selection controls to table**

In `PolynomialMonomialsTable`, add props:

```ts
selectedMonomialIds: string[];
onToggleSelectedMonomial: (monomialId: string) => void;
onOpenMergeDialog: () => void;
```

Add an action button in `OperationalPanel.controls`:

```tsx
controls={
  <Button
    type="button"
    variant="outline"
    onClick={onOpenMergeDialog}
    disabled={selectedMonomialIds.length < 2}
  >
    Juntar monomios
  </Button>
}
```

Add a checkbox column:

```tsx
<TH className="w-10">Sel.</TH>
```

And cell:

```tsx
<TD className="align-top">
  <input
    type="checkbox"
    checked={selectedMonomialIds.includes(monomial.id)}
    onChange={() => onToggleSelectedMonomial(monomial.id)}
    className="h-4 w-4 rounded border-slate-300"
    aria-label={`Seleccionar ${monomial.code}`}
  />
</TD>
```

- [ ] **Step 3: Wire merge in editor**

In `components/budget/polynomial-formula-editor.tsx`, import:

```ts
import { mergeSmartMonomials } from "@/lib/calculations/polynomial-smart-monomials";
import { PolynomialMonomialMergeDialog } from "@/components/budget/polynomial-monomial-merge-dialog";
```

Add state:

```ts
const [selectedMonomialIds, setSelectedMonomialIds] = useState<string[]>([]);
const [mergeDialogOpen, setMergeDialogOpen] = useState(false);
```

Add helpers:

```ts
function toggleSelectedMonomial(monomialId: string) {
  setSelectedMonomialIds((current) =>
    current.includes(monomialId)
      ? current.filter((id) => id !== monomialId)
      : [...current, monomialId],
  );
}

function mergeSelectedMonomials(result: {
  code: string;
  name: string;
  baseIndexCode: string;
  baseIndexName: string;
}) {
  setFormula((current) => {
    if (!current) return current;
    const merged = mergeSmartMonomials({
      monomials: current.monomials,
      selectedIds: selectedMonomialIds,
      result,
    });
    const next = { ...current, monomials: merged };
    setSummary(createFormulaSummary(next));
    return next;
  });
  setSelectedMonomialIds([]);
  setMergeDialogOpen(false);
}
```

Pass props to table and render dialog:

```tsx
<PolynomialMonomialsTable
  monomials={formula.monomials}
  baseIndexOptions={baseIndexOptions}
  baseIndicesLoading={baseIndicesLoading}
  onChangeMonomial={updateMonomial}
  currencyDecimals={currencyDecimals}
  selectedMonomialIds={selectedMonomialIds}
  onToggleSelectedMonomial={toggleSelectedMonomial}
  onOpenMergeDialog={() => setMergeDialogOpen(true)}
/>
<PolynomialMonomialMergeDialog
  open={mergeDialogOpen}
  selectedMonomials={formula.monomials.filter((monomial) => selectedMonomialIds.includes(monomial.id))}
  currencyDecimals={currencyDecimals}
  onCancel={() => setMergeDialogOpen(false)}
  onConfirm={mergeSelectedMonomials}
/>
```

- [ ] **Step 4: Run lint**

Run: `npm run lint`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/budget/polynomial-monomial-merge-dialog.tsx components/budget/polynomial-monomials-table.tsx components/budget/polynomial-formula-editor.tsx
git commit -m "Add manual polynomial monomial merge flow"
```

---

### Task 12: Final Verification And Reference Comparison

**Files:**
- No planned code changes.

- [ ] **Step 1: Run focused test suite**

Run:

```bash
npm run test -- lib/calculations/polynomial-formula.test.ts lib/calculations/polynomial-smart-monomials.test.ts lib/data/polynomial-formulas.test.ts lib/polynomial-formula/iu-family-classifier.test.ts
```

Expected: all tests pass.

- [ ] **Step 2: Run lint**

Run: `npm run lint`

Expected: PASS.

- [ ] **Step 3: Run build**

Run: `node ./node_modules/next/dist/bin/next build`

Expected: build completes without TypeScript or Next.js errors.

- [ ] **Step 4: Manual UI smoke check**

Run: `npm run dev`

Open the formula page for a budget with APU resources. Verify:

- `Generar formula` creates no more than 10 monomials.
- `MO` appears when labor exists.
- `GU` appears when general expenses or utility exist.
- Materials are split into IU-family monomials.
- Composition rows expand under monomials.
- Selecting two monomials enables `Juntar monomios`.
- Merging changes coefficients and keeps sum at `1.000`.
- Save persists the merged formula and composition detail reloads.

- [ ] **Step 5: Compare with reference workbooks**

Use the four reference workbooks as qualitative checks:

- `Formula_Polinomica-estructuras.xlsx`: should produce anchors plus material families such as steel, aggregates/cement, and GG.
- `Formula Polinomica-arquitectura.xlsx`: should produce labor, material families for finishes/masonry/wood, and GG.
- `Formula_Polinomica-sanitarias.xlsx`: should produce labor, sanitary material family, and GG.
- `Formula_Polinomica-electricas.xlsx`: should produce labor, electrical material family, and GG.

Expected: exact coefficients may differ by budget data, but the grouping shape should match the reference model.

- [ ] **Step 6: Record verification result**

If Steps 1-5 pass without code changes, do not create a commit. If a verification step fails, return to the task that introduced the failing behavior, add a focused failing test there, fix it, and commit inside that task's file scope.

---

## Self-Review Checklist

- Spec coverage:
  - Broad groups first: Task 7.
  - MO and GG anchors: Tasks 5, 7, 9.
  - Materials expanded by IU family: Tasks 3, 5, 7.
  - Equipment and Others threshold behavior: Tasks 5, 9.
  - Max 10 monomials: Tasks 5, 6.
  - DEV composition view: Tasks 1, 2, 8, 10.
  - Manual merge: Tasks 5, 11.
  - IU catalog untouched: Tasks 3, 5.
  - Precision rules: Tasks 6, 10, 12.
- Completeness scan: every implementation step includes concrete files, commands, and expected outcomes.
- Type consistency:
  - `composition` is the UI/API record property.
  - `SmartMonomialInput` mirrors the monomial fields used by merge logic.
  - Snapshot fields use `unifiedIndexCode`, `unifiedIndexName`, `iuFamily`, `participationPercentage`, `coefficientContribution`.
