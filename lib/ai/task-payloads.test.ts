import { describe, expect, it } from "vitest";
import {
  buildAiTaskPayload,
  buildBridgeTaskPayload,
  type AiTaskPayload,
} from "@/lib/ai/task-payloads";

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
        format: "json_only",
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
});
