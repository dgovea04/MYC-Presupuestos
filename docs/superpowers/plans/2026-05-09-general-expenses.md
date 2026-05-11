# General Expenses Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a hierarchical General Expenses module that initializes each General Budget from `presupuesto-ejemplo/Gastos_Generales.xlsx`, recalculates item partials using category rules and current direct cost, and replaces the current flat editor.

**Architecture:** Move from a flat `GeneralExpense` row model to a hierarchy of groups, titles, and items. Add a parser for the Excel template, a pure calculation layer for derived totals, budget-scoped initialization logic, new CRUD APIs, and a hierarchical React editor.

**Tech Stack:** Next.js App Router, React 19, Prisma, PostgreSQL, Vitest, ExcelJS, existing app UI components

---

## File Map

**Create**
- `lib/calculations/general-expense-structure.ts`
- `lib/calculations/general-expense-structure.test.ts`
- `lib/general-expenses/template-parser.ts`
- `lib/general-expenses/template-parser.test.ts`
- `lib/general-expenses/template-seed.ts`
- `lib/general-expenses/types.ts`
- `app/api/budgets/[id]/general-expenses/initialize/route.ts`
- `app/api/budgets/[id]/general-expenses/items/[itemId]/route.ts`
- `app/api/budgets/[id]/general-expenses/titles/[titleId]/items/route.ts`
- `app/api/budgets/[id]/general-expenses/groups/[groupId]/titles/route.ts`

**Modify**
- `prisma/schema.prisma`
- `lib/data/budgets.ts`
- `types/budget-sections.ts`
- `lib/validations/general-expense.ts`
- `app/api/budgets/[id]/general-expenses/route.ts`
- `app/api/budgets/[id]/general-expenses/[expenseId]/route.ts`
- `components/budget/general-expenses-manager.tsx`
- `app/budgets/[id]/general-expenses/page.tsx`

**Test**
- `lib/calculations/general-expense-structure.test.ts`
- `lib/general-expenses/template-parser.test.ts`

## Task 1: Define Domain Types

**Files:**
- Create: `lib/general-expenses/types.ts`
- Modify: `types/budget-sections.ts`

- [ ] **Step 1: Write the failing test**

Add a new assertion block to `lib/calculations/general-expense-structure.test.ts` after the file exists, covering the expected output shape:

```ts
expect(result.groups[0].titles[0].items[0]).toMatchObject({
  code: "1.1.1",
  category: "STANDARD",
  quantity: 1,
  participationPercentage: 0,
  unitPrice: 2000,
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm.cmd test -- lib/calculations/general-expense-structure.test.ts`
Expected: FAIL because the file and types do not exist yet.

- [ ] **Step 3: Write minimal implementation**

Create `lib/general-expenses/types.ts` with hierarchical runtime types:

```ts
export type GeneralExpenseItemCategory = "STANDARD" | "PERSONAL" | "TESTING" | "DIRECT_COST_BASED";
export type GeneralExpenseGroupKind = "FIXED" | "VARIABLE";
```

and define:

- `GeneralExpenseItemRecord`
- `GeneralExpenseTitleRecord`
- `GeneralExpenseGroupRecord`
- `GeneralExpenseStructureRecord`

Then update `types/budget-sections.ts` so the page and component layer consume the new structure rather than only the old flat record.

- [ ] **Step 4: Run test to verify type imports compile**

Run: `npm.cmd run build`
Expected: TypeScript fails later on unrelated missing implementation, but the new type files resolve.

- [ ] **Step 5: Commit**

```bash
git add lib/general-expenses/types.ts types/budget-sections.ts
git commit -m "feat: add general expenses hierarchy types"
```

## Task 2: Add Failing Tests for Formula Rules

**Files:**
- Create: `lib/calculations/general-expense-structure.test.ts`
- Create: `lib/calculations/general-expense-structure.ts`

- [ ] **Step 1: Write the failing test**

Create `lib/calculations/general-expense-structure.test.ts` with:

```ts
import { describe, expect, it } from "vitest";
import { calculateGeneralExpenseStructure } from "@/lib/calculations/general-expense-structure";

describe("calculateGeneralExpenseStructure", () => {
  it("calculates standard item partials using quantity times unit price", () => {
    const result = calculateGeneralExpenseStructure({
      totalDirectCost: 1000,
      groups: [{
        id: "g1",
        name: "Fijo",
        kind: "FIXED",
        sortOrder: 0,
        titles: [{
          id: "t1",
          code: "1.1",
          name: "Titulo",
          sortOrder: 0,
          items: [{
            id: "i1",
            code: "1.1.1",
            description: "Item",
            category: "STANDARD",
            unit: "UND",
            quantityDescription: "-",
            quantity: 2,
            participationPercentage: 0,
            unitPrice: 50,
            sortOrder: 0,
          }],
        }],
      }],
    });

    expect(result.groups[0].titles[0].items[0].partial).toBe(100);
    expect(result.groups[0].titles[0].subtotal).toBe(100);
    expect(result.groups[0].subtotal).toBe(100);
    expect(result.total).toBe(100);
  });

  it("calculates direct-cost-based item partials using quantity times percentage times direct cost", () => {
    const result = calculateGeneralExpenseStructure({
      totalDirectCost: 1000,
      groups: [{
        id: "g1",
        name: "Variable",
        kind: "VARIABLE",
        sortOrder: 0,
        titles: [{
          id: "t1",
          code: "2.1",
          name: "Titulo",
          sortOrder: 0,
          items: [{
            id: "i1",
            code: "2.1.1",
            description: "Tributos",
            category: "DIRECT_COST_BASED",
            unit: "%",
            quantityDescription: "-",
            quantity: 1,
            participationPercentage: 0.03,
            unitPrice: 0,
            sortOrder: 0,
          }],
        }],
      }],
    });

    expect(result.groups[0].titles[0].items[0].partial).toBe(30);
    expect(result.total).toBe(30);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm.cmd test -- lib/calculations/general-expense-structure.test.ts`
Expected: FAIL because `calculateGeneralExpenseStructure` does not exist.

- [ ] **Step 3: Write minimal implementation**

Create `lib/calculations/general-expense-structure.ts` with a pure function that:

- computes item partial by category
- computes title subtotal
- computes group subtotal
- computes grand total

Use rounding similar to existing budget calculations.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm.cmd test -- lib/calculations/general-expense-structure.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/calculations/general-expense-structure.ts lib/calculations/general-expense-structure.test.ts
git commit -m "feat: add general expenses calculation engine"
```

## Task 3: Add Failing Tests for Excel Template Parsing

**Files:**
- Create: `lib/general-expenses/template-parser.test.ts`
- Create: `lib/general-expenses/template-parser.ts`

- [ ] **Step 1: Write the failing test**

Create `lib/general-expenses/template-parser.test.ts` with assertions that the workbook parser:

- finds two top-level groups
- maps `GASTOS GENERALES FIJO`
- maps `GASTOS GENERALES VARIABLES`
- extracts title `1.1`
- extracts item `1.1.1`

Use the real workbook path:

```ts
const filePath = "C:/MYC-Presupuestos/presupuesto-ejemplo/Gastos_Generales.xlsx";
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm.cmd test -- lib/general-expenses/template-parser.test.ts`
Expected: FAIL because parser does not exist.

- [ ] **Step 3: Write minimal implementation**

Create `lib/general-expenses/template-parser.ts` using `exceljs` to:

- read the workbook
- parse worksheet `Gastos Generales`
- identify header row and data region
- convert rows into:
  - group rows like `1`
  - title rows like `1.1`
  - item rows like `1.1.1`

Implement explicit category mapping for:

- titles/items containing `PERSONAL` => `PERSONAL`
- titles/items containing `ENSAYO` => `TESTING`
- items containing `GASTOS FINANCIEROS`, `TRIBUTOS`, `SEGUROS` => `DIRECT_COST_BASED`
- otherwise => `STANDARD`

- [ ] **Step 4: Run test to verify it passes**

Run: `npm.cmd test -- lib/general-expenses/template-parser.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/general-expenses/template-parser.ts lib/general-expenses/template-parser.test.ts
git commit -m "feat: parse general expenses excel template"
```

## Task 4: Replace Prisma Model With Hierarchical Structure

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Write the failing test**

Use build failure as the gate for missing schema fields referenced by upcoming code:

Run: `npm.cmd run build`
Expected: FAIL once new data layer code references hierarchical models that do not exist yet.

- [ ] **Step 2: Add schema models**

Update `prisma/schema.prisma` to:

- remove or deprecate flat `GeneralExpense`
- add enum `GeneralExpenseGroupKind`
- add enum `GeneralExpenseItemCategory`
- add models:
  - `GeneralExpenseGroup`
  - `GeneralExpenseTitle`
  - `GeneralExpenseItem`

Connect them to `Budget`.

- [ ] **Step 3: Generate Prisma client**

Run: `npm.cmd run prisma:generate`
Expected: Prisma client regenerates successfully.

- [ ] **Step 4: Run build to verify schema references compile**

Run: `npm.cmd run build`
Expected: Any remaining failures should now be in data/API/UI code, not missing Prisma types.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat: add hierarchical general expenses prisma models"
```

## Task 5: Implement Budget-Scoped Template Initialization

**Files:**
- Create: `lib/general-expenses/template-seed.ts`
- Modify: `lib/data/budgets.ts`

- [ ] **Step 1: Write the failing test**

Add a parser-level or pure data transformation test asserting initialization returns groups/titles/items only once for a given payload.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm.cmd test -- lib/general-expenses/template-parser.test.ts lib/calculations/general-expense-structure.test.ts`
Expected: FAIL because initialization helper does not exist.

- [ ] **Step 3: Write minimal implementation**

Create `lib/general-expenses/template-seed.ts` with helpers to:

- load template rows from Excel
- transform them into create payloads
- upsert or initialize only if no existing groups exist for the budget

Update `lib/data/budgets.ts` to:

- expose `getBudgetGeneralExpensesStructure`
- ensure initialization on first access
- return calculated structure using current `budget.totalDirectCost`

- [ ] **Step 4: Run tests to verify logic passes**

Run: `npm.cmd test`
Expected: PASS for all current unit tests.

- [ ] **Step 5: Commit**

```bash
git add lib/general-expenses/template-seed.ts lib/data/budgets.ts
git commit -m "feat: initialize general expenses from workbook template"
```

## Task 6: Replace Validation and API Shape

**Files:**
- Modify: `lib/validations/general-expense.ts`
- Modify: `app/api/budgets/[id]/general-expenses/route.ts`
- Modify: `app/api/budgets/[id]/general-expenses/[expenseId]/route.ts`
- Create: `app/api/budgets/[id]/general-expenses/initialize/route.ts`
- Create: `app/api/budgets/[id]/general-expenses/items/[itemId]/route.ts`
- Create: `app/api/budgets/[id]/general-expenses/titles/[titleId]/items/route.ts`
- Create: `app/api/budgets/[id]/general-expenses/groups/[groupId]/titles/route.ts`

- [ ] **Step 1: Write the failing test**

Use one API-focused unit test or, if no route test harness exists, use `npm.cmd run build` as the failing gate once imports and route contracts are updated.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm.cmd run build`
Expected: FAIL before the new route handlers exist.

- [ ] **Step 3: Write minimal implementation**

Replace flat row validation with:

- title creation schema
- item update schema
- item creation schema

Update API handlers so:

- list route returns hierarchical data
- initialize route creates the structure if missing
- item route updates and deletes items
- title route creates titles or items as planned

- [ ] **Step 4: Run build to verify route compilation**

Run: `npm.cmd run build`
Expected: PASS or move remaining failures to UI.

- [ ] **Step 5: Commit**

```bash
git add lib/validations/general-expense.ts app/api/budgets
git commit -m "feat: add hierarchical general expenses api"
```

## Task 7: Rebuild the General Expenses UI

**Files:**
- Modify: `components/budget/general-expenses-manager.tsx`
- Modify: `app/budgets/[id]/general-expenses/page.tsx`

- [ ] **Step 1: Write the failing test**

If no component test harness exists, define the acceptance criteria inline and use build plus manual visual verification:

- groups render in order
- titles render under groups
- item rows show category-aware fields
- derived partials render

- [ ] **Step 2: Run build to verify current UI is insufficient**

Run: `npm.cmd run build`
Expected: Current component no longer matches new data types.

- [ ] **Step 3: Write minimal implementation**

Refactor `general-expenses-manager.tsx` to:

- accept hierarchical structure instead of flat rows
- render summary metrics
- render grouped sections for fixed and variable
- render titles with subtotals
- render editable item rows with fields:
  - description
  - category
  - unit
  - quantity description
  - quantity
  - `% Part`
  - `PU`
  - partial
- disable or visually downplay irrelevant inputs per category
- persist item edits via new API

Update the page loader to call the new structure loader.

- [ ] **Step 4: Run verification**

Run:

```bash
npm.cmd run lint
npm.cmd run build
```

Expected: both commands PASS

- [ ] **Step 5: Commit**

```bash
git add components/budget/general-expenses-manager.tsx app/budgets/[id]/general-expenses/page.tsx
git commit -m "feat: rebuild general expenses editor with hierarchy"
```

## Task 8: Full Regression Verification

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

- [ ] **Step 4: Manual spot-check checklist**

Verify in app:

- opening General Expenses initializes the template once
- fixed and variable groups appear
- editing a standard row recalculates `Parcial = Cantidad x PU`
- editing a direct-cost-based row recalculates `Parcial = Cantidad x % Part x Costo Directo`
- title and group subtotals update

- [ ] **Step 5: Commit final polish if needed**

```bash
git add .
git commit -m "test: verify hierarchical general expenses flow"
```
