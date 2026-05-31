import { describe, expect, it } from "vitest";

import { normalizeExcelCellText } from "@/lib/seed/excel-cell-text";

describe("normalizeExcelCellText", () => {
  it("normalizes rich text cells without producing object Object", () => {
    expect(
      normalizeExcelCellText({
        richText: [
          { text: "CONCRETO " },
          { text: "F'C=210 KG/CM2" },
        ],
      }),
    ).toBe("CONCRETO F'C=210 KG/CM2");
  });

  it("normalizes formula and hyperlink text cells", () => {
    expect(normalizeExcelCellText({ formula: "A1", result: "MURO DE LADRILLO" })).toBe("MURO DE LADRILLO");
    expect(normalizeExcelCellText({ text: "ACERO FY=4200", hyperlink: "https://example.com" })).toBe("ACERO FY=4200");
  });
});
