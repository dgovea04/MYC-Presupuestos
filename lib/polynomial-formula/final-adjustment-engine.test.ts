import Decimal from "decimal.js";
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
    .reduce((sum, item) => sum.plus(item.coefficient), new Decimal(0))
    .toFixed(3);
}

describe("createPolynomialFinalAdjustmentProposal", () => {
  it("keeps a valid architecture-like preliminary set at 6 monomials without mutating input", () => {
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

    const before = structuredClone(input) as PolynomialMonomialRecord[];

    const result = createPolynomialFinalAdjustmentProposal(input);

    expect(result.canApply).toBe(true);
    expect(result.finalMonomials).toHaveLength(6);
    expect(result.finalMonomials.map((item) => item.code)).toEqual(["MO", "CE", "LA", "BA", "MA", "GG"]);
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
        id: "cement",
        code: "CE",
        name: "Cemento",
        costGroupKey: "MATERIALS",
        amount: "80",
        coefficient: "0.080",
        iuFamily: "CEMENT",
        unifiedIndexCode: "21",
      }),
      monomial({
        id: "finish",
        code: "ACB",
        name: "Acabados",
        costGroupKey: "MATERIALS",
        amount: "70",
        coefficient: "0.070",
        iuFamily: "FINISHES",
        unifiedIndexCode: "16",
      }),
      monomial({
        id: "gg",
        code: "GG",
        name: "Gastos generales",
        costGroupKey: "GENERAL_EXPENSES_PROFIT",
        amount: "285",
        coefficient: "0.285",
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

  it("leaves a low non-locked monomial unresolved when only locked monomials remain as alternatives", () => {
    const result = createPolynomialFinalAdjustmentProposal([
      monomial({
        id: "mo",
        code: "MO",
        name: "Mano de obra",
        costGroupKey: "LABOR",
        amount: "475",
        coefficient: "0.475",
        iuFamily: "LABOR",
        unifiedIndexCode: "47",
      }),
      monomial({
        id: "gg",
        code: "GG",
        name: "Gastos generales",
        costGroupKey: "GENERAL_EXPENSES_PROFIT",
        amount: "500",
        coefficient: "0.500",
        iuFamily: "GENERAL_EXPENSES",
        unifiedIndexCode: "39",
      }),
      monomial({
        id: "material-low",
        code: "MT",
        name: "Material menor",
        costGroupKey: "MATERIALS",
        amount: "25",
        coefficient: "0.025",
        iuFamily: "OTHERS",
        unifiedIndexCode: "90",
      }),
    ]);

    expect(result.finalMonomials.find((item) => item.id === "mo")?.composition).toHaveLength(1);
    expect(result.finalMonomials.find((item) => item.id === "gg")?.composition).toHaveLength(1);
    expect(result.finalMonomials.find((item) => item.id === "material-low")?.coefficient).toBe("0.025");
    expect(result.diagnostics.some((diagnostic) => diagnostic.code === "LOW_COEFFICIENT_UNRESOLVED")).toBe(true);
    expect(result.canApply).toBe(false);
  });

  it("stops merging at the minimum final monomial count when the proposal becomes valid", () => {
    const result = createPolynomialFinalAdjustmentProposal([
      monomial({
        id: "mo",
        code: "MO",
        name: "Mano de obra",
        costGroupKey: "LABOR",
        amount: "250",
        coefficient: "0.250",
        iuFamily: "LABOR",
        unifiedIndexCode: "47",
      }),
      monomial({
        id: "pipe-small",
        code: "TU",
        name: "Tuberia menor",
        costGroupKey: "MATERIALS",
        amount: "20",
        coefficient: "0.020",
        iuFamily: "SANITARY_INSTALLATIONS",
        unifiedIndexCode: "72",
      }),
      monomial({
        id: "pipe",
        code: "TP",
        name: "Tuberia PVC",
        costGroupKey: "MATERIALS",
        amount: "80",
        coefficient: "0.080",
        iuFamily: "SANITARY_INSTALLATIONS",
        unifiedIndexCode: "73",
      }),
      monomial({
        id: "valves",
        code: "VA",
        name: "Valvulas",
        costGroupKey: "MATERIALS",
        amount: "150",
        coefficient: "0.150",
        iuFamily: "SANITARY_INSTALLATIONS",
        unifiedIndexCode: "74",
      }),
      monomial({
        id: "equipment",
        code: "EQ",
        name: "Equipos sanitarios",
        costGroupKey: "EQUIPMENT",
        amount: "250",
        coefficient: "0.250",
        iuFamily: "EQUIPMENT",
        unifiedIndexCode: "49",
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
    ]);

    expect(result.canApply).toBe(true);
    expect(result.finalMonomials).toHaveLength(5);
    expect(result.finalMonomials.every((item) => Number(item.coefficient) >= 0.05)).toBe(true);
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).not.toContain(
      "FINAL_MONOMIAL_COUNT_BELOW_MINIMUM",
    );
  });

  it("uses technical name affinity to group sanitary PVC pipes before broader same-family targets", () => {
    const result = createPolynomialFinalAdjustmentProposal([
      monomial({
        id: "mo",
        code: "MO",
        name: "Mano de obra",
        costGroupKey: "LABOR",
        amount: "250",
        coefficient: "0.250",
        iuFamily: "LABOR",
        unifiedIndexCode: "47",
      }),
      monomial({
        id: "iu-66",
        code: "IS - IU 66",
        name: "TUBERIA DE PVC PARA LA RED DE AGUA POTABLE Y ALCANTARILLADO",
        costGroupKey: "MATERIALS",
        amount: "33",
        coefficient: "0.033",
        iuFamily: "SANITARY_INSTALLATIONS",
        unifiedIndexCode: "66",
      }),
      monomial({
        id: "iu-72",
        code: "IS - IU 72",
        name: "TUBERIA DE PVC PARA REDES INTERIORES",
        costGroupKey: "MATERIALS",
        amount: "28",
        coefficient: "0.028",
        iuFamily: "SANITARY_INSTALLATIONS",
        unifiedIndexCode: "72",
      }),
      monomial({
        id: "iu-90",
        code: "IS - IU 90",
        name: "TUBERIA DE POLIETILENO",
        costGroupKey: "MATERIALS",
        amount: "180",
        coefficient: "0.180",
        iuFamily: "SANITARY_INSTALLATIONS",
        unifiedIndexCode: "90",
      }),
      monomial({
        id: "equipment",
        code: "EQ",
        name: "Equipos sanitarios",
        costGroupKey: "EQUIPMENT",
        amount: "242",
        coefficient: "0.242",
        iuFamily: "EQUIPMENT",
        unifiedIndexCode: "49",
      }),
      monomial({
        id: "gg",
        code: "GG",
        name: "Gastos generales",
        costGroupKey: "GENERAL_EXPENSES_PROFIT",
        amount: "267",
        coefficient: "0.267",
        iuFamily: "GENERAL_EXPENSES",
        unifiedIndexCode: "39",
      }),
    ]);

    expect(result.canApply).toBe(true);
    expect(result.finalMonomials).toHaveLength(5);
    expect(result.mergePlan).toContainEqual(
      expect.objectContaining({
        targetMonomialId: "iu-66",
        sourceMonomialIds: ["iu-72"],
      }),
    );
    expect(result.finalMonomials.find((item) => item.id === "iu-66")?.coefficient).toBe("0.061");
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).not.toContain("LOW_COEFFICIENT_UNRESOLVED");
  });

  it("does not merge below the minimum final monomial count", () => {
    const result = createPolynomialFinalAdjustmentProposal([
      monomial({
        id: "mo",
        code: "MO",
        name: "Mano de obra",
        costGroupKey: "LABOR",
        amount: "250",
        coefficient: "0.250",
        iuFamily: "LABOR",
        unifiedIndexCode: "47",
      }),
      monomial({
        id: "pipe-small",
        code: "TU",
        name: "Tuberia menor",
        costGroupKey: "MATERIALS",
        amount: "20",
        coefficient: "0.020",
        iuFamily: "SANITARY_INSTALLATIONS",
        unifiedIndexCode: "72",
      }),
      monomial({
        id: "pipe",
        code: "TP",
        name: "Tuberia PVC",
        costGroupKey: "MATERIALS",
        amount: "330",
        coefficient: "0.330",
        iuFamily: "SANITARY_INSTALLATIONS",
        unifiedIndexCode: "73",
      }),
      monomial({
        id: "valves",
        code: "VA",
        name: "Valvulas",
        costGroupKey: "MATERIALS",
        amount: "150",
        coefficient: "0.150",
        iuFamily: "SANITARY_INSTALLATIONS",
        unifiedIndexCode: "74",
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
    ]);

    expect(result.finalMonomials).toHaveLength(5);
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).not.toContain(
      "FINAL_MONOMIAL_COUNT_BELOW_MINIMUM",
    );
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "LOW_COEFFICIENT_UNRESOLVED",
        severity: "ERROR",
      }),
    );
    expect(result.canApply).toBe(false);
  });

  it("keeps a valid 6-monomial proposal unchanged when all coefficients already satisfy the minimum", () => {
    const input = [
      monomial({
        id: "mo",
        code: "MO",
        name: "Mano de obra",
        costGroupKey: "LABOR",
        amount: "280",
        coefficient: "0.280",
        iuFamily: "LABOR",
        unifiedIndexCode: "47",
      }),
      monomial({
        id: "cement",
        code: "CE",
        name: "Cemento",
        costGroupKey: "MATERIALS",
        amount: "140",
        coefficient: "0.140",
        iuFamily: "CEMENT",
        unifiedIndexCode: "21",
      }),
      monomial({
        id: "steel",
        code: "AC",
        name: "Acero",
        costGroupKey: "MATERIALS",
        amount: "130",
        coefficient: "0.130",
        iuFamily: "STEEL",
        unifiedIndexCode: "3",
      }),
      monomial({
        id: "wood",
        code: "MA",
        name: "Madera",
        costGroupKey: "MATERIALS",
        amount: "120",
        coefficient: "0.120",
        iuFamily: "WOOD",
        unifiedIndexCode: "43",
      }),
      monomial({
        id: "finish",
        code: "PI",
        name: "Pintura",
        costGroupKey: "MATERIALS",
        amount: "90",
        coefficient: "0.090",
        iuFamily: "FINISHES",
        unifiedIndexCode: "54",
      }),
      monomial({
        id: "gg",
        code: "GG",
        name: "Gastos generales",
        costGroupKey: "GENERAL_EXPENSES_PROFIT",
        amount: "240",
        coefficient: "0.240",
        iuFamily: "GENERAL_EXPENSES",
        unifiedIndexCode: "39",
      }),
    ];

    const result = createPolynomialFinalAdjustmentProposal(input);

    expect(result.canApply).toBe(true);
    expect(result.finalMonomials).toHaveLength(6);
    expect(result.finalMonomials.map((item) => item.id)).toEqual(input.map((item) => item.id));
    expect(result.mergePlan).toEqual([]);
    expect(result.finalMonomials.every((item) => Number(item.coefficient) >= 0.05)).toBe(true);
    expect(coefficientSum(result)).toBe("1.000");
  });

  it("does not classify missing IU families as compatible-family matches", () => {
    const result = createPolynomialFinalAdjustmentProposal([
      monomial({
        id: "unknown-low",
        code: "U1",
        name: "Insumo especial",
        costGroupKey: "MATERIALS",
        amount: "20",
        coefficient: "0.020",
      }),
      monomial({
        id: "unknown-high",
        code: "U2",
        name: "Otro insumo especial",
        costGroupKey: "MATERIALS",
        amount: "480",
        coefficient: "0.480",
      }),
      monomial({
        id: "known-target",
        code: "CE",
        name: "Cemento",
        costGroupKey: "MATERIALS",
        amount: "500",
        coefficient: "0.500",
        iuFamily: "CEMENT",
        unifiedIndexCode: "21",
      }),
      monomial({
        id: "steel",
        code: "AC",
        name: "Acero",
        costGroupKey: "MATERIALS",
        amount: "200",
        coefficient: "0.200",
        iuFamily: "STEEL",
        unifiedIndexCode: "3",
      }),
      monomial({
        id: "finish",
        code: "ACB",
        name: "Acabados",
        costGroupKey: "MATERIALS",
        amount: "180",
        coefficient: "0.180",
        iuFamily: "FINISHES",
        unifiedIndexCode: "16",
      }),
      monomial({
        id: "gg",
        code: "GG",
        name: "Gastos generales",
        costGroupKey: "GENERAL_EXPENSES_PROFIT",
        amount: "220",
        coefficient: "0.220",
        iuFamily: "GENERAL_EXPENSES",
        unifiedIndexCode: "39",
      }),
    ]);

    expect(result.mergePlan).toHaveLength(1);
    expect(result.mergePlan[0]).toMatchObject({
      sourceMonomialIds: ["unknown-low"],
      reason: "SAME_BROAD_GROUP",
    });
    expect(result.mergePlan[0]?.targetMonomialId).not.toBe("unknown-low");
  });

  it("uses experience hints as a scoring boost for compatible manual merge patterns", () => {
    const result = createPolynomialFinalAdjustmentProposal(
      [
        monomial({
          id: "wood-low",
          code: "MD",
          name: "Madera menor",
          costGroupKey: "MATERIALS",
          amount: "20",
          coefficient: "0.020",
          iuFamily: "WOOD",
          unifiedIndexCode: "43",
        }),
        monomial({
          id: "wood-target",
          code: "MA",
          name: "Madera",
          costGroupKey: "MATERIALS",
          amount: "180",
          coefficient: "0.180",
          iuFamily: "WOOD",
          unifiedIndexCode: "41",
        }),
        monomial({
          id: "finishes-target",
          code: "AC",
          name: "Acabados",
          costGroupKey: "MATERIALS",
          amount: "200",
          coefficient: "0.200",
          iuFamily: "FINISHES",
          unifiedIndexCode: "16",
        }),
        monomial({
          id: "mo",
          code: "MO",
          name: "Mano de obra",
          costGroupKey: "LABOR",
          amount: "300",
          coefficient: "0.300",
          iuFamily: "LABOR",
          unifiedIndexCode: "47",
        }),
        monomial({
          id: "gg",
          code: "GG",
          name: "Gastos generales",
          costGroupKey: "GENERAL_EXPENSES_PROFIT",
          amount: "300",
          coefficient: "0.300",
          iuFamily: "GENERAL_EXPENSES",
          unifiedIndexCode: "39",
        }),
        monomial({
          id: "cement",
          code: "CE",
          name: "Cemento",
          costGroupKey: "MATERIALS",
          amount: "100",
          coefficient: "0.100",
          iuFamily: "CEMENT",
          unifiedIndexCode: "21",
        }),
      ],
      {
        experienceHints: [
          {
            sourceIuFamily: "WOOD",
            targetIuFamily: "FINISHES",
            targetCode: "AC",
            costGroupKey: "MATERIALS",
            weight: 50,
            evidenceLabel: "manual-finish-merge",
          },
        ],
      },
    );

    expect(result.mergePlan).toHaveLength(1);
    expect(result.mergePlan[0]).toMatchObject({
      targetMonomialId: "finishes-target",
      sourceMonomialIds: ["wood-low"],
      reason: "EXPERIENCE_HINT",
    });
    expect(result.finalMonomials.find((item) => item.id === "finishes-target")?.composition.map((row) => row.id)).toContain(
      "wood-low-component",
    );
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toContain("EXPERIENCE_HINT_USED");
  });

  it("does not let experience hints merge locked labor or general expenses as source", () => {
    const result = createPolynomialFinalAdjustmentProposal(
      [
        monomial({
          id: "mo",
          code: "MO",
          name: "Mano de obra",
          costGroupKey: "LABOR",
          amount: "20",
          coefficient: "0.020",
          iuFamily: "LABOR",
          unifiedIndexCode: "47",
        }),
        monomial({
          id: "materials",
          code: "MA",
          name: "Materiales",
          costGroupKey: "MATERIALS",
          amount: "530",
          coefficient: "0.530",
          iuFamily: "WOOD",
          unifiedIndexCode: "43",
        }),
        monomial({
          id: "gg",
          code: "GG",
          name: "Gastos generales",
          costGroupKey: "GENERAL_EXPENSES_PROFIT",
          amount: "450",
          coefficient: "0.450",
          iuFamily: "GENERAL_EXPENSES",
          unifiedIndexCode: "39",
        }),
      ],
      {
        experienceHints: [
          {
            sourceIuFamily: "LABOR",
            sourceUnifiedIndexCode: "47",
            targetIuFamily: "WOOD",
            targetUnifiedIndexCode: "43",
            targetCode: "MA",
            costGroupKey: "MATERIALS",
            weight: 1_000,
            evidenceLabel: "invalid-locked-merge",
          },
        ],
      },
    );

    expect(result.finalMonomials.find((item) => item.id === "mo")?.composition).toHaveLength(1);
    expect(result.finalMonomials.map((item) => item.id)).toContain("mo");
    expect(result.mergePlan).toEqual([]);
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).not.toContain("EXPERIENCE_HINT_USED");
  });
});
