import { describe, expect, it } from "vitest";
import { extractPartidaVariables } from "@/lib/partida-generation/variables";

describe("extractPartidaVariables", () => {
  it("detects material, resistance, element, category, unit, and keywords from a concrete partida", () => {
    const variables = extractPartidaVariables("Concreto armado f'c=210 kg/cm2 para columnas", "m3");

    expect(variables.material).toBe("concreto armado");
    expect(variables.resistance).toBe("210");
    expect(variables.element).toBe("columnas");
    expect(variables.category).toBe("concreto");
    expect(variables.unit).toBe("m3");
    expect(variables.technicalSpecs).toContain("fc210");
    expect(variables.keywords).toEqual(expect.arrayContaining(["concreto", "armado", "columnas"]));
  });

  it("normalizes accents, plurals, and common construction synonyms deterministically", () => {
    const variables = extractPartidaVariables("Tarrajeo en muros interiores, mezcla 1:5", "m2");

    expect(variables.material).toBe("mortero");
    expect(variables.element).toBe("muros");
    expect(variables.category).toBe("acabados");
    expect(variables.technicalSpecs).toContain("mezcla1:5");
  });
});
