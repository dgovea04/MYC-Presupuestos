import { describe, expect, it } from "vitest";

import {
  classifyUnifiedIndexForPolynomialFormula,
  type PolynomialIuFamily,
} from "@/lib/polynomial-formula/iu-family-classifier";

describe("classifyUnifiedIndexForPolynomialFormula", () => {
  it.each([
    [{ code: "47", name: "MANO DE OBRA" }, "LABOR"],
    [{ code: "39", name: "INDICE GENERAL DE PRECIOS AL CONSUMIDOR" }, "GENERAL_EXPENSES"],
    [{ code: "3", name: "ACERO DE CONSTRUCCION CORRUGADO" }, "STEEL"],
    [{ code: "2", name: "ACERO DE CONSTRUCCION LISO" }, "STEEL"],
    [{ code: "21", name: "CEMENTO PORTLAND TIPO I" }, "CEMENT"],
    [{ code: "5", name: "AGREGADO GRUESO" }, "AGGREGATES"],
    [{ code: "17", name: "BLOQUES Y LADRILLOS" }, "MASONRY"],
    [{ code: "43", name: "MADERA NACIONAL PARA ENCOFRADO Y CARPINTERIA" }, "WOOD"],
    [{ code: "54", name: "PINTURA LATEX" }, "FINISHES"],
    [{ code: "72", name: "TUBERIA DE PVC" }, "SANITARY_INSTALLATIONS"],
    [{ code: "7", name: "ALAMBRE Y CABLE TW Y THW" }, "ELECTRICAL_INSTALLATIONS"],
  ] satisfies Array<[{ code: string; name: string }, PolynomialIuFamily]>)(
    "classifies $0.name as $1",
    (index, expected) => {
      expect(classifyUnifiedIndexForPolynomialFormula(index)).toBe(expected);
    },
  );

  it("falls back to OTHERS without mutating the input", () => {
    const index = { code: "999", name: "INSUMO ESPECIAL" };
    expect(classifyUnifiedIndexForPolynomialFormula(index)).toBe("OTHERS");
    expect(index).toEqual({ code: "999", name: "INSUMO ESPECIAL" });
  });
});
