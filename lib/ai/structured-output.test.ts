import { describe, expect, it } from "vitest";
import {
  aiApuCatalogProposalSchema,
  aiApuStructuredSchema,
  parseAutocompleteStructuredData,
  aiReviewStructuredSchema,
  extractJsonObjectFromText,
  parseStructuredAiOutput,
} from "@/lib/ai/structured-output";

describe("AI structured output", () => {
  it("normalizes a raw autocomplete JSON response for presentation", () => {
    const parsed = parseAutocompleteStructuredData(
      JSON.stringify({
        answer: "Excavacion manual en",
        input: "Excavacion manual en",
        suggestion: {
          id: "",
          code: "",
          description: "Excavacion manual en terreno normal",
          unit: "m3",
          category: "Movimiento de tierras",
          apuId: "",
          apuDescription: "",
          matchType: "new",
          missingFields: ["tipo de terreno"],
        },
        alternatives: [{ description: "Excavacion manual en zanja", unit: "m3", category: "Movimiento de tierras" }],
        assumptions: ["Se asume terreno normal"],
        requiresHumanReview: true,
      }),
    );

    expect(parsed?.suggestion).toEqual(
      expect.objectContaining({
        description: "Excavacion manual en terreno normal",
        unit: "m3",
        matchType: "new",
      }),
    );
    expect(parsed?.suggestion).not.toHaveProperty("id");
    expect(parsed?.alternatives[0]).toEqual(
      expect.objectContaining({
        description: "Excavacion manual en zanja",
        matchType: "new",
        missingFields: [],
      }),
    );
  });

  it("extracts a JSON object embedded inside a model response", () => {
    expect(extractJsonObjectFromText("Analisis:\n{\"answer\":\"OK\",\"unit\":\"m3\"}\nFin")).toBe(
      "{\"answer\":\"OK\",\"unit\":\"m3\"}",
    );
  });

  it("parses a valid APU payload into structured data", () => {
    const parsed = parseStructuredAiOutput({
      answer:
        "{\"answer\":\"APU propuesto\",\"unit\":\"m3\",\"performance\":\"12 m3/dia\",\"crew\":\"1 capataz + 4 operarios\",\"materials\":[{\"description\":\"Cemento\",\"unit\":\"bolsa\",\"quantity\":\"8\",\"notes\":\"Tipo I\"}],\"labor\":[{\"description\":\"Operario\",\"unit\":\"hh\",\"quantity\":\"16\"}],\"equipment\":[{\"description\":\"Mezcladora\",\"unit\":\"hm\",\"quantity\":\"1.5\"}],\"observations\":[\"Validar dosificacion\"],\"assumptions\":[\"Precio referencial en Lima\"]}",
      schema: aiApuStructuredSchema,
    });

    expect(parsed.answer).toBe("APU propuesto");
    expect(parsed.data.unit).toBe("m3");
    expect(parsed.data.materials).toHaveLength(1);
    expect(parsed.data.labor).toHaveLength(1);
    expect(parsed.data.equipment).toHaveLength(1);
  });

  it("parses review findings with severity and recommended action", () => {
    const parsed = parseStructuredAiOutput({
      answer:
        "{\"answer\":\"Revision completada\",\"findings\":[{\"severity\":\"high\",\"type\":\"duplicate\",\"description\":\"Partida duplicada de concreto\",\"impact\":\"Puede duplicar el costo directo\",\"recommendedAction\":\"Consolidar o eliminar una de las dos partidas\"}],\"assumptions\":[\"Revision preliminar\"]}",
      schema: aiReviewStructuredSchema,
    });

    expect(parsed.answer).toBe("Revision completada");
    expect(parsed.data.findings[0]).toMatchObject({
      severity: "high",
      type: "duplicate",
    });
  });

  it("parses catalog APU proposals that do not include a generic answer field", () => {
    const parsed = parseStructuredAiOutput({
      answer:
        "{\"partida_name\":\"Concreto f c 210 en columnas\",\"unit\":\"m3\",\"confidence\":0.82,\"items\":[],\"suggested_new_resources\":[],\"warnings\":[],\"requires_human_review\":true}",
      schema: aiApuCatalogProposalSchema,
    });

    expect(parsed.answer).toContain("Concreto f c 210");
    expect(parsed.data.partida_name).toBe("Concreto f c 210 en columnas");
  });

  it("fails fast when the model does not return valid JSON", () => {
    expect(() =>
      parseStructuredAiOutput({
        answer: "No encontre un formato JSON valido",
        schema: aiReviewStructuredSchema,
      }),
    ).toThrowError("La IA no devolvio un JSON estructurado valido.");
  });
});
