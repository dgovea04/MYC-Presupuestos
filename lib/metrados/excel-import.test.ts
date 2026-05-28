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
});
