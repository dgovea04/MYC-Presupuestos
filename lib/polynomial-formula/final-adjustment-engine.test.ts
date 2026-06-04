import { describe, expect, it } from "vitest";

import { createPolynomialFinalAdjustmentProposal } from "@/lib/polynomial-formula/final-adjustment-engine";
import type { PolynomialCostGroupKey, PolynomialMonomialRecord } from "@/types/polynomial-formula";

function monomial(input: {
  id: string;
  code: string;
  name: string;
  costGroupKey: PolynomialCostGroupKey;
  amount: string;
  coefficient: string;
  iuFamily?: string;
  unifiedIndexCode?: string;
  unifiedIndexName?: string;
}): PolynomialMonomialRecord {
  return {
    id: input.id,
    formulaId: "formula-1",
    code: input.code,
    name: input.name,
    costGroupKey: input.costGroupKey,
    amount: input.amount,
    coefficient: input.coefficient,
    baseIndexCode: input.unifiedIndexCode ?? input.code,
    baseIndexName: input.unifiedIndexName ?? input.name,
    baseIndexValue: "100",
    adjustmentIndexCode: null,
    adjustmentIndexName: null,
    adjustmentIndexValue: null,
    sortOrder: 0,
    composition: [
      {
        id: `${input.id}-component`,
        monomialId: input.id,
        amount: input.amount,
        unifiedIndexCode: input.unifiedIndexCode,
        unifiedIndexName: input.unifiedIndexName,
        iuFamily: input.iuFamily,
        participationPercentage: "1",
        coefficientContribution: input.coefficient,
      },
    ],
  };
}

function coefficientSum(result: ReturnType<typeof createPolynomialFinalAdjustmentProposal>): string {
  return result.finalMonomials
    .reduce((sum, item) => sum + Number(item.coefficient), 0)
    .toFixed(3);
}

describe("createPolynomialFinalAdjustmentProposal", () => {
  it("reduces an architecture-like preliminary set to 5 final monomials without mutating input", () => {
    const input = [
      monomial({
        id: "mo",
        code: "MO",
        name: "Mano de obra",
        costGroupKey: "LABOR",
        amount: "390",
        coefficient: "0.390",
        iuFamily: "LABOR",
        unifiedIndexCode: "47",
      }),
      monomial({
        id: "cement",
        code: "CE",
        name: "Cemento",
        costGroupKey: "MATERIALS",
        amount: "64",
        coefficient: "0.064",
        iuFamily: "CEMENT",
        unifiedIndexCode: "21",
      }),
      monomial({
        id: "aggregate",
        code: "AG",
        name: "Agregado",
        costGroupKey: "MATERIALS",
        amount: "24",
        coefficient: "0.024",
        iuFamily: "AGGREGATES",
        unifiedIndexCode: "5",
      }),
      monomial({
        id: "masonry",
        code: "LA",
        name: "Ladrillos",
        costGroupKey: "MATERIALS",
        amount: "91",
        coefficient: "0.091",
        iuFamily: "MASONRY",
        unifiedIndexCode: "17",
      }),
      monomial({
        id: "tile",
        code: "BA",
        name: "Baldosa",
        costGroupKey: "MATERIALS",
        amount: "64",
        coefficient: "0.064",
        iuFamily: "FINISHES",
        unifiedIndexCode: "16",
      }),
      monomial({
        id: "ceramic",
        code: "CR",
        name: "Ceramica",
        costGroupKey: "MATERIALS",
        amount: "24",
        coefficient: "0.024",
        iuFamily: "FINISHES",
        unifiedIndexCode: "24",
      }),
      monomial({
        id: "wood-strip",
        code: "MT",
        name: "Madera tira",
        costGroupKey: "MATERIALS",
        amount: "17",
        coefficient: "0.017",
        iuFamily: "WOOD",
        unifiedIndexCode: "41",
      }),
      monomial({
        id: "wood",
        code: "MA",
        name: "Madera",
        costGroupKey: "MATERIALS",
        amount: "47",
        coefficient: "0.047",
        iuFamily: "WOOD",
        unifiedIndexCode: "43",
      }),
      monomial({
        id: "paint",
        code: "PI",
        name: "Pintura",
        costGroupKey: "MATERIALS",
        amount: "30",
        coefficient: "0.030",
        iuFamily: "FINISHES",
        unifiedIndexCode: "54",
      }),
      monomial({
        id: "gg",
        code: "GG",
        name: "Gastos generales",
        costGroupKey: "GENERAL_EXPENSES_PROFIT",
        amount: "250",
        coefficient: "0.250",
        iuFamily: "GENERAL_EXPENSES",
        unifiedIndexCode: "39",
      }),
    ];

    const before = JSON.parse(JSON.stringify(input)) as PolynomialMonomialRecord[];

    const result = createPolynomialFinalAdjustmentProposal(input);

    expect(result.canApply).toBe(true);
    expect(result.finalMonomials).toHaveLength(5);
    expect(result.finalMonomials.map((item) => item.code)).toEqual(["MO", "CE", "LA", "BA", "GG"]);
    expect(result.finalMonomials.every((item) => Number(item.coefficient) >= 0.05)).toBe(true);
    expect(coefficientSum(result)).toBe("1.000");
    expect(result.mergePlan.length).toBeGreaterThan(0);
    expect(result.finalMonomials.every((item) => !("amountDecimal" in item))).toBe(true);
    expect(input).toEqual(before);
  });

  it("keeps labor and general expenses independent while merging a low steel item into steel", () => {
    const result = createPolynomialFinalAdjustmentProposal([
      monomial({
        id: "mo",
        code: "MO",
        name: "Mano de obra",
        costGroupKey: "LABOR",
        amount: "370",
        coefficient: "0.370",
        iuFamily: "LABOR",
        unifiedIndexCode: "47",
      }),
      monomial({
        id: "steel",
        code: "AC",
        name: "Acero",
        costGroupKey: "MATERIALS",
        amount: "180",
        coefficient: "0.180",
        iuFamily: "STEEL",
        unifiedIndexCode: "3",
      }),
      monomial({
        id: "steel-small",
        code: "AL",
        name: "Acero liso",
        costGroupKey: "MATERIALS",
        amount: "15",
        coefficient: "0.015",
        iuFamily: "STEEL",
        unifiedIndexCode: "2",
      }),
      monomial({
        id: "gg",
        code: "GG",
        name: "Gastos generales",
        costGroupKey: "GENERAL_EXPENSES_PROFIT",
        amount: "435",
        coefficient: "0.435",
        iuFamily: "GENERAL_EXPENSES",
        unifiedIndexCode: "39",
      }),
    ]);

    expect(result.finalMonomials.map((item) => item.id)).toContain("mo");
    expect(result.finalMonomials.map((item) => item.id)).toContain("gg");
    expect(result.finalMonomials.find((item) => item.id === "mo")?.composition).toHaveLength(1);
    expect(result.finalMonomials.find((item) => item.id === "gg")?.composition).toHaveLength(1);
    expect(result.finalMonomials.find((item) => item.id === "steel")?.composition.map((row) => row.unifiedIndexCode)).toEqual([
      "3",
      "2",
    ]);
  });
});
