import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { PolynomialCompositionDetail } from "@/components/budget/polynomial-composition-detail";
import type { PolynomialMonomialRecord } from "@/types/polynomial-formula";

function createMonomial(
  overrides: Partial<PolynomialMonomialRecord> = {},
): PolynomialMonomialRecord {
  return {
    id: "monomial-1",
    formulaId: "formula-1",
    code: "CE",
    name: "Cemento",
    costGroupKey: "CEMENT",
    amount: "3210.0000",
    coefficient: "0.321",
    baseIndexCode: "21",
    baseIndexName: "Cemento portland",
    baseIndexValue: "100.000",
    adjustmentIndexCode: null,
    adjustmentIndexName: null,
    adjustmentIndexValue: null,
    sortOrder: 0,
    composition: [
      {
        id: "component-1",
        monomialId: "monomial-1",
        apuResourceId: "resource-cement-long-id-001",
        resourceType: "MATERIAL",
        amount: "2912.50",
        unifiedIndexCode: "21",
        unifiedIndexName: "Cemento portland tipo I",
        iuFamily: "CEMENT",
        participationPercentage: "0.909091",
        coefficientContribution: "0.291262",
      },
    ],
    ...overrides,
  };
}

describe("PolynomialCompositionDetail", () => {
  it("renders monomial composition rows with formatted contribution fields", () => {
    const markup = renderToStaticMarkup(
      <PolynomialCompositionDetail monomials={[createMonomial()]} />,
    );

    expect(markup).toContain("Detalle de composicion");
    expect(markup).toContain("CE");
    expect(markup).toContain("Cemento portland tipo I");
    expect(markup).toContain("CEMENT");
    expect(markup).toContain("2,912.50");
    expect(markup).toContain("90.91%");
    expect(markup).toContain("0.291");
    expect(markup).toContain("1 fuente");
  });

  it("shows a placeholder row when a monomial has no composition snapshot", () => {
    const markup = renderToStaticMarkup(
      <PolynomialCompositionDetail
        monomials={[createMonomial({ composition: [] })]}
      />,
    );

    expect(markup).toContain("Sin indice");
    expect(markup).toContain("Sin familia");
    expect(markup).toContain("0 fuentes");
  });
});
