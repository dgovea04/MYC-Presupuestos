import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";

import {
  createSmartPolynomialMonomialProposal,
  allocateRoundedCoefficients,
} from "@/lib/polynomial-formula/smart-monomial-engine";
import type { PolynomialIuFamily } from "@/lib/polynomial-formula/iu-family-classifier";
import type {
  SmartMonomialBroadGroup,
  SmartMonomialInputItem,
} from "@/lib/polynomial-formula/smart-monomial-types";

function item(input: {
  id: string;
  broadGroup: SmartMonomialBroadGroup;
  amount: string;
  iuFamily: PolynomialIuFamily;
  unifiedIndexCode?: string;
  unifiedIndexName?: string;
}): SmartMonomialInputItem {
  return {
    id: input.id,
    sourceId: `source-${input.id}`,
    broadGroup: input.broadGroup,
    amount: new Decimal(input.amount),
    baseAmount: new Decimal(input.amount),
    iuFamily: input.iuFamily,
    unifiedIndexCode: input.unifiedIndexCode,
    unifiedIndexName: input.unifiedIndexName,
  };
}

function coefficientByKey(
  items: ReturnType<typeof createSmartPolynomialMonomialProposal>["proposedMonomials"],
): Record<string, string> {
  return Object.fromEntries(items.map((monomial) => [monomial.key, monomial.coefficient.toFixed(3)]));
}

describe("createSmartPolynomialMonomialProposal", () => {
  it("keeps labor and general expenses locked while splitting materials by IU family", () => {
    const result = createSmartPolynomialMonomialProposal([
      item({
        id: "labor-1",
        broadGroup: "LABOR",
        amount: "200",
        iuFamily: "LABOR",
        unifiedIndexCode: "47",
        unifiedIndexName: "Mano de obra",
      }),
      item({
        id: "cement-1",
        broadGroup: "MATERIALS",
        amount: "300",
        iuFamily: "CEMENT",
        unifiedIndexCode: "21",
        unifiedIndexName: "Cemento Portland",
      }),
      item({
        id: "steel-1",
        broadGroup: "MATERIALS",
        amount: "250",
        iuFamily: "STEEL",
        unifiedIndexCode: "3",
        unifiedIndexName: "Acero corrugado",
      }),
      item({
        id: "gu-1",
        broadGroup: "GENERAL_EXPENSES_PROFIT",
        amount: "250",
        iuFamily: "GENERAL_EXPENSES",
        unifiedIndexCode: "39",
        unifiedIndexName: "Indice general",
      }),
    ]);

    expect(result.proposedMonomials.map((monomial) => monomial.key)).toEqual([
      "LABOR",
      "MATERIALS:CEMENT",
      "MATERIALS:STEEL",
      "GENERAL_EXPENSES_PROFIT",
    ]);
    expect(result.proposedMonomials.filter((monomial) => monomial.locked).map((monomial) => monomial.key)).toEqual([
      "LABOR",
      "GENERAL_EXPENSES_PROFIT",
    ]);
    expect(result.proposedMonomials.find((monomial) => monomial.key === "MATERIALS:CEMENT")?.statuses).toContain(
      "SPLIT_BY_IU_FAMILY",
    );
    expect(coefficientByKey(result.proposedMonomials)).toEqual({
      LABOR: "0.200",
      "MATERIALS:CEMENT": "0.300",
      "MATERIALS:STEEL": "0.250",
      GENERAL_EXPENSES_PROFIT: "0.250",
    });
  });

  it("does not leave zero or below-threshold others as standalone and emits diagnostics", () => {
    const result = createSmartPolynomialMonomialProposal([
      item({ id: "labor-1", broadGroup: "LABOR", amount: "500", iuFamily: "LABOR" }),
      item({ id: "mat-1", broadGroup: "MATERIALS", amount: "460", iuFamily: "CEMENT" }),
      item({ id: "other-zero", broadGroup: "OTHERS", amount: "0", iuFamily: "OTHERS" }),
      item({ id: "other-small", broadGroup: "OTHERS", amount: "40", iuFamily: "OTHERS" }),
    ]);

    expect(result.proposedMonomials.map((monomial) => monomial.key)).not.toContain("OTHERS");
    const material = result.proposedMonomials.find((monomial) => monomial.key === "MATERIALS:CEMENT");
    expect(material?.sourceItemIds).toEqual(["mat-1", "other-small"]);
    expect(material?.statuses).toEqual(expect.arrayContaining(["MERGED_PRELIMINARILY", "USER_MERGE_CANDIDATE"]));
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toEqual(
      expect.arrayContaining(["ZERO_COEFFICIENT", "BELOW_MINIMUM_COEFFICIENT", "MERGED_PRELIMINARILY"]),
    );
  });

  it("merges equipment below threshold but leaves equipment above threshold standalone", () => {
    const below = createSmartPolynomialMonomialProposal([
      item({ id: "mat-1", broadGroup: "MATERIALS", amount: "960", iuFamily: "CEMENT" }),
      item({ id: "eq-small", broadGroup: "EQUIPMENT", amount: "40", iuFamily: "EQUIPMENT" }),
    ]);
    const above = createSmartPolynomialMonomialProposal([
      item({ id: "mat-1", broadGroup: "MATERIALS", amount: "940", iuFamily: "CEMENT" }),
      item({ id: "eq-big", broadGroup: "EQUIPMENT", amount: "60", iuFamily: "EQUIPMENT" }),
    ]);

    expect(below.proposedMonomials.map((monomial) => monomial.key)).not.toContain("EQUIPMENT");
    expect(below.proposedMonomials[0].sourceItemIds).toEqual(["mat-1", "eq-small"]);
    expect(above.proposedMonomials.map((monomial) => monomial.key)).toContain("EQUIPMENT");
    expect(coefficientByKey(above.proposedMonomials).EQUIPMENT).toBe("0.060");
  });

  it("falls back to a locked target when below-threshold equipment has no non-locked merge target", () => {
    const result = createSmartPolynomialMonomialProposal([
      item({ id: "labor-1", broadGroup: "LABOR", amount: "960", iuFamily: "LABOR" }),
      item({ id: "eq-small", broadGroup: "EQUIPMENT", amount: "40", iuFamily: "EQUIPMENT" }),
    ]);

    expect(result.proposedMonomials.map((monomial) => monomial.key)).toEqual(["LABOR"]);
    const labor = result.proposedMonomials[0];
    expect(labor.locked).toBe(true);
    expect(labor.sourceItemIds).toEqual(["labor-1", "eq-small"]);
    expect(labor.compositionRows.flatMap((row) => row.sourceItemIds)).toEqual(["labor-1", "eq-small"]);
    expect(labor.statuses).toEqual(expect.arrayContaining(["MERGED_PRELIMINARILY", "USER_MERGE_CANDIDATE"]));
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toEqual(
      expect.arrayContaining(["BELOW_MINIMUM_COEFFICIENT", "MERGED_PRELIMINARILY"]),
    );
  });

  it("reduces more than ten candidate groups by merging the smallest non-locked groups", () => {
    const materialFamilies: PolynomialIuFamily[] = [
      "STEEL",
      "CEMENT",
      "AGGREGATES",
      "MASONRY",
      "WOOD",
      "FINISHES",
      "SANITARY_INSTALLATIONS",
      "ELECTRICAL_INSTALLATIONS",
      "EQUIPMENT",
      "OTHERS",
      "GENERAL_EXPENSES",
    ];
    const result = createSmartPolynomialMonomialProposal(
      materialFamilies.map((iuFamily, index) =>
        item({
          id: `mat-${index + 1}`,
          broadGroup: "MATERIALS",
          amount: String(100 + index),
          iuFamily,
        }),
      ),
    );

    expect(result.proposedMonomials).toHaveLength(10);
    expect(result.proposedMonomials.some((monomial) => monomial.sourceItemIds.length > 1)).toBe(true);
    expect(result.proposedMonomials.some((monomial) => monomial.statuses.includes("USER_MERGE_CANDIDATE"))).toBe(
      true,
    );
  });

  it("returns three-decimal coefficients that sum exactly to 1.000 for nonzero totals", () => {
    const result = createSmartPolynomialMonomialProposal([
      item({ id: "a", broadGroup: "MATERIALS", amount: "1", iuFamily: "STEEL" }),
      item({ id: "b", broadGroup: "MATERIALS", amount: "1", iuFamily: "CEMENT" }),
      item({ id: "c", broadGroup: "MATERIALS", amount: "1", iuFamily: "WOOD" }),
    ]);

    expect(result.proposedMonomials.map((monomial) => monomial.coefficient.toFixed(3)).sort()).toEqual([
      "0.333",
      "0.333",
      "0.334",
    ]);
    const sum = result.proposedMonomials.reduce(
      (total, monomial) => total.plus(monomial.coefficient),
      new Decimal(0),
    );
    expect(sum.toFixed(3)).toBe("1.000");
  });

  it("adds composition rows with monomial participation and total coefficient contribution", () => {
    const result = createSmartPolynomialMonomialProposal([
      item({
        id: "cement-1",
        broadGroup: "MATERIALS",
        amount: "300",
        iuFamily: "CEMENT",
        unifiedIndexCode: "21",
        unifiedIndexName: "Cemento Portland",
      }),
      item({
        id: "cement-2",
        broadGroup: "MATERIALS",
        amount: "100",
        iuFamily: "CEMENT",
        unifiedIndexCode: "21",
        unifiedIndexName: "Cemento Portland",
      }),
      item({
        id: "steel-1",
        broadGroup: "MATERIALS",
        amount: "600",
        iuFamily: "STEEL",
        unifiedIndexCode: "3",
        unifiedIndexName: "Acero corrugado",
      }),
    ]);

    const cementRows = result.proposedMonomials.find((monomial) => monomial.key === "MATERIALS:CEMENT")
      ?.compositionRows;

    expect(cementRows).toEqual([
      expect.objectContaining({
        unifiedIndexCode: "21",
        unifiedIndexName: "Cemento Portland",
        iuFamily: "CEMENT",
        sourceItemIds: ["cement-1", "cement-2"],
      }),
    ]);
    expect(cementRows?.[0]?.amount.toString()).toBe("400");
    expect(cementRows?.[0]?.participationPercentage.toFixed(6)).toBe("1.000000");
    expect(cementRows?.[0]?.coefficientContribution.toFixed(6)).toBe("0.400000");
  });

  it("does not mutate input items", () => {
    const inputs = [
      item({ id: "mat-1", broadGroup: "MATERIALS", amount: "960", iuFamily: "CEMENT" }),
      item({ id: "eq-small", broadGroup: "EQUIPMENT", amount: "40", iuFamily: "EQUIPMENT" }),
    ];
    const before = inputs.map((input) => ({
      ...input,
      amount: input.amount.toString(),
      baseAmount: input.baseAmount.toString(),
    }));

    createSmartPolynomialMonomialProposal(inputs);

    expect(
      inputs.map((input) => ({
        ...input,
        amount: input.amount.toString(),
        baseAmount: input.baseAmount.toString(),
      })),
    ).toEqual(before);
  });
});

describe("allocateRoundedCoefficients", () => {
  it("allocates Decimal coefficients without using floating-point residue", () => {
    expect(allocateRoundedCoefficients([new Decimal("0.1"), new Decimal("0.2")]).map((value) => value.toFixed(3))).toEqual([
      "0.333",
      "0.667",
    ]);
  });
});
