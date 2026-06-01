import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";

import {
  composeBudgetPolynomialFormulaInput,
  sanitizePolynomialMonomialComponents,
} from "@/lib/data/polynomial-formulas";
import {
  serializeAdjustmentCalculation,
  serializePolynomialFormula,
  serializeUnifiedIndex,
  serializeValuation,
} from "@/lib/db/serializers";

describe("composeBudgetPolynomialFormulaInput", () => {
  it("builds budget-level direct cost groups from APU resources and adds GU", () => {
    const result = composeBudgetPolynomialFormulaInput({
      id: "budget-1",
      projectId: "project-1",
      totalGeneralExpenses: 12000,
      totalUtility: 8000,
      items: [
        {
          id: "item-1",
          quantity: 100,
          apu: {
            resources: [
              {
                id: "apu-resource-1",
                resourceType: "MO",
                subtotal: 25,
                resource: {
                  category: "LABOR",
                  iu: "47",
                },
              },
              {
                id: "apu-resource-2",
                resourceType: "Material",
                subtotal: 280,
                resource: {
                  category: "MATERIAL",
                  iu: "30",
                },
              },
              {
                id: "apu-resource-3",
                resourceType: "Equipo",
                subtotal: 35,
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
          quantity: 10,
          apu: {
            resources: [
              {
                id: "apu-resource-4",
                resourceType: "Herramientas",
                subtotal: 2,
                resource: {
                  category: "TOOLS",
                  iu: "49",
                },
              },
              {
                id: "apu-resource-5",
                resourceType: "Subcontrato",
                subtotal: 7,
                resource: undefined,
              },
            ],
          },
        },
      ],
    });

    expect(result.directCostBreakdown).toEqual({
      labor: "2500.0000",
      materials: "28000.0000",
      equipment: "3520.0000",
      others: "70.0000",
    });
    expect(result.totalBaseAmount).toBe("54090.0000");
    expect(
      Object.fromEntries(result.monomials.map((monomial) => [monomial.code, monomial.amount])),
    ).toEqual({
      MO: "2500.0000",
      MAT: "28000.0000",
      EQ: "3520.0000",
      V: "70.0000",
      GU: "20000.0000",
    });
    expect(result.monomials.map((monomial) => monomial.coefficient)).toEqual([
      "0.046",
      "0.518",
      "0.065",
      "0.001",
      "0.370",
    ]);
    expect(result.componentsByGroup.get("LABOR")).toEqual([
      {
        apuResourceId: "apu-resource-1",
        resourceType: "MO",
        amount: "2500.0000",
      },
    ]);
    expect(result.componentsByGroup.get("GENERAL_EXPENSES_PROFIT")).toEqual([]);
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
                resource: { category: "MATERIAL", iu: "30" },
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
      MAT: "0.750",
      GU: "0.250",
    });
  });
});

describe("sanitizePolynomialMonomialComponents", () => {
  it("keeps one persisted source reference per component and skips summary-only rows", () => {
    expect(
      sanitizePolynomialMonomialComponents([
        {
          budgetItemId: "item-1",
          apuResourceId: "apu-resource-1",
          resourceType: "MO",
          amount: "2500.0000",
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
      },
      {
        apuResourceId: null,
        budgetItemId: "item-2",
        resourceType: "MANUAL",
        amount: "15.0000",
      },
    ]);
  });
});

describe("polynomial serializers", () => {
  it("serializes formula, valuation, unified index, and adjustment records", () => {
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
          createdAt: new Date("2026-02-01T00:00:00.000Z"),
          updatedAt: new Date("2026-02-01T00:00:00.000Z"),
        },
      ],
    });

    expect(formula.totalBaseAmount).toBe("54090.0000");
    expect(formula.monomials[0]?.baseIndexValue).toBe("100");
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
