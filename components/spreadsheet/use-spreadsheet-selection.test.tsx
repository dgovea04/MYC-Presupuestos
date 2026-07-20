/* @vitest-environment jsdom */

import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useSpreadsheetSelection } from "@/components/spreadsheet/use-spreadsheet-selection";
import type { SpreadsheetRowDefinition } from "@/lib/spreadsheet/cell-address";

const rows: SpreadsheetRowDefinition[] = [
  { id: "row-1", columns: [{ id: "code", editable: true }, { id: "description", editable: true }] },
  { id: "row-2", columns: [{ id: "code", editable: true }, { id: "description", editable: true }] },
];

describe("useSpreadsheetSelection", () => {
  it("tracks active cell and rectangular selection", () => {
    const { result } = renderHook(() => useSpreadsheetSelection({ rows }));

    act(() => result.current.activateCell({ rowId: "row-1", columnId: "code" }));
    expect(result.current.activeCell).toEqual({ rowId: "row-1", columnId: "code" });
    expect(result.current.selectedCells).toEqual([{ rowId: "row-1", columnId: "code" }]);
    expect(result.current.isCellActive({ rowId: "row-1", columnId: "code" })).toBe(true);
    expect(result.current.isCellSelected({ rowId: "row-1", columnId: "code" })).toBe(true);

    act(() => result.current.extendSelectionTo({ rowId: "row-2", columnId: "description" }));
    expect(result.current.selectedCells).toEqual([
      { rowId: "row-1", columnId: "code" },
      { rowId: "row-1", columnId: "description" },
      { rowId: "row-2", columnId: "code" },
      { rowId: "row-2", columnId: "description" },
    ]);
  });

  it("supports activating a new cell", () => {
    const { result } = renderHook(() => useSpreadsheetSelection({ rows }));

    act(() => result.current.activateCell({ rowId: "row-2", columnId: "description" }));
    expect(result.current.activeCell).toEqual({ rowId: "row-2", columnId: "description" });
    expect(result.current.selectedCells).toEqual([{ rowId: "row-2", columnId: "description" }]);
  });

  it("clears the selection", () => {
    const { result } = renderHook(() => useSpreadsheetSelection({ rows }));

    act(() => result.current.activateCell({ rowId: "row-1", columnId: "code" }));
    act(() => result.current.clearSelection());
    expect(result.current.activeCell).toBeNull();
    expect(result.current.selectedCells).toEqual([]);
  });
});
