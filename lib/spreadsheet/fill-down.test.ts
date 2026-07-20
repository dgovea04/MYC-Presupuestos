/* @vitest-environment jsdom */

import { describe, expect, it } from "vitest";
import { createFillDownPatches, type SpreadsheetCellValueMap } from "@/lib/spreadsheet/fill-down";

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

  it("returns no patches when source has no value", () => {
    const values: SpreadsheetCellValueMap = new Map();
    expect(
      createFillDownPatches({
        source: { rowId: "row-1", columnId: "unit" },
        targets: [{ rowId: "row-2", columnId: "unit" }],
        values,
      }),
    ).toEqual([]);
  });
});
