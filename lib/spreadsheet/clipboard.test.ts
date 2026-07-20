/* @vitest-environment jsdom */

import { describe, expect, it } from "vitest";
import { parseSpreadsheetClipboard, serializeSpreadsheetClipboard } from "@/lib/spreadsheet/clipboard";

describe("spreadsheet clipboard helpers", () => {
  it("parses Excel-style TSV text", () => {
    expect(parseSpreadsheetClipboard("01.01\tExcavacion\tm3\n01.02\tRelleno\tm3")).toEqual([
      ["01.01", "Excavacion", "m3"],
      ["01.02", "Relleno", "m3"],
    ]);
  });

  it("serializes cells to TSV text", () => {
    expect(
      serializeSpreadsheetClipboard([
        ["01.01", "Excavacion"],
        ["01.02", "Relleno"],
      ]),
    ).toBe("01.01\tExcavacion\n01.02\tRelleno");
  });
});
