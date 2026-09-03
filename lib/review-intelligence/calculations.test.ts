import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";
import { calculateQuantityDifference } from "./calculations";
import { normalizeUnit } from "./units";

describe("review intelligence units", () => {
  it("normalizes equivalent square-metre spellings without inventing conversions", () => {
    expect(normalizeUnit("m²")).toEqual(normalizeUnit("M2"));
    expect(normalizeUnit("M2")).toEqual(normalizeUnit("m2"));
    expect(normalizeUnit("m²")).toMatchObject({ canonical: "m²", dimension: "area", comparable: true });
  });

  it("does not treat area and volume as equivalent units", () => {
    expect(normalizeUnit("m²").comparableTo).not.toContain("m³");
    expect(normalizeUnit("m³").comparableTo).not.toContain("m²");
  });
});

describe("calculateQuantityDifference", () => {
  it("uses the greater of an absolute 0.01 tolerance and one percent", () => {
    const result = calculateQuantityDifference({
      documentValue: new Decimal("100.8"),
      budgetValue: new Decimal("100"),
      tolerance: new Decimal("0.01"),
    });

    expect(result.difference.toFixed(2)).toBe("0.80");
    expect(result.percentage?.toFixed(2)).toBe("0.80");
    expect(result.tolerance.toFixed(2)).toBe("1.00");
    expect(result.exceedsTolerance).toBe(false);
  });

  it("applies relative configured tolerance to the budget value", () => {
    const result = calculateQuantityDifference({ documentValue: new Decimal("10.8"), budgetValue: new Decimal("10"), tolerance: new Decimal("1") });
    expect(result.tolerance.toFixed(2)).toBe("0.10");
    expect(result.exceedsTolerance).toBe(true);
  });

  it("calculates signed impact, including a negative document difference", () => {
    const result = calculateQuantityDifference({
      documentValue: new Decimal("8"),
      budgetValue: new Decimal("10"),
      unitPrice: new Decimal("25.50"),
      tolerance: new Decimal("0.01"),
    });

    expect(result.difference.toFixed(2)).toBe("-2.00");
    expect(result.potentialImpact?.toFixed(2)).toBe("-51.00");
    expect(result.exceedsTolerance).toBe(true);
  });

  it("leaves percentage null when the budget value is zero", () => {
    const result = calculateQuantityDifference({
      documentValue: new Decimal("2"),
      budgetValue: new Decimal("0"),
      unitPrice: new Decimal("10"),
      tolerance: new Decimal("0.01"),
    });

    expect(result.percentage).toBeNull();
    expect(result.difference.toFixed(2)).toBe("2.00");
    expect(result.potentialImpact?.toFixed(2)).toBe("20.00");
    expect(result.exceedsTolerance).toBe(true);
  });

  it("uses the absolute 0.01 floor with zero budget and configured tolerance", () => {
    const result = calculateQuantityDifference({
      documentValue: new Decimal("0.02"),
      budgetValue: new Decimal("0"),
      tolerance: new Decimal("0"),
    });

    expect(result.tolerance.toFixed(2)).toBe("0.01");
    expect(result.exceedsTolerance).toBe(true);
  });
});
