import { describe, expect, it } from "vitest";
import { buildSkillProviderRequest, resolveKhipuSkill } from "@/lib/ai/skills/registry";

const assembledContext = {
  projectContext: "Proyecto: Hospital Norte",
  projectHistory: [],
  projectMemory: [],
  retrievalEvidence: [],
  userRequest: {
    task: "suggest_insumos" as const,
    payload: {
      description: "Concreto f'c=210",
    },
  },
};

describe("Khipu skill registry", () => {
  it("maps every official task to an explicit skill", () => {
    expect(resolveKhipuSkill("review_apu").id).toBe("skill-apu");
    expect(resolveKhipuSkill("generate_apu").id).toBe("skill-apu");
    expect(resolveKhipuSkill("review_budget").id).toBe("skill-budget");
    expect(resolveKhipuSkill("review_quantity_takeoff").id).toBe("skill-metrados");
    expect(resolveKhipuSkill("review_formula_polinomica").id).toBe("skill-formula-polinomica");
    expect(resolveKhipuSkill("montecarlo_risk_analysis").id).toBe("skill-risk");
    expect(resolveKhipuSkill("suggest_insumos").id).toBe("skill-catalog");
    expect(resolveKhipuSkill("generate_partida").id).toBe("skill-catalog");
    expect(resolveKhipuSkill("chat").id).toBe("skill-chat");
    expect(resolveKhipuSkill("autocomplete").id).toBe("skill-autocomplete");
  });

  it("builds provider requests with skill metadata and context", () => {
    const request = buildSkillProviderRequest({
      task: "suggest_insumos",
      payload: {
        description: "Concreto f'c=210",
      },
      assembledContext,
      userId: "user-1",
    });

    const content = request.messages.map((message) => message.content).join("\n");
    expect(request.schemaName).toBe("catalog_insumo_suggestions_v1");
    expect(content).toContain("skill-catalog");
    expect(content).toContain("Usa recursos existentes del catalogo antes de sugerir nuevos insumos.");
    expect(content).toContain("Contexto del proyecto");
    expect(content).toContain('"task": "suggest_insumos"');
  });

  it("builds provider request for generate_apu with APU output shape and skill instruction", () => {
    const request = buildSkillProviderRequest({
      task: "generate_apu",
      payload: {
        description: "Concreto armado f'c=210 kg/cm2",
        unit: "m3",
      },
      assembledContext,
      userId: "user-1",
    });

    const content = request.messages.map((message) => message.content).join("\n");
    expect(request.schemaName).toBe("apu_generation_v1");
    expect(content).toContain("skill-apu");
    expect(content).toContain("Genera o revisa APU con supuestos explicitos");
    expect(content).toContain("Contexto del proyecto");
    // The APU output shape is included as a JSON block with APU fields
    expect(content).toContain("materials");
    expect(content).toContain("labor");
    expect(content).toContain("equipment");
    expect(content).toContain("observations");
    expect(content).toContain("assumptions");
    expect(content).toContain('"task": "generate_apu"');
    expect(content).toContain("m3");
  });

  it("builds provider request for review_apu with review output shape", () => {
    const request = buildSkillProviderRequest({
      task: "review_apu",
      payload: {
        description: "Concreto armado f'c=210 kg/cm2",
        unit: "m3",
      },
      assembledContext,
      userId: "user-1",
    });

    const content = request.messages.map((message) => message.content).join("\n");
    expect(request.schemaName).toBe("apu_generation_v1");
    expect(content).toContain("skill-apu");
    expect(content).toContain("Genera o revisa APU con supuestos explicitos");
    expect(content).toContain("Contexto del proyecto");
    // review_apu should use REVIEW_OUTPUT_JSON_SHAPE (findings, not APU items)
    expect(content).toContain("findings");
    expect(content).toContain("severity");
    expect(content).toContain("recommendedAction");
    expect(content).toContain('"task": "review_apu"');
  });

  it("builds provider request for review_budget with review output shape and skill instruction", () => {
    const request = buildSkillProviderRequest({
      task: "review_budget",
      payload: {
        budgetSummary: "Estructuras: 5 partidas, S/ 125,000.00 total",
      },
      assembledContext,
      userId: "user-1",
    });

    const content = request.messages.map((message) => message.content).join("\n");
    expect(request.schemaName).toBe("budget_review_v1");
    expect(content).toContain("skill-budget");
    expect(content).toContain("Revisa consistencia de presupuesto, duplicados, unidades, costos y cantidades");
    expect(content).toContain("Contexto del proyecto");
    // review_budget uses REVIEW_OUTPUT_JSON_SHAPE (findings/severity/recommendedAction)
    expect(content).toContain("findings");
    expect(content).toContain("severity");
    expect(content).toContain("recommendedAction");
    expect(content).toContain('"task": "review_budget"');
    expect(content).toContain("Estructuras");
    expect(content).toContain("125,000.00");
  });

  it("builds provider request for review_quantity_takeoff with review output shape and skill instruction", () => {
    const request = buildSkillProviderRequest({
      task: "review_quantity_takeoff",
      payload: {
        quantityTakeoffSummary: "Concreto: 120 m3, Acero: 8,500 kg, Encofrado: 850 m2",
      },
      assembledContext,
      userId: "user-1",
    });

    const content = request.messages.map((message) => message.content).join("\n");
    expect(request.schemaName).toBe("quantity_takeoff_review_v1");
    expect(content).toContain("skill-metrados");
    expect(content).toContain("Verifica metrados, unidades, formulas y trazabilidad con partidas del presupuesto");
    expect(content).toContain("Contexto del proyecto");
    // Uses REVIEW_OUTPUT_JSON_SHAPE (findings/severity/recommendedAction)
    expect(content).toContain("findings");
    expect(content).toContain("severity");
    expect(content).toContain("recommendedAction");
    expect(content).toContain('"task": "review_quantity_takeoff"');
    expect(content).toContain("Concreto");
    expect(content).toContain("8,500 kg");
    expect(content).toContain("850 m2");
  });

  it("builds provider request for review_formula_polinomica with review output shape and skill instruction", () => {
    const request = buildSkillProviderRequest({
      task: "review_formula_polinomica",
      payload: {
        formulaSummary: "Formula Polinomica: K=0.352(Mo/100.00)+0.248(Ma/120.50)+0.125(Ag/98.30)+0.275(Eq/105.00)",
      },
      assembledContext,
      userId: "user-1",
    });

    const content = request.messages.map((message) => message.content).join("\n");
    expect(request.schemaName).toBe("formula_polinomica_review_v1");
    expect(content).toContain("skill-formula-polinomica");
    expect(content).toContain("Valida coeficientes con 3 decimales, monomios, indices unificados y supuestos normativos peruanos");
    expect(content).toContain("Contexto del proyecto");
    // Uses REVIEW_OUTPUT_JSON_SHAPE (findings/severity/recommendedAction)
    expect(content).toContain("findings");
    expect(content).toContain("severity");
    expect(content).toContain("recommendedAction");
    expect(content).toContain('"task": "review_formula_polinomica"');
    expect(content).toContain("Formula Polinomica");
    expect(content).toContain("0.352");
    expect(content).toContain("100.00");
  });

  it("builds provider request for montecarlo_risk_analysis with review output shape and skill instruction", () => {
    const request = buildSkillProviderRequest({
      task: "montecarlo_risk_analysis",
      payload: {
        riskSummary: "Costo base: S/ 850,000.00, 12 variables con distribucion triangular",
      },
      assembledContext,
      userId: "user-1",
    });

    const content = request.messages.map((message) => message.content).join("\n");
    expect(request.schemaName).toBe("montecarlo_risk_analysis_v1");
    expect(content).toContain("skill-risk");
    expect(content).toContain("En V2 entrega analisis asesor y datos faltantes; no inventes P50, P80, P90 ni histogramas sin simulacion backend");
    expect(content).toContain("Contexto del proyecto");
    // Uses REVIEW_OUTPUT_JSON_SHAPE (findings/severity/recommendedAction)
    expect(content).toContain("findings");
    expect(content).toContain("severity");
    expect(content).toContain("recommendedAction");
    expect(content).toContain('"task": "montecarlo_risk_analysis"');
    expect(content).toContain("850,000.00");
    expect(content).toContain("triangular");
  });

  it("builds provider request for generate_partida with catalog skill instruction and no output shape", () => {
    const request = buildSkillProviderRequest({
      task: "generate_partida",
      payload: {
        description: "Viga de concreto armado f'c=210 kg/cm2",
        unit: "m3",
      },
      assembledContext,
      userId: "user-1",
    });

    const content = request.messages.map((message) => message.content).join("\n");
    expect(request.schemaName).toBe("catalog_insumo_suggestions_v1");
    expect(content).toContain("skill-catalog");
    expect(content).toContain("Usa recursos existentes del catalogo antes de sugerir nuevos insumos");
    expect(content).toContain("Contexto del proyecto");
    // generate_partida has no dedicated output shape block (schema not in getOutputShapeBlock switch)
    expect(content).not.toContain("OUTPUT JSON SHAPE");
    expect(content).toContain('"task": "generate_partida"');
    expect(content).toContain("Viga de concreto armado");
    expect(content).toContain("m3");
  });

  it("builds provider request for chat with technical_chat schema", () => {
    const request = buildSkillProviderRequest({
      task: "chat",
      payload: {
        message: "Revisa el presupuesto completo",
      },
      assembledContext,
      userId: "user-1",
    });

    const content = request.messages.map((message) => message.content).join("\n");
    expect(request.schemaName).toBe("technical_chat_v1");
    // chat task has no output shape block (schema name not in getOutputShapeBlock switch)
    expect(content).toContain("skill-chat");
    expect(content).toContain("Responde como copiloto tecnico de costos");
    expect(content).toContain("Contexto del proyecto");
    expect(content).toContain('"task": "chat"');
    expect(content).not.toContain("OUTPUT JSON SHAPE");
  });
});
