import { Prisma } from "@prisma/client";
import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";

import {
  buildMonomialComponentCreateData,
  composeBudgetPolynomialFormulaInput,
  getPolynomialFormulaReadOptionsForEnvironment,
  sanitizePolynomialMonomialComponents,
} from "@/lib/data/polynomial-formulas";
import {
  serializeAdjustmentCalculation,
  serializePolynomialFormula,
  serializePolynomialMonomial,
  serializeUnifiedIndex,
  serializeValuation,
} from "@/lib/db/serializers";

describe("composeBudgetPolynomialFormulaInput", () => {
  it("builds smart family monomials from APU resources and adds GU", () => {
    const result = composeBudgetPolynomialFormulaInput({
      id: "budget-1",
      projectId: "project-1",
      totalGeneralExpenses: 60,
      totalUtility: 40,
      items: [
        {
          id: "item-1",
          quantity: 1,
          apu: {
            resources: [
              {
                id: "apu-resource-1",
                resourceType: "MO",
                subtotal: 200,
                resource: {
                  category: "LABOR",
                  iu: "47",
                },
              },
              {
                id: "apu-resource-2",
                resourceType: "Material",
                subtotal: 300,
                resource: {
                  category: "MATERIAL",
                  iu: "3",
                  unifiedIndexName: "ACERO CORRUGADO",
                },
              },
              {
                id: "apu-resource-3",
                resourceType: "Material",
                subtotal: 250,
                resource: {
                  category: "MATERIAL",
                  iu: "21",
                },
              },
              {
                id: "apu-resource-4",
                resourceType: "Material",
                subtotal: 150,
                resource: {
                  category: "MATERIAL",
                  iu: "17",
                },
              },
              {
                id: "apu-resource-5",
                resourceType: "Equipo",
                subtotal: 20,
                resource: {
                  category: "EQUIPMENT",
                  iu: "48",
                },
              },
            ],
          },
        },
        {
          id: "item-2",
          quantity: 1,
          apu: {
            resources: [
              {
                id: "apu-resource-6",
                resourceType: "Subcontrato",
                subtotal: 10,
                resource: undefined,
              },
              {
                id: "apu-resource-7",
                resourceType: "Miscelaneo",
                subtotal: 0,
                resource: undefined,
              },
            ],
          },
        },
      ],
    });

    expect(result.directCostBreakdown).toEqual({
      labor: "200.0000",
      materials: "700.0000",
      equipment: "20.0000",
      others: "10.0000",
    });
    expect(result.totalBaseAmount).toBe("1030.0000");
    expect(
      Object.fromEntries(result.monomials.map((monomial) => [monomial.costGroupKey, monomial.amount])),
    ).toEqual({
      LABOR: "200.0000",
      STEEL: "330.0000",
      CEMENT: "250.0000",
      MASONRY: "150.0000",
      GENERAL_EXPENSES_PROFIT: "100.0000",
    });
    expect(result.monomials.map((monomial) => monomial.coefficient)).toEqual(["0.194", "0.320", "0.243", "0.146", "0.097"]);
    expect(result.monomials.map((monomial) => monomial.costGroupKey)).not.toEqual(
      expect.arrayContaining(["EQUIPMENT", "OTHERS"]),
    );
    expect(
      result.monomials
        .reduce((total, monomial) => total.plus(monomial.coefficient), new Decimal(0))
        .toFixed(3),
    ).toBe("1.000");
    expect(
      result.monomials
        .reduce((total, monomial) => total.plus(monomial.amount), new Decimal(0))
        .toFixed(4),
    ).toBe(result.totalBaseAmount);
    expect(result.componentsByGroup.get("LABOR")).toEqual([
      {
        apuResourceId: "apu-resource-1",
        resourceType: "MO",
        amount: "200.0000",
      },
    ]);
    expect(result.componentsByGroup.get("GENERAL_EXPENSES_PROFIT")).toEqual([]);
    expect(result.componentsByMonomialKey.get("MATERIALS:STEEL")).toEqual(expect.arrayContaining([
      expect.objectContaining({
        apuResourceId: "apu-resource-2",
        amount: "300.0000",
        unifiedIndexCode: "3",
        unifiedIndexName: "ACERO CORRUGADO",
        iuFamily: "STEEL",
        participationPercentage: "0.909091",
        coefficientContribution: "0.291262",
      }),
      expect.objectContaining({
        apuResourceId: "apu-resource-5",
        amount: "20.0000",
        iuFamily: "EQUIPMENT",
        participationPercentage: "0.060606",
        coefficientContribution: "0.019417",
      }),
      expect.objectContaining({
        apuResourceId: "apu-resource-6",
        amount: "10.0000",
        iuFamily: "OTHERS",
        participationPercentage: "0.030303",
        coefficientContribution: "0.009709",
      }),
    ]));
  });

  it("keeps monomial coefficients independent when composing separate sub budgets", () => {
    const estructuras = composeBudgetPolynomialFormulaInput({
      id: "sub-budget-estructuras",
      projectId: "project-1",
      name: "Estructuras",
      totalGeneralExpenses: 100,
      totalUtility: 50,
      items: [
        {
          id: "item-estructuras",
          quantity: 10,
          apu: {
            resources: [
              {
                id: "mo-estructuras",
                resourceType: "MO",
                subtotal: 10,
                resource: { category: "LABOR", iu: "47" },
              },
            ],
          },
        },
      ],
    });
    const arquitectura = composeBudgetPolynomialFormulaInput({
      id: "sub-budget-arquitectura",
      projectId: "project-1",
      name: "Arquitectura",
      totalGeneralExpenses: 20,
      totalUtility: 30,
      items: [
        {
          id: "item-arquitectura",
          quantity: 5,
          apu: {
            resources: [
              {
                id: "mat-arquitectura",
                resourceType: "Material",
                subtotal: 30,
                resource: { category: "MATERIAL", iu: "21" },
              },
            ],
          },
        },
      ],
    });

    expect(estructuras.totalBaseAmount).toBe("250.0000");
    expect(Object.fromEntries(estructuras.monomials.map((monomial) => [monomial.code, monomial.coefficient]))).toMatchObject({
      MO: "0.400",
      GU: "0.600",
    });
    expect(arquitectura.totalBaseAmount).toBe("200.0000");
    expect(Object.fromEntries(arquitectura.monomials.map((monomial) => [monomial.code, monomial.coefficient]))).toMatchObject({
      CE: "0.750",
      GU: "0.250",
    });
  });
});

describe("sanitizePolynomialMonomialComponents", () => {
  it("keeps one persisted source reference, preserves snapshot fields, and skips summary-only rows", () => {
    expect(
      sanitizePolynomialMonomialComponents([
        {
          budgetItemId: "item-1",
          apuResourceId: "apu-resource-1",
          resourceType: "MO",
          amount: "2500.0000",
          unifiedIndexCode: "47",
          unifiedIndexName: "MANO DE OBRA",
          iuFamily: "LABOR",
          participationPercentage: "1.000000",
          coefficientContribution: "0.046000",
        },
        {
          budgetItemId: "item-2",
          resourceType: "MANUAL",
          amount: "15.0000",
        },
        {
          resourceType: "GENERAL_EXPENSES_PROFIT",
          amount: "20000.0000",
        },
      ]),
    ).toEqual([
      {
        apuResourceId: "apu-resource-1",
        budgetItemId: null,
        resourceType: "MO",
        amount: "2500.0000",
        unifiedIndexCode: "47",
        unifiedIndexName: "MANO DE OBRA",
        iuFamily: "LABOR",
        participationPercentage: "1.000000",
        coefficientContribution: "0.046000",
      },
      {
        apuResourceId: null,
        budgetItemId: "item-2",
        resourceType: "MANUAL",
        amount: "15.0000",
      },
    ]);
  });

  it("builds component create data with persisted snapshot fields", () => {
    expect(
      buildMonomialComponentCreateData({
        budgetItemId: null,
        apuResourceId: "apu-resource-1",
        resourceType: "MO",
        amount: "2500.123456",
        unifiedIndexCode: "47",
        unifiedIndexName: "MANO DE OBRA",
        iuFamily: "LABOR",
        participationPercentage: "1.000000",
        coefficientContribution: "0.046000",
      }),
    ).toEqual({
      budgetItemId: null,
      apuResourceId: "apu-resource-1",
      resourceType: "MO",
      amount: "2500.1235",
      unifiedIndexCode: "47",
      unifiedIndexName: "MANO DE OBRA",
      iuFamily: "LABOR",
      participationPercentage: "1.000000",
      coefficientContribution: "0.046000",
    });
  });
});

describe("getPolynomialFormulaReadOptionsForEnvironment", () => {
  it("keeps composition detail disabled for production payloads", () => {
    expect(getPolynomialFormulaReadOptionsForEnvironment("production")).toEqual({
      includeCompositionDetail: false,
    });
  });

  it("enables composition detail for development payloads", () => {
    expect(getPolynomialFormulaReadOptionsForEnvironment("development")).toEqual({
      includeCompositionDetail: true,
    });
  });
});

describe("polynomial serializers", () => {
  it("serializes formula, valuation, unified index, and adjustment records", () => {
    const monomialWithoutComponents = serializePolynomialMonomial({
      id: "monomial-without-components",
      formulaId: "formula-1",
      code: "MAT",
      name: "Materiales",
      costGroupKey: "MATERIALS",
      amount: new Prisma.Decimal("1000.00"),
      coefficient: new Prisma.Decimal("0.123"),
      baseIndexCode: "30",
      baseIndexName: "Materiales",
      baseIndexValue: new Prisma.Decimal("100.000"),
      adjustmentIndexCode: null,
      adjustmentIndexName: null,
      adjustmentIndexValue: null,
      sortOrder: 1,
    });

    const formula = serializePolynomialFormula({
      id: "formula-1",
      budgetId: "budget-1",
      name: "Formula base",
      baseMonth: 1,
      baseYear: 2026,
      totalBaseAmount: new Prisma.Decimal("54090.00"),
      status: "DRAFT",
      createdAt: new Date("2026-01-15T00:00:00.000Z"),
      updatedAt: new Date("2026-01-16T00:00:00.000Z"),
      monomials: [
        {
          id: "monomial-1",
          formulaId: "formula-1",
          code: "MO",
          name: "Mano de obra",
          costGroupKey: "LABOR",
          amount: new Prisma.Decimal("2500.00"),
          coefficient: new Prisma.Decimal("0.046"),
          baseIndexCode: "47",
          baseIndexName: "Mano de obra",
          baseIndexValue: new Prisma.Decimal("100.000"),
          adjustmentIndexCode: null,
          adjustmentIndexName: null,
          adjustmentIndexValue: null,
          sortOrder: 0,
          createdAt: new Date("2026-01-15T00:00:00.000Z"),
          updatedAt: new Date("2026-01-16T00:00:00.000Z"),
          components: [
            {
              id: "component-1",
              monomialId: "monomial-1",
              budgetItemId: null,
              apuResourceId: "apu-resource-1",
              resourceType: "MO",
              amount: new Prisma.Decimal("2500.00"),
              unifiedIndexCode: "47",
              unifiedIndexName: "MANO DE OBRA",
              iuFamily: "LABOR",
              participationPercentage: new Prisma.Decimal("1.000000"),
              coefficientContribution: new Prisma.Decimal("0.046000"),
              createdAt: new Date("2026-01-15T00:00:00.000Z"),
              updatedAt: new Date("2026-01-16T00:00:00.000Z"),
            },
          ],
        },
      ],
    });

    const valuation = serializeValuation({
      id: "valuation-1",
      formulaId: "formula-1",
      month: 2,
      year: 2026,
      amount: new Prisma.Decimal("100000.00"),
      createdAt: new Date("2026-02-01T00:00:00.000Z"),
      updatedAt: new Date("2026-02-01T00:00:00.000Z"),
    });

    const index = serializeUnifiedIndex({
      id: "index-1",
      code: "47",
      name: "Mano de obra",
      geographicArea: "LIMA",
      month: 2,
      year: 2026,
      value: new Prisma.Decimal("108.000"),
      source: "inei-ene26.xlsx",
      createdAt: new Date("2026-02-01T00:00:00.000Z"),
      updatedAt: new Date("2026-02-01T00:00:00.000Z"),
    });

    const adjustment = serializeAdjustmentCalculation({
      id: "adjustment-1",
      formulaId: "formula-1",
      valuationId: "valuation-1",
      month: 2,
      year: 2026,
      originalAmount: new Prisma.Decimal("100000.00"),
      adjustedAmount: new Prisma.Decimal("111700.00"),
      adjustmentAmount: new Prisma.Decimal("11700.00"),
      kRaw: new Prisma.Decimal("1.116500"),
      kRounded: new Prisma.Decimal("1.117"),
      createdAt: new Date("2026-02-01T00:00:00.000Z"),
      updatedAt: new Date("2026-02-01T00:00:00.000Z"),
      terms: [
        {
          id: "term-1",
          adjustmentId: "adjustment-1",
          monomialId: "monomial-1",
          name: "Mano de obra",
          coefficient: new Prisma.Decimal("0.046"),
          baseIndexValue: new Prisma.Decimal("100.000"),
          adjustmentIndexValue: new Prisma.Decimal("108.000"),
          ratio: new Prisma.Decimal("1.080000"),
          partial: new Prisma.Decimal("0.049680"),
          sortOrder: 0,
        },
      ],
    });

    expect(formula.totalBaseAmount).toBe("54090.0000");
    expect(formula.monomials[0]?.baseIndexValue).toBe("100");
    expect(monomialWithoutComponents.composition).toEqual([]);
    expect(formula.monomials[0]?.composition).toEqual([
      {
        id: "component-1",
        monomialId: "monomial-1",
        budgetItemId: undefined,
        apuResourceId: "apu-resource-1",
        resourceType: "MO",
        amount: "2500.00",
        unifiedIndexCode: "47",
        unifiedIndexName: "MANO DE OBRA",
        iuFamily: "LABOR",
        participationPercentage: "1",
        coefficientContribution: "0.046",
        createdAt: "2026-01-15T00:00:00.000Z",
        updatedAt: "2026-01-16T00:00:00.000Z",
      },
    ]);
    expect(valuation.amount).toBe("100000.00");
    expect(index.value).toBe("108");
    expect(index.geographicArea).toBe("LIMA");
    expect(index.source).toBe("inei-ene26.xlsx");
    expect(adjustment.kRounded).toBe("1.117");
    expect(adjustment.terms[0]?.partial).toBe("0.04968");
  });
});
