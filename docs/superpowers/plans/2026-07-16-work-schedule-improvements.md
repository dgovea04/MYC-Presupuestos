# Work Schedule Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the work schedule into a real construction control workflow by adding progress tracking, planned-vs-actual Curve S, controlled rescheduling, work-calendar visibility, resource capacity alerts, WBS display and PDF export.

**Architecture:** Keep scheduling, progress, resource and WBS calculations in pure services under `lib/work-schedule` or `lib/calculations`. React components should render and collect user intent only; API/data modules persist validated payloads.

**Tech Stack:** Next.js App Router, TypeScript strict mode, Prisma, Zod, Tailwind CSS, shadcn/ui patterns, lucide-react, Vitest/Testing Library, existing work schedule calculation helpers.

## Global Constraints

- Use TypeScript strict mode.
- Never use `any`.
- Financial calculations must use decimal-safe math.
- Keep calculation logic isolated from UI.
- All formulas must be testable.
- Prefer reusable services.
- Use clean architecture.
- Preserve existing cronograma views: overview, valuation calendar, resource calendar and Curve S.
- Do not replace project architecture.
- Do not simplify financial formulas.
- Do not overwrite unrelated user changes currently present in the worktree.

---

## File Map

- Modify `components/budget/work-schedule/types.ts`: make `EditableLine` the single source for editable schedule rows.
- Modify `components/budget/work-schedule/overview-view.tsx`: remove local duplicate `EditableLine`, add progress columns and real-date controls.
- Modify `components/budget/work-schedule/utils/edit-helpers.ts`: serialize real progress fields and preserve them during preview/recalculation.
- Modify `components/budget/work-schedule/utils/edit-helpers.test.ts`: cover real progress serialization and preview preservation.
- Modify `components/budget/work-schedule-page-content.tsx`: wire save flow, reschedule preview, new panels and view data.
- Modify `components/budget/work-schedule-page-content.test.tsx`: cover progress editing, reschedule confirmation and UI payloads.
- Modify `components/budget/gantt/gantt-bar.tsx`: ensure progress overlay is visible and accessible.
- Modify `components/budget/gantt/timeline-row.tsx`: ensure row-level progress and non-working-day layers render consistently.
- Create `lib/work-schedule/progress.ts`: planned-vs-real progress and deviation helpers.
- Create `lib/work-schedule/progress.test.ts`.
- Create `lib/work-schedule/curve-s.ts`: planned and actual Curve S series helpers.
- Create `lib/work-schedule/curve-s.test.ts`.
- Create `lib/work-schedule/rescheduling.ts`: impact preview helpers around dependency recalculation.
- Create `lib/work-schedule/rescheduling.test.ts`.
- Create `components/budget/work-schedule/reschedule-preview-dialog.tsx`: confirmation dialog for affected dependents.
- Create `lib/work-schedule/resource-capacity.ts`: capacity and over-allocation helpers.
- Create `lib/work-schedule/resource-capacity.test.ts`.
- Create `components/budget/work-schedule/resource-capacity-panel.tsx`: histogram and alerts.
- Create `lib/work-schedule/wbs.ts`: WBS code generation.
- Create `lib/work-schedule/wbs.test.ts`.
- Create `components/budget/work-schedule/schedule-deviation-panel.tsx`: summary of delays and risks.
- Create `components/budget/work-schedule/lookahead-view.tsx`: 2/4/6-week operational lookahead.
- Modify `app/api/budgets/[id]/work-schedule/curve-s/route.ts`: include actual series.
- Modify `app/api/budgets/[id]/work-schedule/curve-s/route.test.ts`.
- Create optional `app/api/budgets/[id]/work-schedule/deviations/route.ts`.
- Create optional `app/api/budgets/[id]/work-schedule/export/pdf/route.ts`.

---

## Task 1: Unify Editable Line And Restore Real Progress Persistence

**Files:**

- Modify: `components/budget/work-schedule/types.ts`
- Modify: `components/budget/work-schedule/overview-view.tsx`
- Modify: `components/budget/work-schedule/utils/edit-helpers.ts`
- Modify: `components/budget/work-schedule/utils/edit-helpers.test.ts`

**Interfaces:**

- Produces: `EditableLine` exported only from `components/budget/work-schedule/types.ts`
- Produces: `serializeEditableLine(line, rowNumberToItemCode)` includes `actualStartDate`, `actualEndDate`, `percentComplete`

- [ ] **Step 1: Move the full editable type to `types.ts`**

Ensure `components/budget/work-schedule/types.ts` exports:

```ts
export type EditableLine = {
  budgetItemId: string;
  description: string;
  quantity: number;
  performance: number | null;
  startDate: string;
  endDate: string;
  durationDays: number;
  predecessor: string;
  crew: string;
  monthlyDistributions: WorkScheduleMonthlyDistributionRecord[];
  isMilestone: boolean;
  baselineStartDate: string | null;
  baselineEndDate: string | null;
  actualStartDate: string | null;
  actualEndDate: string | null;
  percentComplete: number | null;
};
```

- [ ] **Step 2: Remove the local duplicate in overview**

In `components/budget/work-schedule/overview-view.tsx`, delete the local `type EditableLine = ...` and import:

```ts
import type { EditableLine, VisibleTimelineLinePosition } from "./types";
```

- [ ] **Step 3: Write failing serialization test**

In `components/budget/work-schedule/utils/edit-helpers.test.ts`, add:

```ts
it("serializes actual progress fields for persistence", () => {
  const line = createEditableLine(createLine({
    actualStartDate: "2026-08-01",
    actualEndDate: "2026-08-10",
    percentComplete: 75,
  }));

  const payload = serializeEditableLine(line);

  expect(payload.actualStartDate).toBe("2026-08-01");
  expect(payload.actualEndDate).toBe("2026-08-10");
  expect(payload.percentComplete).toBe(75);
});
```

- [ ] **Step 4: Implement serialization**

In `serializeEditableLine`, include:

```ts
actualStartDate: line.actualStartDate || null,
actualEndDate: line.actualEndDate || null,
percentComplete: line.percentComplete,
```

Remove the comment that says progress fields are temporarily omitted.

- [ ] **Step 5: Preserve progress in predecessor bridge**

When `updateEditableLinePredecessor` builds `asWorkScheduleRecord`, include:

```ts
actualStartDate: line.actualStartDate,
actualEndDate: line.actualEndDate,
percentComplete: line.percentComplete,
```

- [ ] **Step 6: Run tests**

Run:

```powershell
npm.cmd run test -- components/budget/work-schedule/utils/edit-helpers.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

Run:

```powershell
git add components/budget/work-schedule/types.ts components/budget/work-schedule/overview-view.tsx components/budget/work-schedule/utils/edit-helpers.ts components/budget/work-schedule/utils/edit-helpers.test.ts
git commit -m "Restore work schedule progress persistence"
```

---

## Task 2: Add Progress Columns And Editor Fields

**Files:**

- Modify: `components/budget/work-schedule/overview-view.tsx`
- Modify: `components/budget/work-schedule-page-content.tsx`
- Modify: `components/budget/work-schedule-page-content.test.tsx`

**Interfaces:**

- Consumes: `EditableLine.actualStartDate`, `EditableLine.actualEndDate`, `EditableLine.percentComplete`
- Produces: editable UI controls for real progress

- [ ] **Step 1: Add column widths**

Extend `OVERVIEW_TABLE_COLUMN_WIDTHS`:

```ts
actualStart: 118,
actualEnd: 118,
progress: 88,
```

- [ ] **Step 2: Add table headers**

In the overview table header, add compact columns:

```tsx
<TH style={{ width: OVERVIEW_TABLE_COLUMN_WIDTHS.progress }}>%</TH>
<TH style={{ width: OVERVIEW_TABLE_COLUMN_WIDTHS.actualStart }}>Inicio real</TH>
<TH style={{ width: OVERVIEW_TABLE_COLUMN_WIDTHS.actualEnd }}>Fin real</TH>
```

- [ ] **Step 3: Add inline cells**

For active editable rows, render:

```tsx
<Input
  type="number"
  min={0}
  max={100}
  value={draft.percentComplete ?? ""}
  onChange={(event) =>
    onInlineDraftChange(row.rowId, {
      ...draft,
      percentComplete: event.target.value === "" ? null : Number(event.target.value),
    })
  }
/>
<Input
  type="date"
  value={draft.actualStartDate ?? ""}
  onChange={(event) => onInlineDraftChange(row.rowId, { ...draft, actualStartDate: event.target.value || null })}
/>
<Input
  type="date"
  value={draft.actualEndDate ?? ""}
  onChange={(event) => onInlineDraftChange(row.rowId, { ...draft, actualEndDate: event.target.value || null })}
/>
```

- [ ] **Step 4: Add read-only display cells**

For non-editing rows, render:

```tsx
<TD>{line.percentComplete == null ? "-" : `${formatNumber(line.percentComplete, 2)}%`}</TD>
<TD>{line.actualStartDate ? formatDate(line.actualStartDate, dateFormat) : "-"}</TD>
<TD>{line.actualEndDate ? formatDate(line.actualEndDate, dateFormat) : "-"}</TD>
```

- [ ] **Step 5: Add validation before save**

In the inline save path, reject:

```ts
percentComplete != null && (percentComplete < 0 || percentComplete > 100)
```

and:

```ts
actualStartDate && actualEndDate && actualStartDate > actualEndDate
```

Use Spanish messages:

```text
El avance debe estar entre 0 y 100.
El inicio real no puede ser posterior al fin real.
```

- [ ] **Step 6: Add UI test**

In `components/budget/work-schedule-page-content.test.tsx`, add a test that edits progress and expects the PATCH body to contain:

```json
{
  "actualStartDate": "2026-08-01",
  "actualEndDate": "2026-08-10",
  "percentComplete": 60
}
```

- [ ] **Step 7: Run tests**

Run:

```powershell
npm.cmd run test -- components/budget/work-schedule-page-content.test.tsx
```

Expected: PASS.

---

## Task 3: Harden Gantt Progress Overlay

**Files:**

- Modify: `components/budget/gantt/gantt-bar.tsx`
- Modify: `components/budget/gantt/timeline-row.tsx`

**Interfaces:**

- Consumes: `line.percentComplete`
- Produces: visible progress overlay and accessible tooltip data

- [ ] **Step 1: Confirm progress clamp**

Both Gantt components should clamp progress:

```ts
const progressPercent = line.percentComplete != null ? Math.min(100, Math.max(0, line.percentComplete)) : null;
```

- [ ] **Step 2: Render overlay only when progress exists**

Use a child element with width:

```tsx
style={{ width: `${progressPercent}%` }}
```

and a class consistent with current design, such as:

```text
bg-emerald-500/70
```

- [ ] **Step 3: Add accessible label**

The bar label should include:

```ts
percentComplete == null ? "Sin avance real" : `Avance real ${percentComplete}%`
```

- [ ] **Step 4: Run focused tests**

Run:

```powershell
npm.cmd run test -- components/budget/work-schedule-page-content.test.tsx
```

Expected: PASS.

---

## Task 4: Build Progress And Deviation Service

**Files:**

- Create: `lib/work-schedule/progress.ts`
- Create: `lib/work-schedule/progress.test.ts`

**Interfaces:**

- Produces:

```ts
export type WorkScheduleProgressStatus = "ahead" | "on_track" | "behind" | "not_started";

export type WorkScheduleProgressSummary = {
  plannedPercent: number;
  actualPercent: number;
  variancePoints: number;
  status: WorkScheduleProgressStatus;
};

export function calculateWorkScheduleProgressSummary(args: {
  lines: WorkScheduleLineRecord[];
  asOfDate: string;
}): WorkScheduleProgressSummary;
```

- [ ] **Step 1: Write tests**

Create tests for:

- no lines returns zero summary;
- completed line returns actual progress;
- partial line uses `partial * percentComplete / 100`;
- behind status when actual is more than 5 points under planned;
- ahead status when actual is more than 5 points above planned.

- [ ] **Step 2: Implement decimal-safe weighted progress**

Use existing decimal helper patterns if present. Do not use floating-point accumulation for money-sensitive values. Convert final display result to number only at boundaries.

- [ ] **Step 3: Run tests**

Run:

```powershell
npm.cmd run test -- lib/work-schedule/progress.test.ts
```

Expected: PASS.

---

## Task 5: Add Planned Vs Actual Curve S

**Files:**

- Create: `lib/work-schedule/curve-s.ts`
- Create: `lib/work-schedule/curve-s.test.ts`
- Modify: `app/api/budgets/[id]/work-schedule/curve-s/route.ts`
- Modify: `app/api/budgets/[id]/work-schedule/curve-s/route.test.ts`
- Modify: `components/budget/work-schedule-page-content.tsx`

**Interfaces:**

- Produces:

```ts
export type WorkScheduleCurvePoint = {
  period: string;
  plannedPercent: number;
  actualPercent: number;
};

export function buildPlannedVsActualCurveSeries(args: {
  lines: WorkScheduleLineRecord[];
  periods: { year: number; month: number }[];
}): WorkScheduleCurvePoint[];
```

- [ ] **Step 1: Write curve tests**

Cover:

- empty lines;
- a complete single-month line;
- a partial line with `percentComplete = 50`;
- multi-month distributions;
- missing distributions fallback.

- [ ] **Step 2: Implement helper**

Use existing monthly distribution rules. Planned series should preserve current behavior; actual series should multiply each line contribution by `percentComplete / 100`.

- [ ] **Step 3: Extend API response**

Add `actualPercent` alongside current planned point shape. Keep backward compatibility by leaving existing planned keys intact if consumers depend on them.

- [ ] **Step 4: Update UI chart**

Render two series:

- `Programado`
- `Real`

Use subdued blue for planned and green for real.

- [ ] **Step 5: Run tests**

Run:

```powershell
npm.cmd run test -- lib/work-schedule/curve-s.test.ts app/api/budgets/[id]/work-schedule/curve-s/route.test.ts components/budget/work-schedule-page-content.test.tsx
```

Expected: PASS.

---

## Task 6: Add Controlled Rescheduling Preview

**Files:**

- Create: `lib/work-schedule/rescheduling.ts`
- Create: `lib/work-schedule/rescheduling.test.ts`
- Create: `components/budget/work-schedule/reschedule-preview-dialog.tsx`
- Modify: `components/budget/work-schedule-page-content.tsx`
- Modify: `components/budget/work-schedule-page-content.test.tsx`

**Interfaces:**

- Produces:

```ts
export type WorkScheduleRescheduleImpact = {
  budgetItemId: string;
  itemCode: string;
  description: string;
  previousStartDate: string | null;
  previousEndDate: string | null;
  nextStartDate: string | null;
  nextEndDate: string | null;
  deltaDays: number;
  isCritical: boolean;
};

export function buildWorkScheduleReschedulePreview(args: {
  lines: WorkScheduleLineRecord[];
  changedBudgetItemId: string;
  workDaysBitmask?: number;
}): WorkScheduleRescheduleImpact[];
```

- [ ] **Step 1: Write rescheduling tests**

Cover:

- no dependents returns empty impacts;
- FS dependent moves after predecessor end;
- unchanged dependent is omitted;
- critical dependent marks `isCritical = true`.

- [ ] **Step 2: Implement preview helper**

Call `recalculateDependentWorkScheduleLines`, compare old and new dates, and return only changed dependents.

- [ ] **Step 3: Add dialog**

Dialog content:

- title: `Reprogramacion detectada`
- table: partida, inicio anterior, nuevo inicio, fin anterior, nuevo fin, variacion
- actions: `Aplicar reprogramacion`, `Guardar solo esta partida`, `Cancelar`

- [ ] **Step 4: Wire save flow**

When an edit has impacts:

- open dialog;
- apply selected action;
- persist either one line or all affected lines.

- [ ] **Step 5: Add tests**

Test:

- preview appears after changing predecessor date;
- `Guardar solo esta partida` sends one PATCH;
- `Aplicar reprogramacion` sends changed dependents too.

- [ ] **Step 6: Run tests**

Run:

```powershell
npm.cmd run test -- lib/work-schedule/rescheduling.test.ts components/budget/work-schedule-page-content.test.tsx
```

Expected: PASS.

---

## Task 7: Add Work Calendar Visualization

**Files:**

- Modify: `components/budget/gantt/timeline-row.tsx`
- Modify: `components/budget/work-schedule/overview-view.tsx`
- Modify: `lib/work-schedule/calendar.ts`
- Modify: existing calendar tests or create `lib/work-schedule/calendar.test.ts`

**Interfaces:**

- Consumes: current `workCalendar`, work-day bitmask and exception map
- Produces: non-working-day shading in timeline

- [ ] **Step 1: Add pure helper**

Create or expose:

```ts
export function isNonWorkingDate(args: {
  isoDate: string;
  workDaysBitmask?: number;
  exceptionMap?: CalendarExceptionMap;
}): boolean;
```

- [ ] **Step 2: Add tests**

Cover Saturday/Sunday and an explicit holiday exception.

- [ ] **Step 3: Render day background**

In timeline cells, apply a soft background for non-working days:

```text
bg-slate-100/70
```

- [ ] **Step 4: Add legend**

In overview toolbar or timeline header, add compact legend:

```text
No laborable
```

- [ ] **Step 5: Run tests**

Run:

```powershell
npm.cmd run test -- lib/work-schedule/calendar.test.ts components/budget/work-schedule-page-content.test.tsx
```

Expected: PASS.

---

## Task 8: Add Resource Capacity Alerts

**Files:**

- Create: `lib/work-schedule/resource-capacity.ts`
- Create: `lib/work-schedule/resource-capacity.test.ts`
- Create: `components/budget/work-schedule/resource-capacity-panel.tsx`
- Modify: `components/budget/work-schedule-page-content.tsx`

**Interfaces:**

- Produces:

```ts
export type ResourceCapacityLimit = {
  resourceId: string;
  periodKey: string;
  quantityCapacity: number;
};

export type ResourceOverallocation = {
  resourceId: string;
  resourceName: string;
  periodKey: string;
  demandQuantity: number;
  capacityQuantity: number;
  excessQuantity: number;
};

export function detectResourceOverallocations(args: {
  resourceCalendar: WorkScheduleResourceCalendarRecord;
  limits: ResourceCapacityLimit[];
}): ResourceOverallocation[];
```

- [ ] **Step 1: Write tests**

Cover:

- demand under capacity returns no alerts;
- demand equal capacity returns no alerts;
- demand over capacity returns excess;
- missing capacity is ignored.

- [ ] **Step 2: Implement helper**

Use decimal-safe math where quantities may affect financial/resource reporting.

- [ ] **Step 3: Build panel**

Panel features:

- filter `Todos` / `Solo sobreasignados`;
- rows grouped by resource family;
- period, demand, capacity, excess.

- [ ] **Step 4: Wire into resource calendar view**

Show panel above or beside existing calendar without replacing the table.

- [ ] **Step 5: Run tests**

Run:

```powershell
npm.cmd run test -- lib/work-schedule/resource-capacity.test.ts components/budget/work-schedule-page-content.test.tsx
```

Expected: PASS.

---

## Task 9: Add WBS Code Generation

**Files:**

- Create: `lib/work-schedule/wbs.ts`
- Create: `lib/work-schedule/wbs.test.ts`
- Modify: `components/budget/work-schedule/overview-view.tsx`

**Interfaces:**

- Produces:

```ts
export type WorkScheduleWbsNode = {
  id: string;
  parentId: string | null;
  sortOrder: number;
};

export function buildWbsCodeByNodeId(nodes: WorkScheduleWbsNode[]): Map<string, string>;
```

- [ ] **Step 1: Write tests**

Cover:

- root nodes get `1`, `2`;
- children get `1.1`, `1.2`;
- grandchildren get `1.2.1`;
- stable sort by `sortOrder`.

- [ ] **Step 2: Implement helper**

Do not mutate input nodes.

- [ ] **Step 3: Show WBS column**

Add optional compact WBS column near item code:

```tsx
<TH>WBS</TH>
<TD>{wbsCodeByLevelId.get(line.levelId ?? "") ?? "-"}</TD>
```

- [ ] **Step 4: Run tests**

Run:

```powershell
npm.cmd run test -- lib/work-schedule/wbs.test.ts components/budget/work-schedule-page-content.test.tsx
```

Expected: PASS.

---

## Task 10: Add Deviation Panel And Lookahead View

**Files:**

- Create: `components/budget/work-schedule/schedule-deviation-panel.tsx`
- Create: `components/budget/work-schedule/lookahead-view.tsx`
- Modify: `lib/work-schedule/progress.ts`
- Modify: `lib/work-schedule/progress.test.ts`
- Modify: `components/budget/work-schedule-page-content.tsx`

**Interfaces:**

- Produces deviation categories:

```ts
type WorkScheduleDeviationKind =
  | "late"
  | "ahead"
  | "missing_actual_progress"
  | "critical_low_progress"
  | "baseline_variance";
```

- [ ] **Step 1: Add deviation helper tests**

Cover all deviation categories.

- [ ] **Step 2: Implement deviation helper**

Export:

```ts
export function detectWorkScheduleDeviations(args: {
  lines: WorkScheduleLineRecord[];
  asOfDate: string;
}): WorkScheduleDeviation[];
```

- [ ] **Step 3: Build deviation panel**

Use compact cards or rows:

- atrasadas;
- adelantadas;
- sin avance;
- criticas con bajo avance;
- variacion contra baseline.

- [ ] **Step 4: Build lookahead view**

Support 2, 4 and 6 week ranges. Show start/finish candidates and predecessor risks.

- [ ] **Step 5: Run tests**

Run:

```powershell
npm.cmd run test -- lib/work-schedule/progress.test.ts components/budget/work-schedule-page-content.test.tsx
```

Expected: PASS.

---

## Task 11: Add Executive PDF Export

**Files:**

- Create: `lib/work-schedule/pdf-export.ts`
- Create: `lib/work-schedule/pdf-export.test.ts`
- Create: `app/api/budgets/[id]/work-schedule/export/pdf/route.ts`
- Create: `app/api/budgets/[id]/work-schedule/export/pdf/route.test.ts`
- Modify: `components/budget/work-schedule-page-content.tsx`

**Interfaces:**

- Produces:

```ts
export type WorkSchedulePdfExportPayload = {
  projectName: string;
  budgetName: string;
  currency: string;
  generatedAt: string;
  summary: WorkScheduleProgressSummary;
  curve: WorkScheduleCurvePoint[];
  deviations: WorkScheduleDeviation[];
};
```

- [ ] **Step 1: Decide PDF implementation**

Prefer an existing server-side PDF utility if the project already has one. If none exists, start with a deterministic HTML-to-PDF or tabular PDF approach after checking existing dependencies.

- [ ] **Step 2: Build export payload tests**

Test payload generation separately from binary PDF rendering.

- [ ] **Step 3: Add API route**

Route should:

- authorize budget access using existing route patterns;
- load schedule view;
- build payload;
- return `application/pdf`.

- [ ] **Step 4: Add UI action**

Add an export action in `ExportPanel` or the centralized export area:

```text
PDF ejecutivo
```

- [ ] **Step 5: Run tests**

Run:

```powershell
npm.cmd run test -- lib/work-schedule/pdf-export.test.ts app/api/budgets/[id]/work-schedule/export/pdf/route.test.ts
```

Expected: PASS.

---

## Task 12: Final Verification

**Files:**

- No source edits expected unless verification exposes a defect.

**Interfaces:**

- Produces: verified implementation ready for review

- [ ] **Step 1: Run focused work schedule tests**

Run:

```powershell
npm.cmd run test -- lib/calculations/work-schedule.test.ts lib/work-schedule/progress.test.ts lib/work-schedule/curve-s.test.ts lib/work-schedule/rescheduling.test.ts lib/work-schedule/resource-capacity.test.ts lib/work-schedule/wbs.test.ts components/budget/work-schedule-page-content.test.tsx
```

Expected: PASS.

- [ ] **Step 2: Run existing financial calculation tests**

Run:

```powershell
npm.cmd run test -- lib/calculations/budget.test.ts lib/calculations/apu.test.ts lib/calculations/polynomial-formula.test.ts
```

Expected: PASS.

- [ ] **Step 3: Run lint**

Run:

```powershell
npm.cmd run lint
```

Expected: PASS.

- [ ] **Step 4: Review diff**

Run:

```powershell
git diff --stat
git diff -- components/budget/work-schedule lib/work-schedule app/api/budgets
```

Expected: changes are limited to work schedule improvements and tests.

- [ ] **Step 5: Commit final implementation**

Run:

```powershell
git add components/budget/work-schedule components/budget/gantt lib/work-schedule app/api/budgets
git commit -m "Improve work schedule control workflow"
```

---

## Recommended Execution Order

1. Task 1 and Task 2 first, because progress fields already exist and unlock immediate value.
2. Task 3 to make Gantt progress trustworthy.
3. Task 4 and Task 5 to add actual progress analytics.
4. Task 6 to make dependency edits safer.
5. Task 7 and Task 8 to improve construction realism.
6. Task 9, Task 10 and Task 11 as reporting and management layers.

## Rollback Plan

- If progress editing causes issues, hide the UI columns but keep persisted fields.
- If Curva S actual is disputed, keep planned series as default and mark real series as beta.
- If reprogramacion preview is too noisy, keep `Guardar solo esta partida` as default action.
- If PDF export is unstable, keep CSV/XLSX exports unchanged and disable the PDF button.
- No migration rollback should be necessary for phases that only use existing progress fields.
