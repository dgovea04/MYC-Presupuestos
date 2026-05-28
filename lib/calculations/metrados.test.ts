import { describe, expect, test } from "vitest";

import {
  calculateMetradoRow,
  calculateMetradoSheet,
} from "@/lib/calculations/metrados";
import type { MetradoRowRecord } from "@/types/metrado";

function row(overrides: Partial<MetradoRowRecord>): MetradoRowRecord {
  return {
    id: "row-1",
    sheetId: "sheet-1",
    sector: "Sector A",
    eje: "Eje 1",
    nivel: "Nivel 1",
    description: "Elemento",
    unit: "m3",
    formulaKey: "volume",
    inputs: {},
    partial: 0,
    sortOrder: 1,
    ...overrides,
  };
}

describe("metrado calculations", () => {
  test("calculates concrete volume with decimal-safe math", () => {
    const result = calculateMetradoRow(
      row({ inputs: { largo: 1.1, ancho: 2.2, alto: 3.3 } }),
    );

    expect(result.partial).toBe(7.986);
  });

  test("calculates rebar weight", () => {
    const result = calculateMetradoRow(
      row({
        unit: "kg",
        formulaKey: "rebarWeight",
        inputs: { cantidad: 12, longitud: 3.5, pesoUnitario: 0.617 },
      }),
    );

    expect(result.partial).toBe(25.914);
  });

  test("groups totals by unit and primary unit", () => {
    const result = calculateMetradoSheet({
      unit: "m2",
      rows: [
        row({
          id: "row-1",
          unit: "m2",
          formulaKey: "area",
          inputs: { largo: 2, ancho: 3 },
        }),
        row({
          id: "row-2",
          unit: "m2",
          formulaKey: "area",
          inputs: { largo: 4, ancho: 5 },
        }),
        row({
          id: "row-3",
          unit: "kg",
          formulaKey: "manual",
          inputs: { manual: 9 },
        }),
      ],
    });

    expect(result.primaryTotal).toBe(26);
    expect(result.totalsByUnit.m2).toBe(26);
    expect(result.totalsByUnit.kg).toBe(9);
  });
});
