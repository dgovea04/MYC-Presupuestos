# Excel View Mode Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a persisted `modern | excel` visualization mode for the budget/APU flow, including compact spreadsheet-like styling plus first-phase productivity shortcuts, without changing calculation logic.

**Architecture:** Introduce a client-side view-mode provider scoped to the budget flow, persist the selected mode in `localStorage`, expose the mode through a `data-view-mode` signal, and adapt shared UI primitives plus `BudgetEditor` and `ApuEditorSheet` to respond to that signal. Keep financial logic isolated and unchanged.

**Tech Stack:** Next.js 16, React 19, TypeScript strict mode, Tailwind CSS 4, Vitest

---

## File Structure

### Create

- `components/budget/view-mode-provider.tsx`
- `components/budget/view-mode-toggle.tsx`
- `lib/budget/view-mode.ts`
- `lib/budget/view-mode.test.ts`

### Modify

- `app/budgets/[id]/page.tsx`
- `components/budget/budget-editor.tsx`
- `components/apu/apu-editor-sheet.tsx`
- `components/ui/table.tsx`
- `components/ui/input.tsx`
- `components/ui/select.tsx`
- `components/ui/button.tsx`
- `components/ui/card.tsx`
- `app/globals.css`

### Test

- `lib/budget/view-mode.test.ts`
- targeted editor/UI verification through `npm run lint` and `npm run test`

---

### Task 1: Build View-Mode Domain Utilities And Provider

**Files:**
- Create: `lib/budget/view-mode.ts`
- Create: `lib/budget/view-mode.test.ts`
- Create: `components/budget/view-mode-provider.tsx`

- [ ] **Step 1: Write the failing tests for persistence helpers**

```ts
import { describe, expect, it } from "vitest";
import {
  APP_VIEW_MODE_STORAGE_KEY,
  coerceViewMode,
  getStoredViewModeFromValue,
} from "@/lib/budget/view-mode";

describe("view mode helpers", () => {
  it("accepts only modern and excel", () => {
    expect(coerceViewMode("modern")).toBe("modern");
    expect(coerceViewMode("excel")).toBe("excel");
    expect(coerceViewMode("dense")).toBe("modern");
  });

  it("reads a stored value safely", () => {
    expect(getStoredViewModeFromValue("excel")).toBe("excel");
    expect(getStoredViewModeFromValue("invalid")).toBe("modern");
    expect(APP_VIEW_MODE_STORAGE_KEY).toBe("app_view_mode");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm.cmd run test -- lib/budget/view-mode.test.ts`

Expected: FAIL with module-not-found or missing export errors for `@/lib/budget/view-mode`

- [ ] **Step 3: Write the minimal domain utility module**

```ts
export const APP_VIEW_MODE_STORAGE_KEY = "app_view_mode" as const;

export type ViewMode = "modern" | "excel";

export function coerceViewMode(value: string | null | undefined): ViewMode {
  return value === "excel" ? "excel" : "modern";
}

export function getStoredViewModeFromValue(value: string | null | undefined): ViewMode {
  return coerceViewMode(value);
}

export function readStoredViewMode(storage: Pick<Storage, "getItem">): ViewMode {
  return getStoredViewModeFromValue(storage.getItem(APP_VIEW_MODE_STORAGE_KEY));
}

export function writeStoredViewMode(storage: Pick<Storage, "setItem">, mode: ViewMode) {
  storage.setItem(APP_VIEW_MODE_STORAGE_KEY, mode);
}
```

- [ ] **Step 4: Add the provider with localStorage-backed state**

```tsx
"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  coerceViewMode,
  readStoredViewMode,
  writeStoredViewMode,
  type ViewMode,
} from "@/lib/budget/view-mode";

type ViewModeContextValue = {
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  isExcelMode: boolean;
};

const ViewModeContext = createContext<ViewModeContextValue | null>(null);

export function BudgetViewModeProvider({ children }: { children: ReactNode }) {
  const [viewMode, setViewModeState] = useState<ViewMode>("modern");

  useEffect(() => {
    try {
      setViewModeState(readStoredViewMode(window.localStorage));
    } catch {
      setViewModeState("modern");
    }
  }, []);

  function setViewMode(mode: ViewMode) {
    const nextMode = coerceViewMode(mode);
    setViewModeState(nextMode);

    try {
      writeStoredViewMode(window.localStorage, nextMode);
    } catch {}
  }

  const value = useMemo(
    () => ({ viewMode, setViewMode, isExcelMode: viewMode === "excel" }),
    [viewMode],
  );

  return (
    <ViewModeContext.Provider value={value}>
      <div data-view-mode={viewMode}>{children}</div>
    </ViewModeContext.Provider>
  );
}

export function useBudgetViewMode() {
  const context = useContext(ViewModeContext);
  if (!context) {
    throw new Error("useBudgetViewMode must be used within BudgetViewModeProvider");
  }
  return context;
}
```

- [ ] **Step 5: Run tests to verify helpers pass**

Run: `npm.cmd run test -- lib/budget/view-mode.test.ts`

Expected: PASS with 2 tests green for coercion and storage-key behavior

- [ ] **Step 6: Commit**

```bash
git add lib/budget/view-mode.ts lib/budget/view-mode.test.ts components/budget/view-mode-provider.tsx
git commit -m "feat: add budget view mode provider"
```

---

### Task 2: Add Reusable Excel-Mode Styling Hooks To Shared UI Primitives

**Files:**
- Modify: `components/ui/table.tsx`
- Modify: `components/ui/input.tsx`
- Modify: `components/ui/select.tsx`
- Modify: `components/ui/button.tsx`
- Modify: `components/ui/card.tsx`
- Modify: `app/globals.css`

- [ ] **Step 1: Write the failing styling helpers test**

```ts
import { describe, expect, it } from "vitest";
import { getTableModeClassNames, getInputModeClassNames } from "@/lib/budget/view-mode";

describe("view mode class helpers", () => {
  it("returns excel variants for dense spreadsheet styling", () => {
    expect(getTableModeClassNames("excel")).toContain("border-collapse");
    expect(getInputModeClassNames("excel")).toContain("rounded-none");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm.cmd run test -- lib/budget/view-mode.test.ts`

Expected: FAIL because the class helper exports do not exist yet

- [ ] **Step 3: Extend the helper module with reusable class builders**

```ts
export function getTableModeClassNames(mode: ViewMode) {
  return mode === "excel"
    ? "border-collapse [&_th]:border [&_td]:border [&_th]:border-slate-300 [&_td]:border-slate-200"
    : "";
}

export function getInputModeClassNames(mode: ViewMode) {
  return mode === "excel"
    ? "h-8 rounded-none border-slate-300 px-2 text-xs shadow-none"
    : "";
}
```

- [ ] **Step 4: Update shared UI primitives to support `data-view-mode` styling**

```tsx
export function Table({ className, ...props }: React.TableHTMLAttributes<HTMLTableElement>) {
  return (
    <table
      className={cn(
        "w-full caption-bottom text-sm",
        "data-[view-mode=excel]:border-collapse",
        className,
      )}
      {...props}
    />
  );
}
```

```tsx
export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      className={cn(
        "flex h-10 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-sky-500",
        "data-[view-mode=excel]:h-8 data-[view-mode=excel]:rounded-none data-[view-mode=excel]:px-2 data-[view-mode=excel]:text-xs",
        className,
      )}
      {...props}
    />
  );
});
```

```css
[data-view-mode="excel"] {
  --budget-panel-radius: 0.25rem;
  --budget-panel-shadow: 0 0 #0000;
}

[data-view-mode="excel"] .budget-sticky-header {
  position: sticky;
  top: 0;
  z-index: 20;
}
```

- [ ] **Step 5: Run lint and tests after the primitive updates**

Run: `npm.cmd run lint`

Expected: PASS with no new lint errors from UI primitives

Run: `npm.cmd run test -- lib/budget/view-mode.test.ts`

Expected: PASS with helper tests green

- [ ] **Step 6: Commit**

```bash
git add components/ui/table.tsx components/ui/input.tsx components/ui/select.tsx components/ui/button.tsx components/ui/card.tsx app/globals.css lib/budget/view-mode.ts lib/budget/view-mode.test.ts
git commit -m "feat: add reusable excel mode ui variants"
```

---

### Task 3: Integrate The Provider And Add The Budget/APU Toggle Surface

**Files:**
- Create: `components/budget/view-mode-toggle.tsx`
- Modify: `app/budgets/[id]/page.tsx`
- Modify: `components/budget/budget-editor.tsx`

- [ ] **Step 1: Write the toggle component and keep its API tiny**

```tsx
"use client";

import { Button } from "@/components/ui/button";
import { useBudgetViewMode } from "@/components/budget/view-mode-provider";
import { cn } from "@/lib/utils";

export function ViewModeToggle() {
  const { viewMode, setViewMode } = useBudgetViewMode();

  return (
    <div className="inline-flex rounded-lg border border-slate-300 bg-white p-1">
      <Button
        type="button"
        size="sm"
        variant={viewMode === "modern" ? "secondary" : "ghost"}
        onClick={() => setViewMode("modern")}
      >
        Moderna
      </Button>
      <Button
        type="button"
        size="sm"
        variant={viewMode === "excel" ? "secondary" : "ghost"}
        onClick={() => setViewMode("excel")}
      >
        Tipo Excel
      </Button>
    </div>
  );
}
```

- [ ] **Step 2: Wrap the budget flow with the provider**

```tsx
import { BudgetViewModeProvider } from "@/components/budget/view-mode-provider";

return (
  <AppShell>
    <BudgetViewModeProvider>
      <BudgetEditor
        budget={budget}
        projectName={project.name}
        partidasCatalog={partidasCatalog}
        resourcesCatalog={resourcesCatalog}
      />
    </BudgetViewModeProvider>
  </AppShell>
);
```

- [ ] **Step 3: Add the toggle to the budget editor toolbar**

```tsx
import { ViewModeToggle } from "@/components/budget/view-mode-toggle";
import { useBudgetViewMode } from "@/components/budget/view-mode-provider";

const { viewMode, isExcelMode } = useBudgetViewMode();

<div className="flex flex-wrap items-center gap-2">
  <ViewModeToggle />
  <span className="text-xs text-slate-500">
    {isExcelMode ? "Modo Excel activo" : "Vista moderna activa"}
  </span>
</div>
```

- [ ] **Step 4: Apply mode-aware wrappers in the editor root**

```tsx
<div
  className={cn(
    "space-y-5",
    isExcelMode ? "budget-excel-flow" : "budget-modern-flow",
  )}
  data-view-mode={viewMode}
>
  {/* existing editor layout */}
</div>
```

- [ ] **Step 5: Run lint to verify the new provider/toggle integration**

Run: `npm.cmd run lint`

Expected: PASS with the budget page, toggle, and editor compiling cleanly

- [ ] **Step 6: Commit**

```bash
git add app/budgets/[id]/page.tsx components/budget/budget-editor.tsx components/budget/view-mode-toggle.tsx
git commit -m "feat: integrate excel view mode into budget flow"
```

---

### Task 4: Implement BudgetEditor Excel Mode And Keyboard Productivity Additions

**Files:**
- Modify: `components/budget/budget-editor.tsx`

- [ ] **Step 1: Add the failing keyboard/productivity assertions as comments or checklist in the editor test pass**

```ts
// Verification targets for manual-plus-lint pass:
// 1. Ctrl/Cmd + S still saves
// 2. Alt + ArrowUp/ArrowDown still reorders active rows
// 3. Ctrl/Cmd + Enter opens the selected item's APU
// 4. Sticky table header renders in excel mode
```

- [ ] **Step 2: Add the new shortcut for opening APU from the active item**

```tsx
if (commandOrCtrl && event.key === "Enter" && activeRowId) {
  const activeItem = summary.items.find((item) => item.id === activeRowId);
  if (activeItem) {
    event.preventDefault();
    setSelectedItemId(activeItem.id);
    return;
  }
}
```

- [ ] **Step 3: Make the main table and sticky headers mode-aware**

```tsx
<div className={cn("overflow-auto rounded-2xl border border-slate-200", isExcelMode && "rounded-md border-slate-300")}>
  <Table className={cn("table-fixed min-w-[1100px] w-full", isExcelMode && "[&_td]:px-2 [&_th]:px-2")}>
    <THead className={cn(isExcelMode && "[&_th]:bg-slate-100 [&_th]:text-[11px] [&_th]:font-semibold")}>
      <TR className="hover:bg-transparent">
        <TH className="budget-sticky-header">Codigo</TH>
        <TH className="budget-sticky-header">Descripcion</TH>
        <TH className="budget-sticky-header text-center">Unidad</TH>
        <TH className="budget-sticky-header text-right">Metrado</TH>
        <TH className="budget-sticky-header text-right">P. Unitario</TH>
        <TH className="budget-sticky-header text-right">Parcial</TH>
      </TR>
    </THead>
  </Table>
</div>
```

- [ ] **Step 4: Tighten cell, summary, and side-panel density in excel mode**

```tsx
const densityMode: DensityMode = isExcelMode ? "compact" : userDensityMode;

function getBodyCellClass(column: ActiveColumn, activeColumn: ActiveColumn, extraClassName: string, densityMode: DensityMode) {
  return cn(
    getCellPadding(densityMode),
    activeColumn === column ? "bg-sky-50/70" : "",
    densityMode === "compact" ? "text-xs" : "text-sm",
    extraClassName,
  );
}
```

```tsx
<Card className={cn(isExcelMode && "rounded-md shadow-none")}>
  <CardHeader className={cn(isExcelMode && "px-3 py-2")}>
    <CardTitle className={cn(isExcelMode && "text-sm")}>Resumen</CardTitle>
  </CardHeader>
</Card>
```

- [ ] **Step 5: Run targeted verification commands**

Run: `npm.cmd run lint`

Expected: PASS with no regressions in the editor event handlers

Run: `npm.cmd run test -- lib/calculations/budget.test.ts`

Expected: PASS confirming budget calculations still behave the same

- [ ] **Step 6: Commit**

```bash
git add components/budget/budget-editor.tsx
git commit -m "feat: add excel mode behavior to budget editor"
```

---

### Task 5: Adapt APU Sheet, Close-Out Shortcuts, And End-To-End Verification

**Files:**
- Modify: `components/apu/apu-editor-sheet.tsx`
- Modify: `components/budget/budget-editor.tsx`

- [ ] **Step 1: Thread the shared view mode into the APU sheet**

```tsx
import { useBudgetViewMode } from "@/components/budget/view-mode-provider";

const { isExcelMode } = useBudgetViewMode();
const effectiveDensityMode = isExcelMode ? "compact" : densityMode;
```

- [ ] **Step 2: Add `Escape` handling for the APU sheet**

```tsx
useEffect(() => {
  if (!open) return;

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
    }
  }

  window.addEventListener("keydown", handleKeyDown);
  return () => window.removeEventListener("keydown", handleKeyDown);
}, [open, onClose]);
```

- [ ] **Step 3: Apply excel-mode compact table and panel styling in the sheet**

```tsx
<div className={cn("ml-auto h-full w-full max-w-6xl overflow-y-auto bg-white p-5 shadow-2xl", isExcelMode && "max-w-[92rem] p-3 shadow-none")}>
  <div className={cn("mb-5 grid gap-4 md:grid-cols-2", isExcelMode && "gap-2")}>
    <div className={cn("rounded-2xl border border-slate-200 p-4", isExcelMode && "rounded-md border-slate-300 p-2")}>
      {/* metric */}
    </div>
  </div>

  <div className={cn("overflow-hidden rounded-2xl border border-slate-200", isExcelMode && "rounded-md border-slate-300")}>
    <Table className="table-auto">
      <THead className={cn(isExcelMode && "[&_th]:bg-slate-100 [&_th]:text-[11px]")}>
        <TR className="hover:bg-transparent">
          <TH className="budget-sticky-header h-8">Insumo</TH>
        </TR>
      </THead>
    </Table>
  </div>
</div>
```

- [ ] **Step 4: Run full regression verification**

Run: `npm.cmd run test`

Expected: PASS with existing calculation and utility tests still green

Run: `npm.cmd run lint`

Expected: PASS with no new type/lint issues across budget and APU components

- [ ] **Step 5: Perform manual verification**

Run: `npm.cmd run dev`

Expected manual checks:
- switch between `Moderna` and `Tipo Excel` in a sub-budget
- reload the page and confirm the same mode returns
- open APU from the toolbar button and from `Ctrl/Cmd + Enter`
- close APU with `Escape`
- confirm sticky headers remain visible while scrolling

- [ ] **Step 6: Commit**

```bash
git add components/apu/apu-editor-sheet.tsx components/budget/budget-editor.tsx
git commit -m "feat: finish excel mode for apu flow"
```

---

## Self-Review

### Spec coverage

- Local selector in budget/APU flow: covered in Task 3
- Shared persisted state: covered in Task 1 and Task 3
- Shared visual signal via `data-view-mode`: covered in Task 1 and Task 2
- BudgetEditor compact/sticky/rigid layout: covered in Task 4
- ApuEditorSheet compact/sticky/shared mode behavior: covered in Task 5
- Keyboard productivity additions: covered in Task 4 and Task 5
- No business-logic change: protected by Task 4 and Task 5 regression commands

### Placeholder scan

- No `TBD`, `TODO`, or deferred implementation markers remain
- All file paths are explicit
- Every code-changing step includes concrete code or commands

### Type consistency

- Shared mode type is always `ViewMode = "modern" | "excel"`
- Provider API consistently uses `viewMode`, `setViewMode`, and `isExcelMode`
- Storage key is consistently `app_view_mode`

