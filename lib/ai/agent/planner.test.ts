import { describe, expect, it } from "vitest";
import type { PlannerInput } from "@/lib/ai/agent/contracts";
import type { AgentToolDefinition } from "@/lib/ai/agent/types";
import { createPlanner } from "@/lib/ai/agent/planner";

function makePlannerInput(overrides: Partial<PlannerInput> = {}): PlannerInput {
  return {
    goal: "Necesito buscar partidas de concreto y agregar una nueva",
    projectId: "project-1",
    userId: "user-1",
    mode: "chat",
    availableTools: [
      "searchPartidas",
      "suggestPartidas",
      "addPartida",
      "calculateBudget",
      "searchBudgets",
      "calculateAPU",
      "reviewAPU",
      "searchInsumos",
      "addInsumo",
      "createSchedule",
      "exportReport",
      "createChapter",
      "reviewTakeoff",
    ],
    ...overrides,
  };
}

describe("AgentPlanner", () => {
  const planner = createPlanner();

  it("genera pasos read antes que write para busqueda + creacion", async () => {
    const steps = await planner.plan(makePlannerInput({
      goal: "Busca partidas de concreto y agrega una nueva partida",
    }));

    expect(steps.length).toBeGreaterThanOrEqual(2);
    // searchPartidas (read) debe ir antes que addPartida (write)
    const searchIndex = steps.findIndex((s) => s.toolName === "searchPartidas");
    const addIndex = steps.findIndex((s) => s.toolName === "addPartida");
    expect(searchIndex).toBeGreaterThanOrEqual(0);
    expect(addIndex).toBeGreaterThanOrEqual(0);
    expect(searchIndex).toBeLessThan(addIndex);
  });

  it("retorna paso genérico cuando no hay herramientas que matcheen", async () => {
    const steps = await planner.plan(makePlannerInput({
      goal: "Cuéntame un chiste",
    }));

    expect(steps.length).toBe(1);
    expect(steps[0].toolName).toBeUndefined();
    expect(steps[0].approvalBoundary).toBe(false);
    expect(steps[0].dependsOn).toEqual([]);
  });

  it("marca approvalBoundary en write steps", async () => {
    const steps = await planner.plan(makePlannerInput({
      goal: "Agrega una nueva partida de concreto",
    }));

    const addStep = steps.find((s) => s.toolName === "addPartida");
    expect(addStep).toBeDefined();
    expect(addStep!.approvalBoundary).toBe(true);
  });

  it("no marca approvalBoundary en read steps", async () => {
    const steps = await planner.plan(makePlannerInput({
      goal: "Busca partidas de concreto",
    }));

    const searchStep = steps.find((s) => s.toolName === "searchPartidas");
    expect(searchStep).toBeDefined();
    expect(searchStep!.approvalBoundary).toBe(false);
  });

  it("empareja múltiples herramientas de diferentes dominios", async () => {
    const steps = await planner.plan(makePlannerInput({
      goal: "Busca insumos de concreto, calcula el APU y genera el cronograma",
    }));

    const toolNames = steps.map((s) => s.toolName).filter(Boolean);
    expect(toolNames).toContain("searchInsumos");
    expect(toolNames).toContain("calculateAPU");
    expect(toolNames).toContain("createSchedule");
  });

  it("filtra herramientas no disponibles en el registry", async () => {
    const steps = await planner.plan(makePlannerInput({
      goal: "Busca partidas y agrega una nueva",
      availableTools: ["searchPartidas"], // addPartida no disponible
    }));

    const toolNames = steps.map((s) => s.toolName).filter(Boolean);
    expect(toolNames).toContain("searchPartidas");
    expect(toolNames).not.toContain("addPartida");
  });

  it("marca approvalBoundary en el último paso en modo goal", async () => {
    const steps = await planner.plan(makePlannerInput({
      goal: "Busca partidas de concreto y calcula el presupuesto",
      mode: "goal",
    }));

    expect(steps.length).toBeGreaterThan(0);
    expect(steps[steps.length - 1].approvalBoundary).toBe(true);
  });

  it("no fuerza approvalBoundary en modo chat", async () => {
    const steps = await planner.plan(makePlannerInput({
      goal: "Busca partidas de concreto y calcula el presupuesto",
      mode: "chat",
    }));

    // En modo chat, solo los write steps tienen approvalBoundary
    const hasBoundary = steps.some((s) => s.approvalBoundary && !["addPartida", "createSchedule", "exportReport", "createChapter", "addInsumo"].includes(s.toolName ?? ""));
    expect(hasBoundary).toBe(false);
  });

  it("genera IDs únicos para cada paso", async () => {
    const steps = await planner.plan(makePlannerInput({
      goal: "Busca partidas y agrega una nueva",
    }));

    const ids = steps.map((s) => s.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(steps.length);
  });

  it("write steps dependen del último read step cuando hay reads", async () => {
    const steps = await planner.plan(makePlannerInput({
      goal: "Busca partidas de concreto y agrega una nueva",
    }));

    const addStep = steps.find((s) => s.toolName === "addPartida");
    const searchStep = steps.find((s) => s.toolName === "searchPartidas");

    expect(addStep).toBeDefined();
    expect(addStep!.dependsOn).toContain(searchStep!.id);
  });
});
