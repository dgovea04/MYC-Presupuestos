# Work Schedule Fronts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `Por frentes de obra` intelligent schedule generation strategy that schedules independent work fronts in parallel while preserving technical construction sequence inside each front.

**Architecture:** Keep calculation behavior inside `lib/work-schedule/intelligent-schedule.ts` using pure, deterministic helpers. Extend the existing strategy enum, validation, API and UI selector without changing saved schedule records or existing strategies.

**Tech Stack:** Next.js App Router, TypeScript strict mode, Zod, Vitest/Testing Library, Tailwind/shadcn-style UI patterns already present in the project.

## Global Constraints

- Use TypeScript strict mode.
- Never use `any`.
- Keep calculation logic isolated from UI.
- All formulas and scheduling rules must be testable.
- Prefer reusable services and clean architecture.
- Do not change financial or polynomial calculation logic.
- Do not modify the existing pending Gantt visual change in `components/budget/gantt/timeline-row.tsx` unless the task explicitly requires it.
- Preserve behavior of `sequential`, `by_level` and `by_similarity`.

---

## File Map

- Modify `types/work-schedule.ts`: add `by_front` to `WorkScheduleGenerationStrategy`.
- Modify `lib/validations/work-schedule.ts`: add `by_front` to the Zod enum.
- Modify `lib/work-schedule/intelligent-schedule.ts`: implement front grouping, phase classification and `buildByFrontBase`.
- Modify `lib/work-schedule/intelligent-schedule.test.ts`: add focused tests for front strategy.
- Modify `components/budget/work-schedule-page-content.tsx`: add UI option and strategy guard support.
- Modify `components/budget/work-schedule/generation-dialog.tsx`: keep modular dialog selector aligned.
- Modify `components/budget/work-schedule/utils/storage.ts`: update strategy guard if present.
- Modify `components/budget/work-schedule-page-content.test.tsx`: assert UI sends `by_front`.
- Modify `app/api/budgets/[id]/work-schedule/route.test.ts`: assert route accepts `by_front`.
- Modify `lib/ai/agent/tools/schedule.test.ts` only if test failures show the agent tool has hard-coded strategy expectations.

---

## Task 1: Add Failing Scheduler Tests For `by_front`

**Files:**

- Modify: `lib/work-schedule/intelligent-schedule.test.ts`

**Interfaces:**

- Consumes: `buildIntelligentWorkScheduleBase`
- Produces: failing expectations that define `by_front` behavior before implementation

- [ ] **Step 1: Add a test helper option**

Find the local `createOptions` helper and ensure tests can call:

```ts
createOptions({ strategy: "by_front" })
```

This will fail until `WorkScheduleGenerationStrategy` includes `by_front`.

- [ ] **Step 2: Add test for parallel fronts**

Add a test in a new describe block:

```ts
describe("buildIntelligentWorkScheduleBase (by_front strategy)", () => {
  it("starts independent top-level fronts in parallel", () => {
    const result = buildIntelligentWorkScheduleBase({
      baseStartDate: "2026-08-03",
      lines: [
        createLine({ budgetItemId: "a1", itemCode: "1", description: "Limpieza de terreno frente A", levelId: "front-a", quantity: 10, performance: 10 }),
        createLine({ budgetItemId: "a2", itemCode: "2", description: "Excavacion de zapatas frente A", levelId: "front-a", quantity: 10, performance: 10 }),
        createLine({ budgetItemId: "b1", itemCode: "3", description: "Limpieza de terreno frente B", levelId: "front-b", quantity: 10, performance: 10 }),
        createLine({ budgetItemId: "b2", itemCode: "4", description: "Excavacion de zapatas frente B", levelId: "front-b", quantity: 10, performance: 10 }),
      ],
      options: createOptions({ strategy: "by_front" }),
      levelById: new Map([
        ["front-a", { parentId: null, type: "TITLE" }],
        ["front-b", { parentId: null, type: "TITLE" }],
      ]),
    });

    expect(result.generatedItems).toHaveLength(4);
    expect(result.generatedItems.find((item) => item.itemCode === "1")?.startDate).toBe("2026-08-03");
    expect(result.generatedItems.find((item) => item.itemCode === "3")?.startDate).toBe("2026-08-03");
    expect(result.generatedItems.find((item) => item.itemCode === "2")?.predecessor).toBe("1FS");
    expect(result.generatedItems.find((item) => item.itemCode === "4")?.predecessor).toBe("3FS");
  });
});
```

- [ ] **Step 3: Add test for technical phase order inside a front**

Add:

```ts
it("orders technical phases inside the same front before generating FS links", () => {
  const result = buildIntelligentWorkScheduleBase({
    baseStartDate: "2026-08-03",
    lines: [
      createLine({ budgetItemId: "finish", itemCode: "30", description: "Pintura latex en muros", levelId: "front-a", quantity: 5, performance: 5 }),
      createLine({ budgetItemId: "earth", itemCode: "10", description: "Excavacion masiva", levelId: "front-a", quantity: 5, performance: 5 }),
      createLine({ budgetItemId: "structure", itemCode: "20", description: "Concreto f'c=210 kg/cm2 en zapatas", levelId: "front-a", quantity: 5, performance: 5 }),
    ],
    options: createOptions({ strategy: "by_front" }),
    levelById: new Map([["front-a", { parentId: null, type: "TITLE" }]]),
  });

  expect(result.generatedItems.map((item) => item.itemCode)).toEqual(["10", "20", "30"]);
  expect(result.generatedItems[0]?.predecessor).toBeNull();
  expect(result.generatedItems[1]?.predecessor).toBe("10FS");
  expect(result.generatedItems[2]?.predecessor).toBe("20FS");
});
```

- [ ] **Step 4: Add test for fallback order on unknown phase**

Add:

```ts
it("keeps original relative order for unclassified work inside a front", () => {
  const result = buildIntelligentWorkScheduleBase({
    baseStartDate: "2026-08-03",
    lines: [
      createLine({ budgetItemId: "x1", itemCode: "1", description: "Servicio especial alfa", levelId: "front-a", quantity: 1, performance: 1 }),
      createLine({ budgetItemId: "x2", itemCode: "2", description: "Servicio especial beta", levelId: "front-a", quantity: 1, performance: 1 }),
    ],
    options: createOptions({ strategy: "by_front" }),
    levelById: new Map([["front-a", { parentId: null, type: "TITLE" }]]),
  });

  expect(result.generatedItems.map((item) => item.itemCode)).toEqual(["1", "2"]);
  expect(result.generatedItems[1]?.predecessor).toBe("1FS");
});
```

- [ ] **Step 5: Run failing tests**

Run:

```powershell
npm.cmd run test -- lib/work-schedule/intelligent-schedule.test.ts
```

Expected: FAIL because `by_front` is not part of the strategy union/schema and the switch does not implement it.

---

## Task 2: Extend Strategy Types And Validation

**Files:**

- Modify: `types/work-schedule.ts`
- Modify: `lib/validations/work-schedule.ts`

**Interfaces:**

- Produces: `WorkScheduleGenerationStrategy` accepts `"by_front"`
- Produces: API validation accepts `"by_front"`

- [ ] **Step 1: Update TypeScript union**

Change:

```ts
export type WorkScheduleGenerationStrategy = "sequential" | "by_level" | "by_similarity";
```

To:

```ts
export type WorkScheduleGenerationStrategy = "sequential" | "by_level" | "by_similarity" | "by_front";
```

- [ ] **Step 2: Update Zod enum**

Change the generation strategy schema to include `by_front`:

```ts
export const workScheduleGenerationStrategySchema = z.enum(["sequential", "by_level", "by_similarity", "by_front"]);
```

- [ ] **Step 3: Run type-focused tests**

Run:

```powershell
npm.cmd run test -- lib/work-schedule/intelligent-schedule.test.ts app/api/budgets/[id]/work-schedule/route.test.ts
```

Expected: scheduler tests still fail because implementation is missing; route validation errors related to enum should be gone or reduced.

- [ ] **Step 4: Commit type and validation change**

Run:

```powershell
git add types/work-schedule.ts lib/validations/work-schedule.ts
git commit -m "Add work schedule front strategy type"
```

---

## Task 3: Implement Phase Classification Helpers

**Files:**

- Modify: `lib/work-schedule/intelligent-schedule.ts`

**Interfaces:**

- Produces:

```ts
type WorkFrontPhase =
  | "preliminaries"
  | "earthwork"
  | "structure"
  | "masonry"
  | "installations"
  | "finishes"
  | "testing"
  | "other";
```

- Produces:

```ts
function classifyWorkFrontPhase(line: WorkScheduleLineRecord): WorkFrontPhase
function getWorkFrontPhaseOrder(phase: WorkFrontPhase): number
```

- [ ] **Step 1: Add phase type near existing local types**

Add:

```ts
type WorkFrontPhase =
  | "preliminaries"
  | "earthwork"
  | "structure"
  | "masonry"
  | "installations"
  | "finishes"
  | "testing"
  | "other";
```

- [ ] **Step 2: Add text normalization helper**

Add near helper functions:

```ts
function normalizeScheduleText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}
```

- [ ] **Step 3: Add keyword matching helper**

Add:

```ts
function includesAnyKeyword(value: string, keywords: readonly string[]) {
  return keywords.some((keyword) => value.includes(keyword));
}
```

- [ ] **Step 4: Add classifier**

Add:

```ts
function classifyWorkFrontPhase(line: WorkScheduleLineRecord): WorkFrontPhase {
  const text = normalizeScheduleText(`${line.itemCode} ${line.description} ${line.unit}`);

  if (includesAnyKeyword(text, ["prueba", "ensayo", "puesta en marcha", "limpieza final", "entrega", "recepcion"])) {
    return "testing";
  }

  if (includesAnyKeyword(text, ["preliminar", "limpieza", "trazo", "replanteo", "cartel", "movilizacion", "campamento", "seguridad"])) {
    return "preliminaries";
  }

  if (includesAnyKeyword(text, ["excavacion", "corte", "relleno", "eliminacion", "movimiento de tierras", "nivelacion", "compactacion"])) {
    return "earthwork";
  }

  if (includesAnyKeyword(text, ["concreto", "hormigon", "acero", "fierro", "encofrado", "desencofrado", "columna", "viga", "losa", "zapata", "cimentacion"])) {
    return "structure";
  }

  if (includesAnyKeyword(text, ["muro", "ladrillo", "albanileria", "tabique", "asentado"])) {
    return "masonry";
  }

  if (includesAnyKeyword(text, ["electrica", "sanitario", "sanitaria", "tuberia", "desague", "agua", "cable", "conduit", "tablero", "instalacion"])) {
    return "installations";
  }

  if (includesAnyKeyword(text, ["pintura", "ceramico", "porcelanato", "enchape", "piso", "acabado", "cielo raso", "carpinteria", "puerta", "ventana"])) {
    return "finishes";
  }

  return "other";
}
```

- [ ] **Step 5: Add phase order**

Add:

```ts
function getWorkFrontPhaseOrder(phase: WorkFrontPhase) {
  const order: Record<WorkFrontPhase, number> = {
    preliminaries: 10,
    earthwork: 20,
    structure: 30,
    masonry: 40,
    installations: 50,
    finishes: 60,
    testing: 70,
    other: 80,
  };

  return order[phase];
}
```

- [ ] **Step 6: Run tests**

Run:

```powershell
npm.cmd run test -- lib/work-schedule/intelligent-schedule.test.ts
```

Expected: tests still fail because `buildByFrontBase` is not wired yet.

---

## Task 4: Implement Front Grouping And `buildByFrontBase`

**Files:**

- Modify: `lib/work-schedule/intelligent-schedule.ts`

**Interfaces:**

- Consumes: `classifyWorkFrontPhase`, `getWorkFrontPhaseOrder`, `tryGenerateLine`
- Produces:

```ts
function buildByFrontBase(args: {
  baseStartDate: string;
  lines: WorkScheduleLineRecord[];
  reviewedBudgetItemIds?: Set<string>;
  issues: WorkScheduleGenerationIssueRecord[];
  options: WorkScheduleGenerationOptions;
  levelById?: Map<string, LevelInfo>;
  workDaysBitmask?: number;
  exceptionMap?: CalendarExceptionMap;
}): GeneratedScheduleLine[]
```

- [ ] **Step 1: Add front group local type**

Add:

```ts
type WorkFrontLine = {
  line: WorkScheduleLineRecord;
  phase: WorkFrontPhase;
  originalIndex: number;
};
```

- [ ] **Step 2: Add front key helper**

Add:

```ts
function getWorkFrontKey(line: WorkScheduleLineRecord, levelById?: Map<string, LevelInfo>) {
  const topLevelId = findTopLevelId(line.levelId ?? null, levelById);
  return `${line.subBudgetId}:${topLevelId ?? "default"}`;
}
```

- [ ] **Step 3: Add grouping helper**

Add:

```ts
function groupLinesByWorkFront(lines: WorkScheduleLineRecord[], levelById?: Map<string, LevelInfo>) {
  const groups = new Map<string, WorkFrontLine[]>();

  sortLines(lines).forEach((line, originalIndex) => {
    const frontKey = getWorkFrontKey(line, levelById);
    const current = groups.get(frontKey) ?? [];
    current.push({
      line,
      phase: classifyWorkFrontPhase(line),
      originalIndex,
    });
    groups.set(frontKey, current);
  });

  return groups;
}
```

- [ ] **Step 4: Add front line sorter**

Add:

```ts
function sortWorkFrontLines(lines: WorkFrontLine[]) {
  return [...lines].sort((left, right) => {
    const phaseDifference = getWorkFrontPhaseOrder(left.phase) - getWorkFrontPhaseOrder(right.phase);
    if (phaseDifference !== 0) {
      return phaseDifference;
    }

    return left.originalIndex - right.originalIndex;
  });
}
```

- [ ] **Step 5: Implement `buildByFrontBase`**

Add a new section after `buildByLevelBase`:

```ts
function buildByFrontBase({
  baseStartDate,
  lines,
  reviewedBudgetItemIds,
  issues,
  options,
  levelById,
  workDaysBitmask,
  exceptionMap,
}: {
  baseStartDate: string;
  lines: WorkScheduleLineRecord[];
  reviewedBudgetItemIds?: Set<string>;
  issues: WorkScheduleGenerationIssueRecord[];
  options: WorkScheduleGenerationOptions;
  levelById?: Map<string, LevelInfo>;
  workDaysBitmask?: number;
  exceptionMap?: CalendarExceptionMap;
}) {
  const generatedItems: GeneratedScheduleLine[] = [];
  const linesBySubBudget = groupLinesBySubBudget(lines);
  const orderedSubBudgetIds = [...linesBySubBudget.keys()];
  let subBudgetStaggerOffset = 0;

  for (const subBudgetId of orderedSubBudgetIds) {
    const groupLines = linesBySubBudget.get(subBudgetId) ?? [];
    const subBudgetStartDate = addDaysInclusive(baseStartDate, subBudgetStaggerOffset, workDaysBitmask, exceptionMap);
    const frontGroups = groupLinesByWorkFront(groupLines, levelById);

    for (const frontLines of frontGroups.values()) {
      const orderedFrontLines = sortWorkFrontLines(frontLines);
      let cursor = subBudgetStartDate;
      let previousGeneratedLine: GeneratedScheduleLine | null = null;

      for (const frontLine of orderedFrontLines) {
        const result = tryGenerateLine({
          line: frontLine.line,
          cursor,
          previousLine: previousGeneratedLine?.itemCode ?? null,
          reviewedBudgetItemIds,
          issues,
          options,
          workDaysBitmask,
          exceptionMap,
        });

        if (!result) {
          continue;
        }

        generatedItems.push(result.generatedLine);
        previousGeneratedLine = result.generatedLine;
        cursor = addDaysInclusive(result.generatedLine.endDate, 1, workDaysBitmask, exceptionMap);
      }
    }

    subBudgetStaggerOffset = getNextSubBudgetStaggerOffset(subBudgetStaggerOffset, options);
  }

  return generatedItems;
}
```

- [ ] **Step 6: Wire switch case**

In `buildIntelligentWorkScheduleBase`, add before `by_similarity` or after `by_level`:

```ts
case "by_front":
  generatedItems = buildByFrontBase({ baseStartDate, lines, reviewedBudgetItemIds, issues, options: appliedOptions, levelById, workDaysBitmask, exceptionMap });
  break;
```

- [ ] **Step 7: Run scheduler tests**

Run:

```powershell
npm.cmd run test -- lib/work-schedule/intelligent-schedule.test.ts
```

Expected: new `by_front` tests pass. Existing tests pass. If ordering of generated items differs only across independent fronts, adjust implementation to preserve stable insertion order by front group rather than weakening assertions.

- [ ] **Step 8: Commit scheduler implementation**

Run:

```powershell
git add lib/work-schedule/intelligent-schedule.ts lib/work-schedule/intelligent-schedule.test.ts
git commit -m "Add intelligent schedule generation by work fronts"
```

---

## Task 5: Add Highlights For Front Strategy

**Files:**

- Modify: `lib/work-schedule/intelligent-schedule.ts`
- Modify: `lib/work-schedule/intelligent-schedule.test.ts`

**Interfaces:**

- Produces: `summary.highlights` includes front strategy labels for `by_front`

- [ ] **Step 1: Add highlight test**

Add to the `by_front` describe block:

```ts
it("describes front strategy in generation highlights", () => {
  const result = buildIntelligentWorkScheduleBase({
    baseStartDate: "2026-08-03",
    lines: [
      createLine({ budgetItemId: "a1", itemCode: "1", description: "Limpieza de terreno", quantity: 1, performance: 1 }),
    ],
    options: createOptions({ strategy: "by_front" }),
  });

  expect(result.summary.highlights).toContain("Estrategia por frentes de obra");
  expect(result.summary.highlights).toContain("Secuencia constructiva aplicada por fase tecnica");
});
```

- [ ] **Step 2: Update strategy labels**

In `buildGenerationHighlights`, update:

```ts
const strategyLabels: Record<Exclude<WorkScheduleGenerationStrategy, "sequential">, string> = {
  by_level: "Estrategia por niveles (titulos en paralelo)",
  by_similarity: "Estrategia por similitud",
  by_front: "Estrategia por frentes de obra",
};
```

- [ ] **Step 3: Add front-specific highlight**

After the strategy label push, add:

```ts
if (options.strategy === "by_front") {
  highlights.push("Secuencia constructiva aplicada por fase tecnica");
}
```

- [ ] **Step 4: Run scheduler tests**

Run:

```powershell
npm.cmd run test -- lib/work-schedule/intelligent-schedule.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit highlights**

Run:

```powershell
git add lib/work-schedule/intelligent-schedule.ts lib/work-schedule/intelligent-schedule.test.ts
git commit -m "Describe work front schedule generation"
```

---

## Task 6: Connect UI Strategy Selection

**Files:**

- Modify: `components/budget/work-schedule-page-content.tsx`
- Modify: `components/budget/work-schedule/generation-dialog.tsx`
- Modify: `components/budget/work-schedule/utils/storage.ts`

**Interfaces:**

- Consumes: `WorkScheduleGenerationStrategy`
- Produces: user can select `Por frentes de obra`

- [ ] **Step 1: Update inline page selector**

In `components/budget/work-schedule-page-content.tsx`, add:

```tsx
<option value="by_front">Por frentes de obra</option>
```

Recommended position:

```tsx
<option value="sequential">Secuencial</option>
<option value="by_level">Por niveles</option>
<option value="by_front">Por frentes de obra</option>
<option value="by_similarity">Por similitud</option>
```

- [ ] **Step 2: Update inline strategy guard**

Change:

```ts
return value === "sequential" || value === "by_level" || value === "by_similarity";
```

To:

```ts
return value === "sequential" || value === "by_level" || value === "by_similarity" || value === "by_front";
```

- [ ] **Step 3: Update modular dialog selector**

In `components/budget/work-schedule/generation-dialog.tsx`, add the same option:

```tsx
<option value="by_front">Por frentes de obra</option>
```

- [ ] **Step 4: Update storage utility guard if duplicated**

If `components/budget/work-schedule/utils/storage.ts` has an `isWorkScheduleGenerationStrategy` helper, include `by_front` in the allowed values:

```ts
return value === "sequential" || value === "by_level" || value === "by_similarity" || value === "by_front";
```

- [ ] **Step 5: Run TypeScript-relevant tests**

Run:

```powershell
npm.cmd run test -- components/budget/work-schedule-page-content.test.tsx
```

Expected: existing tests pass or fail only because no test expectation has been added for the new option yet.

---

## Task 7: Add UI And API Tests

**Files:**

- Modify: `components/budget/work-schedule-page-content.test.tsx`
- Modify: `app/api/budgets/[id]/work-schedule/route.test.ts`

**Interfaces:**

- Produces: UI posts `strategy: "by_front"`
- Produces: API accepts `strategy: "by_front"`

- [ ] **Step 1: Add UI test for strategy payload**

In the generation dialog tests, add a test similar to the existing `by_level` payload test:

```ts
it("sends by_front strategy when selected", async () => {
  renderWorkSchedulePageContent();

  await userEvent.click(screen.getByRole("button", { name: /generar cronograma/i }));
  await userEvent.selectOptions(screen.getByLabelText(/estrategia/i), "by_front");
  await userEvent.click(screen.getByRole("button", { name: /generar/i }));

  await waitFor(() => {
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/work-schedule"),
      expect.objectContaining({
        body: expect.stringContaining("\"strategy\":\"by_front\""),
      }),
    );
  });
});
```

Adjust helper names to match the existing test file. Do not create new render infrastructure if one already exists.

- [ ] **Step 2: Add API route test**

In `app/api/budgets/[id]/work-schedule/route.test.ts`, add or adjust a POST generation test so the request body includes:

```ts
options: {
  strategy: "by_front",
}
```

Assert the generation function receives:

```ts
expect.objectContaining({
  options: expect.objectContaining({
    strategy: "by_front",
  }),
})
```

- [ ] **Step 3: Run UI/API tests**

Run:

```powershell
npm.cmd run test -- components/budget/work-schedule-page-content.test.tsx app/api/budgets/[id]/work-schedule/route.test.ts
```

Expected: PASS. Existing React `act` warnings can remain if they already existed before this work and do not represent new failures.

- [ ] **Step 4: Commit UI/API connection**

Run:

```powershell
git add components/budget/work-schedule-page-content.tsx components/budget/work-schedule/generation-dialog.tsx components/budget/work-schedule/utils/storage.ts components/budget/work-schedule-page-content.test.tsx app/api/budgets/[id]/work-schedule/route.test.ts
git commit -m "Expose work front schedule generation"
```

---

## Task 8: Final Verification

**Files:**

- No source edits expected unless verification exposes a defect.

**Interfaces:**

- Produces: verified implementation ready for review

- [ ] **Step 1: Check working tree**

Run:

```powershell
git status --short
```

Expected: only the pre-existing `components/budget/gantt/timeline-row.tsx` change may remain if it was not part of this feature. No accidental files from this implementation should remain unstaged.

- [ ] **Step 2: Run scheduler tests**

Run:

```powershell
npm.cmd run test -- lib/work-schedule/intelligent-schedule.test.ts
```

Expected: PASS.

- [ ] **Step 3: Run UI/API tests**

Run:

```powershell
npm.cmd run test -- components/budget/work-schedule-page-content.test.tsx app/api/budgets/[id]/work-schedule/route.test.ts
```

Expected: PASS.

- [ ] **Step 4: Run lint**

Run:

```powershell
npm.cmd run lint
```

Expected: PASS or only pre-existing warnings unrelated to this implementation.

- [ ] **Step 5: Review diff**

Run:

```powershell
git diff --stat
git diff -- lib/work-schedule/intelligent-schedule.ts types/work-schedule.ts lib/validations/work-schedule.ts components/budget/work-schedule-page-content.tsx
```

Expected: diff shows only strategy extension, front scheduling helpers, UI option and tests.

- [ ] **Step 6: Final commit if any verification fixes were needed**

If Task 8 required additional fixes, commit only those files:

```powershell
git add <fixed-files>
git commit -m "Stabilize work front schedule generation"
```

---

## Rollback Plan

If the strategy produces unexpected schedules after release:

- Keep the enum and validation if already stored data may reference `by_front`.
- Hide the UI option temporarily by removing the `<option value="by_front">` entries.
- Keep tests for classifier behavior and mark UI availability as disabled only if product decides to pause the feature.

This avoids breaking existing records while preventing new usage.

## Implementation Notes

- Do not use `any`.
- Do not introduce dependencies.
- Do not call external AI services for classification.
- Keep all classification deterministic and covered by tests.
- Prefer conservative sequencing over aggressive parallelism when a phase is uncertain.
- Keep the existing Gantt manual dependency behavior separate from this generation feature.

