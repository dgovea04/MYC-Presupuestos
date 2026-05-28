import { describe, expect, test } from "vitest";

import { validateMetradoSheet } from "@/lib/metrados/validation";
import type { MetradoRowRecord } from "@/types/metrado";

const validRow: MetradoRowRecord = {
  id: "row-1",
  sheetId: "sheet-1",
  sector: "Sector A",
  eje: "Eje 1",
  nivel: "Nivel 1",
  description: "Zapata",
  unit: "m3",
  formulaKey: "volume",
  inputs: { largo: 2, ancho: 3, alto: 0.5 },
  partial: 3,
  sortOrder: 1,
};

describe("validateMetradoSheet", () => {
  test("blocks an empty sheet from sending totals", () => {
    const issues = validateMetradoSheet({
      sheetUnit: "m3",
      templateFormulaKeys: ["volume"],
      linkedPartidaUnit: "m3",
      rows: [],
    });

    expect(issues).toEqual([
      {
        id: "sheet-empty",
        severity: "error",
        message: "La hoja debe tener al menos una fila de metrado.",
      },
    ]);
  });

  test("flags unsupported formula keys for the selected template", () => {
    const issues = validateMetradoSheet({
      sheetUnit: "m3",
      templateFormulaKeys: ["volume"],
      linkedPartidaUnit: "m3",
      rows: [{ ...validRow, formulaKey: "area" }],
    });

    expect(issues.some((issue) => issue.id === "row-1-formula-unsupported")).toBe(true);
  });

  test("flags mixed units when linked partida unit differs", () => {
    const issues = validateMetradoSheet({
      sheetUnit: "m3",
      templateFormulaKeys: ["volume"],
      linkedPartidaUnit: "m2",
      rows: [validRow],
    });

    expect(issues.some((issue) => issue.id === "sheet-linked-unit-mismatch")).toBe(true);
  });

  test("accepts uppercase linked partida unit when it matches the metrado unit", () => {
    const issues = validateMetradoSheet({
      sheetUnit: "m3",
      templateFormulaKeys: ["volume"],
      linkedPartidaUnit: " M3 ",
      rows: [validRow],
    });

    expect(issues.some((issue) => issue.id === "sheet-linked-unit-mismatch")).toBe(false);
  });
});
