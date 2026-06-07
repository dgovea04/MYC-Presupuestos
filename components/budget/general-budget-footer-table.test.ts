import { describe, expect, it } from "vitest";
import { getDisplayDescription } from "@/components/budget/general-budget-footer-table";

describe("getDisplayDescription", () => {
  it("replaces stale general expenses percentages with the effective rate", () => {
    expect(
      getDisplayDescription(
        {
          variable: "PGG",
          description: "GASTOS GENERALES 47.03%",
        },
        { generalExpensesRate: 0.1, utilityRate: 0.08, igvRate: 0.18, percentageDecimals: 2 },
      ),
    ).toBe("GASTOS GENERALES 10%");
  });

  it("uses imported S10 GG rows as general expenses descriptions", () => {
    expect(
      getDisplayDescription(
        {
          variable: "GG",
          description: "GASTOS GENERALES (12.5%)",
        },
        { generalExpensesRate: 0.125, utilityRate: 0.075, igvRate: 0.19, percentageDecimals: 2 },
      ),
    ).toBe("GASTOS GENERALES 12.50%");
  });

  it("replaces stale utility and IGV percentages with their effective rates", () => {
    const rates = { generalExpensesRate: 0.1, utilityRate: 0.075, igvRate: 0.19, percentageDecimals: 2 };

    expect(getDisplayDescription({ variable: "UTI", description: "UTILIDAD 10.00%" }, rates)).toBe("UTILIDAD 7.50%");
    expect(getDisplayDescription({ variable: "IGV", description: "IGV 18.00%" }, rates)).toBe("IGV 19%");
  });

  it("uses the configured decimal count only for non-integer description percentages", () => {
    const rates = { generalExpensesRate: 0.12345, utilityRate: 0.08, igvRate: 0.18, percentageDecimals: 3 };

    expect(getDisplayDescription({ variable: "PGG", description: "GASTOS GENERALES" }, rates)).toBe(
      "GASTOS GENERALES 12.345%",
    );
    expect(getDisplayDescription({ variable: "UTI", description: "UTILIDAD" }, rates)).toBe("UTILIDAD 8%");
    expect(getDisplayDescription({ variable: "IGV", description: "IGV" }, rates)).toBe("IGV 18%");
  });
});
