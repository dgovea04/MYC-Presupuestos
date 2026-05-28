import { describe, expect, test } from "vitest";

import { normalizeMetradoImportRows } from "@/lib/metrados/excel-import";

describe("normalizeMetradoImportRows", () => {
  test("converts raw rows into draft metrado rows", () => {
    const result = normalizeMetradoImportRows([
      {
        sector: "A",
        eje: "1",
        nivel: "N1",
        description: "Zapata",
        unit: "m3",
        formulaKey: "volume",
        largo: 2,
        ancho: 3,
        alto: 1,
      },
    ]);

    expect(result.rows[0]).toMatchObject({
      sector: "A",
      unit: "m3",
      formulaKey: "volume",
      inputs: { largo: 2, ancho: 3, alto: 1 },
    });
    expect(result.issues).toEqual([]);
  });

  test("reports invalid unit and formula with safe fallbacks", () => {
    const result = normalizeMetradoImportRows([
      {
        sector: "B",
        unit: "pies",
        formulaKey: "unsupported",
        manual: 4,
      },
    ]);

    expect(result.rows[0]).toMatchObject({
      unit: "und",
      formulaKey: "manual",
      inputs: { manual: 4 },
    });
    expect(result.issues).toEqual([
      expect.objectContaining({ field: "unit", rowId: "import-row-1" }),
      expect.objectContaining({ field: "formulaKey", rowId: "import-row-1" }),
    ]);
  });
});
