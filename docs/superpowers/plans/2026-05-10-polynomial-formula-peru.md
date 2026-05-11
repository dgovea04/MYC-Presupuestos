# Polynomial Formula Peru Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a complete polynomial formula module for Peruvian construction budgets that generates coefficients from real budget/APU data, validates the formula under local rules, applies INEI unified indices, calculates coefficient `K`, and produces monthly adjustment history.

**Architecture:** Add a dedicated `polynomial-formula` domain with Prisma persistence, pure calculation services, budget-facing data composition, REST endpoints, and reusable UI components under the existing general budget section. Keep all mathematical and normative rules inside pure calculation and validation modules so UI remains a thin editor/view layer and future country-specific strategies can branch cleanly.

**Tech Stack:** Next.js App Router, React 19, Prisma, PostgreSQL, Zod, Vitest, ExcelJS, decimal.js, existing app UI components

---

## File Map

**Create**
- `types/polynomial-formula.ts`
- `lib/polynomial-formula/types.ts`
- `lib/polynomial-formula/index-source.ts`
- `lib/polynomial-formula/index-source.test.ts`
- `lib/calculations/polynomial-formula.ts`
- `lib/calculations/polynomial-formula.test.ts`
- `lib/validations/polynomial-formula.ts`
- `lib/data/polynomial-formulas.ts`
- `components/budget/polynomial-formula-editor.tsx`
- `components/budget/polynomial-monomials-table.tsx`
- `components/budget/polynomial-formula-math.tsx`
- `components/budget/polynomial-k-calculator.tsx`
- `components/budget/polynomial-adjustment-history.tsx`
- `components/budget/polynomial-validation-summary.tsx`
- `app/api/budgets/[id]/polynomial-formula/route.ts`
- `app/api/polynomial-formulas/[id]/calculate/route.ts`
- `app/api/polynomial-formulas/[id]/adjustments/route.ts`
- `app/api/unified-indices/route.ts`
- `prisma/migrations/<timestamp>_add_polynomial_formula_module/migration.sql`

**Modify**
- `prisma/schema.prisma`
- `prisma/seed.ts`
- `package.json`
- `lib/db/serializers.ts`
- `lib/data/budgets.ts`
- `types/budget-sections.ts`
- `app/budgets/[id]/polynomial-formula/page.tsx`
- `README.md`

**Reference Inputs**
- `presupuesto-ejemplo/formula-polinomica-peru-webapp-spec.md`
- `presupuesto-ejemplo/formula-polinomica/07_indices_unificados_de_precios_de_la_construccion_ene26.xlsx`

## Scope Notes

- This plan covers one coherent subsystem: polynomial formulas for Peruvian public-work budget adjustments.
- The workbook `07_indices_unificados_de_precios_de_la_construccion_ene26.xlsx` is the initial source for:
  - monthly INEI index values,
  - index code-to-name mapping,
  - dictionary support for future auto-suggestion of compatible indices.
- The first implementation must not hardcode final business index mappings into formulas. It may seed available indices and leave manual assignment in the UI.

## Task 1: Add Decimal-Safe Foundation

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Write the failing test**

Create a first failing spec in `lib/calculations/polynomial-formula.test.ts` with:

```ts
import { describe, expect, it } from "vitest";
import { roundCoefficient, roundCurrency, roundKValue } from "@/lib/calculations/polynomial-formula";

describe("polynomial formula rounding", () => {
  it("rounds coefficients to three decimals", () => {
    expect(roundCoefficient("0.1796")).toBe("0.180");
  });

  it("rounds K to three decimals", () => {
    expect(roundKValue("1.1165")).toBe("1.117");
  });

  it("rounds money to two decimals", () => {
    expect(roundCurrency("111700.005")).toBe("111700.01");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm.cmd test -- lib/calculations/polynomial-formula.test.ts`
Expected: FAIL because the module does not exist.

- [ ] **Step 3: Add decimal-safe dependency**

Update `package.json` dependencies with:

```json
{
  "dependencies": {
    "decimal.js": "^10.4.3"
  }
}
```

- [ ] **Step 4: Install dependency and verify lockfile updates**

Run: `npm.cmd install`
Expected: `package-lock.json` updates and install completes successfully.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add decimal-safe math dependency"
```

## Task 2: Define Polynomial Formula Domain Types

**Files:**
- Create: `types/polynomial-formula.ts`
- Create: `lib/polynomial-formula/types.ts`
- Modify: `types/budget-sections.ts`

- [ ] **Step 1: Write the failing test**

Extend `lib/calculations/polynomial-formula.test.ts` with:

```ts
import type { PolynomialMonomialInput } from "@/types/polynomial-formula";

const monomial: PolynomialMonomialInput = {
  id: "m1",
  code: "MO",
  name: "Mano de obra",
  costGroupKey: "LABOR",
  amount: "180000",
  coefficient: "0.180",
  baseIndexCode: "47",
  baseIndexName: "Mano de obra",
  baseIndexValue: "100",
  sortOrder: 0,
};

expect(monomial.costGroupKey).toBe("LABOR");
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm.cmd test -- lib/calculations/polynomial-formula.test.ts`
Expected: FAIL because the type file does not exist.

- [ ] **Step 3: Write minimal implementation**

Create `types/polynomial-formula.ts` with:

```ts
export type PolynomialCostGroupKey =
  | "LABOR"
  | "MATERIALS"
  | "EQUIPMENT"
  | "OTHERS"
  | "GENERAL_EXPENSES_PROFIT"
  | "STEEL"
  | "CEMENT"
  | "MASONRY"
  | "INSTALLATIONS";
```

Also define:
- `BudgetCostGroupRecord`
- `PolynomialFormulaRecord`
- `PolynomialMonomialRecord`
- `PolynomialMonomialInput`
- `UnifiedIndexRecord`
- `ValuationRecord`
- `AdjustmentCalculationRecord`
- `AdjustmentCalculationTermRecord`
- `PolynomialFormulaValidationResult`

Create `lib/polynomial-formula/types.ts` for calculation-layer payloads using string decimals.

Update `types/budget-sections.ts` to replace `PolynomialFormulaDraft` with a real page model:
- `PolynomialFormulaSectionData`
- `PolynomialFormulaSectionSummary`

- [ ] **Step 4: Run test to verify type imports compile**

Run: `npm.cmd run build`
Expected: TypeScript resolves the new type imports and fails only on still-missing implementation files.

- [ ] **Step 5: Commit**

```bash
git add types/polynomial-formula.ts lib/polynomial-formula/types.ts types/budget-sections.ts
git commit -m "feat: add polynomial formula domain types"
```

## Task 3: Add Prisma Models for Formulas, Indices, Valuations, and Adjustments

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_add_polynomial_formula_module/migration.sql`

- [ ] **Step 1: Write the failing test**

Use Prisma generation as the failing gate:

Run: `npm.cmd run prisma:generate`
Expected: PASS now, then FAIL later when new data layer code references missing Prisma models.

- [ ] **Step 2: Add schema models**

Update `prisma/schema.prisma` to add:

```prisma
enum PolynomialFormulaStatus {
  DRAFT
  VALID
  ARCHIVED
}

model PolynomialFormula {
  id              String   @id @default(cuid())
  budgetId        String
  name            String
  baseMonth       Int
  baseYear        Int
  totalBaseAmount Decimal  @default(0) @db.Decimal(18, 4)
  status          PolynomialFormulaStatus @default(DRAFT)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  budget          Budget   @relation(fields: [budgetId], references: [id], onDelete: Cascade)
  monomials       PolynomialMonomial[]
  adjustments     AdjustmentCalculation[]
}
```

and:
- `PolynomialMonomial`
- `PolynomialMonomialComponent`
- `UnifiedIndex`
- `Valuation`
- `AdjustmentCalculation`
- `AdjustmentCalculationTerm`

Add reverse relations on `Budget`.

- [ ] **Step 3: Create migration**

Run: `npm.cmd run prisma:migrate -- --name add_polynomial_formula_module`
Expected: a new migration directory and SQL file are generated.

- [ ] **Step 4: Regenerate Prisma client**

Run: `npm.cmd run prisma:generate`
Expected: PASS with the new Prisma client types.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat: add prisma schema for polynomial formulas"
```

## Task 4: Parse the 2026 INEI Workbook Into a Reusable Index Source

**Files:**
- Create: `lib/polynomial-formula/index-source.ts`
- Create: `lib/polynomial-formula/index-source.test.ts`

- [ ] **Step 1: Write the failing test**

Create `lib/polynomial-formula/index-source.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { loadUnifiedIndexWorkbook } from "@/lib/polynomial-formula/index-source";

describe("loadUnifiedIndexWorkbook", () => {
  it("loads January 2026 index data and code dictionary from the INEI workbook", async () => {
    const result = await loadUnifiedIndexWorkbook(
      "C:/MYC-Presupuestos/presupuesto-ejemplo/formula-polinomica/07_indices_unificados_de_precios_de_la_construccion_ene26.xlsx",
    );

    expect(result.monthSheets).toContain("Ene_2026");
    expect(result.baseSheets).toContain("IUPC Dic.25(Base Dic 2025=100)");
    expect(result.dictionaryEntries.length).toBeGreaterThan(100);
    expect(result.indexRows.length).toBeGreaterThan(50);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm.cmd test -- lib/polynomial-formula/index-source.test.ts`
Expected: FAIL because the parser does not exist.

- [ ] **Step 3: Write minimal implementation**

Create `lib/polynomial-formula/index-source.ts` using `exceljs` to:
- open the workbook,
- read sheet names,
- parse the `Relación índices Base dic 2025` sheet into `{ code, name }`,
- parse the `Diccionario Alfabetico` sheet into dictionary rows,
- parse the `Ene_2026` sheet into normalized index rows with:
  - `code`
  - `name`
  - `geographicArea`
  - `month`
  - `year`
  - `value`
  - `sourceSheet`

Do not assume a fixed row number for data start; scan for header labels such as `CÓDIGO`, `ELEMENTO`, and geographic area columns.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm.cmd test -- lib/polynomial-formula/index-source.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/polynomial-formula/index-source.ts lib/polynomial-formula/index-source.test.ts
git commit -m "feat: parse INEI unified index workbook"
```

## Task 5: Seed Unified Indices From the 2026 Workbook

**Files:**
- Modify: `prisma/seed.ts`

- [ ] **Step 1: Write the failing test**

Add a seed-focused assertion to `lib/polynomial-formula/index-source.test.ts` describing the target payload shape:

```ts
expect(result.indexRows[0]).toMatchObject({
  code: expect.any(String),
  month: 1,
  year: 2026,
  value: expect.any(String),
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm.cmd test -- lib/polynomial-formula/index-source.test.ts`
Expected: FAIL until the parser returns the normalized row shape.

- [ ] **Step 3: Write minimal implementation**

Update `prisma/seed.ts` to:
- call `loadUnifiedIndexWorkbook(...)`,
- upsert `UnifiedIndex` rows for January 2026,
- upsert the base month rows if present,
- set `source` to the workbook filename,
- avoid duplicate inserts on rerun.

Use the exact workbook path:

```ts
const workbookPath =
  "C:/MYC-Presupuestos/presupuesto-ejemplo/formula-polinomica/07_indices_unificados_de_precios_de_la_construccion_ene26.xlsx";
```

- [ ] **Step 4: Run seed and verify it completes**

Run: `npm.cmd run prisma:seed`
Expected: PASS with log output indicating indices were inserted or updated.

- [ ] **Step 5: Commit**

```bash
git add prisma/seed.ts
git commit -m "feat: seed unified indices from 2026 workbook"
```

## Task 6: Build Pure Polynomial Formula Calculation Engine

**Files:**
- Create: `lib/calculations/polynomial-formula.ts`
- Create: `lib/calculations/polynomial-formula.test.ts`

- [ ] **Step 1: Write the failing test**

Create `lib/calculations/polynomial-formula.test.ts` with:

```ts
import { describe, expect, it } from "vitest";
import {
  calculateAdjustmentAmounts,
  calculateBudgetCostGroups,
  calculateCoefficientK,
  calculateMonomialCoefficients,
  validatePolynomialFormula,
} from "@/lib/calculations/polynomial-formula";

describe("polynomial formula engine", () => {
  it("calculates base cost groups excluding IGV", () => {
    const result = calculateBudgetCostGroups({
      directCostBreakdown: {
        labor: "180000",
        materials: "520000",
        equipment: "70000",
        others: "30000",
      },
      generalExpenses: "120000",
      utility: "80000",
    });

    expect(result.totalBaseAmount).toBe("1000000.0000");
    expect(result.groups.find((group) => group.key === "GENERAL_EXPENSES_PROFIT")?.amount).toBe("200000.0000");
  });

  it("calculates monomial coefficients with thousandth rounding", () => {
    const result = calculateMonomialCoefficients([
      { key: "LABOR", amount: "180000.0000" },
      { key: "MATERIALS", amount: "520000.0000" },
      { key: "EQUIPMENT", amount: "70000.0000" },
      { key: "OTHERS", amount: "30000.0000" },
      { key: "GENERAL_EXPENSES_PROFIT", amount: "200000.0000" },
    ]);

    expect(result[0].coefficient).toBe("0.180");
    expect(result[1].coefficient).toBe("0.520");
    expect(result[4].coefficient).toBe("0.200");
  });

  it("validates sum, maximum terms, and minimum coefficient rules", () => {
    const result = validatePolynomialFormula([
      { coefficient: "0.180", baseIndexValue: "100" },
      { coefficient: "0.520", baseIndexValue: "100" },
      { coefficient: "0.070", baseIndexValue: "100" },
      { coefficient: "0.030", baseIndexValue: "100" },
      { coefficient: "0.200", baseIndexValue: "100" },
    ]);

    expect(result.isCoefficientSumValid).toBe(true);
    expect(result.minimumCoefficientWarnings).toHaveLength(1);
  });

  it("calculates coefficient K from base and adjustment indices", () => {
    const result = calculateCoefficientK([
      { coefficient: "0.180", baseIndexValue: "100", adjustmentIndexValue: "108", name: "MO" },
      { coefficient: "0.520", baseIndexValue: "100", adjustmentIndexValue: "115", name: "MAT" },
      { coefficient: "0.070", baseIndexValue: "100", adjustmentIndexValue: "105", name: "EQ" },
      { coefficient: "0.030", baseIndexValue: "100", adjustmentIndexValue: "102", name: "V" },
      { coefficient: "0.200", baseIndexValue: "100", adjustmentIndexValue: "110", name: "GU" },
    ]);

    expect(result.kRaw).toBe("1.1165");
    expect(result.kRounded).toBe("1.117");
  });

  it("calculates adjusted valuation amounts", () => {
    const result = calculateAdjustmentAmounts({
      originalAmount: "100000.00",
      kRounded: "1.117",
    });

    expect(result.adjustedAmount).toBe("111700.00");
    expect(result.adjustmentAmount).toBe("11700.00");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm.cmd test -- lib/calculations/polynomial-formula.test.ts`
Expected: FAIL because the engine does not exist.

- [ ] **Step 3: Write minimal implementation**

Create `lib/calculations/polynomial-formula.ts` with pure functions:
- `roundCoefficient`
- `roundKValue`
- `roundCurrency`
- `calculateBudgetCostGroups`
- `calculateMonomialCoefficients`
- `validatePolynomialFormula`
- `calculateCoefficientK`
- `calculateAdjustmentAmounts`

Rules to encode:
- use decimal-safe arithmetic,
- exclude IGV,
- merge `generalExpenses + utility` into one `GU` monomial by default,
- coefficient sum tolerance `0.001`,
- maximum `8` monomials,
- warning for coefficient `< 0.05`,
- base and adjustment indices must be `> 0`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm.cmd test -- lib/calculations/polynomial-formula.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/calculations/polynomial-formula.ts lib/calculations/polynomial-formula.test.ts
git commit -m "feat: add polynomial formula calculation engine"
```

## Task 7: Compose Budget and APU Data Into Formula Inputs

**Files:**
- Modify: `lib/data/budgets.ts`
- Create: `lib/data/polynomial-formulas.ts`
- Modify: `lib/db/serializers.ts`

- [ ] **Step 1: Write the failing test**

Add a test block to `lib/calculations/polynomial-formula.test.ts` describing the input shape expected from the data layer:

```ts
expect({
  labor: "2500.0000",
  materials: "28000.0000",
  equipment: "3500.0000",
  others: "0.0000",
}).toMatchObject({
  labor: expect.any(String),
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm.cmd run build`
Expected: FAIL once the page and routes start importing missing data-layer methods.

- [ ] **Step 3: Write minimal implementation**

Create `lib/data/polynomial-formulas.ts` with methods:
- `getBudgetPolynomialFormulaSectionData`
- `generatePolynomialFormulaFromBudget`
- `savePolynomialFormula`
- `calculatePolynomialFormulaAdjustment`
- `listPolynomialFormulaAdjustments`

Update `lib/data/budgets.ts` only where shared budget access helpers are needed.

Update `lib/db/serializers.ts` with serializer helpers for:
- `PolynomialFormula`
- `PolynomialMonomial`
- `UnifiedIndex`
- `Valuation`
- `AdjustmentCalculation`

The generation logic must:
- traverse budget items,
- read each `item.apu.resources`,
- derive `labor/materials/equipment/others` from resource category and `resourceType`,
- multiply unit component cost by item quantity through existing APU subtotals,
- add `budget.totalGeneralExpenses + budget.totalUtility`,
- produce default monomials.

- [ ] **Step 4: Run build to verify type and Prisma wiring**

Run: `npm.cmd run build`
Expected: TypeScript progresses past data layer imports and fails only on still-missing route/UI pieces.

- [ ] **Step 5: Commit**

```bash
git add lib/data/polynomial-formulas.ts lib/data/budgets.ts lib/db/serializers.ts
git commit -m "feat: compose budget data for polynomial formulas"
```

## Task 8: Add Input Validation Schemas for Formula Editing and K Calculation

**Files:**
- Create: `lib/validations/polynomial-formula.ts`

- [ ] **Step 1: Write the failing test**

Add an inline schema usage block in `lib/calculations/polynomial-formula.test.ts`:

```ts
import { polynomialFormulaSaveSchema } from "@/lib/validations/polynomial-formula";

expect(() =>
  polynomialFormulaSaveSchema.parse({
    name: "FP Vivienda",
    baseMonth: 1,
    baseYear: 2026,
    monomials: [],
  }),
).toThrow();
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm.cmd test -- lib/calculations/polynomial-formula.test.ts`
Expected: FAIL because the validation module does not exist.

- [ ] **Step 3: Write minimal implementation**

Create `lib/validations/polynomial-formula.ts` with:
- `polynomialMonomialInputSchema`
- `polynomialFormulaSaveSchema`
- `polynomialKCalculationSchema`
- `valuationInputSchema`
- `polynomialAdjustmentCreateSchema`

Include explicit constraints:
- `baseMonth` 1..12
- `baseYear` >= 1979
- `monomials.length` 1..8
- numeric strings must coerce to positive decimals where required

- [ ] **Step 4: Run test to verify it passes**

Run: `npm.cmd test -- lib/calculations/polynomial-formula.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/validations/polynomial-formula.ts
git commit -m "feat: add polynomial formula validation schemas"
```

## Task 9: Add REST Endpoints for Formula CRUD, K Calculation, Adjustments, and Index Lookup

**Files:**
- Create: `app/api/budgets/[id]/polynomial-formula/route.ts`
- Create: `app/api/polynomial-formulas/[id]/calculate/route.ts`
- Create: `app/api/polynomial-formulas/[id]/adjustments/route.ts`
- Create: `app/api/unified-indices/route.ts`

- [ ] **Step 1: Write the failing test**

Use build failure as the route gate:

Run: `npm.cmd run build`
Expected: FAIL because the route files do not exist yet while the page will import them next.

- [ ] **Step 2: Implement formula route**

Create `app/api/budgets/[id]/polynomial-formula/route.ts` with:
- `GET` to return generated or persisted formula section data,
- `POST` to generate and persist a new draft from the budget,
- `PATCH` to save edited monomials and metadata.

- [ ] **Step 3: Implement calculation and adjustment routes**

Create:
- `app/api/polynomial-formulas/[id]/calculate/route.ts` to compute `K` from month/year or submitted index values,
- `app/api/polynomial-formulas/[id]/adjustments/route.ts` to create a persisted adjustment record,
- `app/api/unified-indices/route.ts` to query by `month`, `year`, `code`, and optional `geographicArea`.

- [ ] **Step 4: Run build to verify route compilation**

Run: `npm.cmd run build`
Expected: PASS or remaining failures move to UI components only.

- [ ] **Step 5: Commit**

```bash
git add app/api/budgets/[id]/polynomial-formula/route.ts app/api/polynomial-formulas/[id]/calculate/route.ts app/api/polynomial-formulas/[id]/adjustments/route.ts app/api/unified-indices/route.ts
git commit -m "feat: add polynomial formula api routes"
```

## Task 10: Replace Placeholder Page With Real Section Loader

**Files:**
- Modify: `app/budgets/[id]/polynomial-formula/page.tsx`

- [ ] **Step 1: Write the failing test**

Use build failure as the gate:

Run: `npm.cmd run build`
Expected: FAIL once the placeholder draft type is removed from `types/budget-sections.ts`.

- [ ] **Step 2: Write minimal implementation**

Update `app/budgets/[id]/polynomial-formula/page.tsx` to:
- keep `getGeneralBudgetSectionContext(id)`,
- load section data via `getBudgetPolynomialFormulaSectionData`,
- render the real editor components instead of the placeholder section.

- [ ] **Step 3: Run build to verify page compiles**

Run: `npm.cmd run build`
Expected: PASS or remaining failures move to missing UI components.

- [ ] **Step 4: Verify section shell wiring**

Expected page metadata:
- title `Formula polinomica`
- description referencing monomios, índices INEI, coeficiente `K`, and valorizaciones reajustadas.

- [ ] **Step 5: Commit**

```bash
git add app/budgets/[id]/polynomial-formula/page.tsx
git commit -m "feat: wire polynomial formula page to real data"
```

## Task 11: Build Reusable UI Components for Editing, Validation, K Calculation, and History

**Files:**
- Create: `components/budget/polynomial-formula-editor.tsx`
- Create: `components/budget/polynomial-monomials-table.tsx`
- Create: `components/budget/polynomial-formula-math.tsx`
- Create: `components/budget/polynomial-k-calculator.tsx`
- Create: `components/budget/polynomial-adjustment-history.tsx`
- Create: `components/budget/polynomial-validation-summary.tsx`

- [ ] **Step 1: Write the failing test**

Use build failure and acceptance criteria as the initial gate:
- monomial table renders editable rows,
- validation summary renders coefficient sum and warnings,
- math expression renders `K = a(Jr/Jo) + b(Mr/Mo) + ...`,
- calculator table renders ratio and partial per monomial,
- history table renders prior monthly adjustments.

- [ ] **Step 2: Run build to verify missing components fail**

Run: `npm.cmd run build`
Expected: FAIL because the components do not exist.

- [ ] **Step 3: Write minimal implementation**

Create the components with these responsibilities:
- `polynomial-formula-editor.tsx`: orchestrates fetch/save/generate/calculate/apply flows.
- `polynomial-monomials-table.tsx`: editable rows with columns:
  - monomio,
  - grupo,
  - monto,
  - coeficiente,
  - índice base,
  - índice reajuste,
  - estado.
- `polynomial-formula-math.tsx`: mathematical display of the current formula.
- `polynomial-k-calculator.tsx`: rows with coefficient, base index, adjustment index, ratio, partial, `K raw`, `K rounded`.
- `polynomial-adjustment-history.tsx`: month/year, original amount, adjusted amount, adjustment amount, `K`.
- `polynomial-validation-summary.tsx`: sum, max terms, low-coefficient warnings, missing-index warnings.

UI rules:
- real-time recalculation when a monomial or index value changes,
- visual warning if coefficient `< 0.05`,
- visual error if sum differs from `1.000` beyond tolerance,
- disable “Aplicar reajuste” when required indices are missing.

- [ ] **Step 4: Run verification**

Run:

```bash
npm.cmd run lint
npm.cmd run build
```

Expected: both commands PASS

- [ ] **Step 5: Commit**

```bash
git add components/budget/polynomial-formula-editor.tsx components/budget/polynomial-monomials-table.tsx components/budget/polynomial-formula-math.tsx components/budget/polynomial-k-calculator.tsx components/budget/polynomial-adjustment-history.tsx components/budget/polynomial-validation-summary.tsx
git commit -m "feat: build polynomial formula editor ui"
```

## Task 12: Document the Module and Its Workbook Source

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Write the failing test**

Use docs completeness as the gate:
- README must mention the module,
- seed process must mention the 2026 INEI workbook,
- verification commands must be present.

- [ ] **Step 2: Update README**

Add a section covering:
- purpose of fórmula polinómica,
- normative source file path,
- workbook source path for indices,
- required seed command,
- API endpoints,
- test command,
- warning that IGV is excluded from coefficient base.

- [ ] **Step 3: Run markdown sanity check**

Run: `Get-Content -Raw README.md`
Expected: the new section renders as plain markdown without placeholders.

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: add polynomial formula module documentation"
```

- [ ] **Step 5: Manual docs verification**

Verify the README mentions both:
- `presupuesto-ejemplo/formula-polinomica-peru-webapp-spec.md`
- `presupuesto-ejemplo/formula-polinomica/07_indices_unificados_de_precios_de_la_construccion_ene26.xlsx`

## Task 13: Full Verification and Regression Pass

**Files:**
- Modify: none unless defects are found

- [ ] **Step 1: Run unit tests**

Run: `npm.cmd test`
Expected: PASS

- [ ] **Step 2: Run lint**

Run: `npm.cmd run lint`
Expected: PASS

- [ ] **Step 3: Run production build**

Run: `npm.cmd run build`
Expected: PASS

- [ ] **Step 4: Run seed verification**

Run: `npm.cmd run prisma:seed`
Expected: PASS with unified index records inserted or updated.

- [ ] **Step 5: Manual acceptance checklist**

Verify in the app:
- generating a formula from a real budget creates monomials from APU-backed cost groups,
- coefficient sum displays as `1.000` when valid,
- low coefficients show warnings,
- maximum 8 monomials is enforced,
- missing indices block `K` calculation,
- `K` shows both raw and rounded values,
- applying `K` to a valuation persists history,
- January 2026 INEI indices can be queried from seeded data.

## Spec Coverage Check

- RF-01 create formula from budget: covered by Tasks 7, 9, 10, 11.
- RF-02 edit monomials: covered by Tasks 8, 9, 11.
- RF-03 validate formula: covered by Tasks 6, 8, 11.
- RF-04 calculate `K`: covered by Tasks 6, 9, 11.
- RF-05 apply `K` to valuation: covered by Tasks 3, 6, 7, 9, 11.
- RF-06 generate report: not implemented in this first plan.

## Deliberate Gap

- Exportable report generation to PDF/Excel/Markdown is intentionally deferred. It should be handled in a follow-up plan after the calculation and persistence module is stable.
