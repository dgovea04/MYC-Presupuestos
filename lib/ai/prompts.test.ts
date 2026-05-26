import { describe, expect, it } from "vitest";
import { buildApuPrompt, buildAutocompletePrompt, buildCatalogApuPrompt, buildChatMessages, buildReviewPrompt } from "@/lib/ai/prompts";

describe("AI prompts", () => {
  it("adds the MYC construction system prompt and contextual budget data to chat messages", () => {
    const messages = buildChatMessages({
      message: "Revisa el rendimiento",
      context: {
        project: "Edificio Multifamiliar",
        module: "APU",
        selectedItem: "Concreto f'c=210",
        unit: "m3",
        currentCost: 420,
      },
    });

    expect(messages[0]).toMatchObject({ role: "system" });
    expect(messages[0]?.content).toContain("presupuestos de construccion");
    expect(messages[1]?.content).toContain("Proyecto: Edificio Multifamiliar");
    expect(messages[1]?.content).toContain("Costo actual: 420");
    expect(messages[2]).toEqual({ role: "user", content: "Revisa el rendimiento" });
  });

  it("builds specialized prompts without allowing automatic budget mutation", () => {
    expect(buildApuPrompt("Concreto armado f'c=210", "m3")).toContain("Genera un analisis de precios unitarios");
    expect(buildReviewPrompt("Partida duplicada de acero")).toContain("No modifiques datos automaticamente");
    expect(buildAutocompletePrompt("Excavacion manual en")).toContain("Devuelve solo el texto completado");
  });

  it("includes an exact valid catalog APU JSON example with a real matching resource", () => {
    const prompt = buildCatalogApuPrompt({
      query: "ACERO DE REFUERZO F´Y = 4200 KG/CM2",
      unit: "KG",
      similarPartidas: [{ id: "par-acero" }],
      matchingResources: [
        {
          id: "res-acero",
          name: "ACERO CORRUGADO F'Y 4,200 KG/CM2",
          unit: "KG",
          category: "MATERIAL",
        },
      ],
    });

    expect(prompt).toContain("Ejemplo de salida valida");
    expect(prompt).toContain('"partida_name": "ACERO DE REFUERZO F´Y = 4200 KG/CM2"');
    expect(prompt).toContain('"based_on_partida_id": "par-acero"');
    expect(prompt).toContain('"resource_id": "res-acero"');
    expect(prompt).toContain('"type": "MATERIAL"');
    expect(prompt).toContain('"source": "catalog"');
    expect(prompt).toContain('"requires_human_review": true');
    expect(prompt).not.toContain("matchingResources[0].id");
    expect(prompt).not.toContain("Ejemplo de Material");
  });
});
