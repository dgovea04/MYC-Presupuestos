# Excel Mode Professional Grid Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the existing "Modo Excel" from a mostly visual compact mode into a consistent professional spreadsheet workflow across budgets, APU, metrados, catalogs, resources, and formula tables.

**Architecture:** Keep the existing global `data-view-mode="excel"` architecture, formatting settings, and module-specific business logic. Add shared spreadsheet primitives for navigation, range selection, clipboard handling, density, and compact row actions, then adopt them incrementally in the highest-value modules first.

**Tech Stack:** Next.js App Router, React client components, TypeScript strict mode, Tailwind CSS, Vitest, React Testing Library, existing `BufferedInput`, existing `Table` components, existing `useVirtualTableWindow`.

## Global Constraints

- Use TypeScript strict mode.
- Never use `any`.
- Financial calculations must use decimal-safe math.
- Keep calculation logic isolated from UI.
- All formulas must be testable.
- Prefer reusable services.
- Use clean architecture.
- Reuse existing components, utilities, styles, and UI patterns.
- Modo Excel must not change calculation results, persistence contracts, or export formats.
- Modo Excel must preserve APU/subpartida visual inheritance: same columns, density, row height, borders, decimals, and header context.
- Do not add new dependencies unless a task explicitly proves the existing stack cannot support the behavior.

---

## Product Specification

### Current State

The project already has:

- Global view mode state in `lib/budget/view-mode.ts`.
- Global provider and CSS variable application in `components/view-mode/app-view-mode-provider.tsx`.
- User settings for default mode, field borders, and row height in `components/settings/user-settings-form.tsx`.
- Global Excel CSS rules in `app/globals.css`.
- Budget editor keyboard navigation and paste/import handling in `components/budget/budget-editor.tsx`.
- APU editor inheritance via `data-view-mode` and `data-excel-field-border-scope` in `components/apu/apu-editor-sheet.tsx`.
- Metrado sheet selection and drag-fill behavior in `components/metrados/MetradoSheetTable.tsx`.
- Virtualized tables in budget, resources, partidas, and unified indices.

### Target User Experience

Modo Excel should feel like a technical spreadsheet optimized for presupuestistas:

- Dense, legible, predictable rows.
- Fast keyboard movement across editable cells.
- Range selection and visual active cell feedback.
- Paste from Excel into budget/metrado grids with minimal friction.
- Fill-down for repeated text/numeric values.
- Compact row actions that do not steal table width.
- Sticky headers and important columns.
- Consistent visual treatment across budget, APU, subpartidas, resources, partidas, metrados, formula polinómica, gastos generales, and unified indices.

### Non-Goals

- Do not rebuild tables using a large third-party grid library.
- Do not change budget, APU, metrado, or formula calculation semantics.
- Do not change database schema for budget data.
- Do not change Excel export formats in this plan.
- Do not implement inline formula expressions inside budget cells in this phase.

### Phased Scope

Phase 1:

- Shared spreadsheet primitives.
- Budget range selection, copy, paste, fill-down.
- Compact actions and badges in budget Excel rows.
- APU/subpartida inheritance tests.

Phase 2:

- Metrado adoption of shared primitives.
- Resources and partidas adoption of shared density/navigation helpers.
- Formula polinómica and gastos generales visual consistency.

Phase 3:

- Column resize/pinning preferences.
- Extended keyboard shortcuts.
- Visual regression coverage with Playwright if the project adds browser screenshot infrastructure.

---

## File Structure

Create:

- `lib/spreadsheet/cell-address.ts`: Pure helpers for cell identity, rectangular ranges, and ordered cell traversal.
- `lib/spreadsheet/clipboard.ts`: Pure helpers for TSV clipboard serialization/parsing.
- `lib/spreadsheet/fill-down.ts`: Pure helpers for deriving cell patches from a source cell and selected target range.
- `components/spreadsheet/use-spreadsheet-selection.ts`: React hook for active cell and rectangular range state.
- `components/spreadsheet/use-spreadsheet-keyboard.ts`: React hook for keyboard movement and copy/fill shortcuts.
- `components/spreadsheet/compact-row-actions.tsx`: Shared compact actions for Excel-mode rows.
- `components/spreadsheet/spreadsheet-range-overlay.tsx`: Lightweight range and active-cell class helpers.
- `components/spreadsheet/index.ts`: Barrel for shared spreadsheet primitives.
- `lib/spreadsheet/cell-address.test.ts`
- `lib/spreadsheet/clipboard.test.ts`
- `lib/spreadsheet/fill-down.test.ts`
- `components/spreadsheet/use-spreadsheet-selection.test.tsx`
- `components/spreadsheet/use-spreadsheet-keyboard.test.tsx`
- `components/spreadsheet/compact-row-actions.test.tsx`

Modify:

- `components/budget/budget-editor.tsx`: Replace local-only navigation state with shared spreadsheet primitives, add range copy/fill-down, and compact row actions.
- `components/budget/budget-editor.view-mode.test.tsx`: Add behavioral tests for range selection and compact actions.
- `components/apu/markup-table.tsx` or equivalent APU resource table file if present after local search; otherwise keep changes inside `components/apu/apu-editor-sheet.tsx`.
- `components/apu/apu-editor-sheet.test.tsx`: Add inheritance tests for subpartida popup density/decimals/borders.
- `components/metrados/MetradoSheetTable.tsx`: Reuse shared active/range/fill helpers without changing metrado formula behavior.
- `components/metrados/metrado-view-model.test.ts` or `components/metrados/MetradoSheetTable.test.tsx` if present; add tests for shared behavior.
- `components/resources/resources-table.tsx`: Adopt shared table density classes and optional keyboard traversal.
- `components/partidas/partidas-table.tsx`: Adopt shared table density classes and compact APU actions.
- `components/budget/polynomial-monomials-table.tsx`: Align Excel density and field borders.
- `components/budget/general-budget-footer-table.tsx`: Align Excel density and field borders.
- `app/globals.css`: Keep only truly global Excel selectors; move module-specific variants into component helpers where possible.
- `DESIGN.md`: Document the final Excel-mode interaction contract.

Do not modify:

- Calculation libraries unless a failing test proves UI behavior currently mutates numeric semantics.
- API route contracts.
- Prisma schema.

---

## Acceptance Criteria

- User can switch between Moderna and Tipo Excel without reload.
- Excel mode row height respects `excelRowHeight` in supported virtualized tables.
- Budget editor supports Arrow keys, Enter, Tab, Shift+Tab, copy range, paste range, and fill-down for editable fields.
- Budget editor does not allow editing derived `unitPrice` or `partial` cells.
- Paste into budget preserves hierarchy behavior already implemented by `createGuidedBudgetPaste`.
- APU editor and subpartida dialogs inherit `data-view-mode`, field border scope, row height variables, and currency decimals.
- Metrado drag-fill behavior still works and uses shared range helpers.
- Compact row actions in Excel mode reduce row width pressure and remain keyboard accessible.
- Existing tests pass with `npm run test`.
- Lint passes with `npm run lint`.

---

### Task 1: Spreadsheet Cell Address Helpers

**Files:**
- Create: `lib/spreadsheet/cell-address.ts`
- Create: `lib/spreadsheet/cell-address.test.ts`

**Interfaces:**
- Produces:
  - `type SpreadsheetCellAddress = { rowId: string; columnId: string }`
  - `type SpreadsheetColumnDefinition = { id: string; editable: boolean }`
  - `type SpreadsheetRowDefinition = { id: string; columns: SpreadsheetColumnDefinition[] }`
  - `getCellKey(cell: SpreadsheetCellAddress): string`
  - `parseCellKey(key: string): SpreadsheetCellAddress | null`
  - `getOrderedEditableCells(rows: SpreadsheetRowDefinition[]): SpreadsheetCellAddress[]`
  - `getRectangularCellRange(args: { rows: SpreadsheetRowDefinition[]; anchor: SpreadsheetCellAddress; focus: SpreadsheetCellAddress }): SpreadsheetCellAddress[]`
  - `getAdjacentEditableCell(args: { rows: SpreadsheetRowDefinition[]; cell: SpreadsheetCellAddress; direction: "up" | "down" | "left" | "right" }): SpreadsheetCellAddress | null`

- [ ] **Step 1: Write failing tests**

```ts
import {
  getAdjacentEditableCell,
  getCellKey,
  getOrderedEditableCells,
  getRectangularCellRange,
  parseCellKey,
  type SpreadsheetRowDefinition,
} from "@/lib/spreadsheet/cell-address";

const rows: SpreadsheetRowDefinition[] = [
  {
    id: "row-1",
    columns: [
      { id: "code", editable: true },
      { id: "description", editable: true },
      { id: "unitPrice", editable: false },
    ],
  },
  {
    id: "row-2",
    columns: [
      { id: "code", editable: true },
      { id: "description", editable: true },
      { id: "unitPrice", editable: false },
    ],
  },
];

describe("spreadsheet cell address helpers", () => {
  it("serializes and parses stable cell keys", () => {
    expect(getCellKey({ rowId: "row-1", columnId: "description" })).toBe("row-1::description");
    expect(parseCellKey("row-1::description")).toEqual({ rowId: "row-1", columnId: "description" });
    expect(parseCellKey("invalid")).toBeNull();
  });

  it("returns ordered editable cells and skips readonly cells", () => {
    expect(getOrderedEditableCells(rows)).toEqual([
      { rowId: "row-1", columnId: "code" },
      { rowId: "row-1", columnId: "description" },
      { rowId: "row-2", columnId: "code" },
      { rowId: "row-2", columnId: "description" },
    ]);
  });

  it("moves between editable cells by direction", () => {
    expect(getAdjacentEditableCell({ rows, cell: { rowId: "row-1", columnId: "code" }, direction: "right" })).toEqual({
      rowId: "row-1",
      columnId: "description",
    });
    expect(getAdjacentEditableCell({ rows, cell: { rowId: "row-1", columnId: "description" }, direction: "down" })).toEqual({
      rowId: "row-2",
      columnId: "description",
    });
    expect(getAdjacentEditableCell({ rows, cell: { rowId: "row-2", columnId: "description" }, direction: "right" })).toBeNull();
  });

  it("returns a rectangular editable range", () => {
    expect(
      getRectangularCellRange({
        rows,
        anchor: { rowId: "row-1", columnId: "code" },
        focus: { rowId: "row-2", columnId: "description" },
      }),
    ).toEqual([
      { rowId: "row-1", columnId: "code" },
      { rowId: "row-1", columnId: "description" },
      { rowId: "row-2", columnId: "code" },
      { rowId: "row-2", columnId: "description" },
    ]);
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npm run test -- lib/spreadsheet/cell-address.test.ts`

Expected: FAIL because `lib/spreadsheet/cell-address.ts` does not exist.

- [ ] **Step 3: Implement helpers**

```ts
export type SpreadsheetCellAddress = {
  rowId: string;
  columnId: string;
};

export type SpreadsheetColumnDefinition = {
  id: string;
  editable: boolean;
};

export type SpreadsheetRowDefinition = {
  id: string;
  columns: SpreadsheetColumnDefinition[];
};

export function getCellKey(cell: SpreadsheetCellAddress): string {
  return `${cell.rowId}::${cell.columnId}`;
}

export function parseCellKey(key: string): SpreadsheetCellAddress | null {
  const separatorIndex = key.indexOf("::");
  if (separatorIndex <= 0 || separatorIndex === key.length - 2) {
    return null;
  }

  return {
    rowId: key.slice(0, separatorIndex),
    columnId: key.slice(separatorIndex + 2),
  };
}

export function getOrderedEditableCells(rows: SpreadsheetRowDefinition[]): SpreadsheetCellAddress[] {
  return rows.flatMap((row) =>
    row.columns
      .filter((column) => column.editable)
      .map((column) => ({
        rowId: row.id,
        columnId: column.id,
      })),
  );
}

export function getAdjacentEditableCell({
  rows,
  cell,
  direction,
}: {
  rows: SpreadsheetRowDefinition[];
  cell: SpreadsheetCellAddress;
  direction: "up" | "down" | "left" | "right";
}): SpreadsheetCellAddress | null {
  const rowIndex = rows.findIndex((row) => row.id === cell.rowId);
  if (rowIndex === -1) {
    return null;
  }

  const currentRow = rows[rowIndex];
  if (!currentRow) {
    return null;
  }

  if (direction === "left" || direction === "right") {
    const editableColumns = currentRow.columns.filter((column) => column.editable);
    const columnIndex = editableColumns.findIndex((column) => column.id === cell.columnId);
    if (columnIndex === -1) {
      return null;
    }

    const nextColumn = editableColumns[direction === "left" ? columnIndex - 1 : columnIndex + 1];
    return nextColumn ? { rowId: currentRow.id, columnId: nextColumn.id } : null;
  }

  const step = direction === "up" ? -1 : 1;
  for (let nextRowIndex = rowIndex + step; nextRowIndex >= 0 && nextRowIndex < rows.length; nextRowIndex += step) {
    const candidateRow = rows[nextRowIndex];
    const matchingColumn = candidateRow?.columns.find((column) => column.id === cell.columnId && column.editable);
    if (candidateRow && matchingColumn) {
      return { rowId: candidateRow.id, columnId: matchingColumn.id };
    }
  }

  return null;
}

export function getRectangularCellRange({
  rows,
  anchor,
  focus,
}: {
  rows: SpreadsheetRowDefinition[];
  anchor: SpreadsheetCellAddress;
  focus: SpreadsheetCellAddress;
}): SpreadsheetCellAddress[] {
  const anchorRowIndex = rows.findIndex((row) => row.id === anchor.rowId);
  const focusRowIndex = rows.findIndex((row) => row.id === focus.rowId);
  if (anchorRowIndex === -1 || focusRowIndex === -1) {
    return [];
  }

  const allColumnIds = rows[anchorRowIndex]?.columns.map((column) => column.id) ?? [];
  const anchorColumnIndex = allColumnIds.indexOf(anchor.columnId);
  const focusColumnIndex = allColumnIds.indexOf(focus.columnId);
  if (anchorColumnIndex === -1 || focusColumnIndex === -1) {
    return [];
  }

  const rowStart = Math.min(anchorRowIndex, focusRowIndex);
  const rowEnd = Math.max(anchorRowIndex, focusRowIndex);
  const columnStart = Math.min(anchorColumnIndex, focusColumnIndex);
  const columnEnd = Math.max(anchorColumnIndex, focusColumnIndex);
  const selected: SpreadsheetCellAddress[] = [];

  for (let rowIndex = rowStart; rowIndex <= rowEnd; rowIndex += 1) {
    const row = rows[rowIndex];
    if (!row) {
      continue;
    }

    for (let columnIndex = columnStart; columnIndex <= columnEnd; columnIndex += 1) {
      const column = row.columns[columnIndex];
      if (column?.editable) {
        selected.push({ rowId: row.id, columnId: column.id });
      }
    }
  }

  return selected;
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `npm run test -- lib/spreadsheet/cell-address.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/spreadsheet/cell-address.ts lib/spreadsheet/cell-address.test.ts
git commit -m "feat: add spreadsheet cell helpers"
```

---

### Task 2: Clipboard and Fill-Down Helpers

**Files:**
- Create: `lib/spreadsheet/clipboard.ts`
- Create: `lib/spreadsheet/clipboard.test.ts`
- Create: `lib/spreadsheet/fill-down.ts`
- Create: `lib/spreadsheet/fill-down.test.ts`

**Interfaces:**
- Consumes:
  - `SpreadsheetCellAddress` from `lib/spreadsheet/cell-address.ts`
- Produces:
  - `parseSpreadsheetClipboard(text: string): string[][]`
  - `serializeSpreadsheetClipboard(rows: string[][]): string`
  - `type SpreadsheetCellValueMap = ReadonlyMap<string, string>`
  - `createFillDownPatches(args: { source: SpreadsheetCellAddress; targets: SpreadsheetCellAddress[]; values: SpreadsheetCellValueMap }): Array<{ cell: SpreadsheetCellAddress; value: string }>`

- [ ] **Step 1: Write failing tests**

```ts
import { parseSpreadsheetClipboard, serializeSpreadsheetClipboard } from "@/lib/spreadsheet/clipboard";
import { createFillDownPatches, type SpreadsheetCellValueMap } from "@/lib/spreadsheet/fill-down";

describe("spreadsheet clipboard helpers", () => {
  it("parses Excel-style TSV text", () => {
    expect(parseSpreadsheetClipboard("01.01\tExcavacion\tm3\n01.02\tRelleno\tm3")).toEqual([
      ["01.01", "Excavacion", "m3"],
      ["01.02", "Relleno", "m3"],
    ]);
  });

  it("serializes cells to TSV text", () => {
    expect(serializeSpreadsheetClipboard([
      ["01.01", "Excavacion"],
      ["01.02", "Relleno"],
    ])).toBe("01.01\tExcavacion\n01.02\tRelleno");
  });
});

describe("spreadsheet fill-down helpers", () => {
  it("copies the source cell value to target cells in the same column", () => {
    const values: SpreadsheetCellValueMap = new Map([["row-1::unit", "m3"]]);

    expect(
      createFillDownPatches({
        source: { rowId: "row-1", columnId: "unit" },
        targets: [
          { rowId: "row-1", columnId: "unit" },
          { rowId: "row-2", columnId: "unit" },
          { rowId: "row-3", columnId: "unit" },
          { rowId: "row-3", columnId: "description" },
        ],
        values,
      }),
    ).toEqual([
      { cell: { rowId: "row-2", columnId: "unit" }, value: "m3" },
      { cell: { rowId: "row-3", columnId: "unit" }, value: "m3" },
    ]);
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npm run test -- lib/spreadsheet/clipboard.test.ts lib/spreadsheet/fill-down.test.ts`

Expected: FAIL because helpers do not exist.

- [ ] **Step 3: Implement clipboard helper**

```ts
export function parseSpreadsheetClipboard(text: string): string[][] {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .filter((line) => line.length > 0)
    .map((line) => line.split("\t"));
}

export function serializeSpreadsheetClipboard(rows: string[][]): string {
  return rows.map((row) => row.join("\t")).join("\n");
}
```

- [ ] **Step 4: Implement fill-down helper**

```ts
import { getCellKey, type SpreadsheetCellAddress } from "@/lib/spreadsheet/cell-address";

export type SpreadsheetCellValueMap = ReadonlyMap<string, string>;

export function createFillDownPatches({
  source,
  targets,
  values,
}: {
  source: SpreadsheetCellAddress;
  targets: SpreadsheetCellAddress[];
  values: SpreadsheetCellValueMap;
}): Array<{ cell: SpreadsheetCellAddress; value: string }> {
  const sourceValue = values.get(getCellKey(source));
  if (typeof sourceValue === "undefined") {
    return [];
  }

  return targets
    .filter((target) => target.columnId === source.columnId)
    .filter((target) => target.rowId !== source.rowId)
    .map((target) => ({
      cell: target,
      value: sourceValue,
    }));
}
```

- [ ] **Step 5: Run tests to verify pass**

Run: `npm run test -- lib/spreadsheet/clipboard.test.ts lib/spreadsheet/fill-down.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/spreadsheet/clipboard.ts lib/spreadsheet/clipboard.test.ts lib/spreadsheet/fill-down.ts lib/spreadsheet/fill-down.test.ts
git commit -m "feat: add spreadsheet clipboard helpers"
```

---

### Task 3: Shared Selection and Keyboard Hooks

**Files:**
- Create: `components/spreadsheet/use-spreadsheet-selection.ts`
- Create: `components/spreadsheet/use-spreadsheet-selection.test.tsx`
- Create: `components/spreadsheet/use-spreadsheet-keyboard.ts`
- Create: `components/spreadsheet/use-spreadsheet-keyboard.test.tsx`
- Create: `components/spreadsheet/index.ts`

**Interfaces:**
- Consumes:
  - `SpreadsheetCellAddress`
  - `SpreadsheetRowDefinition`
  - `getAdjacentEditableCell`
  - `getRectangularCellRange`
- Produces:
  - `useSpreadsheetSelection(args: { rows: SpreadsheetRowDefinition[] })`
  - `useSpreadsheetKeyboard(args: { rows: SpreadsheetRowDefinition[]; activeCell: SpreadsheetCellAddress | null; focusCell: (cell: SpreadsheetCellAddress | null) => void; extendSelectionTo: (cell: SpreadsheetCellAddress) => void })`

- [ ] **Step 1: Write failing selection test**

```tsx
import { act, renderHook } from "@testing-library/react";
import { useSpreadsheetSelection } from "@/components/spreadsheet/use-spreadsheet-selection";
import type { SpreadsheetRowDefinition } from "@/lib/spreadsheet/cell-address";

const rows: SpreadsheetRowDefinition[] = [
  { id: "row-1", columns: [{ id: "code", editable: true }, { id: "description", editable: true }] },
  { id: "row-2", columns: [{ id: "code", editable: true }, { id: "description", editable: true }] },
];

it("tracks active cell and rectangular selection", () => {
  const { result } = renderHook(() => useSpreadsheetSelection({ rows }));

  act(() => result.current.activateCell({ rowId: "row-1", columnId: "code" }));
  expect(result.current.activeCell).toEqual({ rowId: "row-1", columnId: "code" });
  expect(result.current.selectedCells).toEqual([{ rowId: "row-1", columnId: "code" }]);

  act(() => result.current.extendSelectionTo({ rowId: "row-2", columnId: "description" }));
  expect(result.current.selectedCells).toEqual([
    { rowId: "row-1", columnId: "code" },
    { rowId: "row-1", columnId: "description" },
    { rowId: "row-2", columnId: "code" },
    { rowId: "row-2", columnId: "description" },
  ]);
});
```

- [ ] **Step 2: Write failing keyboard test**

```tsx
import { renderHook } from "@testing-library/react";
import { useSpreadsheetKeyboard } from "@/components/spreadsheet/use-spreadsheet-keyboard";
import type { SpreadsheetCellAddress, SpreadsheetRowDefinition } from "@/lib/spreadsheet/cell-address";

const rows: SpreadsheetRowDefinition[] = [
  { id: "row-1", columns: [{ id: "code", editable: true }, { id: "description", editable: true }] },
  { id: "row-2", columns: [{ id: "code", editable: true }, { id: "description", editable: true }] },
];

function createKeyboardEvent(key: string, shiftKey = false): React.KeyboardEvent<HTMLInputElement> {
  return {
    key,
    shiftKey,
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    nativeEvent: { isComposing: false },
    preventDefault: vi.fn(),
    currentTarget: document.createElement("input"),
  } as unknown as React.KeyboardEvent<HTMLInputElement>;
}

it("moves active cell with arrow keys", () => {
  const focused: Array<SpreadsheetCellAddress | null> = [];
  const extended: SpreadsheetCellAddress[] = [];
  const { result } = renderHook(() =>
    useSpreadsheetKeyboard({
      rows,
      activeCell: { rowId: "row-1", columnId: "code" },
      focusCell: (cell) => focused.push(cell),
      extendSelectionTo: (cell) => extended.push(cell),
    }),
  );

  result.current.onCellKeyDown(createKeyboardEvent("ArrowRight"));
  expect(focused).toEqual([{ rowId: "row-1", columnId: "description" }]);
  expect(extended).toEqual([]);
});
```

- [ ] **Step 3: Run tests to verify failure**

Run: `npm run test -- components/spreadsheet/use-spreadsheet-selection.test.tsx components/spreadsheet/use-spreadsheet-keyboard.test.tsx`

Expected: FAIL because hooks do not exist.

- [ ] **Step 4: Implement selection hook**

```ts
"use client";

import { useCallback, useMemo, useState } from "react";
import {
  getCellKey,
  getRectangularCellRange,
  type SpreadsheetCellAddress,
  type SpreadsheetRowDefinition,
} from "@/lib/spreadsheet/cell-address";

export function useSpreadsheetSelection({ rows }: { rows: SpreadsheetRowDefinition[] }) {
  const [activeCell, setActiveCell] = useState<SpreadsheetCellAddress | null>(null);
  const [anchorCell, setAnchorCell] = useState<SpreadsheetCellAddress | null>(null);
  const [focusCell, setFocusCell] = useState<SpreadsheetCellAddress | null>(null);

  const activateCell = useCallback((cell: SpreadsheetCellAddress) => {
    setActiveCell(cell);
    setAnchorCell(cell);
    setFocusCell(cell);
  }, []);

  const extendSelectionTo = useCallback((cell: SpreadsheetCellAddress) => {
    setFocusCell(cell);
  }, []);

  const clearSelection = useCallback(() => {
    setActiveCell(null);
    setAnchorCell(null);
    setFocusCell(null);
  }, []);

  const selectedCells = useMemo(() => {
    if (!anchorCell || !focusCell) {
      return activeCell ? [activeCell] : [];
    }

    return getRectangularCellRange({ rows, anchor: anchorCell, focus: focusCell });
  }, [activeCell, anchorCell, focusCell, rows]);

  const selectedCellKeys = useMemo(() => new Set(selectedCells.map(getCellKey)), [selectedCells]);

  return {
    activeCell,
    selectedCells,
    selectedCellKeys,
    activateCell,
    extendSelectionTo,
    clearSelection,
  };
}
```

- [ ] **Step 5: Implement keyboard hook**

```ts
"use client";

import { useCallback } from "react";
import { getAdjacentEditableCell, type SpreadsheetCellAddress, type SpreadsheetRowDefinition } from "@/lib/spreadsheet/cell-address";

function shouldMoveHorizontally(input: HTMLInputElement, key: string): boolean {
  const start = input.selectionStart ?? 0;
  const end = input.selectionEnd ?? 0;
  if (start !== end) {
    return false;
  }

  return key === "ArrowLeft" ? start === 0 : end === input.value.length;
}

export function useSpreadsheetKeyboard({
  rows,
  activeCell,
  focusCell,
  extendSelectionTo,
}: {
  rows: SpreadsheetRowDefinition[];
  activeCell: SpreadsheetCellAddress | null;
  focusCell: (cell: SpreadsheetCellAddress | null) => void;
  extendSelectionTo: (cell: SpreadsheetCellAddress) => void;
}) {
  const onCellKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (!activeCell || event.nativeEvent.isComposing || event.altKey || event.ctrlKey || event.metaKey) {
        return;
      }

      const direction =
        event.key === "ArrowUp"
          ? "up"
          : event.key === "ArrowDown" || event.key === "Enter"
            ? "down"
            : event.key === "ArrowLeft"
              ? "left"
              : event.key === "ArrowRight"
                ? "right"
                : null;

      if (!direction) {
        return;
      }

      if ((direction === "left" || direction === "right") && !shouldMoveHorizontally(event.currentTarget, event.key)) {
        return;
      }

      event.preventDefault();
      const nextCell = getAdjacentEditableCell({ rows, cell: activeCell, direction });
      if (!nextCell) {
        return;
      }

      if (event.shiftKey) {
        extendSelectionTo(nextCell);
        return;
      }

      focusCell(nextCell);
    },
    [activeCell, extendSelectionTo, focusCell, rows],
  );

  return { onCellKeyDown };
}
```

- [ ] **Step 6: Create barrel**

```ts
export { useSpreadsheetKeyboard } from "@/components/spreadsheet/use-spreadsheet-keyboard";
export { useSpreadsheetSelection } from "@/components/spreadsheet/use-spreadsheet-selection";
export type {
  SpreadsheetCellAddress,
  SpreadsheetColumnDefinition,
  SpreadsheetRowDefinition,
} from "@/lib/spreadsheet/cell-address";
```

- [ ] **Step 7: Run tests to verify pass**

Run: `npm run test -- components/spreadsheet/use-spreadsheet-selection.test.tsx components/spreadsheet/use-spreadsheet-keyboard.test.tsx`

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add components/spreadsheet lib/spreadsheet
git commit -m "feat: add spreadsheet selection hooks"
```

---

### Task 4: Budget Editor Range Selection, Copy, and Fill-Down

**Files:**
- Modify: `components/budget/budget-editor.tsx`
- Modify: `components/budget/budget-editor.view-mode.test.tsx`

**Interfaces:**
- Consumes:
  - `useSpreadsheetSelection`
  - `useSpreadsheetKeyboard`
  - `serializeSpreadsheetClipboard`
  - `createFillDownPatches`

- [ ] **Step 1: Add failing budget tests**

Add tests to `components/budget/budget-editor.view-mode.test.tsx`:

```tsx
it("selects a budget cell range with shift arrow keys in Excel mode", async () => {
  renderBudgetEditorInExcelMode();

  const codeInput = getBudgetCellInput("01.01", "code");
  codeInput.focus();
  await userEvent.keyboard("{Shift>}{ArrowRight}{/Shift}");

  expect(getBudgetCell("01.01", "code")).toHaveAttribute("data-spreadsheet-selected", "true");
  expect(getBudgetCell("01.01", "description")).toHaveAttribute("data-spreadsheet-selected", "true");
});

it("fills down the selected budget unit column in Excel mode", async () => {
  renderBudgetEditorInExcelMode();

  getBudgetCellInput("01.01", "unit").focus();
  await userEvent.keyboard("{Shift>}{ArrowDown}{/Shift}");
  await userEvent.keyboard("{Control>}d{/Control}");

  expect(getBudgetCellInput("01.02", "unit")).toHaveValue("m3");
});
```

Use existing test factories in this file. If helper names differ, create local helpers:

```ts
function getBudgetCell(rowCode: string, column: string) {
  const row = screen.getByDisplayValue(rowCode).closest("[data-budget-row-id]");
  if (!row) throw new Error(`Missing row ${rowCode}`);
  const cell = row.querySelector(`[data-budget-column="${column}"]`);
  if (!cell) throw new Error(`Missing column ${column}`);
  return cell;
}

function getBudgetCellInput(rowCode: string, column: string) {
  const input = getBudgetCell(rowCode, column).querySelector("input");
  if (!input) throw new Error(`Missing input for ${rowCode}/${column}`);
  return input;
}
```

- [ ] **Step 2: Run budget tests to verify failure**

Run: `npm run test -- components/budget/budget-editor.view-mode.test.tsx`

Expected: FAIL because range attributes and fill-down shortcut are not implemented.

- [ ] **Step 3: Add spreadsheet row definitions in budget editor**

In `BudgetEditor`, derive shared row definitions from existing `rows`:

```ts
const spreadsheetRows = useMemo(
  () =>
    rows.map((row) => ({
      id: getRowId(row),
      columns: getEditableColumnsForRow(row).map((column) => ({
        id: column,
        editable: true,
      })),
    })),
  [rows],
);
```

- [ ] **Step 4: Wire shared selection state**

Add:

```ts
const spreadsheetSelection = useSpreadsheetSelection({ rows: spreadsheetRows });
```

Update `handleCellFocus` so it activates the selected cell:

```ts
const handleCellFocus = useCallback((rowId: string, column: ActiveColumn) => {
  activeRowIdRef.current = rowId;
  activeColumnRef.current = column;
  setActiveRowId(rowId);
  setActiveColumn(column);

  if (isEditableActiveColumn(column)) {
    spreadsheetSelection.activateCell({ rowId, columnId: column });
  }
}, [spreadsheetSelection]);
```

- [ ] **Step 5: Replace keyboard movement calls**

Keep existing `focusCell` but adapt it to shared cell addresses:

```ts
const focusSpreadsheetCell = useCallback((cell: SpreadsheetCellAddress | null) => {
  if (!cell || !isEditableColumn(cell.columnId)) return;
  focusCell({ rowId: cell.rowId, column: cell.columnId });
}, [focusCell]);
```

Use `useSpreadsheetKeyboard`:

```ts
const spreadsheetKeyboard = useSpreadsheetKeyboard({
  rows: spreadsheetRows,
  activeCell: spreadsheetSelection.activeCell,
  focusCell: focusSpreadsheetCell,
  extendSelectionTo: spreadsheetSelection.extendSelectionTo,
});
```

Update row input handlers from `onNavigate(event, row.item.id, "unit")` to call a wrapper:

```ts
onKeyDown={(event) => {
  onNavigate(event, row.item.id, "unit");
}}
```

Then change the parent `onNavigate` implementation to delegate to `spreadsheetKeyboard.onCellKeyDown` in Excel mode and keep current behavior in modern mode.

- [ ] **Step 6: Mark cells with selection attributes**

Update `getBodyCellClass` call sites so every editable `TD` has:

```tsx
data-budget-column="unit"
data-spreadsheet-selected={selectedCellKeys.has(getCellKey({ rowId: row.item.id, columnId: "unit" })) ? "true" : undefined}
data-spreadsheet-active={activeCell?.rowId === row.item.id && activeCell.columnId === "unit" ? "true" : undefined}
```

For readonly cells, add `data-budget-column` only.

- [ ] **Step 7: Add CSS for selected cells**

In `app/globals.css`, add:

```css
[data-view-mode="excel"] [data-spreadsheet-selected="true"] {
  background: rgba(219, 234, 254, 0.72);
  box-shadow: inset 0 0 0 1px rgba(37, 99, 235, 0.26);
}

[data-view-mode="excel"] [data-spreadsheet-active="true"] {
  box-shadow: inset 0 0 0 2px var(--app-primary);
}
```

- [ ] **Step 8: Implement fill-down shortcut**

Add a value map builder:

```ts
const budgetCellValues = useMemo(() => {
  const values = new Map<string, string>();
  for (const row of rows) {
    if (row.kind === "level") {
      values.set(getCellKey({ rowId: row.level.id, columnId: "code" }), row.level.code);
      values.set(getCellKey({ rowId: row.level.id, columnId: "description" }), row.level.name);
      continue;
    }

    values.set(getCellKey({ rowId: row.item.id, columnId: "code" }), row.item.code);
    values.set(getCellKey({ rowId: row.item.id, columnId: "description" }), row.item.description);
    values.set(getCellKey({ rowId: row.item.id, columnId: "unit" }), row.item.unit);
    values.set(getCellKey({ rowId: row.item.id, columnId: "quantity" }), String(row.item.quantity));
  }
  return values;
}, [rows]);
```

Add handler:

```ts
function applyBudgetFillDown() {
  const activeCell = spreadsheetSelection.activeCell;
  if (!activeCell || !isEditableColumn(activeCell.columnId)) return;

  const patches = createFillDownPatches({
    source: activeCell,
    targets: spreadsheetSelection.selectedCells,
    values: budgetCellValues,
  });

  for (const patch of patches) {
    applyBudgetCellPatch(patch.cell, patch.value);
  }
}
```

Implement `applyBudgetCellPatch` using existing `updateLevel` and `updateItem`:

```ts
function applyBudgetCellPatch(cell: SpreadsheetCellAddress, value: string) {
  const row = rows.find((candidate) => getRowId(candidate) === cell.rowId);
  if (!row) return;

  if (row.kind === "level") {
    if (cell.columnId === "code") updateLevel(row.level.id, { code: value });
    if (cell.columnId === "description") updateLevel(row.level.id, { name: value });
    return;
  }

  if (cell.columnId === "code") updateItem(row.item.id, { code: value });
  if (cell.columnId === "description") updateItem(row.item.id, { description: value });
  if (cell.columnId === "unit") updateItem(row.item.id, { unit: value });
  if (cell.columnId === "quantity") updateItem(row.item.id, { quantity: parseSpreadsheetNumber(value) });
}
```

Add shortcut in editor root:

```ts
onKeyDownCapture={(event) => {
  if (!isExcelMode) return;
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "d") {
    event.preventDefault();
    applyBudgetFillDown();
  }
}}
```

- [ ] **Step 9: Run focused tests**

Run: `npm run test -- components/budget/budget-editor.view-mode.test.tsx`

Expected: PASS for new tests and existing view mode tests.

- [ ] **Step 10: Commit**

```bash
git add components/budget/budget-editor.tsx components/budget/budget-editor.view-mode.test.tsx app/globals.css
git commit -m "feat: add budget spreadsheet range editing"
```

---

### Task 5: Compact Budget Row Actions and Badges

**Files:**
- Create: `components/spreadsheet/compact-row-actions.tsx`
- Create: `components/spreadsheet/compact-row-actions.test.tsx`
- Modify: `components/budget/budget-editor.tsx`
- Modify: `components/budget/budget-editor.view-mode.test.tsx`

**Interfaces:**
- Produces:
  - `CompactRowActions`
  - Props:
```ts
type CompactRowAction = {
  id: string;
  label: string;
  icon: React.ReactNode;
  onSelect: () => void;
  disabled?: boolean;
};
```

- [ ] **Step 1: Write failing compact actions test**

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BotMessageSquare } from "lucide-react";
import { CompactRowActions } from "@/components/spreadsheet/compact-row-actions";

it("opens compact row actions and triggers an action", async () => {
  const onSelect = vi.fn();
  render(
    <CompactRowActions
      actions={[
        {
          id: "ai",
          label: "Explicar con IA",
          icon: <BotMessageSquare aria-hidden="true" />,
          onSelect,
        },
      ]}
    />,
  );

  await userEvent.click(screen.getByRole("button", { name: "Abrir acciones de fila" }));
  await userEvent.click(screen.getByRole("menuitem", { name: "Explicar con IA" }));
  expect(onSelect).toHaveBeenCalledTimes(1);
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npm run test -- components/spreadsheet/compact-row-actions.test.tsx`

Expected: FAIL because component does not exist.

- [ ] **Step 3: Implement compact actions component**

```tsx
"use client";

import { useState } from "react";
import { MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

export type CompactRowAction = {
  id: string;
  label: string;
  icon: React.ReactNode;
  onSelect: () => void;
  disabled?: boolean;
};

export function CompactRowActions({ actions, className }: { actions: CompactRowAction[]; className?: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className={cn("relative inline-flex", className)}>
      <button
        type="button"
        className="inline-flex h-7 w-7 items-center justify-center rounded-sm border border-[var(--app-border)] bg-[var(--app-surface)] text-[var(--app-text-muted)] hover:bg-[var(--app-surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
        aria-label="Abrir acciones de fila"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-1 min-w-44 rounded-md border border-[var(--app-border)] bg-[var(--app-surface)] p-1 shadow-lg"
        >
          {actions.map((action) => (
            <button
              key={action.id}
              type="button"
              role="menuitem"
              disabled={action.disabled}
              className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-xs text-[var(--app-text)] hover:bg-[var(--app-surface-hover)] disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() => {
                setOpen(false);
                action.onSelect();
              }}
            >
              <span className="inline-flex h-4 w-4 items-center justify-center">{action.icon}</span>
              {action.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 4: Use compact actions in budget Excel rows**

In `BudgetItemTableRow`, render existing full buttons in modern mode. In Excel mode, replace visible row action button group with:

```tsx
{isExcelMode ? (
  <CompactRowActions
    actions={[
      {
        id: "ai-chat",
        label: "Explicar con IA",
        icon: <BotMessageSquare className="h-3.5 w-3.5" aria-hidden="true" />,
        onSelect: () => onRunAiItemAction("chat", row.item.id),
      },
      {
        id: "apu",
        label: "Abrir APU",
        icon: <Calculator className="h-3.5 w-3.5" aria-hidden="true" />,
        onSelect: () => onOpenApuSheet(row.item),
      },
      {
        id: "more",
        label: "Mas acciones",
        icon: <MoreHorizontal className="h-3.5 w-3.5" aria-hidden="true" />,
        onSelect: () => onToggleItemActionMenu(row.item.id, document.activeElement instanceof HTMLElement ? document.activeElement : document.body),
      },
    ]}
  />
) : (
  existingModernActions
)}
```

Keep existing menu logic and labels.

- [ ] **Step 5: Compact warning badges in Excel mode**

Change budget row warning badges to icon-only with accessible labels in Excel mode:

```tsx
{hasNoApu ? (
  <span
    className={cn(
      "theme-status-warning shrink-0 border font-medium",
      isExcelMode ? "inline-flex h-5 w-5 items-center justify-center rounded-sm text-[10px]" : "rounded-full px-2 py-0.5 text-[11px]",
    )}
    title="Sin APU"
    aria-label="Sin APU"
  >
    {isExcelMode ? "A" : "Sin APU"}
  </span>
) : null}
```

- [ ] **Step 6: Add budget test for compact action**

Add:

```tsx
it("uses compact row actions in Excel mode", async () => {
  renderBudgetEditorInExcelMode();

  expect(screen.getAllByRole("button", { name: "Abrir acciones de fila" }).length).toBeGreaterThan(0);
  expect(screen.queryByRole("button", { name: "Explicar esta partida con IA" })).not.toBeInTheDocument();
});
```

- [ ] **Step 7: Run tests**

Run: `npm run test -- components/spreadsheet/compact-row-actions.test.tsx components/budget/budget-editor.view-mode.test.tsx`

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add components/spreadsheet/compact-row-actions.tsx components/spreadsheet/compact-row-actions.test.tsx components/budget/budget-editor.tsx components/budget/budget-editor.view-mode.test.tsx
git commit -m "feat: compact budget actions in excel mode"
```

---

### Task 6: APU and Subpartida Excel Inheritance Contract

**Files:**
- Modify: `components/apu/apu-editor-sheet.test.tsx`
- Modify: `components/partidas/partida-apu-sheet.test.tsx`
- Modify: `components/apu/apu-editor-sheet.tsx` only if tests expose a missing attribute.
- Modify: `components/partidas/partida-apu-sheet.tsx` only if tests expose a missing attribute.

**Interfaces:**
- Consumes:
  - Existing `data-excel-field-border-scope="apu-editor"`
  - Existing `data-view-mode`
  - Existing CSS variables from `getExcelViewCssVariables`

- [ ] **Step 1: Add failing or confirming tests**

Add to APU editor tests:

```tsx
it("keeps subpartida dialog in the same Excel visual scope as the APU editor", async () => {
  renderApuEditorSheetInExcelMode({
    excelShowFieldBorders: true,
    excelRowHeight: 52,
    currencyDecimals: 3,
  });

  await userEvent.click(screen.getByRole("button", { name: /agregar subpartida/i }));

  const dialog = screen.getByRole("dialog");
  expect(dialog).toHaveAttribute("data-view-mode", "excel");
  expect(dialog).toHaveAttribute("data-excel-field-border-scope", "apu-editor");
  expect(dialog).toHaveStyle("--excel-row-height: 52px");
  expect(dialog).toHaveStyle("--excel-field-border-color: #cbd5e1");
});
```

Add equivalent test to `components/partidas/partida-apu-sheet.test.tsx`.

- [ ] **Step 2: Run tests**

Run: `npm run test -- components/apu/apu-editor-sheet.test.tsx components/partidas/partida-apu-sheet.test.tsx`

Expected: PASS if current implementation already satisfies the contract; FAIL only if a dialog misses an attribute or CSS variable.

- [ ] **Step 3: Fix only missing attributes**

If a dialog lacks scope, add:

```tsx
data-excel-field-border-scope="apu-editor"
data-view-mode={isExcelMode ? "excel" : "modern"}
style={excelCssVariables}
```

Do not change APU calculation code.

- [ ] **Step 4: Run tests again**

Run: `npm run test -- components/apu/apu-editor-sheet.test.tsx components/partidas/partida-apu-sheet.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/apu/apu-editor-sheet.test.tsx components/partidas/partida-apu-sheet.test.tsx components/apu/apu-editor-sheet.tsx components/partidas/partida-apu-sheet.tsx
git commit -m "test: lock apu excel inheritance contract"
```

---

### Task 7: Metrado Sheet Shared Selection Adoption

**Files:**
- Modify: `components/metrados/MetradoSheetTable.tsx`
- Test: `components/metrados/MetradoSheetTable.test.tsx` if present; otherwise create `components/metrados/MetradoSheetTable.test.tsx`.

**Interfaces:**
- Consumes:
  - `useSpreadsheetSelection`
  - `getCellKey`
  - Existing drag-fill behavior

- [ ] **Step 1: Write metrado selection test**

```tsx
it("marks active and selected metrado cells in Excel mode", async () => {
  renderMetradoSheetTableInExcelMode();

  const sectorInput = screen.getByRole("textbox", { name: "Sector fila 1" });
  await userEvent.click(sectorInput);

  const cell = sectorInput.closest("td");
  expect(cell).toHaveAttribute("data-spreadsheet-active", "true");
  expect(cell).toHaveAttribute("data-spreadsheet-selected", "true");
});
```

If accessible names differ, assign them in the component as part of this task:

```tsx
aria-label={`Sector fila ${displayIndex}`}
```

- [ ] **Step 2: Run test**

Run: `npm run test -- components/metrados/MetradoSheetTable.test.tsx`

Expected: FAIL until shared attributes are wired.

- [ ] **Step 3: Build metrado row definitions**

Inside `MetradoSheetTable`:

```ts
const spreadsheetRows = useMemo(
  () =>
    rows
      .filter((row) => !row.groupLabel)
      .map((row) => ({
        id: row.id,
        columns: [
          { id: "sector", editable: true },
          { id: "eje", editable: true },
          { id: "nivel", editable: true },
          { id: "description", editable: true },
          ...inputColumns.map((key) => ({ id: key, editable: true })),
        ],
      })),
  [inputColumns, rows],
);
const spreadsheetSelection = useSpreadsheetSelection({ rows: spreadsheetRows });
```

- [ ] **Step 4: Mark cells**

In `TextCell` and `NumericCell`, add props:

```ts
cellKey: string;
activeSpreadsheet: boolean;
selectedSpreadsheet: boolean;
```

Apply:

```tsx
data-spreadsheet-active={activeSpreadsheet ? "true" : undefined}
data-spreadsheet-selected={selectedSpreadsheet ? "true" : undefined}
```

Call `spreadsheetSelection.activateCell({ rowId: row.id, columnId: "sector" })` when focusing each cell.

- [ ] **Step 5: Preserve drag-fill**

Do not remove `DragHandle`, `dragFillRef`, or existing `onPointerDown` logic. Add shared selection only as visual and future keyboard state.

- [ ] **Step 6: Run tests**

Run: `npm run test -- components/metrados/MetradoSheetTable.test.tsx lib/metrados`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add components/metrados/MetradoSheetTable.tsx components/metrados/MetradoSheetTable.test.tsx
git commit -m "feat: align metrado sheet selection with excel mode"
```

---

### Task 8: Resource and Partida Tables Density Contract

**Files:**
- Modify: `components/resources/resources-table.tsx`
- Modify: `components/resources/resources-table.test.tsx`
- Modify: `components/partidas/partidas-table.tsx`
- Modify: `components/partidas/partidas-table.test.tsx`

**Interfaces:**
- Consumes:
  - Existing `useVirtualTableWindow`
  - Existing `excelRowHeight`
  - Existing `getTableFrameClassName`

- [ ] **Step 1: Add tests for Excel row height**

In resources test:

```tsx
it("uses the configured Excel row height for resource rows", () => {
  mockFormattingSettings({ excelRowHeight: 52 });
  renderResourcesTableInExcelMode();

  expect(screen.getAllByRole("row")[1]).toHaveStyle({ height: "52px" });
});
```

In partidas test:

```tsx
it("uses the configured Excel row height for partida rows", () => {
  mockFormattingSettings({ excelRowHeight: 52 });
  renderPartidasTableInExcelMode();

  expect(screen.getAllByRole("row")[1]).toHaveStyle({ height: "52px" });
});
```

- [ ] **Step 2: Run tests**

Run: `npm run test -- components/resources/resources-table.test.tsx components/partidas/partidas-table.test.tsx`

Expected: PASS if current coverage already matches; FAIL if row style is not applied to all rows.

- [ ] **Step 3: Fix row height consistency**

Ensure resource and partida rows use:

```tsx
style={{ height: isExcelMode ? excelRowHeight : RESOURCE_ROW_HEIGHT }}
```

and:

```tsx
style={{ height: isExcelMode ? excelRowHeight : PARTIDA_ROW_HEIGHT }}
```

Keep virtualized row height values synchronized with these row styles.

- [ ] **Step 4: Compact row actions only in Excel mode**

Where resource/partida rows expose multiple inline action buttons, use `CompactRowActions` in Excel mode and preserve current buttons in modern mode.

- [ ] **Step 5: Run tests**

Run: `npm run test -- components/resources/resources-table.test.tsx components/partidas/partidas-table.test.tsx`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add components/resources/resources-table.tsx components/resources/resources-table.test.tsx components/partidas/partidas-table.tsx components/partidas/partidas-table.test.tsx
git commit -m "feat: standardize catalog excel density"
```

---

### Task 9: Formula and General Budget Tables Excel Consistency

**Files:**
- Modify: `components/budget/polynomial-monomials-table.tsx`
- Modify: `components/budget/polynomial-monomials-table.test.tsx`
- Modify: `components/budget/general-budget-footer-table.tsx`
- Modify: `components/budget/general-budget-footer-table.test.ts`
- Modify: `components/budget/general-budget-resources-table.tsx` if present and table-like.

**Interfaces:**
- Consumes:
  - `useAppViewMode`
  - `getTableFrameClassName`
  - `getExcelViewCssVariables`

- [ ] **Step 1: Add formula table tests**

```tsx
it("renders monomial table inside Excel table frame when Excel mode is active", () => {
  renderPolynomialMonomialsTableInExcelMode();

  expect(screen.getByTestId("polynomial-monomials-table-frame")).toHaveClass("rounded-none");
});
```

- [ ] **Step 2: Add general budget footer tests**

```ts
it("applies Excel field control height to footer percentage inputs", () => {
  renderGeneralBudgetFooterTableInExcelMode({ excelRowHeight: 52 });

  expect(screen.getByLabelText(/igv/i)).toHaveClass("h-[var(--excel-control-height)]");
});
```

- [ ] **Step 3: Run tests**

Run: `npm run test -- components/budget/polynomial-monomials-table.test.tsx components/budget/general-budget-footer-table.test.ts`

Expected: FAIL where test ids or classes are not wired.

- [ ] **Step 4: Apply shared table frame and data attributes**

Wrap polynomial table:

```tsx
<div data-testid="polynomial-monomials-table-frame" className={getTableFrameClassName(isExcelMode)}>
  existingTable
</div>
```

Ensure footer table root has:

```tsx
data-view-mode={isExcelMode ? "excel" : "modern"}
style={excelCssVariables}
```

- [ ] **Step 5: Run tests**

Run: `npm run test -- components/budget/polynomial-monomials-table.test.tsx components/budget/general-budget-footer-table.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add components/budget/polynomial-monomials-table.tsx components/budget/polynomial-monomials-table.test.tsx components/budget/general-budget-footer-table.tsx components/budget/general-budget-footer-table.test.ts
git commit -m "feat: align formula tables with excel mode"
```

---

### Task 10: CSS Cleanup and Design Documentation

**Files:**
- Modify: `app/globals.css`
- Modify: `app/globals.test.ts`
- Modify: `DESIGN.md`

**Interfaces:**
- Consumes:
  - Existing global Excel CSS selectors.
  - New spreadsheet data attributes.

- [ ] **Step 1: Add globals test for range selectors**

```ts
it("includes Excel spreadsheet selection styling", () => {
  expect(globalsCss).toContain('[data-view-mode="excel"] [data-spreadsheet-selected="true"]');
  expect(globalsCss).toContain('[data-view-mode="excel"] [data-spreadsheet-active="true"]');
});
```

- [ ] **Step 2: Run globals test**

Run: `npm run test -- app/globals.test.ts`

Expected: PASS if Task 4 added CSS; FAIL otherwise.

- [ ] **Step 3: Remove duplicated module-specific CSS only when covered**

Keep selectors for:

```css
[data-view-mode="excel"] .ui-table
[data-view-mode="excel"] .ui-table-cell
[data-view-mode="excel"] .ui-table-head-cell
[data-view-mode="excel"] .ui-button
[data-view-mode="excel"] .ui-card
[data-view-mode="excel"] [data-spreadsheet-selected="true"]
[data-view-mode="excel"] [data-spreadsheet-active="true"]
```

Move module-specific selectors into component class helpers only if the component has a test asserting the same behavior.

- [ ] **Step 4: Document Excel mode contract**

Add to `DESIGN.md` under the tables/Excel section:

```md
### Excel Mode Interaction Contract

- `data-view-mode="excel"` activates compact spreadsheet styling.
- `--excel-row-height` controls table row height for compatible tables.
- Editable cells expose `data-spreadsheet-active` and `data-spreadsheet-selected` when participating in range selection.
- Derived financial cells may be selected visually but must not become editable unless the underlying business model supports editing.
- APU subpartida dialogs inherit the parent APU density, row height, field borders, currency decimals, and table column language.
- Compact row actions are preferred in Excel mode when inline actions would reduce data density.
```

- [ ] **Step 5: Run tests**

Run: `npm run test -- app/globals.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add app/globals.css app/globals.test.ts DESIGN.md
git commit -m "docs: define excel mode interaction contract"
```

---

### Task 11: Final Verification

**Files:**
- No code files unless verification exposes a defect.

- [ ] **Step 1: Run full test suite**

Run: `npm run test`

Expected: PASS.

- [ ] **Step 2: Run lint**

Run: `npm run lint`

Expected: PASS.

- [ ] **Step 3: Run production build**

Run: `node ./node_modules/next/dist/bin/next build`

Expected: PASS.

- [ ] **Step 4: Manual QA with dev server**

Run: `npm run dev`

Expected: local Next.js dev server starts.

Check:

- Budget editor switches between Moderna and Tipo Excel.
- Budget Excel row height changes after updating settings.
- Budget Arrow/Enter/Tab navigation still works.
- Budget Shift+Arrow range selection marks cells.
- Budget Ctrl+D fills down editable values only.
- Budget paste from Excel still opens the guided paste flow for structured content.
- APU editor opens in Excel mode and keeps compact density.
- Subpartida popup inherits APU density and borders.
- Metrado drag-fill still works.
- Resources and partidas remain virtualized and compact.
- Formula and general budget tables keep readable compact controls.

- [ ] **Step 5: Commit verification fixes if needed**

If a defect is found, add the smallest focused test and fix, then commit:

```bash
git add <changed-files>
git commit -m "fix: stabilize excel mode verification"
```

---

## Delivery Notes

Recommended implementation order:

1. Tasks 1-3 create reusable primitives.
2. Tasks 4-6 upgrade the highest-value budget/APU flow.
3. Tasks 7-9 spread the contract to adjacent spreadsheet-heavy modules.
4. Tasks 10-11 lock documentation and verification.

Recommended checkpoint after Task 6:

- Budget and APU should already feel materially better in Excel mode.
- If schedule pressure exists, ship Task 6 as Phase 1 and move Tasks 7-11 to Phase 2.

## Self-Review

Spec coverage:

- Global state and settings are preserved by using existing files.
- Budget productivity is covered by Tasks 4 and 5.
- APU/subpartida inheritance is covered by Task 6.
- Metrados are covered by Task 7.
- Resources and partidas are covered by Task 8.
- Formula and general budget tables are covered by Task 9.
- CSS/design documentation is covered by Task 10.
- Verification is covered by Task 11.

Placeholder scan:

- No `TBD`, `TODO`, or unspecified "handle edge cases" placeholders remain.
- Each code step includes concrete snippets or exact behavior.

Type consistency:

- Shared names use `SpreadsheetCellAddress`, `SpreadsheetRowDefinition`, `getCellKey`, `useSpreadsheetSelection`, and `useSpreadsheetKeyboard` consistently across tasks.
