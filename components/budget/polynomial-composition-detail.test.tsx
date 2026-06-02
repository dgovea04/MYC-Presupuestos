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
        resourceName: "Cemento portland tipo I (42.5 kg)",
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
  it("renders a non-editable initial broad group summary with amount and coefficient totals", () => {
    const markup = renderToStaticMarkup(
      <PolynomialCompositionDetail
        monomials={[
          createMonomial({
            id: "labor",
            code: "MO",
            name: "Mano de obra",
            costGroupKey: "LABOR",
            amount: "200.0000",
            coefficient: "0.200",
            composition: [
              {
                id: "labor-component",
                monomialId: "labor",
                apuResourceId: "labor-resource",
                resourceType: "MO",
                resourceName: "Operario",
                amount: "200.00",
                unifiedIndexCode: "47",
                unifiedIndexName: "Mano de obra",
                iuFamily: "LABOR",
                participationPercentage: "1.000000",
                coefficientContribution: "0.200000",
              },
            ],
          }),
          createMonomial({
            id: "cement",
            code: "IU21",
            name: "Cemento Portland Tipo I",
            costGroupKey: "CEMENT",
            amount: "300.0000",
            coefficient: "0.300",
            composition: [
              {
                id: "cement-component",
                monomialId: "cement",
                apuResourceId: "cement-resource",
                resourceType: "Material",
                resourceName: "Cemento portland tipo I",
                amount: "300.00",
                unifiedIndexCode: "21",
                unifiedIndexName: "Cemento Portland Tipo I",
                iuFamily: "CEMENT",
                participationPercentage: "1.000000",
                coefficientContribution: "0.300000",
              },
            ],
          }),
          createMonomial({
            id: "gu",
            code: "GU",
            name: "Gastos generales y utilidad",
            costGroupKey: "GENERAL_EXPENSES_PROFIT",
            amount: "500.0000",
            coefficient: "0.500",
            composition: [],
          }),
        ]}
      />,
    );

    expect(markup).toContain("Monomios iniciales");
    expect(markup).toContain("MO");
    expect(markup).toContain("MAT");
    expect(markup).toContain("EQ");
    expect(markup).toContain("V");
    expect(markup).toContain("GU");
    expect(markup).toContain("1,000.00");
    expect(markup).toContain("1.000");
  });

  it("renders monomial composition rows with formatted contribution fields", () => {
    const markup = renderToStaticMarkup(
      <PolynomialCompositionDetail
        monomials={[
          createMonomial({
            name: "IU 21 : CEMENTO PORTLAND E HIDRAULICO",
            composition: [
              {
                id: "component-1",
                monomialId: "monomial-1",
                apuResourceId: "resource-cement-long-id-001",
                resourceType: "MATERIAL",
                amount: "2912.50",
                resourceName: "Cemento portland tipo I (42.5 kg)",
                unifiedIndexCode: "21",
                unifiedIndexName: "Cemento portland tipo I",
                iuFamily: "CEMENT",
                participationPercentage: "0.909091",
                coefficientContribution: "0.291262",
              },
              {
                id: "component-2",
                monomialId: "monomial-1",
                apuResourceId: "resource-cement-long-id-002",
                resourceType: "MATERIAL",
                amount: "297.50",
                resourceName: "Cemento portland adicional",
                unifiedIndexCode: "21",
                unifiedIndexName: "Cemento portland tipo I",
                iuFamily: "CEMENT",
                participationPercentage: "0.090909",
                coefficientContribution: "0.029738",
              },
            ],
          }),
        ]}
      />,
    );

    expect(markup).toContain("Detalle de composicion");
    expect(markup).toContain("IU 21 : CEMENTO PORTLAND E HIDRAULICO");
    expect(markup).toContain("Codigo CE · Coef. 0.321");
    expect(markup).toContain("CE");
    expect(markup).toContain("21 : CEMENTO PORTLAND TIPO I");
    expect(markup).toContain("Cemento portland tipo I (42.5 kg)");
    expect(markup).toContain("MATERIALS");
    expect(markup).toContain("CEMENT");
    expect(markup).toContain("2,912.50");
    expect(markup).toContain("90.91%");
    expect(markup).toContain("3,210.00");
    expect(markup).toContain("100.00%");
    expect(markup).toContain("0.321");
    expect(markup).toContain("0.291");
    expect(markup).toContain("1 fuente : resource...id-001");
  });

  it("renders one-digit IU codes with the official two-digit format", () => {
    const markup = renderToStaticMarkup(
      <PolynomialCompositionDetail
        monomials={[
          createMonomial({
            code: "MAT",
            name: "IU 01 : ACEITE Y LUBRICANTE (B)",
            baseIndexCode: "1",
            baseIndexName: "ACEITE Y LUBRICANTE (B)",
            composition: [
              {
                id: "component-1",
                monomialId: "monomial-1",
                apuResourceId: "resource-grease",
                resourceType: "MATERIAL",
                amount: "100.00",
                resourceName: "Grasa multi propositos",
                unifiedIndexCode: "1",
                unifiedIndexName: "Aceite y lubricante (b)",
                iuFamily: "OTHERS",
                participationPercentage: "1.000000",
                coefficientContribution: "0.100000",
              },
              {
                id: "component-2",
                monomialId: "monomial-1",
                apuResourceId: "resource-sand",
                resourceType: "MATERIAL",
                amount: "100.00",
                resourceName: "Arena fina",
                unifiedIndexCode: "4",
                unifiedIndexName: "AGREGADO FINO",
                iuFamily: "AGGREGATES",
                participationPercentage: "1.000000",
                coefficientContribution: "0.100000",
              },
            ],
          }),
        ]}
      />,
    );

    expect(markup).toContain("01 : ACEITE Y LUBRICANTE");
    expect(markup).toContain("04 : AGREGADO FINO");
    expect(markup).not.toContain("ACEITE Y LUBRICANTE (B)");
  });

  it("renders IU names uppercase and removes final note suffixes", () => {
    const markup = renderToStaticMarkup(
      <PolynomialCompositionDetail
        monomials={[
          createMonomial({
            code: "GG",
            name: "IU 34 : GASOHOL Y GASOLINA",
            baseIndexCode: "34",
            baseIndexName: "Gasohol y gasolina (b)",
            composition: [
              {
                id: "component-1",
                monomialId: "monomial-1",
                apuResourceId: "resource-fuel",
                resourceType: "EQUIPMENT",
                amount: "100.00",
                resourceName: "Gasohol",
                unifiedIndexCode: "34",
                unifiedIndexName: "Gasohol y gasolina (b)",
                iuFamily: "EQUIPMENT",
                participationPercentage: "1.000000",
                coefficientContribution: "0.100000",
              },
            ],
          }),
        ]}
      />,
    );

    expect(markup).toContain("34 : GASOHOL Y GASOLINA");
    expect(markup).not.toContain("34 : Gasohol y gasolina (b)");
  });

  it("shows a placeholder row when a monomial has no composition snapshot", () => {
    const markup = renderToStaticMarkup(
      <PolynomialCompositionDetail
        monomials={[
          createMonomial({
            code: "GU",
            name: "IU 39 : INDICE GENERAL DE PRECIOS AL CONSUMIDOR",
            costGroupKey: "GENERAL_EXPENSES_PROFIT",
            amount: "61476.8700",
            coefficient: "0.180",
            baseIndexCode: "39",
            baseIndexName: "INDICE GENERAL DE PRECIOS AL CONSUMIDOR",
            composition: [],
          }),
        ]}
      />,
    );

    expect(markup).toContain("39 : INDICE GENERAL DE PRECIOS AL CONSUMIDOR");
    expect(markup).toContain("GENERAL_EXPENSES_PROFIT");
    expect(markup).toContain("61,476.87");
    expect(markup).toContain("100.00%");
    expect(markup).toContain("0.180");
    expect(markup).toContain("0 fuentes");
  });
});
