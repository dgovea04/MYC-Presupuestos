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

  it("adds retrieval evidence to chat messages only when provided", () => {
    const messages = buildChatMessages({
      message: "Revisa el rendimiento",
      evidence: [
        {
          id: "technical:formula-polinomica-monomios",
          sourceType: "technical_doc",
          title: "Formula polinomica Peru - reglas de monomios",
          excerpt: "Referencia interna: evitar monomios con incidencia menor a 0.05 salvo criterio tecnico sustentado.",
          score: 0.684,
          metadata: {
            sourcePath: "prd/formula-polinomica-peru-webapp-spec.md",
            referenceType: "internal_technical_reference",
          },
        },
      ],
    });

    expect(messages[1]).toMatchObject({ role: "system" });
    expect(messages[1]?.content).toContain("Fuentes consultadas:");
    expect(messages[1]?.content).toContain("[technical_doc] Formula polinomica Peru - reglas de monomios");
    expect(messages.at(-1)).toEqual({ role: "user", content: "Revisa el rendimiento" });

    const messagesWithoutEvidence = buildChatMessages({ message: "Revisa el rendimiento" });
    expect(messagesWithoutEvidence.map((message) => message.content).join("\n")).not.toContain("Fuentes consultadas:");
  });

  it("adds retrieval evidence to review prompts without changing the structured JSON instruction", () => {
    const prompt = buildReviewPrompt("Partida duplicada de acero", {
      evidence: [
        {
          id: "partida:par-acero",
          sourceType: "catalog_partida",
          title: "Acero de refuerzo fy=4200 kg/cm2",
          excerpt: "Unidad: kg. Fuente: catalogo-propio. APU: Operario, Acero corrugado.",
          score: 0.912,
          metadata: {
            partidaId: "par-acero",
            unit: "kg",
            source: "catalogo-propio",
          },
        },
      ],
    });

    expect(prompt).toContain("Fuentes consultadas:");
    expect(prompt).toContain("[catalog_partida] Acero de refuerzo fy=4200 kg/cm2");
    expect(prompt).toContain('{"answer":"resumen corto"');
    expect(prompt).toContain("No modifiques datos automaticamente");

    expect(buildReviewPrompt("Partida duplicada de acero")).not.toContain("Fuentes consultadas:");
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
