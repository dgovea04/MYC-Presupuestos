import { describe, expect, test } from "vitest";

import {
  assertMetradoRowsArePersistable,
  buildBudgetItemQuantityPatch,
  buildMetradoRowCreateData,
  buildMetradoPartidaLinkCreateInput,
  parseMetradoInputs,
} from "@/lib/data/metrados";
import type { MetradoRowRecord } from "@/types/metrado";

function row(overrides: Partial<MetradoRowRecord> = {}): MetradoRowRecord {
  return {
    id: "caller-row-id",
    sheetId: "old-sheet-id",
    sector: "Sector A",
    eje: "Eje 1",
    nivel: "Nivel 1",
    description: "Elemento",
    unit: "m3",
    formulaKey: "volume",
    inputs: { largo: 2, ancho: 3, alto: 4 },
    partial: 24,
    sortOrder: 1,
    ...overrides,
  };
}

describe("metrado data helpers", () => {
  test("parses JSON formula inputs into numeric input records", () => {
    expect(parseMetradoInputs({ largo: 2, ancho: "3", ignored: true })).toEqual({
      largo: 2,
      ancho: 3,
    });
  });

  test("ignores invalid numeric strings when parsing JSON formula inputs", () => {
    expect(parseMetradoInputs({ largo: "abc", ancho: "", alto: " 2.5 " })).toEqual({
      alto: 2.5,
    });
  });

  test("builds the budget item quantity patch from the primary total", () => {
    expect(buildBudgetItemQuantityPatch(12.3456)).toEqual({
      quantity: 12.346,
    });
  });

  test("builds metrado partida link create input with required budget id", () => {
    expect(
      buildMetradoPartidaLinkCreateInput({
        sheetId: "sheet-1",
        budgetId: "budget-1",
        budgetItemId: "item-1",
      }),
    ).toEqual({
      sheetId: "sheet-1",
      budgetId: "budget-1",
      budgetItemId: "item-1",
    });
  });

  test("builds row create data without persisting caller-provided row ids", () => {
    expect(buildMetradoRowCreateData(row(), "sheet-1")).toEqual({
      sheetId: "sheet-1",
      sector: "Sector A",
      eje: "Eje 1",
      nivel: "Nivel 1",
      description: "Elemento",
      unit: "m3",
      formulaKey: "volume",
      inputs: { largo: 2, ancho: 3, alto: 4 },
      partial: 24,
      sortOrder: 1,
    });
  });

  test("rejects rows that are not persistable for the selected template", () => {
    expect(() =>
      assertMetradoRowsArePersistable({
        sheetUnit: "m3",
        templateFormulaKeys: ["volume"],
        linkedPartidaUnit: "m3",
        rows: [
          row({
            formulaKey: "bad" as unknown as MetradoRowRecord["formulaKey"],
          }),
        ],
      }),
    ).toThrow("No se pueden guardar filas de metrado con errores de validacion.");
  });
});
