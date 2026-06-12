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
});
