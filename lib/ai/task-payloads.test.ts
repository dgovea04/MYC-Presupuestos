import { describe, expect, it } from "vitest";
import {
  buildAiTaskPayload,
  buildBridgeTaskPayload,
  buildKhipuTaskPayload,
  type AiTaskPayload,
} from "@/lib/ai/task-payloads";
import { aiExecuteRequestSchema } from "@/lib/ai/validation";

describe("AI task payloads", () => {
  it("builds a clean chat task payload with role, output, context, and input", () => {
    const payload = buildAiTaskPayload({
      action: "chat",
      payload: {
        message: "Revisa el rendimiento",
        context: {
          project: "Edificio Multifamiliar",
          module: "APU",
          selectedItem: "Concreto f'c=210",
          unit: "m3",
          currentCost: 420,
          activeTable: "Analisis de precios unitarios",
        },
        projectId: "project-1",
      },
    });

    expect(payload).toEqual({
      task: "technical_chat",
      role: "construction_cost_assistant_peru",
      output: {
        format: "text",
        schema: "technical_chat_v1",
      },
      context: {
        project: "Edificio Multifamiliar",
        module: "APU",
        selectedItem: "Concreto f'c=210",
        unit: "m3",
        currentCost: 420,
        activeTable: "Analisis de precios unitarios",
      },
      input: {
        message: "Revisa el rendimiento",
      },
      guardrails: {
        humanReviewRequired: true,
        noAutomaticBudgetMutation: true,
        noExactPriceFabrication: true,
      },
    } satisfies AiTaskPayload);
  });

  it("builds JSON-only task payloads for structured APU and review actions", () => {
    expect(
      buildAiTaskPayload({
        action: "apu",
        payload: {
          description: "Concreto armado f'c=210 kg/cm2",
          unit: "m3",
          context: { project: "Edificio Multifamiliar" },
        },
      }),
    ).toMatchObject({
      task: "generate_apu",
      output: {
        format: "json_only",
        schema: "apu_generation_v1",
      },
      input: {
        description: "Concreto armado f'c=210 kg/cm2",
        unit: "m3",
      },
    });

    expect(
      buildAiTaskPayload({
        action: "review",
        payload: {
          budgetSummary: "Partida 01.02 Concreto f'c=210 m3 S/ 420.",
          context: { project: "Edificio Multifamiliar" },
        },
      }),
    ).toMatchObject({
      task: "review_budget",
      output: {
        format: "json_only",
        schema: "budget_review_v1",
      },
      input: {
        budgetSummary: "Partida 01.02 Concreto f'c=210 m3 S/ 420.",
      },
    });
  });

  it("builds text task payloads for autocomplete actions", () => {
    expect(
      buildAiTaskPayload({
        action: "autocomplete",
        payload: {
          input: "Concreto armado",
          context: { module: "Partidas" },
        },
      }),
    ).toMatchObject({
      task: "autocomplete_construction_text",
      output: {
        format: "text",
        schema: "autocomplete_text_v1",
      },
      input: {
        input: "Concreto armado",
      },
    });
  });

  it("omits project id and empty context fields from bridge payloads", () => {
    const payload = buildBridgeTaskPayload({
      action: "apu",
      payload: {
        description: "Muro de ladrillo",
        unit: "m2",
        projectId: "project-1",
        context: {
          project: "Edificio Multifamiliar",
          module: "",
          selectedItem: undefined,
          unit: "m2",
        },
      },
    });

    expect(payload).toEqual({
      task: "generate_apu",
      role: "construction_cost_assistant_peru",
      output: {
        format: "json_only",
        schema: "apu_generation_v1",
      },
      context: {
        project: "Edificio Multifamiliar",
        unit: "m2",
      },
      input: {
        description: "Muro de ladrillo",
        unit: "m2",
      },
      guardrails: {
        humanReviewRequired: true,
        noAutomaticBudgetMutation: true,
        noExactPriceFabrication: true,
      },
    });

    expect(JSON.stringify(payload)).not.toContain("project-1");
  });

  it("throws a useful error when required input is missing", () => {
    expect(() =>
      buildAiTaskPayload({
        action: "chat",
        payload: { message: " " },
      }),
    ).toThrowError("Missing AI task input: message");
  });

  it("builds payloads from official Khipu task names without changing legacy callers", () => {
    expect(
      buildKhipuTaskPayload({
        task: "review_apu",
        payload: {
          description: "Concreto f'c=210",
          unit: "m3",
        },
      }),
    ).toMatchObject({
      task: "review_apu",
      output: {
        format: "json_only",
        schema: "apu_review_v1",
      },
      input: {
        description: "Concreto f'c=210",
        unit: "m3",
      },
    });

    expect(
      buildKhipuTaskPayload({
        task: "review_formula_polinomica",
        payload: {
          formulaSummary: "Monomio mano de obra coeficiente 0.312",
        },
      }),
    ).toMatchObject({
      task: "review_formula_polinomica",
      output: {
        format: "json_only",
        schema: "formula_polinomica_review_v1",
      },
      input: {
        formulaSummary: "Monomio mano de obra coeficiente 0.312",
      },
    });
  });

  it("validates canonical execute requests with auto provider by default", () => {
    expect(
      aiExecuteRequestSchema.parse({
        task: "review_budget",
        payload: {
          budgetSummary: "Presupuesto con partidas de concreto y acero",
        },
        projectId: "project-1",
      }),
    ).toEqual({
      provider: "auto",
      task: "review_budget",
      payload: {
        budgetSummary: "Presupuesto con partidas de concreto y acero",
      },
      projectId: "project-1",
    });

    expect(() =>
      aiExecuteRequestSchema.parse({
        provider: "anthropic",
        task: "review_budget",
        payload: {},
      }),
    ).toThrow();
  });
});
