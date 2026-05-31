import { describe, expect, it } from "vitest";
import { calculateBudgetFooterSummary } from "@/lib/calculations/budget-footer";

describe("calculateBudgetFooterSummary", () => {
  it("builds the footer rows using calculated general expenses", () => {
    const result = calculateBudgetFooterSummary({
      totalDirectCost: 47000.66,
      totalGeneralExpenses: 22106.00842,
      utilityRate: 0.1,
      igvRate: 0.18,
      currency: "PEN",
    });

    expect(result.rows).toEqual([
      expect.objectContaining({ code: "CD", value: 47000.66, iu: "", highlight: true }),
      expect.objectContaining({ code: "PGG", value: 22106.00842, formula: "CD * 0.470334", iu: "39", highlight: false }),
      expect.objectContaining({ code: "UTI", value: 4700.066, formula: "CD * 0.1", iu: "39", highlight: false }),
      expect.objectContaining({ code: "ST", value: 73806.73442, iu: "", highlight: true }),
      expect.objectContaining({ code: "IGV", value: 8460.1188, formula: "CD * 0.18", iu: "", highlight: false }),
      expect.objectContaining({ code: "TOTAL", value: 82266.85322, iu: "", highlight: true }),
    ]);
  });

  it("renders the amount in words in spanish uppercase", () => {
    const result = calculateBudgetFooterSummary({
      totalDirectCost: 47000.66,
      totalGeneralExpenses: 22106.00842,
      utilityRate: 0.1,
      igvRate: 0.18,
      currency: "PEN",
    });

    expect(result.amountInWords).toBe("SON: OCHENTA Y DOS MIL DOSCIENTOS SESENTA Y SEIS CON 85/100 SOLES");
  });

  it("keeps formulas stable when direct cost is zero", () => {
    const result = calculateBudgetFooterSummary({
      totalDirectCost: 0,
      totalGeneralExpenses: 0,
      utilityRate: 0.1,
      igvRate: 0.18,
      currency: "PEN",
    });

    expect(result.rows).toEqual([
      expect.objectContaining({ code: "CD", value: 0, formula: "" }),
      expect.objectContaining({ code: "PGG", value: 0, formula: "CD * 0" }),
      expect.objectContaining({ code: "UTI", value: 0, formula: "CD * 0.1" }),
      expect.objectContaining({ code: "ST", value: 0, formula: "CD + PGG + UTI" }),
      expect.objectContaining({ code: "IGV", value: 0, formula: "CD * 0.18" }),
      expect.objectContaining({ code: "TOTAL", value: 0, formula: "ST + IGV" }),
    ]);
    expect(result.amountInWords).toBe("SON: CERO CON 00/100 SOLES");
  });
});
