/* @vitest-environment jsdom */

import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
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

describe("useSpreadsheetKeyboard", () => {
  it("moves active cell with arrow keys", () => {
    const focused: Array<SpreadsheetCellAddress> = [];
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

  it("extends selection with shift+arrow keys", () => {
    const focused: Array<SpreadsheetCellAddress> = [];
    const extended: SpreadsheetCellAddress[] = [];
    const { result } = renderHook(() =>
      useSpreadsheetKeyboard({
        rows,
        activeCell: { rowId: "row-1", columnId: "code" },
        focusCell: (cell) => focused.push(cell),
        extendSelectionTo: (cell) => extended.push(cell),
      }),
    );

    result.current.onCellKeyDown(createKeyboardEvent("ArrowDown", true));
    expect(focused).toEqual([]);
    expect(extended).toEqual([{ rowId: "row-2", columnId: "code" }]);
  });

  it("ignores keys when alt or ctrl is held", () => {
    const focused: Array<SpreadsheetCellAddress> = [];
    const extended: SpreadsheetCellAddress[] = [];
    const { result } = renderHook(() =>
      useSpreadsheetKeyboard({
        rows,
        activeCell: { rowId: "row-1", columnId: "code" },
        focusCell: (cell) => focused.push(cell),
        extendSelectionTo: (cell) => extended.push(cell),
      }),
    );

    const event = createKeyboardEvent("ArrowRight");
    Object.defineProperty(event, "altKey", { value: true });
    result.current.onCellKeyDown(event);
    expect(focused).toEqual([]);
    expect(extended).toEqual([]);
  });
});
