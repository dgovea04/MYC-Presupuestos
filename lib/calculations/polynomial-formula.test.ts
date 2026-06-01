import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";
import type { PolynomialMonomialInput } from "@/types/polynomial-formula";
import {
  buildPolynomialCompositionDiagnostics,
  calculateAdjustmentAmounts,
  calculateBudgetCostGroups,
  calculateCoefficientK,
  calculateMonomialCoefficients,
  roundCoefficient,
  roundCurrency,
  roundKValue,
  validatePolynomialFormula,
} from "@/lib/calculations/polynomial-formula";
import {
  polynomialAdjustmentCreateSchema,
  polynomialFormulaSaveSchema,
  polynomialKCalculationSchema,
  valuationInputSchema,
} from "@/lib/validations/polynomial-formula";

describe("polynomial formula rounding", () => {
  it("rounds coefficients to three decimals", () => {
    expect(roundCoefficient("0.1796")).toBe("0.180");
  });

  it("rounds K to three decimals", () => {
    expect(roundKValue("1.1165")).toBe("1.117");
  });

  it("rounds money to two decimals", () => {
    expect(roundCurrency("111700.005")).toBe("111700.01");
  });
});

describe("polynomial formula domain types", () => {
  it("accepts labor as a valid monomial cost group key", () => {
    const monomial: PolynomialMonomialInput = {
      id: "m1",
      code: "MO",
      name: "Mano de obra",
      costGroupKey: "LABOR",
      amount: "180000",
      coefficient: "0.180",
      baseIndexCode: "47",
      baseIndexName: "Mano de obra",
      baseIndexValue: "100",
      sortOrder: 0,
    };

    expect(monomial.costGroupKey).toBe("LABOR");
  });
});

describe("polynomial formula engine", () => {
  it("calculates base cost groups excluding IGV and merging GU", () => {
    const result = calculateBudgetCostGroups({
      directCostBreakdown: {
        labor: "180000",
        materials: "520000",
        equipment: "70000",
        others: "30000",
      },
      generalExpenses: "120000",
      utility: "80000",
    });

    expect(result.totalBaseAmount).toBe("1000000.0000");
    expect(
      result.groups.find((group) => group.key === "GENERAL_EXPENSES_PROFIT")
        ?.amount,
    ).toBe("200000.0000");
  });

  it("calculates monomial coefficients with thousandth rounding", () => {
    const result = calculateMonomialCoefficients([
      { key: "LABOR", amount: "180000.0000" },
      { key: "MATERIALS", amount: "520000.0000" },
      { key: "EQUIPMENT", amount: "70000.0000" },
      { key: "OTHERS", amount: "30000.0000" },
      { key: "GENERAL_EXPENSES_PROFIT", amount: "200000.0000" },
    ]);

    expect(result[0].coefficient).toBe("0.180");
    expect(result[1].coefficient).toBe("0.520");
    expect(result[4].coefficient).toBe("0.200");
  });

  it("validates sum, maximum terms, and minimum coefficient rules", () => {
    const result = validatePolynomialFormula([
      {
        coefficient: "0.180",
        baseIndexValue: "100",
        adjustmentIndexValue: "108",
        name: "MO",
      },
      {
        coefficient: "0.520",
        baseIndexValue: "100",
        adjustmentIndexValue: "115",
        name: "MAT",
      },
      {
        coefficient: "0.070",
        baseIndexValue: "100",
        adjustmentIndexValue: "105",
        name: "EQ",
      },
      {
        coefficient: "0.030",
        baseIndexValue: "100",
        adjustmentIndexValue: "102",
        name: "V",
      },
      {
        coefficient: "0.200",
        baseIndexValue: "100",
        adjustmentIndexValue: "110",
        name: "GU",
      },
    ]);

    expect(result.isCoefficientSumValid).toBe(true);
    expect(result.hasMaximumTermsValid).toBe(true);
    expect(result.minimumCoefficientWarnings).toHaveLength(1);
  });

  it("warns when an existing monomial coefficient is below 0.050", () => {
    const diagnostics = buildPolynomialCompositionDiagnostics([
      {
        coefficient: "0.049",
        baseIndexValue: "100",
        adjustmentIndexValue: "100",
        name: "Varios",
      },
    ]);

    expect(diagnostics).toEqual([
      expect.objectContaining({
        code: "LOW_COEFFICIENT_REVIEW",
        message: expect.stringContaining("0.049"),
      }),
    ]);
  });

  it("warns when a real monomial coefficient is 0.000", () => {
    const diagnostics = buildPolynomialCompositionDiagnostics([
      {
        coefficient: "0.000",
        baseIndexValue: "100",
        adjustmentIndexValue: "100",
        name: "Monomio sin participacion",
      },
    ]);
    const validation = validatePolynomialFormula([
      {
        coefficient: "0.000",
        baseIndexValue: "100",
        adjustmentIndexValue: "100",
        name: "Monomio sin participacion",
      },
    ]);

    expect(diagnostics).toEqual([
      expect.objectContaining({
        code: "LOW_COEFFICIENT_REVIEW",
        message: expect.stringContaining("0.000"),
      }),
    ]);
    expect(validation.minimumCoefficientWarnings).toHaveLength(1);
  });

  it("warns when a monomial composition groups multiple IU families or codes", () => {
    const diagnostics = buildPolynomialCompositionDiagnostics([
      {
        coefficient: "0.120",
        baseIndexValue: "100",
        adjustmentIndexValue: "100",
        name: "Materiales agrupados",
        composition: [
          {
            iuFamily: "STEEL",
            unifiedIndexCode: "03",
            coefficientContribution: "0.070",
          },
          {
            iuFamily: "CEMENT",
            unifiedIndexCode: "21",
            coefficientContribution: "0.050",
          },
        ],
      },
    ]);

    expect(diagnostics).toEqual([
      expect.objectContaining({
        code: "MIXED_IU_GROUPING_REVIEW",
        message: expect.stringContaining("agrupa"),
      }),
    ]);
  });

  it("does not warn for clean monomial composition", () => {
    const diagnostics = buildPolynomialCompositionDiagnostics([
      {
        coefficient: "0.120",
        baseIndexValue: "100",
        adjustmentIndexValue: "100",
        name: "Acero",
        composition: [
          {
            iuFamily: "STEEL",
            unifiedIndexCode: "03",
            coefficientContribution: "0.080",
          },
          {
            iuFamily: "STEEL",
            unifiedIndexCode: "03",
            coefficientContribution: "0.040",
          },
        ],
      },
    ]);

    expect(diagnostics).toHaveLength(0);
  });

  it("warns when composition contribution coverage differs from the monomial coefficient", () => {
    const diagnostics = buildPolynomialCompositionDiagnostics([
      {
        coefficient: "0.120",
        baseIndexValue: "100",
        adjustmentIndexValue: "100",
        name: "Acero",
        composition: [
          {
            iuFamily: "STEEL",
            unifiedIndexCode: "03",
            coefficientContribution: "0.080",
          },
          {
            iuFamily: "STEEL",
            unifiedIndexCode: "03",
            coefficientContribution: "0.035",
          },
        ],
      },
    ]);

    expect(diagnostics).toEqual([
      expect.objectContaining({
        code: "COMPOSITION_COVERAGE_REVIEW",
        message: expect.stringContaining("0.115 vs coeficiente 0.120"),
      }),
    ]);
  });

  it("rejects coefficient sums outside the 0.001 tolerance", () => {
    const result = validatePolynomialFormula([
      {
        coefficient: "0.180",
        baseIndexValue: "100",
        adjustmentIndexValue: "108",
        name: "MO",
      },
      {
        coefficient: "0.520",
        baseIndexValue: "100",
        adjustmentIndexValue: "115",
        name: "MAT",
      },
      {
        coefficient: "0.070",
        baseIndexValue: "100",
        adjustmentIndexValue: "105",
        name: "EQ",
      },
      {
        coefficient: "0.030",
        baseIndexValue: "100",
        adjustmentIndexValue: "102",
        name: "V",
      },
      {
        coefficient: "0.198",
        baseIndexValue: "100",
        adjustmentIndexValue: "110",
        name: "GU",
      },
    ]);

    expect(result.isCoefficientSumValid).toBe(false);
  });

  it("allows ten monomials", () => {
    const result = validatePolynomialFormula(
      Array.from({ length: 10 }, (_, index) => ({
        coefficient: "0.100",
        baseIndexValue: "100",
        adjustmentIndexValue: "100",
        name: `M${index + 1}`,
      })),
    );

    expect(result.hasMaximumTermsValid).toBe(true);
  });

  it("rejects formulas with more than ten monomials", () => {
    const result = validatePolynomialFormula(
      Array.from({ length: 11 }, (_, index) => ({
        coefficient: index < 10 ? "0.100" : "0.000",
        baseIndexValue: "100",
        adjustmentIndexValue: "100",
        name: `M${index + 1}`,
      })),
    );

    expect(result.hasMaximumTermsValid).toBe(false);
  });

  it("requires positive base indices during validation", () => {
    const result = validatePolynomialFormula([
      {
        coefficient: "1.000",
        baseIndexValue: "0",
        adjustmentIndexValue: "100",
        name: "MO",
      },
    ]);

    expect(result.missingBaseIndexWarnings).toHaveLength(1);
    expect(result.isValid).toBe(false);
  });

  it("balances generated coefficients so rounded output validates itself", () => {
    const coefficients = calculateMonomialCoefficients([
      { key: "LABOR", amount: "1.0000" },
      { key: "MATERIALS", amount: "1.0000" },
      { key: "EQUIPMENT", amount: "1.0000" },
    ]);

    expect(
      coefficients.map((item) => item.coefficient).sort(),
    ).toEqual(["0.333", "0.333", "0.334"]);

    const validation = validatePolynomialFormula(
      coefficients.map((item, index) => ({
        coefficient: item.coefficient,
        baseIndexValue: "100",
        adjustmentIndexValue: "100",
        name: `M${index + 1}`,
      })),
    );

    expect(validation.isCoefficientSumValid).toBe(true);
    expect(validation.isValid).toBe(true);
  });

  it("allocates skewed residuals by raw remainder instead of the last position", () => {
    const coefficients = calculateMonomialCoefficients([
      { key: "LABOR", amount: "926.0000" },
      { key: "MATERIALS", amount: "1.0000" },
      { key: "EQUIPMENT", amount: "1.0000" },
      { key: "OTHERS", amount: "1.0000" },
      { key: "GENERAL_EXPENSES_PROFIT", amount: "1.0000" },
      { key: "STEEL", amount: "1.0000" },
      { key: "CEMENT", amount: "1.0000" },
      { key: "MASONRY", amount: "1.0000" },
    ]);

    expect(coefficients[0].coefficient).toBe("0.993");
    expect(coefficients.slice(1).every((item) => item.coefficient === "0.001")).toBe(
      true,
    );
  });

  it("awards a residual unit to the larger raw coefficient when remainders match", () => {
    const coefficients = calculateMonomialCoefficients([
      { key: "LABOR", amount: "1004.0000" },
      { key: "MATERIALS", amount: "2004.0000" },
      { key: "EQUIPMENT", amount: "6992.0000" },
    ]);

    expect(
      Object.fromEntries(coefficients.map((item) => [item.key, item.coefficient])),
    ).toEqual({
      LABOR: "0.100",
      MATERIALS: "0.201",
      EQUIPMENT: "0.699",
    });
  });

  it("uses the key tie-breaker when remainder and raw coefficient are equal", () => {
    const coefficients = calculateMonomialCoefficients([
      { key: "OTHERS", amount: "1004.0000" },
      { key: "MATERIALS", amount: "1004.0000" },
      { key: "LABOR", amount: "7992.0000" },
    ]);

    expect(
      Object.fromEntries(coefficients.map((item) => [item.key, item.coefficient])),
    ).toEqual({
      OTHERS: "0.100",
      MATERIALS: "0.101",
      LABOR: "0.799",
    });
  });

  it("generates non-negative displayed coefficients that sum to 1.000", () => {
    const coefficients = calculateMonomialCoefficients([
      { key: "LABOR", amount: "137.1250" },
      { key: "MATERIALS", amount: "241.3330" },
      { key: "EQUIPMENT", amount: "89.7770" },
      { key: "OTHERS", amount: "52.4440" },
      { key: "GENERAL_EXPENSES_PROFIT", amount: "179.3210" },
    ]);

    const sum = coefficients.reduce(
      (total, item) => total.plus(item.coefficient),
      new Decimal(0),
    );
    const thousandthUnits = coefficients.reduce(
      (total, item) => total + Number(item.coefficient.replace(".", "")),
      0,
    );

    expect(
      coefficients.every((item) => new Decimal(item.coefficient).greaterThanOrEqualTo(0)),
    ).toBe(true);
    expect(sum.toFixed(3)).toBe("1.000");
    expect(thousandthUnits).toBe(1000);
  });

  it("is stable under permutation for the same raw coefficient set", () => {
    const ordered = calculateMonomialCoefficients([
      { key: "LABOR", amount: "101.0000" },
      { key: "MATERIALS", amount: "203.0000" },
      { key: "EQUIPMENT", amount: "307.0000" },
      { key: "OTHERS", amount: "401.0000" },
    ]);
    const permuted = calculateMonomialCoefficients([
      { key: "OTHERS", amount: "401.0000" },
      { key: "EQUIPMENT", amount: "307.0000" },
      { key: "MATERIALS", amount: "203.0000" },
      { key: "LABOR", amount: "101.0000" },
    ]);

    expect(
      Object.fromEntries(ordered.map((item) => [item.key, item.coefficient])),
    ).toEqual(
      Object.fromEntries(permuted.map((item) => [item.key, item.coefficient])),
    );
  });

  it("calculates coefficient K from base and adjustment indices", () => {
    const result = calculateCoefficientK([
      {
        coefficient: "0.180",
        baseIndexValue: "100",
        adjustmentIndexValue: "108",
        name: "MO",
      },
      {
        coefficient: "0.520",
        baseIndexValue: "100",
        adjustmentIndexValue: "115",
        name: "MAT",
      },
      {
        coefficient: "0.070",
        baseIndexValue: "100",
        adjustmentIndexValue: "105",
        name: "EQ",
      },
      {
        coefficient: "0.030",
        baseIndexValue: "100",
        adjustmentIndexValue: "102",
        name: "V",
      },
      {
        coefficient: "0.200",
        baseIndexValue: "100",
        adjustmentIndexValue: "110",
        name: "GU",
      },
    ]);

    expect(result.kRaw).toBe("1.1165");
    expect(result.kRounded).toBe("1.117");
  });

  it("sums raw K partials instead of presentation-rounded partials", () => {
    const result = calculateCoefficientK([
      {
        coefficient: "0.33335",
        baseIndexValue: "1000",
        adjustmentIndexValue: "1000",
        name: "A",
      },
      {
        coefficient: "0.33335",
        baseIndexValue: "1000",
        adjustmentIndexValue: "1000",
        name: "B",
      },
      {
        coefficient: "0.33335",
        baseIndexValue: "1000",
        adjustmentIndexValue: "1000",
        name: "C",
      },
    ]);

    expect(result.terms.map((term) => term.partial)).toEqual([
      "0.3334",
      "0.3334",
      "0.3334",
    ]);
    expect(result.kRaw).toBe("1.0001");
    expect(result.kRounded).toBe("1.000");
  });

  it("requires positive adjustment indices for coefficient K", () => {
    expect(() =>
      calculateCoefficientK([
        {
          coefficient: "1.000",
          baseIndexValue: "100",
          adjustmentIndexValue: "0",
          name: "MO",
        },
      ]),
    ).toThrow("greater than zero");
  });

  it("fails validation when adjustment indices are missing or non-positive", () => {
    const result = validatePolynomialFormula([
      { coefficient: "0.500", baseIndexValue: "100", name: "MO" },
      {
        coefficient: "0.500",
        baseIndexValue: "100",
        adjustmentIndexValue: "0",
        name: "MAT",
      },
    ]);

    expect(result.missingAdjustmentIndexWarnings).toHaveLength(2);
    expect(result.isValid).toBe(false);
  });

  it("calculates adjusted valuation amounts", () => {
    const result = calculateAdjustmentAmounts({
      originalAmount: "100000.00",
      kRounded: "1.117",
    });

    expect(result.adjustedAmount).toBe("111700.00");
    expect(result.adjustmentAmount).toBe("11700.00");
  });
});

describe("polynomial formula validation schemas", () => {
  const monomial = {
    id: "m1",
    code: "MO",
    name: "Mano de obra",
    costGroupKey: "LABOR" as const,
    amount: "2500.00",
    coefficient: "0.250",
    baseIndexCode: "47",
    baseIndexName: "Mano de obra",
    baseIndexValue: "100.000",
    sortOrder: 0,
  };

  it("accepts a valid polynomial formula payload", () => {
    expect(
      polynomialFormulaSaveSchema.parse({
        name: "FP Vivienda",
        baseMonth: 1,
        baseYear: 2026,
        monomials: [monomial],
      }),
    ).toMatchObject({
      name: "FP Vivienda",
      baseMonth: 1,
      baseYear: 2026,
    });
  });

  it("rejects formulas without monomials", () => {
    expect(() =>
      polynomialFormulaSaveSchema.parse({
        name: "FP Vivienda",
        baseMonth: 1,
        baseYear: 2026,
        monomials: [],
      }),
    ).toThrow();
  });

  it("accepts ten monomials in save payloads", () => {
    expect(
      polynomialFormulaSaveSchema.parse({
        name: "FP Vivienda",
        baseMonth: 1,
        baseYear: 2026,
        monomials: Array.from({ length: 10 }, (_, index) => ({
          ...monomial,
          id: `m${index + 1}`,
          code: `M${index + 1}`,
          name: `Monomio ${index + 1}`,
          sortOrder: index,
        })),
      }).monomials,
    ).toHaveLength(10);
  });

  it("rejects a base month outside the valid range", () => {
    expect(() =>
      polynomialFormulaSaveSchema.parse({
        name: "FP Vivienda",
        baseMonth: 13,
        baseYear: 2026,
        monomials: [monomial],
      }),
    ).toThrow();
  });

  it("requires positive decimal strings for K calculation indices", () => {
    expect(() =>
      polynomialKCalculationSchema.parse({
        monomials: [
          {
            coefficient: "0.250",
            baseIndexValue: "0",
            adjustmentIndexValue: "108.000",
            name: "MO",
          },
        ],
      }),
    ).toThrow();
  });

  it("accepts ten monomials in K calculation payloads", () => {
    expect(
      polynomialKCalculationSchema.parse({
        monomials: Array.from({ length: 10 }, (_, index) => ({
          coefficient: "0.100",
          baseIndexValue: "100.000",
          adjustmentIndexValue: "108.000",
          name: `M${index + 1}`,
        })),
      }).monomials,
    ).toHaveLength(10);
  });

  it("accepts a valuation amount with two-decimal money format", () => {
    expect(
      valuationInputSchema.parse({
        month: 5,
        year: 2026,
        amount: "100000.00",
      }),
    ).toMatchObject({
      month: 5,
      year: 2026,
      amount: "100000.00",
    });
  });

  it("requires either a valuation id or an original amount for adjustments", () => {
    expect(() =>
      polynomialAdjustmentCreateSchema.parse({
        month: 5,
        year: 2026,
      }),
    ).toThrow();
  });
});
