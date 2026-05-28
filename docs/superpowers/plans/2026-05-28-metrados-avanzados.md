# Advanced Metrados Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a persistent Advanced Quantity Takeoff module at `/metrados-avanzados` with Prisma-backed sheets, Excel-style editing, formula calculations, validation, Excel export/import boundaries, and budget partida linking.

**Architecture:** Implement the module as a vertical slice: strict domain types, formula and validation services, Prisma data access, route handlers, then reusable UI components. Keep calculations isolated from UI and use `decimal.js` for all metrado math.

**Tech Stack:** Next.js App Router, TypeScript strict mode, Prisma, decimal.js, exceljs, React Client Components for the editor, existing UI primitives, lucide-react, Vitest.

---

## Reference Context

- Spec: `docs/superpowers/specs/2026-05-28-metrados-avanzados-design.md`
- Local Next docs checked:
  - `node_modules/next/dist/docs/01-app/01-getting-started/03-layouts-and-pages.md`
  - `node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md`
  - `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md`
- Important Next 16 conventions from docs:
  - `page.tsx` files define App Router pages.
  - Pages are Server Components by default; interactive editors need `"use client"` at the component boundary.
  - Dynamic route handler `params` are promises, e.g. `{ params }: { params: Promise<{ id: string }> }`.
  - Route handlers use Web `Request`/`Response` APIs and support exported HTTP methods.

## File Map

- Create `types/metrado.ts`: strict metrado domain records and unions.
- Create `lib/metrados/templates.ts`: static template definitions and formula metadata.
- Create `lib/metrados/templates.test.ts`: template coverage tests.
- Create `lib/metrados/formula-engine.ts`: formula-key dispatcher using `decimal.js`, no arbitrary code execution.
- Create `lib/calculations/metrados.ts`: row and sheet totals.
- Create `lib/calculations/metrados.test.ts`: formula and total tests.
- Create `lib/metrados/validation.ts`: row and sheet validation.
- Create `lib/metrados/validation.test.ts`: validation tests.
- Modify `prisma/schema.prisma`: metrado models and relations.
- Create `lib/data/metrados.ts`: Prisma reads, writes, ownership filters, send-to-partida service.
- Create `lib/data/metrados.test.ts`: pure helpers from the data layer and send payload preparation.
- Create `lib/metrados/excel-export.ts`: ExcelJS workbook export for a sheet.
- Create `lib/metrados/excel-export.test.ts`: workbook structure test.
- Create `lib/metrados/excel-import.ts`: typed workbook-row import boundary.
- Create `lib/metrados/excel-import.test.ts`: import normalization and issue tests.
- Create `app/api/metrados-avanzados/route.ts`: list/create route handlers.
- Create `app/api/metrados-avanzados/[id]/route.ts`: get/update/delete handlers.
- Create `app/api/metrados-avanzados/[id]/rows/route.ts`: upsert/delete rows.
- Create `app/api/metrados-avanzados/[id]/export/route.ts`: Excel download handler.
- Create `app/api/metrados-avanzados/[id]/import/route.ts`: import preview handler.
- Create `app/api/metrados-avanzados/[id]/send-to-partida/route.ts`: linked budget item quantity update handler.
- Create `app/metrados-avanzados/page.tsx`: authenticated Server Component entry.
- Create `components/metrados/MetradosDashboard.tsx`: module client shell.
- Create `components/metrados/MetradoTemplateSelector.tsx`: template picker.
- Create `components/metrados/MetradoSheetTable.tsx`: editable table.
- Create `components/metrados/MetradoFormulaBar.tsx`: active row formula bar.
- Create `components/metrados/MetradoSummaryPanel.tsx`: totals and link status.
- Create `components/metrados/MetradoValidationPanel.tsx`: validation list.
- Create `components/metrados/MetradoExportActions.tsx`: save/export/import/send actions.
- Create `components/metrados/metrado-view-model.ts`: client-only row helpers for add, duplicate, delete, and edits.
- Create `components/metrados/metrado-view-model.test.ts`: editor helper tests.
- Modify `components/layout/app-sidebar-client.tsx`: add `/metrados-avanzados` nav item.
- Modify `components/layout/app-sidebar-client.test.tsx`: expected nav list update.

---

### Task 1: Domain Types And Templates

**Files:**
- Create: `types/metrado.ts`
- Create: `lib/metrados/templates.ts`
- Test: `lib/metrados/templates.test.ts`

- [ ] **Step 1: Write the failing template tests**

Create `lib/metrados/templates.test.ts`:

```ts
import { describe, expect, test } from "vitest";

import { getMetradoTemplateByType, metradoTemplates } from "@/lib/metrados/templates";

describe("metradoTemplates", () => {
  test("defines the required construction template types", () => {
    expect(metradoTemplates.map((template) => template.type)).toEqual([
      "CONCRETE",
      "REBAR",
      "FORMWORK",
      "MASONRY",
      "PLASTER",
      "PAINT",
      "EXCAVATION",
      "FLOORING",
      "ROOFING",
      "CUSTOM",
    ]);
  });

  test("exposes formulas and default units for concrete and rebar", () => {
    expect(getMetradoTemplateByType("CONCRETE")).toMatchObject({
      type: "CONCRETE",
      defaultUnit: "m3",
      formulaKeys: ["volume"],
    });
    expect(getMetradoTemplateByType("REBAR")).toMatchObject({
      type: "REBAR",
      defaultUnit: "kg",
      formulaKeys: ["rebarWeight"],
    });
  });

  test("returns null for an unknown template type", () => {
    expect(getMetradoTemplateByType("UNKNOWN")).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- lib/metrados/templates.test.ts`

Expected: FAIL because `@/lib/metrados/templates` does not exist.

- [ ] **Step 3: Add strict domain types**

Create `types/metrado.ts`:

```ts
export type MetradoTemplateType =
  | "CONCRETE"
  | "REBAR"
  | "FORMWORK"
  | "MASONRY"
  | "PLASTER"
  | "PAINT"
  | "EXCAVATION"
  | "FLOORING"
  | "ROOFING"
  | "CUSTOM";

export type MetradoUnit = "m" | "m2" | "m3" | "kg" | "und" | "glb";

export type MetradoSheetStatus = "DRAFT" | "VALIDATED" | "SENT_TO_BUDGET";

export type MetradoFormulaKey =
  | "volume"
  | "area"
  | "linear"
  | "rebarWeight"
  | "formworkArea"
  | "factorArea"
  | "manual";

export type MetradoFormulaInputKey =
  | "largo"
  | "ancho"
  | "alto"
  | "cantidad"
  | "longitud"
  | "pesoUnitario"
  | "perimetro"
  | "altura"
  | "area"
  | "factor"
  | "manual";

export type MetradoFormulaInputs = Partial<Record<MetradoFormulaInputKey, number>>;

export type MetradoFormulaRecord = {
  id: string;
  templateId: string;
  key: MetradoFormulaKey;
  label: string;
  expression: string;
  requiredInputs: MetradoFormulaInputKey[];
  resultUnit: MetradoUnit;
};

export type MetradoTemplateRecord = {
  id: string;
  type: MetradoTemplateType;
  name: string;
  description: string;
  defaultUnit: MetradoUnit;
  formulaKeys: MetradoFormulaKey[];
  formulas: MetradoFormulaRecord[];
};

export type MetradoRowRecord = {
  id: string;
  sheetId: string;
  sector: string;
  eje: string;
  nivel: string;
  description: string;
  unit: MetradoUnit;
  formulaKey: MetradoFormulaKey;
  inputs: MetradoFormulaInputs;
  partial: number;
  sortOrder: number;
};

export type MetradoPartidaLinkRecord = {
  id: string;
  sheetId: string;
  budgetItemId: string;
  budgetItemCode: string;
  budgetItemDescription: string;
  budgetItemUnit: string;
  lastSentQuantity: number | null;
};

export type MetradoSheetRecord = {
  id: string;
  userId: string;
  projectId: string;
  projectName: string;
  budgetId: string;
  budgetName: string;
  templateId: string;
  templateType: MetradoTemplateType;
  name: string;
  status: MetradoSheetStatus;
  unit: MetradoUnit;
  totalQuantity: number;
  rows: MetradoRowRecord[];
  partidaLink: MetradoPartidaLinkRecord | null;
  createdAt?: string | Date;
  updatedAt?: string | Date;
};

export type MetradoValidationSeverity = "error" | "warning";

export type MetradoValidationIssue = {
  id: string;
  severity: MetradoValidationSeverity;
  rowId?: string;
  field?: string;
  message: string;
};

export type MetradoCalculationResult = {
  rows: MetradoRowRecord[];
  totalsByUnit: Record<MetradoUnit, number>;
  primaryTotal: number;
  issues: MetradoValidationIssue[];
};
```

- [ ] **Step 4: Add template definitions**

Create `lib/metrados/templates.ts`:

```ts
import type {
  MetradoFormulaInputKey,
  MetradoFormulaKey,
  MetradoFormulaRecord,
  MetradoTemplateRecord,
  MetradoTemplateType,
  MetradoUnit,
} from "@/types/metrado";

type TemplateSeed = {
  type: MetradoTemplateType;
  name: string;
  description: string;
  defaultUnit: MetradoUnit;
  formulas: Array<{
    key: MetradoFormulaKey;
    label: string;
    expression: string;
    requiredInputs: MetradoFormulaInputKey[];
    resultUnit: MetradoUnit;
  }>;
};

const templateSeeds: TemplateSeed[] = [
  {
    type: "CONCRETE",
    name: "Concreto",
    description: "Volumenes de concreto por sector, eje y nivel.",
    defaultUnit: "m3",
    formulas: [{ key: "volume", label: "Largo x ancho x alto", expression: "largo * ancho * alto", requiredInputs: ["largo", "ancho", "alto"], resultUnit: "m3" }],
  },
  {
    type: "REBAR",
    name: "Acero de refuerzo",
    description: "Peso de acero por cantidad, longitud y peso unitario.",
    defaultUnit: "kg",
    formulas: [{ key: "rebarWeight", label: "Cantidad x longitud x peso unitario", expression: "cantidad * longitud * pesoUnitario", requiredInputs: ["cantidad", "longitud", "pesoUnitario"], resultUnit: "kg" }],
  },
  {
    type: "FORMWORK",
    name: "Encofrado",
    description: "Area de encofrado por perimetro y altura.",
    defaultUnit: "m2",
    formulas: [{ key: "formworkArea", label: "Perimetro x altura", expression: "perimetro * altura", requiredInputs: ["perimetro", "altura"], resultUnit: "m2" }],
  },
  {
    type: "MASONRY",
    name: "Albanileria",
    description: "Metrados de muros por area o longitud.",
    defaultUnit: "m2",
    formulas: [{ key: "area", label: "Largo x ancho", expression: "largo * ancho", requiredInputs: ["largo", "ancho"], resultUnit: "m2" }],
  },
  {
    type: "PLASTER",
    name: "Tarrajeo",
    description: "Areas de tarrajeo por pano y factor.",
    defaultUnit: "m2",
    formulas: [{ key: "factorArea", label: "Area x factor", expression: "area * factor", requiredInputs: ["area", "factor"], resultUnit: "m2" }],
  },
  {
    type: "PAINT",
    name: "Pintura",
    description: "Areas de pintura con factores de repeticion.",
    defaultUnit: "m2",
    formulas: [{ key: "factorArea", label: "Area x factor", expression: "area * factor", requiredInputs: ["area", "factor"], resultUnit: "m2" }],
  },
  {
    type: "EXCAVATION",
    name: "Excavacion",
    description: "Volumenes de excavacion.",
    defaultUnit: "m3",
    formulas: [{ key: "volume", label: "Largo x ancho x alto", expression: "largo * ancho * alto", requiredInputs: ["largo", "ancho", "alto"], resultUnit: "m3" }],
  },
  {
    type: "FLOORING",
    name: "Pisos",
    description: "Areas de piso por ambiente.",
    defaultUnit: "m2",
    formulas: [{ key: "area", label: "Largo x ancho", expression: "largo * ancho", requiredInputs: ["largo", "ancho"], resultUnit: "m2" }],
  },
  {
    type: "ROOFING",
    name: "Coberturas",
    description: "Areas y longitudes para techos y coberturas.",
    defaultUnit: "m2",
    formulas: [{ key: "factorArea", label: "Area x factor", expression: "area * factor", requiredInputs: ["area", "factor"], resultUnit: "m2" }],
  },
  {
    type: "CUSTOM",
    name: "Personalizado",
    description: "Metrado manual o formula controlada.",
    defaultUnit: "und",
    formulas: [{ key: "manual", label: "Manual", expression: "manual", requiredInputs: ["manual"], resultUnit: "und" }],
  },
];

export const metradoTemplates: MetradoTemplateRecord[] = templateSeeds.map((template, templateIndex) => {
  const templateId = `template-${template.type.toLowerCase()}`;
  const formulas: MetradoFormulaRecord[] = template.formulas.map((formula, formulaIndex) => ({
    ...formula,
    id: `${templateId}-formula-${formulaIndex + 1}`,
    templateId,
  }));

  return {
    ...template,
    id: templateId,
    formulaKeys: formulas.map((formula) => formula.key),
    formulas,
  };
});

export function getMetradoTemplateByType(value: string): MetradoTemplateRecord | null {
  return metradoTemplates.find((template) => template.type === value) ?? null;
}
```

- [ ] **Step 5: Run the template test to verify it passes**

Run: `npm run test -- lib/metrados/templates.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

Run:

```bash
git add types/metrado.ts lib/metrados/templates.ts lib/metrados/templates.test.ts
git commit -m "feat: add metrado template domain"
```

---

### Task 2: Formula Engine And Sheet Calculations

**Files:**
- Create: `lib/metrados/formula-engine.ts`
- Create: `lib/calculations/metrados.ts`
- Test: `lib/calculations/metrados.test.ts`

- [ ] **Step 1: Write failing calculation tests**

Create `lib/calculations/metrados.test.ts`:

```ts
import { describe, expect, test } from "vitest";

import { calculateMetradoRow, calculateMetradoSheet } from "@/lib/calculations/metrados";
import type { MetradoRowRecord } from "@/types/metrado";

function row(overrides: Partial<MetradoRowRecord>): MetradoRowRecord {
  return {
    id: "row-1",
    sheetId: "sheet-1",
    sector: "Sector A",
    eje: "Eje 1",
    nivel: "Nivel 1",
    description: "Elemento",
    unit: "m3",
    formulaKey: "volume",
    inputs: {},
    partial: 0,
    sortOrder: 1,
    ...overrides,
  };
}

describe("metrado calculations", () => {
  test("calculates concrete volume with decimal-safe math", () => {
    const result = calculateMetradoRow(row({ inputs: { largo: 1.1, ancho: 2.2, alto: 3.3 } }));

    expect(result.partial).toBe(7.986);
  });

  test("calculates rebar weight", () => {
    const result = calculateMetradoRow(
      row({
        unit: "kg",
        formulaKey: "rebarWeight",
        inputs: { cantidad: 12, longitud: 3.5, pesoUnitario: 0.617 },
      }),
    );

    expect(result.partial).toBe(25.914);
  });

  test("groups totals by unit and primary unit", () => {
    const result = calculateMetradoSheet({
      unit: "m2",
      rows: [
        row({ id: "row-1", unit: "m2", formulaKey: "area", inputs: { largo: 2, ancho: 3 } }),
        row({ id: "row-2", unit: "m2", formulaKey: "area", inputs: { largo: 4, ancho: 5 } }),
        row({ id: "row-3", unit: "kg", formulaKey: "manual", inputs: { manual: 9 } }),
      ],
    });

    expect(result.primaryTotal).toBe(26);
    expect(result.totalsByUnit.m2).toBe(26);
    expect(result.totalsByUnit.kg).toBe(9);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- lib/calculations/metrados.test.ts`

Expected: FAIL because calculation modules do not exist.

- [ ] **Step 3: Add the formula engine**

Create `lib/metrados/formula-engine.ts`:

```ts
import Decimal from "decimal.js";

import type { MetradoFormulaInputs, MetradoFormulaKey, MetradoValidationIssue } from "@/types/metrado";

type FormulaEvaluation = {
  value: number;
  issues: MetradoValidationIssue[];
};

function readInput(inputs: MetradoFormulaInputs, key: keyof MetradoFormulaInputs, rowId?: string) {
  const value = inputs[key];

  if (typeof value !== "number" || !Number.isFinite(value)) {
    return {
      decimal: new Decimal(0),
      issue: {
        id: `${rowId ?? "row"}-${String(key)}-missing`,
        severity: "error" as const,
        rowId,
        field: String(key),
        message: `Falta el valor ${String(key)}.`,
      },
    };
  }

  if (value < 0) {
    return {
      decimal: new Decimal(0),
      issue: {
        id: `${rowId ?? "row"}-${String(key)}-negative`,
        severity: "error" as const,
        rowId,
        field: String(key),
        message: `El valor ${String(key)} no puede ser negativo.`,
      },
    };
  }

  return { decimal: new Decimal(value), issue: null };
}

function multiply(inputs: MetradoFormulaInputs, keys: Array<keyof MetradoFormulaInputs>, rowId?: string): FormulaEvaluation {
  const issues: MetradoValidationIssue[] = [];
  let value = new Decimal(1);

  for (const key of keys) {
    const input = readInput(inputs, key, rowId);
    if (input.issue) issues.push(input.issue);
    value = value.mul(input.decimal);
  }

  if (issues.length > 0) {
    return { value: 0, issues };
  }

  return { value: roundMetradoNumber(value), issues };
}

export function evaluateMetradoFormula(formulaKey: MetradoFormulaKey, inputs: MetradoFormulaInputs, rowId?: string): FormulaEvaluation {
  if (formulaKey === "volume") return multiply(inputs, ["largo", "ancho", "alto"], rowId);
  if (formulaKey === "area") return multiply(inputs, ["largo", "ancho"], rowId);
  if (formulaKey === "linear") return multiply(inputs, ["longitud", "cantidad"], rowId);
  if (formulaKey === "rebarWeight") return multiply(inputs, ["cantidad", "longitud", "pesoUnitario"], rowId);
  if (formulaKey === "formworkArea") return multiply(inputs, ["perimetro", "altura"], rowId);
  if (formulaKey === "factorArea") return multiply(inputs, ["area", "factor"], rowId);
  return multiply(inputs, ["manual"], rowId);
}

export function roundMetradoNumber(value: Decimal) {
  return value.toDecimalPlaces(3, Decimal.ROUND_HALF_UP).toNumber();
}
```

- [ ] **Step 4: Add sheet calculation functions**

Create `lib/calculations/metrados.ts`:

```ts
import Decimal from "decimal.js";

import { evaluateMetradoFormula, roundMetradoNumber } from "@/lib/metrados/formula-engine";
import type { MetradoCalculationResult, MetradoRowRecord, MetradoUnit, MetradoValidationIssue } from "@/types/metrado";

const metradoUnits: MetradoUnit[] = ["m", "m2", "m3", "kg", "und", "glb"];

export function calculateMetradoRow(row: MetradoRowRecord): MetradoRowRecord {
  const result = evaluateMetradoFormula(row.formulaKey, row.inputs, row.id);

  return {
    ...row,
    partial: result.value,
  };
}

export function calculateMetradoSheet(input: { unit: MetradoUnit; rows: MetradoRowRecord[] }): MetradoCalculationResult {
  const rows = input.rows.map(calculateMetradoRow);
  const totalsByUnit = metradoUnits.reduce<Record<MetradoUnit, number>>((totals, unit) => {
    const total = rows
      .filter((row) => row.unit === unit)
      .reduce((sum, row) => sum.add(row.partial), new Decimal(0));

    totals[unit] = roundMetradoNumber(total);
    return totals;
  }, { m: 0, m2: 0, m3: 0, kg: 0, und: 0, glb: 0 });
  const issues: MetradoValidationIssue[] = rows.flatMap((row) => evaluateMetradoFormula(row.formulaKey, row.inputs, row.id).issues);

  return {
    rows,
    totalsByUnit,
    primaryTotal: totalsByUnit[input.unit],
    issues,
  };
}
```

- [ ] **Step 5: Run calculation tests to verify they pass**

Run: `npm run test -- lib/calculations/metrados.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

Run:

```bash
git add lib/metrados/formula-engine.ts lib/calculations/metrados.ts lib/calculations/metrados.test.ts
git commit -m "feat: add metrado calculations"
```

---

### Task 3: Validation Rules

**Files:**
- Create: `lib/metrados/validation.ts`
- Test: `lib/metrados/validation.test.ts`

- [ ] **Step 1: Write failing validation tests**

Create `lib/metrados/validation.test.ts`:

```ts
import { describe, expect, test } from "vitest";

import { validateMetradoSheet } from "@/lib/metrados/validation";
import type { MetradoRowRecord } from "@/types/metrado";

const validRow: MetradoRowRecord = {
  id: "row-1",
  sheetId: "sheet-1",
  sector: "Sector A",
  eje: "Eje 1",
  nivel: "Nivel 1",
  description: "Zapata",
  unit: "m3",
  formulaKey: "volume",
  inputs: { largo: 2, ancho: 3, alto: 0.5 },
  partial: 3,
  sortOrder: 1,
};

describe("validateMetradoSheet", () => {
  test("blocks an empty sheet from sending totals", () => {
    const issues = validateMetradoSheet({
      sheetUnit: "m3",
      templateFormulaKeys: ["volume"],
      linkedPartidaUnit: "m3",
      rows: [],
    });

    expect(issues).toEqual([
      {
        id: "sheet-empty",
        severity: "error",
        message: "La hoja debe tener al menos una fila de metrado.",
      },
    ]);
  });

  test("flags unsupported formula keys for the selected template", () => {
    const issues = validateMetradoSheet({
      sheetUnit: "m3",
      templateFormulaKeys: ["volume"],
      linkedPartidaUnit: "m3",
      rows: [{ ...validRow, formulaKey: "area" }],
    });

    expect(issues.some((issue) => issue.id === "row-1-formula-unsupported")).toBe(true);
  });

  test("flags mixed units when linked partida unit differs", () => {
    const issues = validateMetradoSheet({
      sheetUnit: "m3",
      templateFormulaKeys: ["volume"],
      linkedPartidaUnit: "m2",
      rows: [validRow],
    });

    expect(issues.some((issue) => issue.id === "sheet-linked-unit-mismatch")).toBe(true);
  });
});
```

- [ ] **Step 2: Run validation test to verify it fails**

Run: `npm run test -- lib/metrados/validation.test.ts`

Expected: FAIL because `validation.ts` does not exist.

- [ ] **Step 3: Add validation service**

Create `lib/metrados/validation.ts`:

```ts
import { evaluateMetradoFormula } from "@/lib/metrados/formula-engine";
import type { MetradoFormulaKey, MetradoRowRecord, MetradoUnit, MetradoValidationIssue } from "@/types/metrado";

const validUnits = new Set<MetradoUnit>(["m", "m2", "m3", "kg", "und", "glb"]);

export function validateMetradoSheet({
  sheetUnit,
  templateFormulaKeys,
  linkedPartidaUnit,
  rows,
}: {
  sheetUnit: MetradoUnit;
  templateFormulaKeys: MetradoFormulaKey[];
  linkedPartidaUnit?: string | null;
  rows: MetradoRowRecord[];
}): MetradoValidationIssue[] {
  const issues: MetradoValidationIssue[] = [];

  if (rows.length === 0) {
    issues.push({
      id: "sheet-empty",
      severity: "error",
      message: "La hoja debe tener al menos una fila de metrado.",
    });
  }

  if (!validUnits.has(sheetUnit)) {
    issues.push({
      id: "sheet-unit-unsupported",
      severity: "error",
      field: "unit",
      message: "La unidad principal de la hoja no esta soportada.",
    });
  }

  if (linkedPartidaUnit && linkedPartidaUnit !== sheetUnit) {
    issues.push({
      id: "sheet-linked-unit-mismatch",
      severity: "error",
      field: "unit",
      message: "La unidad de la hoja no coincide con la unidad de la partida vinculada.",
    });
  }

  for (const row of rows) {
    if (!validUnits.has(row.unit)) {
      issues.push({
        id: `${row.id}-unit-unsupported`,
        severity: "error",
        rowId: row.id,
        field: "unit",
        message: "La unidad de la fila no esta soportada.",
      });
    }

    if (!templateFormulaKeys.includes(row.formulaKey)) {
      issues.push({
        id: `${row.id}-formula-unsupported`,
        severity: "error",
        rowId: row.id,
        field: "formulaKey",
        message: "La formula no pertenece a la plantilla seleccionada.",
      });
    }

    issues.push(...evaluateMetradoFormula(row.formulaKey, row.inputs, row.id).issues);
  }

  return issues;
}

export function hasBlockingMetradoIssues(issues: MetradoValidationIssue[]) {
  return issues.some((issue) => issue.severity === "error");
}
```

- [ ] **Step 4: Run validation test to verify it passes**

Run: `npm run test -- lib/metrados/validation.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add lib/metrados/validation.ts lib/metrados/validation.test.ts
git commit -m "feat: add metrado validation"
```

---

### Task 4: Prisma Schema And Client Generation

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Modify Prisma schema**

Add enum values near existing enums:

```prisma
enum MetradoTemplateType {
  CONCRETE
  REBAR
  FORMWORK
  MASONRY
  PLASTER
  PAINT
  EXCAVATION
  FLOORING
  ROOFING
  CUSTOM
}

enum MetradoSheetStatus {
  DRAFT
  VALIDATED
  SENT_TO_BUDGET
}
```

Add relations:

```prisma
model User {
  // keep existing fields
  metradoSheets MetradoSheet[]
}

model Project {
  // keep existing fields
  metradoSheets MetradoSheet[]
}

model Budget {
  // keep existing fields
  metradoSheets MetradoSheet[]
}

model BudgetItem {
  // keep existing fields
  metradoLinks MetradoPartidaLink[]
}
```

Add models near budget-related models:

```prisma
model MetradoTemplate {
  id          String              @id @default(cuid())
  type        MetradoTemplateType @unique
  name        String
  description String
  defaultUnit String
  createdAt   DateTime           @default(now())
  updatedAt   DateTime           @updatedAt
  sheets      MetradoSheet[]
  formulas    MetradoFormula[]

  @@map("metrado_templates")
}

model MetradoFormula {
  id             String          @id @default(cuid())
  templateId     String
  key            String
  label          String
  expression     String
  requiredInputs String[]        @default([])
  resultUnit     String
  sortOrder      Int             @default(0)
  createdAt      DateTime        @default(now())
  updatedAt      DateTime        @updatedAt
  template       MetradoTemplate @relation(fields: [templateId], references: [id], onDelete: Cascade)

  @@unique([templateId, key])
  @@index([templateId])
  @@map("metrado_formulas")
}

model MetradoSheet {
  id            String              @id @default(cuid())
  userId        String
  projectId     String
  budgetId      String
  templateId    String
  name          String
  status        MetradoSheetStatus  @default(DRAFT)
  unit          String
  totalQuantity Decimal             @default(0) @db.Decimal(18, 4)
  createdAt     DateTime            @default(now())
  updatedAt     DateTime            @updatedAt
  user          User                @relation(fields: [userId], references: [id], onDelete: Cascade)
  project       Project             @relation(fields: [projectId], references: [id], onDelete: Cascade)
  budget        Budget              @relation(fields: [budgetId], references: [id], onDelete: Cascade)
  template      MetradoTemplate     @relation(fields: [templateId], references: [id], onDelete: Restrict)
  rows          MetradoRow[]
  partidaLinks  MetradoPartidaLink[]

  @@index([userId, updatedAt(sort: Desc)])
  @@index([projectId])
  @@index([budgetId])
  @@index([templateId])
  @@map("metrado_sheets")
}

model MetradoRow {
  id          String       @id @default(cuid())
  sheetId     String
  sector      String       @default("")
  eje         String       @default("")
  nivel       String       @default("")
  description String
  unit        String
  formulaKey  String
  inputs      Json         @default("{}")
  partial     Decimal      @default(0) @db.Decimal(18, 4)
  sortOrder   Int          @default(0)
  createdAt   DateTime     @default(now())
  updatedAt   DateTime     @updatedAt
  sheet       MetradoSheet @relation(fields: [sheetId], references: [id], onDelete: Cascade)

  @@index([sheetId, sortOrder])
  @@map("metrado_rows")
}

model MetradoPartidaLink {
  id               String     @id @default(cuid())
  sheetId          String
  budgetItemId     String
  lastSentQuantity Decimal?   @db.Decimal(18, 4)
  sentAt           DateTime?
  createdAt        DateTime   @default(now())
  updatedAt        DateTime   @updatedAt
  sheet            MetradoSheet @relation(fields: [sheetId], references: [id], onDelete: Cascade)
  budgetItem       BudgetItem @relation(fields: [budgetItemId], references: [id], onDelete: Cascade)

  @@unique([sheetId, budgetItemId])
  @@index([budgetItemId])
  @@map("metrado_partida_links")
}
```

- [ ] **Step 2: Generate Prisma client**

Run: `npm run prisma:generate`

Expected: command completes and Prisma client includes metrado models.

- [ ] **Step 3: Run TypeScript-facing tests so schema changes do not break existing code**

Run: `npm run test -- lib/db/serializers.test.ts lib/calculations/metrados.test.ts lib/metrados/validation.test.ts`

Expected: PASS.

- [ ] **Step 4: Commit**

Run:

```bash
git add prisma/schema.prisma
git commit -m "feat: add metrado prisma models"
```

---

### Task 5: Data Mapping And Prisma Services

**Files:**
- Create: `lib/data/metrados.ts`
- Test: `lib/data/metrados.test.ts`

- [ ] **Step 1: Write failing tests for pure service helpers**

Create `lib/data/metrados.test.ts`:

```ts
import { describe, expect, test } from "vitest";

import { buildBudgetItemQuantityPatch, parseMetradoInputs } from "@/lib/data/metrados";

describe("metrado data helpers", () => {
  test("parses JSON formula inputs into numeric input records", () => {
    expect(parseMetradoInputs({ largo: 2, ancho: "3", ignored: true })).toEqual({
      largo: 2,
      ancho: 3,
    });
  });

  test("builds the budget item quantity patch from the primary total", () => {
    expect(buildBudgetItemQuantityPatch(12.3456)).toEqual({
      quantity: 12.346,
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- lib/data/metrados.test.ts`

Expected: FAIL because `lib/data/metrados.ts` does not exist.

- [ ] **Step 3: Add the data service**

Create `lib/data/metrados.ts` with this structure:

```ts
import Decimal from "decimal.js";
import { Prisma } from "@prisma/client";

import { calculateMetradoSheet } from "@/lib/calculations/metrados";
import { prisma } from "@/lib/db/prisma";
import { metradoTemplates } from "@/lib/metrados/templates";
import type {
  MetradoFormulaInputKey,
  MetradoFormulaInputs,
  MetradoRowRecord,
  MetradoSheetRecord,
  MetradoTemplateType,
  MetradoUnit,
} from "@/types/metrado";

const formulaInputKeys = new Set<MetradoFormulaInputKey>([
  "largo",
  "ancho",
  "alto",
  "cantidad",
  "longitud",
  "pesoUnitario",
  "perimetro",
  "altura",
  "area",
  "factor",
  "manual",
]);

export function parseMetradoInputs(value: Prisma.JsonValue): MetradoFormulaInputs {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};

  return Object.entries(value).reduce<MetradoFormulaInputs>((inputs, [key, rawValue]) => {
    if (!formulaInputKeys.has(key as MetradoFormulaInputKey)) return inputs;

    const parsed = Number(rawValue);
    if (Number.isFinite(parsed)) {
      inputs[key as MetradoFormulaInputKey] = parsed;
    }

    return inputs;
  }, {});
}

export function buildBudgetItemQuantityPatch(primaryTotal: number) {
  return {
    quantity: new Decimal(primaryTotal).toDecimalPlaces(3, Decimal.ROUND_HALF_UP).toNumber(),
  };
}

export async function ensureMetradoTemplates() {
  for (const template of metradoTemplates) {
    const savedTemplate = await prisma.metradoTemplate.upsert({
      where: { type: template.type },
      create: {
        type: template.type,
        name: template.name,
        description: template.description,
        defaultUnit: template.defaultUnit,
      },
      update: {
        name: template.name,
        description: template.description,
        defaultUnit: template.defaultUnit,
      },
    });

    for (const [index, formula] of template.formulas.entries()) {
      await prisma.metradoFormula.upsert({
        where: { templateId_key: { templateId: savedTemplate.id, key: formula.key } },
        create: {
          templateId: savedTemplate.id,
          key: formula.key,
          label: formula.label,
          expression: formula.expression,
          requiredInputs: formula.requiredInputs,
          resultUnit: formula.resultUnit,
          sortOrder: index + 1,
        },
        update: {
          label: formula.label,
          expression: formula.expression,
          requiredInputs: formula.requiredInputs,
          resultUnit: formula.resultUnit,
          sortOrder: index + 1,
        },
      });
    }
  }
}

export async function listMetradoSheetsByUser(userId: string): Promise<MetradoSheetRecord[]> {
  await ensureMetradoTemplates();
  const sheets = await prisma.metradoSheet.findMany({
    where: { userId },
    include: {
      project: true,
      budget: true,
      template: true,
      rows: { orderBy: { sortOrder: "asc" } },
      partidaLinks: { include: { budgetItem: true }, take: 1 },
    },
    orderBy: { updatedAt: "desc" },
  });

  return sheets.map(mapMetradoSheetRecord);
}

export async function listMetradoCreationOptions(userId: string) {
  const projects = await prisma.project.findMany({
    where: { company: { userId } },
    include: {
      budgets: {
        include: {
          items: {
            orderBy: { sortOrder: "asc" },
            select: {
              id: true,
              budgetId: true,
              code: true,
              description: true,
              unit: true,
            },
          },
        },
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  return {
    projects: projects.map((project) => ({ id: project.id, name: project.name })),
    budgets: projects.flatMap((project) =>
      project.budgets.map((budget) => ({
        id: budget.id,
        projectId: project.id,
        name: budget.name,
      })),
    ),
    partidas: projects.flatMap((project) =>
      project.budgets.flatMap((budget) =>
        budget.items.map((item) => ({
          id: item.id,
          budgetId: budget.id,
          projectId: project.id,
          code: item.code,
          description: item.description,
          unit: item.unit,
        })),
      ),
    ),
  };
}

export async function createMetradoSheet(input: {
  userId: string;
  projectId: string;
  budgetId: string;
  budgetItemId: string;
  templateType: MetradoTemplateType;
  name: string;
}) {
  await ensureMetradoTemplates();
  const template = await prisma.metradoTemplate.findUniqueOrThrow({ where: { type: input.templateType } });

  return prisma.metradoSheet.create({
    data: {
      userId: input.userId,
      projectId: input.projectId,
      budgetId: input.budgetId,
      templateId: template.id,
      name: input.name,
      unit: template.defaultUnit,
      partidaLinks: {
        create: {
          budgetItemId: input.budgetItemId,
        },
      },
    },
  });
}

export async function getMetradoSheetById(sheetId: string, userId: string) {
  await ensureMetradoTemplates();
  const sheet = await prisma.metradoSheet.findFirst({
    where: { id: sheetId, userId },
    include: {
      project: true,
      budget: true,
      template: true,
      rows: { orderBy: { sortOrder: "asc" } },
      partidaLinks: { include: { budgetItem: true }, take: 1 },
    },
  });

  return sheet ? mapMetradoSheetRecord(sheet) : null;
}

export async function updateMetradoSheetMetadata(sheetId: string, userId: string, input: { name?: string; unit?: MetradoUnit }) {
  const existing = await prisma.metradoSheet.findFirst({ where: { id: sheetId, userId }, select: { id: true } });
  if (!existing) return null;

  await prisma.metradoSheet.update({
    where: { id: sheetId },
    data: {
      name: input.name,
      unit: input.unit,
    },
  });

  return getMetradoSheetById(sheetId, userId);
}

export async function deleteMetradoSheet(sheetId: string, userId: string) {
  const existing = await prisma.metradoSheet.findFirst({ where: { id: sheetId, userId }, select: { id: true } });
  if (!existing) return false;

  await prisma.metradoSheet.delete({ where: { id: sheetId } });
  return true;
}

export async function replaceMetradoRows(sheetId: string, userId: string, rows: MetradoRowRecord[]) {
  const existing = await prisma.metradoSheet.findFirst({ where: { id: sheetId, userId }, select: { id: true, unit: true } });
  if (!existing) return null;

  const calculated = calculateMetradoSheet({ unit: existing.unit as MetradoUnit, rows });

  await prisma.$transaction([
    prisma.metradoRow.deleteMany({ where: { sheetId } }),
    ...calculated.rows.map((row) =>
      prisma.metradoRow.create({
        data: {
          id: row.id.startsWith("row-") ? undefined : row.id,
          sheetId,
          sector: row.sector,
          eje: row.eje,
          nivel: row.nivel,
          description: row.description,
          unit: row.unit,
          formulaKey: row.formulaKey,
          inputs: row.inputs,
          partial: row.partial,
          sortOrder: row.sortOrder,
        },
      }),
    ),
    prisma.metradoSheet.update({
      where: { id: sheetId },
      data: {
        totalQuantity: calculated.primaryTotal,
        status: "DRAFT",
      },
    }),
  ]);

  return getMetradoSheetById(sheetId, userId);
}

export async function sendMetradoTotalToPartida(sheetId: string, userId: string) {
  const sheet = await prisma.metradoSheet.findFirstOrThrow({
    where: { id: sheetId, userId },
    include: {
      rows: { orderBy: { sortOrder: "asc" } },
      partidaLinks: { include: { budgetItem: true }, take: 1 },
    },
  });
  const link = sheet.partidaLinks[0];
  if (!link) throw new Error("La hoja no tiene una partida vinculada.");

  const rows = sheet.rows.map((row): MetradoRowRecord => ({
    id: row.id,
    sheetId: row.sheetId,
    sector: row.sector,
    eje: row.eje,
    nivel: row.nivel,
    description: row.description,
    unit: row.unit as MetradoUnit,
    formulaKey: row.formulaKey as MetradoRowRecord["formulaKey"],
    inputs: parseMetradoInputs(row.inputs),
    partial: Number(row.partial),
    sortOrder: row.sortOrder,
  }));
  const calculation = calculateMetradoSheet({ unit: sheet.unit as MetradoUnit, rows });
  const patch = buildBudgetItemQuantityPatch(calculation.primaryTotal);

  await prisma.$transaction([
    prisma.budgetItem.update({
      where: { id: link.budgetItemId },
      data: patch,
    }),
    prisma.metradoPartidaLink.update({
      where: { id: link.id },
      data: {
        lastSentQuantity: patch.quantity,
        sentAt: new Date(),
      },
    }),
    prisma.metradoSheet.update({
      where: { id: sheet.id },
      data: {
        status: "SENT_TO_BUDGET",
        totalQuantity: patch.quantity,
      },
    }),
  ]);

  return patch;
}

function mapMetradoSheetRecord(sheet: Awaited<ReturnType<typeof prisma.metradoSheet.findMany>>[number]): MetradoSheetRecord {
  const link = sheet.partidaLinks[0];

  return {
    id: sheet.id,
    userId: sheet.userId,
    projectId: sheet.projectId,
    projectName: sheet.project.name,
    budgetId: sheet.budgetId,
    budgetName: sheet.budget.name,
    templateId: sheet.templateId,
    templateType: sheet.template.type,
    name: sheet.name,
    status: sheet.status,
    unit: sheet.unit as MetradoUnit,
    totalQuantity: Number(sheet.totalQuantity),
    rows: sheet.rows.map((row) => ({
      id: row.id,
      sheetId: row.sheetId,
      sector: row.sector,
      eje: row.eje,
      nivel: row.nivel,
      description: row.description,
      unit: row.unit as MetradoUnit,
      formulaKey: row.formulaKey as MetradoRowRecord["formulaKey"],
      inputs: parseMetradoInputs(row.inputs),
      partial: Number(row.partial),
      sortOrder: row.sortOrder,
    })),
    partidaLink: link
      ? {
          id: link.id,
          sheetId: link.sheetId,
          budgetItemId: link.budgetItemId,
          budgetItemCode: link.budgetItem.code,
          budgetItemDescription: link.budgetItem.description,
          budgetItemUnit: link.budgetItem.unit,
          lastSentQuantity: link.lastSentQuantity === null ? null : Number(link.lastSentQuantity),
        }
      : null,
    createdAt: sheet.createdAt,
    updatedAt: sheet.updatedAt,
  };
}
```

- [ ] **Step 4: Run helper tests**

Run: `npm run test -- lib/data/metrados.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add lib/data/metrados.ts lib/data/metrados.test.ts
git commit -m "feat: add metrado data services"
```

---

### Task 6: Excel Export And Import Boundary

**Files:**
- Create: `lib/metrados/excel-export.ts`
- Create: `lib/metrados/excel-export.test.ts`
- Create: `lib/metrados/excel-import.ts`
- Create: `lib/metrados/excel-import.test.ts`

- [ ] **Step 1: Write failing Excel tests**

Create `lib/metrados/excel-export.test.ts`:

```ts
import ExcelJS from "exceljs";
import { describe, expect, test } from "vitest";

import { createMetradoWorkbook } from "@/lib/metrados/excel-export";
import type { MetradoSheetRecord } from "@/types/metrado";

const sheet: MetradoSheetRecord = {
  id: "sheet-1",
  userId: "user-1",
  projectId: "project-1",
  projectName: "Obra Demo",
  budgetId: "budget-1",
  budgetName: "Presupuesto Demo",
  templateId: "template-concrete",
  templateType: "CONCRETE",
  name: "Metrado de concreto",
  status: "DRAFT",
  unit: "m3",
  totalQuantity: 6,
  partidaLink: null,
  rows: [
    {
      id: "row-1",
      sheetId: "sheet-1",
      sector: "A",
      eje: "1",
      nivel: "N1",
      description: "Zapata",
      unit: "m3",
      formulaKey: "volume",
      inputs: { largo: 2, ancho: 3, alto: 1 },
      partial: 6,
      sortOrder: 1,
    },
  ],
};

describe("createMetradoWorkbook", () => {
  test("exports sheet metadata and rows", async () => {
    const buffer = await createMetradoWorkbook(sheet);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);

    const worksheet = workbook.getWorksheet("Metrado");
    expect(worksheet?.getCell("A1").value).toBe("METRADO AVANZADO");
    expect(worksheet?.getCell("B3").value).toBe("Obra Demo");
    expect(worksheet?.getCell("E8").value).toBe("volume");
  });
});
```

Create `lib/metrados/excel-import.test.ts`:

```ts
import { describe, expect, test } from "vitest";

import { normalizeMetradoImportRows } from "@/lib/metrados/excel-import";

describe("normalizeMetradoImportRows", () => {
  test("converts raw rows into draft metrado rows", () => {
    const result = normalizeMetradoImportRows([
      {
        sector: "A",
        eje: "1",
        nivel: "N1",
        description: "Zapata",
        unit: "m3",
        formulaKey: "volume",
        largo: 2,
        ancho: 3,
        alto: 1,
      },
    ]);

    expect(result.rows[0]).toMatchObject({
      sector: "A",
      unit: "m3",
      formulaKey: "volume",
      inputs: { largo: 2, ancho: 3, alto: 1 },
    });
    expect(result.issues).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -- lib/metrados/excel-export.test.ts lib/metrados/excel-import.test.ts`

Expected: FAIL because export and import modules do not exist.

- [ ] **Step 3: Add Excel export**

Create `lib/metrados/excel-export.ts`:

```ts
import ExcelJS from "exceljs";

import type { MetradoSheetRecord } from "@/types/metrado";

export async function createMetradoWorkbook(sheet: MetradoSheetRecord) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Metrado");

  workbook.creator = "MYC Presupuestos";
  worksheet.views = [{ state: "frozen", ySplit: 7 }];
  worksheet.columns = [
    { header: "Sector", key: "sector", width: 14 },
    { header: "Eje", key: "eje", width: 12 },
    { header: "Nivel", key: "nivel", width: 12 },
    { header: "Descripcion", key: "description", width: 36 },
    { header: "Formula", key: "formulaKey", width: 18 },
    { header: "Unidad", key: "unit", width: 10 },
    { header: "Largo", key: "largo", width: 10 },
    { header: "Ancho", key: "ancho", width: 10 },
    { header: "Alto", key: "alto", width: 10 },
    { header: "Cantidad", key: "cantidad", width: 12 },
    { header: "Longitud", key: "longitud", width: 12 },
    { header: "Peso unitario", key: "pesoUnitario", width: 14 },
    { header: "Parcial", key: "partial", width: 14 },
  ];

  worksheet.mergeCells("A1:M1");
  worksheet.getCell("A1").value = "METRADO AVANZADO";
  worksheet.getCell("A1").font = { bold: true, size: 16, color: { argb: "FF0F172A" } };
  worksheet.getCell("A1").alignment = { horizontal: "center" };

  worksheet.getCell("A3").value = "Proyecto";
  worksheet.getCell("B3").value = sheet.projectName;
  worksheet.getCell("D3").value = "Presupuesto";
  worksheet.getCell("E3").value = sheet.budgetName;
  worksheet.getCell("A4").value = "Hoja";
  worksheet.getCell("B4").value = sheet.name;
  worksheet.getCell("D4").value = "Unidad";
  worksheet.getCell("E4").value = sheet.unit;

  const header = worksheet.getRow(7);
  header.values = worksheet.columns.map((column) => column.header);
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F172A" } };

  let rowNumber = 8;
  for (const row of sheet.rows) {
    const excelRow = worksheet.getRow(rowNumber);
    excelRow.getCell(1).value = row.sector;
    excelRow.getCell(2).value = row.eje;
    excelRow.getCell(3).value = row.nivel;
    excelRow.getCell(4).value = row.description;
    excelRow.getCell(5).value = row.formulaKey;
    excelRow.getCell(6).value = row.unit;
    excelRow.getCell(7).value = row.inputs.largo ?? "";
    excelRow.getCell(8).value = row.inputs.ancho ?? "";
    excelRow.getCell(9).value = row.inputs.alto ?? "";
    excelRow.getCell(10).value = row.inputs.cantidad ?? "";
    excelRow.getCell(11).value = row.inputs.longitud ?? "";
    excelRow.getCell(12).value = row.inputs.pesoUnitario ?? "";
    excelRow.getCell(13).value = row.partial;
    rowNumber += 1;
  }

  worksheet.getCell(`L${rowNumber + 1}`).value = "Total";
  worksheet.getCell(`M${rowNumber + 1}`).value = sheet.totalQuantity;
  worksheet.getRow(rowNumber + 1).font = { bold: true };

  return workbook.xlsx.writeBuffer();
}
```

- [ ] **Step 4: Add import boundary**

Create `lib/metrados/excel-import.ts`:

```ts
import type { MetradoFormulaInputKey, MetradoFormulaKey, MetradoRowRecord, MetradoUnit, MetradoValidationIssue } from "@/types/metrado";

type RawImportRow = Record<string, unknown>;

const validFormulaKeys = new Set<MetradoFormulaKey>(["volume", "area", "linear", "rebarWeight", "formworkArea", "factorArea", "manual"]);
const validUnits = new Set<MetradoUnit>(["m", "m2", "m3", "kg", "und", "glb"]);
const inputKeys: MetradoFormulaInputKey[] = ["largo", "ancho", "alto", "cantidad", "longitud", "pesoUnitario", "perimetro", "altura", "area", "factor", "manual"];

export function normalizeMetradoImportRows(rawRows: RawImportRow[]) {
  const issues: MetradoValidationIssue[] = [];
  const rows: MetradoRowRecord[] = rawRows.map((rawRow, index) => {
    const rowId = `import-row-${index + 1}`;
    const unit = String(rawRow.unit ?? "und") as MetradoUnit;
    const formulaKey = String(rawRow.formulaKey ?? "manual") as MetradoFormulaKey;

    if (!validUnits.has(unit)) {
      issues.push({ id: `${rowId}-unit`, severity: "error", rowId, field: "unit", message: "La unidad importada no esta soportada." });
    }

    if (!validFormulaKeys.has(formulaKey)) {
      issues.push({ id: `${rowId}-formula`, severity: "error", rowId, field: "formulaKey", message: "La formula importada no esta soportada." });
    }

    const inputs = inputKeys.reduce<MetradoRowRecord["inputs"]>((nextInputs, key) => {
      const parsed = Number(rawRow[key]);
      if (Number.isFinite(parsed)) nextInputs[key] = parsed;
      return nextInputs;
    }, {});

    return {
      id: rowId,
      sheetId: "",
      sector: String(rawRow.sector ?? ""),
      eje: String(rawRow.eje ?? ""),
      nivel: String(rawRow.nivel ?? ""),
      description: String(rawRow.description ?? "Fila importada"),
      unit: validUnits.has(unit) ? unit : "und",
      formulaKey: validFormulaKeys.has(formulaKey) ? formulaKey : "manual",
      inputs,
      partial: 0,
      sortOrder: index + 1,
    };
  });

  return { rows, issues };
}
```

- [ ] **Step 5: Run Excel tests**

Run: `npm run test -- lib/metrados/excel-export.test.ts lib/metrados/excel-import.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

Run:

```bash
git add lib/metrados/excel-export.ts lib/metrados/excel-export.test.ts lib/metrados/excel-import.ts lib/metrados/excel-import.test.ts
git commit -m "feat: add metrado excel services"
```

---

### Task 7: API Routes

**Files:**
- Create: `app/api/metrados-avanzados/route.ts`
- Create: `app/api/metrados-avanzados/[id]/route.ts`
- Create: `app/api/metrados-avanzados/[id]/rows/route.ts`
- Create: `app/api/metrados-avanzados/[id]/export/route.ts`
- Create: `app/api/metrados-avanzados/[id]/import/route.ts`
- Create: `app/api/metrados-avanzados/[id]/send-to-partida/route.ts`

- [ ] **Step 1: Add list/create handler**

Create `app/api/metrados-avanzados/route.ts`:

```ts
import { NextResponse } from "next/server";

import { getAuthSession } from "@/lib/auth/session";
import { createMetradoSheet, listMetradoSheetsByUser } from "@/lib/data/metrados";

export async function GET() {
  const session = await getAuthSession();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const sheets = await listMetradoSheetsByUser(session.user.id);
  return NextResponse.json({ sheets });
}

export async function POST(request: Request) {
  const session = await getAuthSession();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await request.json();
  const sheet = await createMetradoSheet({
    userId: session.user.id,
    projectId: String(body.projectId ?? ""),
    budgetId: String(body.budgetId ?? ""),
    budgetItemId: String(body.budgetItemId ?? ""),
    templateType: body.templateType,
    name: String(body.name ?? "Nuevo metrado"),
  });

  return NextResponse.json({ sheet }, { status: 201 });
}
```

- [ ] **Step 2: Add sheet read/update/delete handler**

Create `app/api/metrados-avanzados/[id]/route.ts`:

```ts
import { NextResponse } from "next/server";

import { getAuthSession } from "@/lib/auth/session";
import { deleteMetradoSheet, getMetradoSheetById, updateMetradoSheetMetadata } from "@/lib/data/metrados";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAuthSession();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await params;
  const sheet = await getMetradoSheetById(id, session.user.id);
  if (!sheet) return NextResponse.json({ error: "Metrado no encontrado" }, { status: 404 });

  return NextResponse.json({ sheet });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAuthSession();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await params;
  const body = await request.json();
  const sheet = await updateMetradoSheetMetadata(id, session.user.id, {
    name: typeof body.name === "string" ? body.name : undefined,
    unit: body.unit,
  });
  if (!sheet) return NextResponse.json({ error: "Metrado no encontrado" }, { status: 404 });

  return NextResponse.json({ sheet });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAuthSession();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await params;
  const deleted = await deleteMetradoSheet(id, session.user.id);
  if (!deleted) return NextResponse.json({ error: "Metrado no encontrado" }, { status: 404 });

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: Add rows handler**

Create `app/api/metrados-avanzados/[id]/rows/route.ts`:

```ts
import { NextResponse } from "next/server";

import { getAuthSession } from "@/lib/auth/session";
import { replaceMetradoRows } from "@/lib/data/metrados";
import type { MetradoRowRecord } from "@/types/metrado";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAuthSession();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await params;
  const body = await request.json();
  const rows = Array.isArray(body.rows) ? (body.rows as MetradoRowRecord[]) : [];
  const sheet = await replaceMetradoRows(id, session.user.id, rows);
  if (!sheet) return NextResponse.json({ error: "Metrado no encontrado" }, { status: 404 });

  return NextResponse.json({ sheet });
}
```

- [ ] **Step 4: Add export handler**

Create `app/api/metrados-avanzados/[id]/export/route.ts`:

```ts
import { NextResponse } from "next/server";

import { getAuthSession } from "@/lib/auth/session";
import { getMetradoSheetById } from "@/lib/data/metrados";
import { createMetradoWorkbook } from "@/lib/metrados/excel-export";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAuthSession();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await params;
  const sheet = await getMetradoSheetById(id, session.user.id);
  if (!sheet) return NextResponse.json({ error: "Metrado no encontrado" }, { status: 404 });

  const buffer = await createMetradoWorkbook(sheet);

  return new Response(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${sheet.name.replaceAll('"', "")}.xlsx"`,
    },
  });
}
```

- [ ] **Step 5: Add import handler**

Create `app/api/metrados-avanzados/[id]/import/route.ts`:

```ts
import { NextResponse } from "next/server";

import { getAuthSession } from "@/lib/auth/session";
import { normalizeMetradoImportRows } from "@/lib/metrados/excel-import";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAuthSession();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await params;
  const body = await request.json();
  const rawRows = Array.isArray(body.rows) ? body.rows : [];
  const result = normalizeMetradoImportRows(rawRows);

  return NextResponse.json({ sheetId: id, ...result });
}
```

- [ ] **Step 6: Add send-to-partida handler**

Create `app/api/metrados-avanzados/[id]/send-to-partida/route.ts`:

```ts
import { NextResponse } from "next/server";

import { getAuthSession } from "@/lib/auth/session";
import { sendMetradoTotalToPartida } from "@/lib/data/metrados";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAuthSession();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await params;
  const result = await sendMetradoTotalToPartida(id, session.user.id);

  return NextResponse.json({ result });
}
```

- [ ] **Step 7: Run lint and focused tests**

Run: `npm run lint`

Expected: PASS.

Run: `npm run test -- lib/data/metrados.test.ts`

Expected: PASS.

- [ ] **Step 8: Commit**

Run:

```bash
git add app/api/metrados-avanzados lib/data/metrados.ts
git commit -m "feat: add metrado api routes"
```

---

### Task 8: Client Editor Helpers

**Files:**
- Create: `components/metrados/metrado-view-model.ts`
- Test: `components/metrados/metrado-view-model.test.ts`

- [ ] **Step 1: Write failing view-model tests**

Create `components/metrados/metrado-view-model.test.ts`:

```ts
import { describe, expect, test } from "vitest";

import { addMetradoRow, deleteMetradoRow, duplicateMetradoRow, updateMetradoRowInput } from "@/components/metrados/metrado-view-model";
import type { MetradoRowRecord } from "@/types/metrado";

const row: MetradoRowRecord = {
  id: "row-1",
  sheetId: "sheet-1",
  sector: "A",
  eje: "1",
  nivel: "N1",
  description: "Zapata",
  unit: "m3",
  formulaKey: "volume",
  inputs: { largo: 2 },
  partial: 0,
  sortOrder: 1,
};

describe("metrado editor helpers", () => {
  test("adds a row after the current rows", () => {
    expect(addMetradoRow([row], "sheet-1", "m3", "volume")[1]).toMatchObject({
      sheetId: "sheet-1",
      unit: "m3",
      formulaKey: "volume",
      sortOrder: 2,
    });
  });

  test("duplicates a row with a new id and next sort order", () => {
    const rows = duplicateMetradoRow([row], "row-1");
    expect(rows).toHaveLength(2);
    expect(rows[1]?.id).not.toBe("row-1");
    expect(rows[1]?.description).toBe("Zapata");
  });

  test("updates one input value", () => {
    expect(updateMetradoRowInput([row], "row-1", "ancho", 3)[0]?.inputs).toEqual({ largo: 2, ancho: 3 });
  });

  test("deletes a row and resequences sort order", () => {
    const rows = deleteMetradoRow([row, { ...row, id: "row-2", sortOrder: 2 }], "row-1");
    expect(rows).toEqual([{ ...row, id: "row-2", sortOrder: 1 }]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- components/metrados/metrado-view-model.test.ts`

Expected: FAIL because helper module does not exist.

- [ ] **Step 3: Add editor helpers**

Create `components/metrados/metrado-view-model.ts`:

```ts
import type { MetradoFormulaInputKey, MetradoFormulaKey, MetradoRowRecord, MetradoUnit } from "@/types/metrado";

export function addMetradoRow(rows: MetradoRowRecord[], sheetId: string, unit: MetradoUnit, formulaKey: MetradoFormulaKey) {
  return resequenceRows([
    ...rows,
    {
      id: `row-${Date.now()}`,
      sheetId,
      sector: "",
      eje: "",
      nivel: "",
      description: "Nueva fila",
      unit,
      formulaKey,
      inputs: {},
      partial: 0,
      sortOrder: rows.length + 1,
    },
  ]);
}

export function duplicateMetradoRow(rows: MetradoRowRecord[], rowId: string) {
  const source = rows.find((row) => row.id === rowId);
  if (!source) return rows;

  return resequenceRows([
    ...rows,
    {
      ...source,
      id: `row-${Date.now()}`,
    },
  ]);
}

export function deleteMetradoRow(rows: MetradoRowRecord[], rowId: string) {
  return resequenceRows(rows.filter((row) => row.id !== rowId));
}

export function updateMetradoRowInput(rows: MetradoRowRecord[], rowId: string, key: MetradoFormulaInputKey, value: number) {
  return rows.map((row) =>
    row.id === rowId
      ? {
          ...row,
          inputs: {
            ...row.inputs,
            [key]: value,
          },
        }
      : row,
  );
}

function resequenceRows(rows: MetradoRowRecord[]) {
  return rows.map((row, index) => ({
    ...row,
    sortOrder: index + 1,
  }));
}
```

- [ ] **Step 4: Run helper tests**

Run: `npm run test -- components/metrados/metrado-view-model.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add components/metrados/metrado-view-model.ts components/metrados/metrado-view-model.test.ts
git commit -m "feat: add metrado editor helpers"
```

---

### Task 9: Metrados UI Components

**Files:**
- Create: `components/metrados/MetradosDashboard.tsx`
- Create: `components/metrados/MetradoTemplateSelector.tsx`
- Create: `components/metrados/MetradoSheetTable.tsx`
- Create: `components/metrados/MetradoFormulaBar.tsx`
- Create: `components/metrados/MetradoSummaryPanel.tsx`
- Create: `components/metrados/MetradoValidationPanel.tsx`
- Create: `components/metrados/MetradoExportActions.tsx`

- [ ] **Step 1: Add `MetradoTemplateSelector.tsx`**

Create a client component rendering the templates from props with a button per template. Use `Button`, `Card`, and lucide icons.

```tsx
"use client";

import { CheckCircle2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { MetradoTemplateRecord, MetradoTemplateType } from "@/types/metrado";

export function MetradoTemplateSelector({
  templates,
  selectedType,
  onSelect,
}: {
  templates: MetradoTemplateRecord[];
  selectedType: MetradoTemplateType;
  onSelect: (type: MetradoTemplateType) => void;
}) {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
      {templates.map((template) => {
        const selected = template.type === selectedType;

        return (
          <Card key={template.type} className={cn("border-slate-200 transition", selected && "border-sky-300 bg-sky-50/60")}>
            <CardContent className="space-y-3 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{template.name}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">{template.description}</p>
                </div>
                {selected ? <CheckCircle2 className="h-4 w-4 text-sky-600" /> : null}
              </div>
              <Button className="w-full" size="sm" variant={selected ? "default" : "outline"} onClick={() => onSelect(template.type)}>
                {selected ? "Seleccionada" : "Seleccionar"}
              </Button>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Add `MetradoFormulaBar.tsx`**

```tsx
"use client";

import { Sigma } from "lucide-react";

import { Input } from "@/components/ui/input";

export function MetradoFormulaBar({
  activeLabel,
  expression,
}: {
  activeLabel: string;
  expression: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
        <Sigma className="h-4 w-4" />
      </span>
      <div className="w-40 shrink-0 text-sm font-medium text-slate-700">{activeLabel}</div>
      <Input readOnly value={expression} className="font-mono text-sm" />
    </div>
  );
}
```

- [ ] **Step 3: Add `MetradoSummaryPanel.tsx`**

```tsx
"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatNumber } from "@/lib/utils";
import type { MetradoPartidaLinkRecord, MetradoUnit } from "@/types/metrado";

export function MetradoSummaryPanel({
  totalsByUnit,
  primaryUnit,
  primaryTotal,
  partidaLink,
}: {
  totalsByUnit: Record<MetradoUnit, number>;
  primaryUnit: MetradoUnit;
  primaryTotal: number;
  partidaLink: MetradoPartidaLinkRecord | null;
}) {
  return (
    <Card className="border-slate-200">
      <CardContent className="space-y-4 p-5">
        <div>
          <p className="text-sm font-semibold text-slate-900">Total principal</p>
          <p className="mt-2 text-3xl font-semibold text-slate-950">
            {formatNumber(primaryTotal, 3)} <span className="text-base text-slate-500">{primaryUnit}</span>
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 text-sm">
          {Object.entries(totalsByUnit).map(([unit, total]) => (
            <div key={unit} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
              <p className="text-xs uppercase text-slate-500">{unit}</p>
              <p className="font-semibold text-slate-900">{formatNumber(total, 3)}</p>
            </div>
          ))}
        </div>
        {partidaLink ? (
          <div className="rounded-xl border border-sky-100 bg-sky-50 px-3 py-2 text-sm">
            <Badge className="bg-sky-100 text-sky-700">Partida vinculada</Badge>
            <p className="mt-2 font-medium text-slate-900">{partidaLink.budgetItemCode}</p>
            <p className="text-slate-600">{partidaLink.budgetItemDescription}</p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 4: Add `MetradoValidationPanel.tsx`**

```tsx
"use client";

import { AlertTriangle, CheckCircle2 } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import type { MetradoValidationIssue } from "@/types/metrado";

export function MetradoValidationPanel({ issues }: { issues: MetradoValidationIssue[] }) {
  return (
    <Card className="border-slate-200">
      <CardContent className="space-y-3 p-5">
        <div className="flex items-center gap-2">
          {issues.length === 0 ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <AlertTriangle className="h-4 w-4 text-amber-600" />}
          <p className="text-sm font-semibold text-slate-900">Validacion</p>
        </div>
        {issues.length === 0 ? (
          <p className="text-sm text-slate-500">Sin alertas de calculo.</p>
        ) : (
          <div className="space-y-2">
            {issues.map((issue) => (
              <div key={issue.id} className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                {issue.message}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 5: Add `MetradoExportActions.tsx`**

```tsx
"use client";

import { Download, Save, Send, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";

export function MetradoExportActions({
  sheetId,
  blocking,
  onSave,
  onSend,
}: {
  sheetId: string;
  blocking: boolean;
  onSave: () => void;
  onSend: () => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button className="gap-2" variant="outline" onClick={onSave}>
        <Save className="h-4 w-4" />
        Guardar borrador
      </Button>
      <Button className="gap-2" variant="outline" asChild>
        <a href={`/api/metrados-avanzados/${sheetId}/export`}>
          <Download className="h-4 w-4" />
          Exportar Excel
        </a>
      </Button>
      <Button className="gap-2" variant="outline">
        <Upload className="h-4 w-4" />
        Importar Excel
      </Button>
      <Button className="gap-2" disabled={blocking} onClick={onSend}>
        <Send className="h-4 w-4" />
        Enviar a partida
      </Button>
    </div>
  );
}
```

- [ ] **Step 6: Add `MetradoSheetTable.tsx`**

Implement a compact table with sticky headers, inline inputs, add/duplicate/delete callbacks, and input columns for formula keys. Use existing `Table`, `THead`, `TBody`, `TR`, `TH`, `TD`, `Input`, `Button`, and lucide action icons.

Code shape:

```tsx
"use client";

import { Copy, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import type { MetradoFormulaInputKey, MetradoRowRecord } from "@/types/metrado";

const inputColumns: MetradoFormulaInputKey[] = ["largo", "ancho", "alto", "cantidad", "longitud", "pesoUnitario", "perimetro", "altura", "area", "factor", "manual"];

export function MetradoSheetTable({
  rows,
  onAddRow,
  onDuplicateRow,
  onDeleteRow,
  onChangeRow,
}: {
  rows: MetradoRowRecord[];
  onAddRow: () => void;
  onDuplicateRow: (rowId: string) => void;
  onDeleteRow: (rowId: string) => void;
  onChangeRow: (row: MetradoRowRecord) => void;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <p className="text-sm font-semibold text-slate-900">Tabla de metrado</p>
        <Button className="gap-2" size="sm" onClick={onAddRow}>
          <Plus className="h-4 w-4" />
          Fila
        </Button>
      </div>
      <div className="max-h-[560px] overflow-auto">
        <Table className="min-w-[1280px] text-xs">
          <THead>
            <TR className="bg-slate-100 hover:bg-slate-100">
              <TH className="sticky top-0 z-10 bg-slate-100">Sector</TH>
              <TH className="sticky top-0 z-10 bg-slate-100">Eje</TH>
              <TH className="sticky top-0 z-10 bg-slate-100">Nivel</TH>
              <TH className="sticky top-0 z-10 bg-slate-100">Descripcion</TH>
              <TH className="sticky top-0 z-10 bg-slate-100">Unidad</TH>
              {inputColumns.map((column) => (
                <TH key={column} className="sticky top-0 z-10 bg-slate-100">{column}</TH>
              ))}
              <TH className="sticky top-0 z-10 bg-slate-100">Parcial</TH>
              <TH className="sticky top-0 z-10 bg-slate-100 text-right">Acciones</TH>
            </TR>
          </THead>
          <TBody>
            {rows.map((row) => (
              <TR key={row.id}>
                <EditableTextCell value={row.sector} onChange={(value) => onChangeRow({ ...row, sector: value })} />
                <EditableTextCell value={row.eje} onChange={(value) => onChangeRow({ ...row, eje: value })} />
                <EditableTextCell value={row.nivel} onChange={(value) => onChangeRow({ ...row, nivel: value })} />
                <EditableTextCell value={row.description} onChange={(value) => onChangeRow({ ...row, description: value })} className="min-w-56" />
                <EditableTextCell value={row.unit} onChange={(value) => onChangeRow({ ...row, unit: value as MetradoRowRecord["unit"] })} />
                {inputColumns.map((column) => (
                  <TD key={column} className="p-1">
                    <Input
                      type="number"
                      value={row.inputs[column] ?? ""}
                      onChange={(event) =>
                        onChangeRow({
                          ...row,
                          inputs: { ...row.inputs, [column]: Number(event.target.value) },
                        })
                      }
                      className="h-8"
                    />
                  </TD>
                ))}
                <TD className="font-mono font-semibold text-slate-900">{row.partial.toFixed(3)}</TD>
                <TD>
                  <div className="flex justify-end gap-1">
                    <Button size="icon" variant="ghost" onClick={() => onDuplicateRow(row.id)}><Copy className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => onDeleteRow(row.id)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </div>
    </div>
  );
}

function EditableTextCell({ value, onChange, className }: { value: string; onChange: (value: string) => void; className?: string }) {
  return (
    <TD className="p-1">
      <Input value={value} onChange={(event) => onChange(event.target.value)} className={className} />
    </TD>
  );
}
```

- [ ] **Step 7: Add `MetradosDashboard.tsx`**

Compose the selector, formula bar, table, summary, validation, and actions. Keep state local for the first editor pass and use calculation/validation services in `useMemo`.

Code shape:

```tsx
"use client";

import { useMemo, useState } from "react";

import { MetradoExportActions } from "@/components/metrados/MetradoExportActions";
import { MetradoFormulaBar } from "@/components/metrados/MetradoFormulaBar";
import { MetradoSheetTable } from "@/components/metrados/MetradoSheetTable";
import { MetradoSummaryPanel } from "@/components/metrados/MetradoSummaryPanel";
import { MetradoTemplateSelector } from "@/components/metrados/MetradoTemplateSelector";
import { MetradoValidationPanel } from "@/components/metrados/MetradoValidationPanel";
import { addMetradoRow, deleteMetradoRow, duplicateMetradoRow } from "@/components/metrados/metrado-view-model";
import { calculateMetradoSheet } from "@/lib/calculations/metrados";
import { validateMetradoSheet } from "@/lib/metrados/validation";
import type { MetradoSheetRecord, MetradoTemplateRecord } from "@/types/metrado";

type MetradoProjectOption = { id: string; name: string };
type MetradoBudgetOption = { id: string; projectId: string; name: string };
type MetradoPartidaOption = { id: string; projectId: string; budgetId: string; code: string; description: string; unit: string };

export function MetradosDashboard({
  initialSheets,
  templates,
  projects,
  budgets,
  partidas,
}: {
  initialSheets: MetradoSheetRecord[];
  templates: MetradoTemplateRecord[];
  projects: MetradoProjectOption[];
  budgets: MetradoBudgetOption[];
  partidas: MetradoPartidaOption[];
}) {
  const [activeSheet, setActiveSheet] = useState<MetradoSheetRecord>(() => initialSheets[0] ?? createEmptySheet(templates[0]));
  const [saveState, setSaveState] = useState("Borrador local");
  const activeTemplate = templates.find((template) => template.type === activeSheet.templateType) ?? templates[0];
  const availableBudgets = budgets.filter((budget) => !activeSheet.projectId || budget.projectId === activeSheet.projectId);
  const availablePartidas = partidas.filter((partida) => !activeSheet.budgetId || partida.budgetId === activeSheet.budgetId);
  const calculation = useMemo(() => calculateMetradoSheet({ unit: activeSheet.unit, rows: activeSheet.rows }), [activeSheet.rows, activeSheet.unit]);
  const issues = useMemo(
    () =>
      validateMetradoSheet({
        sheetUnit: activeSheet.unit,
        templateFormulaKeys: activeTemplate?.formulaKeys ?? ["manual"],
        linkedPartidaUnit: activeSheet.partidaLink?.budgetItemUnit,
        rows: calculation.rows,
      }),
    [activeSheet.unit, activeSheet.partidaLink?.budgetItemUnit, activeTemplate?.formulaKeys, calculation.rows],
  );
  const formula = activeTemplate?.formulas[0];

  return (
    <div className="space-y-5">
      <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 md:grid-cols-3">
        <label className="space-y-1 text-sm">
          <span className="font-medium text-slate-700">Proyecto</span>
          <select
            className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700"
            value={activeSheet.projectId}
            onChange={(event) => {
              const project = projects.find((candidate) => candidate.id === event.target.value);
              setActiveSheet((current) => ({
                ...current,
                projectId: project?.id ?? "",
                projectName: project?.name ?? "Proyecto sin seleccionar",
                budgetId: "",
                budgetName: "Presupuesto sin seleccionar",
                partidaLink: null,
              }));
            }}
          >
            <option value="">Seleccionar proyecto</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>{project.name}</option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium text-slate-700">Presupuesto</span>
          <select
            className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700"
            value={activeSheet.budgetId}
            onChange={(event) => {
              const budget = availableBudgets.find((candidate) => candidate.id === event.target.value);
              setActiveSheet((current) => ({
                ...current,
                budgetId: budget?.id ?? "",
                budgetName: budget?.name ?? "Presupuesto sin seleccionar",
                partidaLink: null,
              }));
            }}
          >
            <option value="">Seleccionar presupuesto</option>
            {availableBudgets.map((budget) => (
              <option key={budget.id} value={budget.id}>{budget.name}</option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium text-slate-700">Partida</span>
          <select
            className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700"
            value={activeSheet.partidaLink?.budgetItemId ?? ""}
            onChange={(event) => {
              const partida = availablePartidas.find((candidate) => candidate.id === event.target.value);
              setActiveSheet((current) => ({
                ...current,
                unit: partida?.unit === "m" || partida?.unit === "m2" || partida?.unit === "m3" || partida?.unit === "kg" || partida?.unit === "und" || partida?.unit === "glb" ? partida.unit : current.unit,
                partidaLink: partida
                  ? {
                      id: "draft-link",
                      sheetId: current.id,
                      budgetItemId: partida.id,
                      budgetItemCode: partida.code,
                      budgetItemDescription: partida.description,
                      budgetItemUnit: partida.unit,
                      lastSentQuantity: null,
                    }
                  : null,
              }));
            }}
          >
            <option value="">Seleccionar partida</option>
            {availablePartidas.map((partida) => (
              <option key={partida.id} value={partida.id}>{partida.code} - {partida.description}</option>
            ))}
          </select>
        </label>
      </div>
      <MetradoTemplateSelector
        templates={templates}
        selectedType={activeSheet.templateType}
        onSelect={(templateType) => {
          const nextTemplate = templates.find((template) => template.type === templateType);
          if (!nextTemplate) return;
          setActiveSheet((current) => ({ ...current, templateType, templateId: nextTemplate.id, unit: nextTemplate.defaultUnit }));
        }}
      />
      <MetradoFormulaBar activeLabel={formula?.label ?? "Formula"} expression={formula?.expression ?? "manual"} />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <MetradoSheetTable
          rows={calculation.rows}
          onAddRow={() => setActiveSheet((current) => ({ ...current, rows: addMetradoRow(current.rows, current.id, current.unit, formula?.key ?? "manual") }))}
          onDuplicateRow={(rowId) => setActiveSheet((current) => ({ ...current, rows: duplicateMetradoRow(current.rows, rowId) }))}
          onDeleteRow={(rowId) => setActiveSheet((current) => ({ ...current, rows: deleteMetradoRow(current.rows, rowId) }))}
          onChangeRow={(row) => setActiveSheet((current) => ({ ...current, rows: current.rows.map((candidate) => (candidate.id === row.id ? row : candidate)) }))}
        />
        <div className="space-y-4">
          <MetradoSummaryPanel totalsByUnit={calculation.totalsByUnit} primaryUnit={activeSheet.unit} primaryTotal={calculation.primaryTotal} partidaLink={activeSheet.partidaLink} />
          <MetradoValidationPanel issues={[...calculation.issues, ...issues]} />
          <MetradoExportActions
            sheetId={activeSheet.id}
            blocking={[...calculation.issues, ...issues].some((issue) => issue.severity === "error")}
            onSave={() => setSaveState("Borrador listo para guardar")}
            onSend={() => setSaveState("Total listo para enviar a partida")}
          />
          <p className="text-xs text-slate-500">{saveState}</p>
        </div>
      </div>
    </div>
  );
}

function createEmptySheet(template: MetradoTemplateRecord | undefined): MetradoSheetRecord {
  return {
    id: "draft-sheet",
    userId: "",
    projectId: "",
    projectName: "Proyecto sin seleccionar",
    budgetId: "",
    budgetName: "Presupuesto sin seleccionar",
    templateId: template?.id ?? "template-custom",
    templateType: template?.type ?? "CUSTOM",
    name: "Nuevo metrado",
    status: "DRAFT",
    unit: template?.defaultUnit ?? "und",
    totalQuantity: 0,
    rows: [],
    partidaLink: null,
  };
}
```

- [ ] **Step 8: Run lint**

Run: `npm run lint`

Expected: PASS.

- [ ] **Step 9: Commit**

Run:

```bash
git add components/metrados
git commit -m "feat: add metrado editor components"
```

---

### Task 10: Page Route And Sidebar Navigation

**Files:**
- Create: `app/metrados-avanzados/page.tsx`
- Modify: `components/layout/app-sidebar-client.tsx`
- Modify: `components/layout/app-sidebar-client.test.tsx`

- [ ] **Step 1: Add route page**

Create `app/metrados-avanzados/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import { Ruler } from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { MetradosDashboard } from "@/components/metrados/MetradosDashboard";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageHeaderCard } from "@/components/ui/page-header-card";
import { getAuthSession } from "@/lib/auth/session";
import { listMetradoCreationOptions, listMetradoSheetsByUser } from "@/lib/data/metrados";
import { metradoTemplates } from "@/lib/metrados/templates";

export default async function MetradosAvanzadosPage() {
  const session = await getAuthSession();
  if (!session) {
    redirect("/login");
  }

  const [sheets, creationOptions] = await Promise.all([
    listMetradoSheetsByUser(session.user.id),
    listMetradoCreationOptions(session.user.id),
  ]);

  return (
    <AppShell currentUser={session.user}>
      <Card className="border-slate-200">
        <CardHeader className="rounded-2xl bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)]">
          <PageHeaderCard
            icon={<Ruler className="h-5 w-5" />}
            title="Metrados avanzados"
            description="Crea hojas de metrado con formulas, validacion y vinculo directo a partidas de presupuesto."
          />
        </CardHeader>
        <CardContent className="pt-6">
          <MetradosDashboard
            initialSheets={sheets}
            templates={metradoTemplates}
            projects={creationOptions.projects}
            budgets={creationOptions.budgets}
            partidas={creationOptions.partidas}
          />
        </CardContent>
      </Card>
    </AppShell>
  );
}
```

- [ ] **Step 2: Add sidebar nav item**

Modify imports in `components/layout/app-sidebar-client.tsx` to include `Ruler`.

Add this item after Presupuestos:

```ts
{ href: "/metrados-avanzados", label: "Metrados", icon: Ruler },
```

- [ ] **Step 3: Update sidebar test expected hrefs**

Open `components/layout/app-sidebar-client.test.tsx` and add `/metrados-avanzados` in the expected navigation href array immediately after `/budgets`.

- [ ] **Step 4: Run sidebar and route-adjacent checks**

Run: `npm run test -- components/layout/app-sidebar-client.test.tsx`

Expected: PASS.

Run: `npm run lint`

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add app/metrados-avanzados/page.tsx components/layout/app-sidebar-client.tsx components/layout/app-sidebar-client.test.tsx
git commit -m "feat: add metrado route and navigation"
```

---

### Task 11: Final Verification

**Files:**
- All files changed by previous tasks.

- [ ] **Step 1: Run focused metrado tests**

Run:

```bash
npm run test -- lib/metrados/templates.test.ts lib/calculations/metrados.test.ts lib/metrados/validation.test.ts lib/data/metrados.test.ts lib/metrados/excel-export.test.ts lib/metrados/excel-import.test.ts components/metrados/metrado-view-model.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run full test suite**

Run: `npm run test`

Expected: PASS.

- [ ] **Step 3: Run lint**

Run: `npm run lint`

Expected: PASS.

- [ ] **Step 4: Run Next build**

Run: `node ./node_modules/next/dist/bin/next build`

Expected: build completes with no TypeScript or route-handler errors.

- [ ] **Step 5: Start dev server for manual QA**

Run: `npm run dev`

Expected: local server starts. Open `/metrados-avanzados` and verify:

- Sidebar includes `Metrados`.
- Page loads inside `AppShell`.
- Template selector shows all ten template types.
- Adding a row updates the table.
- Editing formula inputs updates partial and totals.
- Validation panel shows errors for empty or invalid rows.
- Export button points to `/api/metrados-avanzados/{id}/export`.

- [ ] **Step 6: Commit verification fixes**

If verification required changes, commit them:

```bash
git add .
git commit -m "fix: stabilize metrado module verification"
```

---

## Self-Review

- Spec coverage:
  - Dashboard: Task 9 and Task 10.
  - Create new sheet: Task 5 and Task 7 create handler; Task 9 provides UI shell.
  - Select project/budget/partida: Task 5 loads creation options, Task 9 renders selectors, and Task 10 passes options into the dashboard.
  - Template types: Task 1.
  - Excel-style editable table: Task 8 and Task 9.
  - Formula engine and totals: Task 2.
  - Validation alerts: Task 3 and Task 9.
  - Save draft: Task 7 route boundary and Task 9 action surface.
  - Export/import Excel: Task 6 and Task 7 route boundaries.
  - Send total to linked partida: Task 5 and Task 7.
  - Data model: Task 4.
  - Future Google Sheets and AI boundaries: Task 6 service boundary and no new dependency.
- Placeholder scan: no red-flag wording or open-ended validation instructions remain.
- Type consistency:
  - Template, formula, row, sheet, and validation names match `types/metrado.ts`.
  - Formula keys used in tests match template definitions.
  - API dynamic `params` use Promise-based Next 16 route-handler shape.
