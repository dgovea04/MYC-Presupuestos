import { describe, expect, it } from "vitest";
import {
  buildApuPrompt,
  buildAutocompletePrompt,
  buildCatalogApuPrompt,
  buildChatMessages,
  buildPromptFromTaskPayload,
  buildReviewPrompt,
  buildTaskPayloadSystemPrompt,
} from "@/lib/ai/prompts";

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

  it("adds retrieval evidence to review prompts without changing the structured payload", () => {
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
    expect(prompt).toContain('"task": "review_budget"');
    expect(prompt).toContain('"schema": "budget_review_v1"');
    expect(prompt).toContain('"budgetSummary": "Partida duplicada de acero"');
    expect(prompt).toContain('"noAutomaticBudgetMutation": true');
    expect(prompt).toContain("OUTPUT JSON SHAPE:");
    expect(prompt).toContain('"findings"');
    expect(prompt).toContain('"recommendedAction"');
    expect(prompt).toContain("low|medium|high");
    expect(prompt).toContain("duplicate|unit|cost|quantity|consistency|other");
    expect(prompt).not.toContain("instrucciones");
    expect(prompt).not.toContain("formatoSalida");

    expect(buildReviewPrompt("Partida duplicada de acero")).not.toContain("Fuentes consultadas:");
  });

  it("keeps stable task rules in the system prompt instead of the task payload", () => {
    const systemPrompt = buildTaskPayloadSystemPrompt({ jsonOnly: true });

    expect(systemPrompt).toContain("Eres un asistente tecnico experto");
    expect(systemPrompt).toContain("Responde unicamente con JSON valido");
    expect(systemPrompt).toContain("No modifiques presupuestos automaticamente");
    expect(systemPrompt).toContain("Toda recomendacion debe quedar para revision humana");
  });

  it("renders a clean INPUT JSON payload from an AI task payload", () => {
    const prompt = buildPromptFromTaskPayload({
      task: "generate_apu",
      role: "construction_cost_assistant_peru",
      output: {
        format: "json_only",
        schema: "apu_generation_v1",
      },
      context: {
        project: "Edificio Multifamiliar",
        selectedItem: "Concreto f'c=210",
        unit: "m3",
        currentCost: 420,
      },
      input: {
        description: "Concreto armado f'c=210",
        unit: "m3",
      },
      guardrails: {
        humanReviewRequired: true,
        noAutomaticBudgetMutation: true,
        noExactPriceFabrication: true,
      },
    });

    expect(prompt).toContain("INPUT JSON:");
    expect(prompt).toContain('"task": "generate_apu"');
    expect(prompt).toContain('"schema": "apu_generation_v1"');
    expect(prompt).toContain('"description": "Concreto armado f\'c=210"');
    expect(prompt).not.toContain("instrucciones");
    expect(prompt).not.toContain("formatoSalida");
  });

  it("builds structured APU prompts from a clean task payload while preserving schema instructions", () => {
    const prompt = buildApuPrompt("Concreto armado f'c=210", "m3");

    expect(prompt).toContain("INPUT JSON:");
    expect(prompt).toContain('"task": "generate_apu"');
    expect(prompt).toContain('"schema": "apu_generation_v1"');
    expect(prompt).toContain('"description": "Concreto armado f\'c=210"');
    expect(prompt).toContain('"unit": "m3"');
    expect(prompt).toContain('"humanReviewRequired": true');
    expect(prompt).toContain("OUTPUT JSON SHAPE:");
    expect(prompt).toContain('"materials"');
    expect(prompt).toContain('"labor"');
    expect(prompt).toContain('"equipment"');
    expect(prompt).toContain('"observations"');
    expect(prompt).toContain('"assumptions"');
    expect(prompt).not.toContain("Devuelve solo un objeto JSON valido sin markdown ni texto adicional.");
    expect(prompt).not.toContain("instrucciones");
    expect(prompt).not.toContain("formatoSalida");
  });

  it("builds specialized prompts without allowing automatic budget mutation", () => {
    expect(buildApuPrompt("Concreto armado f'c=210", "m3")).toContain('"noAutomaticBudgetMutation": true');
    expect(buildReviewPrompt("Partida duplicada de acero")).toContain('"noAutomaticBudgetMutation": true');
    expect(buildAutocompletePrompt("Excavacion manual en")).toContain('"task": "autocomplete_construction_text"');
    expect(buildAutocompletePrompt("Excavacion manual en")).toContain("Devuelve solo el texto completado, sin explicaciones ni formato adicional.");
    expect(buildAutocompletePrompt("Excavacion manual en")).not.toContain("instrucciones");
    expect(buildAutocompletePrompt("Excavacion manual en")).not.toContain("formatoSalida");
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
