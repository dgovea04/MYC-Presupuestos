/* @vitest-environment jsdom */

import { describe, expect, it } from "vitest";
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
    expect(
      getAdjacentEditableCell({ rows, cell: { rowId: "row-1", columnId: "code" }, direction: "right" }),
    ).toEqual({ rowId: "row-1", columnId: "description" });
    expect(
      getAdjacentEditableCell({ rows, cell: { rowId: "row-1", columnId: "description" }, direction: "down" }),
    ).toEqual({ rowId: "row-2", columnId: "description" });
    expect(
      getAdjacentEditableCell({ rows, cell: { rowId: "row-2", columnId: "description" }, direction: "right" }),
    ).toBeNull();
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
