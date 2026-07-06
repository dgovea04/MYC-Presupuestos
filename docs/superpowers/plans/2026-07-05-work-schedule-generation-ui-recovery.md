# Work Schedule Generation UI Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore the intelligent schedule generation configuration UI so users can choose level linkage, parallelism, and advanced options that are already supported by the generation engine.

**Architecture:** Keep the existing generation engine and route contract intact, and restore only the missing presentation/state layer in the schedule generation dialog. The UI will build a typed `options` payload from persisted dialog state, send it to the existing `POST /api/budgets/[id]/work-schedule` route, and render a tree preview based on existing `group.rows` level entries.

**Tech Stack:** Next.js App Router, React, TypeScript strict mode, Vitest, Testing Library, Tailwind, Radix Dialog

---

### Task 1: Cover the missing dialog behaviors with failing tests

**Files:**
- Modify: `components/budget/work-schedule-page-content.test.tsx`
- Modify: `app/api/budgets/[id]/work-schedule/route.test.ts`

- [ ] **Step 1: Write failing UI tests for level preview controls**

```tsx
it("'Todo paralelo' sets all level toggles to parallel in the generation dialog tree preview", async () => {
  window.localStorage.setItem("work-schedule-generation-strategy:budget-1", "sequential");
  window.localStorage.removeItem("work-schedule-generation-level-linkage:budget-1");

  const { clickByText, getByText } = await renderWithView(createViewWithLevels(), createSettings());

  await act(async () => {
    clickByText("Generar cronograma inteligente");
  });

  expect(getByText("Previsualizacion de niveles")).toBeTruthy();
  expect(getByText("Estructuras")).toBeTruthy();
});
```

- [ ] **Step 2: Run the focused component test to verify it fails**

Run: `npm run test -- components/budget/work-schedule-page-content.test.tsx`
Expected: FAIL because the generation dialog does not render the tree preview or bulk linkage controls yet.

- [ ] **Step 3: Write failing route/component payload tests for generation options**

```tsx
expect(global.fetch).toHaveBeenCalledWith(
  "/api/budgets/budget-1/work-schedule",
  expect.objectContaining({
    method: "POST",
    body: expect.stringContaining("\"options\""),
  }),
);
```

```ts
const payload = {
  baseStartDate: "2026-06-01",
  options: {
    strategy: "by_level",
    interSubBudgetParallelism: "parallel",
  },
};
```

- [ ] **Step 4: Run the route test to verify it fails**

Run: `npm run test -- app/api/budgets/[id]/work-schedule/route.test.ts`
Expected: FAIL until the tests and UI agree on the `options` payload shape.

- [ ] **Step 5: Commit**

```bash
git add components/budget/work-schedule-page-content.test.tsx app/api/budgets/[id]/work-schedule/route.test.ts
git commit -m "test: cover intelligent schedule generation options"
```

### Task 2: Restore dialog state, persistence, and payload building

**Files:**
- Modify: `components/budget/work-schedule-page-content.tsx`
- Modify: `types/work-schedule.ts`

- [ ] **Step 1: Add typed dialog state and persistence helpers**

```ts
type WorkScheduleGenerationFormState = {
  strategy: WorkScheduleGenerationStrategy;
  interSubBudgetParallelism: InterSubBudgetParallelism;
  interSubBudgetStaggerDays: string;
  maxDurationDays: string;
  similarityLagDays: string;
  levelLinkage: Record<string, LevelLinkageMode>;
};
```

- [ ] **Step 2: Run the component test to keep it red while helpers are incomplete**

Run: `npm run test -- components/budget/work-schedule-page-content.test.tsx`
Expected: FAIL because UI controls still do not render.

- [ ] **Step 3: Implement minimal form state wiring and POST payload serialization**

```ts
body: JSON.stringify({
  baseStartDate: generationBaseDate,
  options: buildGenerationOptionsPayload(generationFormState),
}),
```

- [ ] **Step 4: Run the component and route tests to verify the new payload passes**

Run: `npm run test -- components/budget/work-schedule-page-content.test.tsx app/api/budgets/[id]/work-schedule/route.test.ts`
Expected: dialog payload assertions pass; tree-preview assertions may still fail until Task 3 completes.

- [ ] **Step 5: Commit**

```bash
git add components/budget/work-schedule-page-content.tsx types/work-schedule.ts
git commit -m "feat: persist intelligent schedule generation options"
```

### Task 3: Rebuild the level preview and advanced controls in the dialog

**Files:**
- Modify: `components/budget/work-schedule-page-content.tsx`

- [ ] **Step 1: Render the failing tree preview controls**

```tsx
<div>
  <div className="flex gap-2">
    <Button type="button" variant="outline" onClick={handleSetAllLevelLinkageParallel}>Todo paralelo</Button>
    <Button type="button" variant="outline" onClick={handleSetAllLevelLinkageChain}>Todo encadenar</Button>
  </div>
  <p className="text-sm font-semibold">Previsualizacion de niveles</p>
</div>
```

- [ ] **Step 2: Run the component test to verify the first preview test turns green**

Run: `npm run test -- components/budget/work-schedule-page-content.test.tsx`
Expected: bulk toggle and collapse tests now pass.

- [ ] **Step 3: Add the advanced controls without widening scope**

```tsx
<Field label="Estrategia base">{/* strategy select */}</Field>
<Field label="Especialidades">{/* parallelism select */}</Field>
<Field label="Duracion maxima (dias)">{/* numeric input */}</Field>
<Field label="Separacion por similitud (dias)">{/* numeric input */}</Field>
```

- [ ] **Step 4: Run the full focused suite again**

Run: `npm run test -- components/budget/work-schedule-page-content.test.tsx app/api/budgets/[id]/work-schedule/route.test.ts`
Expected: PASS for all generation-dialog and route coverage.

- [ ] **Step 5: Commit**

```bash
git add components/budget/work-schedule-page-content.tsx
git commit -m "feat: restore intelligent schedule generation dialog controls"
```

### Task 4: Verify the end-to-end recovery evidence

**Files:**
- Modify: `components/budget/work-schedule-page-content.test.tsx`
- Modify: `app/api/budgets/[id]/work-schedule/route.test.ts`

- [ ] **Step 1: Run the focused tests fresh**

Run: `npm run test -- components/budget/work-schedule-page-content.test.tsx app/api/budgets/[id]/work-schedule/route.test.ts`
Expected: PASS with zero failing tests in those files.

- [ ] **Step 2: Run lint on the touched files through the project command**

Run: `npm run lint`
Expected: PASS with no new lint errors from the restored dialog code.

- [ ] **Step 3: Review the final diff for unintended changes**

Run: `git diff -- components/budget/work-schedule-page-content.tsx components/budget/work-schedule-page-content.test.tsx app/api/budgets/[id]/work-schedule/route.test.ts types/work-schedule.ts`
Expected: only intelligent-generation UI, tests, and typed option helpers changed.

- [ ] **Step 4: Commit**

```bash
git add components/budget/work-schedule-page-content.tsx components/budget/work-schedule-page-content.test.tsx app/api/budgets/[id]/work-schedule/route.test.ts types/work-schedule.ts docs/superpowers/plans/2026-07-05-work-schedule-generation-ui-recovery.md
git commit -m "feat: recover intelligent schedule generation controls"
```
