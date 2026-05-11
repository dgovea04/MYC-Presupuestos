import { describe, expect, it } from "vitest";
import { calculateBudgetFooterBuilder } from "@/lib/calculations/budget-footer-builder";

describe("calculateBudgetFooterBuilder", () => {
  it("evaluates formulas using row variables and system values", () => {
    const result = calculateBudgetFooterBuilder({
      totalDirectCost: 47000.66,
      totalGeneralExpenses: 22106.0084,
      rows: [
        { id: "1", variable: "CD", description: "Costo directo", formula: null, manualValue: 0, iu: null, highlight: true, sortOrder: 0 },
        { id: "2", variable: "PGG", description: "GG", formula: null, manualValue: 0, iu: "39", highlight: false, sortOrder: 1 },
        { id: "3", variable: "UTI", description: "Utilidad", formula: "CD * 0.10", manualValue: 0, iu: "39", highlight: false, sortOrder: 2 },
        { id: "4", variable: "ST", description: "Subtotal", formula: "CD + PGG + UTI", manualValue: 0, iu: null, highlight: true, sortOrder: 3 },
      ],
    });

    expect(result.rows.map((row) => ({ variable: row.variable, value: row.value, error: row.error }))).toEqual([
      { variable: "CD", value: 47000.66, error: null },
      { variable: "PGG", value: 22106.0084, error: null },
      { variable: "UTI", value: 4700.066, error: null },
      { variable: "ST", value: 73806.7344, error: null },
    ]);
  });

  it("marks invalid formulas and missing variables", () => {
    const result = calculateBudgetFooterBuilder({
      totalDirectCost: 1,
      totalGeneralExpenses: 1,
      rows: [
        { id: "1", variable: "A", description: "A", formula: "B + 1", manualValue: 0, iu: null, highlight: false, sortOrder: 0 },
      ],
    });

    expect(result.rows[0]?.error).toBe("Variable no encontrada: B");
  });
});
