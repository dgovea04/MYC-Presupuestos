import { describe, expect, it } from "vitest";
import { calculateBudgetFooterBuilder } from "@/lib/calculations/budget-footer-builder";

describe("calculateBudgetFooterBuilder", () => {
  it("evaluates formulas using row variables and system values", () => {
    const result = calculateBudgetFooterBuilder({
      totalDirectCost: 47000.66,
      totalGeneralExpenses: 22106.0084,
      currencyDecimals: 4,
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

  it("uses configured budget totals for base variables and formulas for subtotal, total, and custom rows", () => {
    const result = calculateBudgetFooterBuilder({
      totalDirectCost: 280340.694,
      totalGeneralExpenses: 39051.456,
      totalUtility: 22427.255,
      subtotal: 1,
      totalTax: 61527.493,
      totalAmount: 1,
      currencyDecimals: 2,
      rows: [
        { id: "1", variable: "CD", description: "Costo directo", formula: null, manualValue: 0, iu: null, highlight: true, sortOrder: 0 },
        { id: "2", variable: "PGG", description: "Gastos generales", formula: "CD*0.10", manualValue: 0, iu: null, highlight: false, sortOrder: 1 },
        { id: "3", variable: "UTI", description: "Utilidad", formula: "CD*0.08", manualValue: 0, iu: null, highlight: false, sortOrder: 2 },
        { id: "4", variable: "ST", description: "Sub total", formula: "CD+PGG+UTI", manualValue: 0, iu: null, highlight: true, sortOrder: 3 },
        { id: "5", variable: "IGV", description: "IGV", formula: "CD*0.18", manualValue: 0, iu: null, highlight: false, sortOrder: 4 },
        { id: "6", variable: "TOTAL", description: "Total", formula: "ST+IGV", manualValue: 0, iu: null, highlight: true, sortOrder: 5 },
        { id: "7", variable: "CUSTOM", description: "Custom", formula: "TOTAL*0.10", manualValue: 0, iu: null, highlight: false, sortOrder: 6 },
      ],
    });

    expect(result.rows.map((row) => row.value)).toEqual([
      280340.69,
      39051.46,
      22427.26,
      341819.41,
      61527.49,
      403346.9,
      40334.69,
    ]);
  });
});
