import { describe, expect, it } from "vitest";
import type { AgentOrchestratorOutput, PlannedStep } from "./types";
import { ResponseBuilder, createResponseBuilder } from "./response-builder";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeStep(overrides: Partial<PlannedStep> = {}): PlannedStep {
  return {
    id: overrides.id ?? "step-1",
    title: overrides.title ?? "Buscar partidas",
    toolName: overrides.toolName ?? "searchPartidas",
    objective: overrides.objective ?? "Buscar partidas de concreto",
    expectedOutcome: overrides.expectedOutcome ?? "Lista de partidas coincidentes",
    dependsOn: overrides.dependsOn ?? [],
    approvalBoundary: overrides.approvalBoundary ?? false,
  };
}

function makeOutput(overrides: Partial<AgentOrchestratorOutput> = {}): AgentOrchestratorOutput {
  return {
    executionId: overrides.executionId ?? "exec-1",
    state: overrides.state ?? "EXECUTED",
    mode: overrides.mode ?? "chat",
    summary: overrides.summary ?? "",
    plan: overrides.plan ?? [],
    completedSteps: overrides.completedSteps ?? [],
    failedSteps: overrides.failedSteps ?? [],
    pendingApproval: overrides.pendingApproval,
    toolActivity: overrides.toolActivity ?? [],
    warnings: overrides.warnings ?? [],
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("ResponseBuilder", () => {
  describe("factory", () => {
    it("createResponseBuilder devuelve una instancia", () => {
      const builder = createResponseBuilder();
      expect(builder).toBeInstanceOf(ResponseBuilder);
    });
  });

  describe("build", () => {
    it("preserva la estructura completa del output", () => {
      const builder = new ResponseBuilder();
      const steps = [makeStep()];
      const output = makeOutput({
        executionId: "exec-1",
        state: "EXECUTED",
        mode: "goal",
        plan: steps,
        completedSteps: steps,
        toolActivity: [
          { toolName: "searchPartidas", success: true, latencyMs: 120, summary: "3 resultados" },
        ],
      });

      const result = builder.build(output);

      expect(result.executionId).toBe("exec-1");
      expect(result.state).toBe("EXECUTED");
      expect(result.mode).toBe("goal");
      expect(result.plan).toHaveLength(1);
      expect(result.completedSteps).toHaveLength(1);
      expect(result.toolActivity).toHaveLength(1);
      expect(result.warnings).toBeDefined();
    });
  });

  // ─── Summary por estado ───────────────────────────────────────────────────

  describe("summary por estado", () => {
    const states: Array<{
      state: AgentOrchestratorOutput["state"];
      expectedFragment: string;
      overrides?: Partial<AgentOrchestratorOutput>;
    }> = [
      { state: "READ", expectedFragment: "Analizando objetivo" },
      { state: "PLAN", expectedFragment: "Plan generado", overrides: { plan: [makeStep()] } },
      { state: "PROPOSE", expectedFragment: "Plan propuesto", overrides: { plan: [makeStep()] } },
      { state: "SIMULATE", expectedFragment: "Simulando", overrides: { plan: [makeStep()] } },
      { state: "PENDING_APPROVAL", expectedFragment: "pausada", overrides: { pendingApproval: { approvalId: "a-1", toolName: "createBudget", reason: "Test" } } },
      { state: "EXECUTING", expectedFragment: "Ejecutando" },
      { state: "EXECUTED", expectedFragment: "completada", overrides: { completedSteps: [makeStep()] } },
      { state: "FAILED", expectedFragment: "fallida", overrides: { failedSteps: [makeStep()] } },
      { state: "ROLLED_BACK", expectedFragment: "revertida" },
    ];

    for (const { state, expectedFragment, overrides } of states) {
      it(`${state} genera summary con "${expectedFragment}"`, () => {
        const builder = new ResponseBuilder();
        const output = makeOutput({ state, ...overrides });
        const result = builder.build(output);
        expect(result.summary).toContain(expectedFragment);
      });
    }

    it("preserva summary custom cuando no es genérico", () => {
      const builder = new ResponseBuilder();
      const output = makeOutput({
        state: "EXECUTED",
        summary: "Se completo el análisis de presupuesto correctamente.",
      });

      const result = builder.build(output);
      expect(result.summary).toBe("Se completo el análisis de presupuesto correctamente.");
    });

    it("PENDING_APPROVAL sin pendingApproval genera summary genérico", () => {
      const builder = new ResponseBuilder();
      const output = makeOutput({ state: "PENDING_APPROVAL" });
      const result = builder.build(output);
      expect(result.summary).toContain("esperando decisión");
    });

    it("PENDING_APPROVAL con pendingApproval muestra toolName", () => {
      const builder = new ResponseBuilder();
      const output = makeOutput({
        state: "PENDING_APPROVAL",
        pendingApproval: { approvalId: "a-1", toolName: "deleteChapter", reason: "Eliminar capítulo" },
      });
      const result = builder.build(output);
      expect(result.summary).toContain("deleteChapter");
    });

    it("EXECUTING con herramientas en progreso muestra conteo", () => {
      const builder = new ResponseBuilder();
      const output = makeOutput({
        state: "EXECUTING",
        toolActivity: [
          { toolName: "searchPartidas", success: false, summary: "En progreso..." },
        ],
      });
      const result = builder.build(output);
      expect(result.summary).toContain("Ejecutando");
    });

    it("EXECUTED con completed y failed muestra ambos", () => {
      const builder = new ResponseBuilder();
      const output = makeOutput({
        state: "EXECUTED",
        completedSteps: [makeStep({ id: "s1" })],
        failedSteps: [makeStep({ id: "s2" })],
      });
      const result = builder.build(output);
      expect(result.summary).toContain("1 paso completado");
      expect(result.summary).toContain("1 paso fallido");
    });

    it("EXECUTED sin pasos ejecutados muestra mensaje adecuado", () => {
      const builder = new ResponseBuilder();
      const output = makeOutput({ state: "EXECUTED" });
      const result = builder.build(output);
      expect(result.summary).toContain("sin pasos ejecutados");
    });

    it("FAILED con failedSteps y summary personalizado preserva summary", () => {
      const builder = new ResponseBuilder();
      const output = makeOutput({ state: "FAILED", failedSteps: [makeStep()] });
      const result = builder.build(output);
      expect(result.summary).toContain("fallida");
      expect(result.summary).toContain("1 paso fallido");
    });

    it("FAILED sin failedSteps muestra error genérico", () => {
      const builder = new ResponseBuilder();
      const output = makeOutput({ state: "FAILED", failedSteps: [], summary: "" });
      const result = builder.build(output);
      expect(result.summary).toContain("error en el plan");
    });

    it("ROLLED_BACK muestra conteo de pasos revertidos cuando hay failedSteps", () => {
      const builder = new ResponseBuilder();
      const output = makeOutput({ state: "ROLLED_BACK", failedSteps: [makeStep()] });
      const result = builder.build(output);
      expect(result.summary).toContain("1 paso revertido");
    });
  });

  // ─── Pending Approval enrichment ──────────────────────────────────────────

  describe("pendingApproval enrichment", () => {
    it("agrega impactSummary cuando hay stepId y step existe en plan", () => {
      const builder = new ResponseBuilder();
      const step = makeStep({ id: "step-create", title: "Crear presupuesto", objective: "Crear presupuesto para hospital" });
      const output = makeOutput({
        state: "PENDING_APPROVAL",
        plan: [step],
        pendingApproval: {
          approvalId: "a-1",
          stepId: "step-create",
          toolName: "createBudget",
          reason: "Creación de nuevo presupuesto",
        },
      });

      const result = builder.build(output);

      expect(result.pendingApproval).toBeDefined();
      expect(result.pendingApproval!.impactSummary).toBeDefined();
      expect(result.pendingApproval!.impactSummary).toContain("Crear presupuesto");
      expect(result.pendingApproval!.impactSummary).toContain("Crear presupuesto para hospital");
    });

    it("agrega impactSummary por toolName cuando no hay stepId", () => {
      const builder = new ResponseBuilder();
      const step = makeStep({ id: "step-x", title: "Buscar y agregar", toolName: "addPartida" });
      const output = makeOutput({
        state: "PENDING_APPROVAL",
        plan: [step],
        pendingApproval: {
          approvalId: "a-2",
          toolName: "addPartida",
          reason: "Agregar nueva partida al catálogo",
        },
      });

      const result = builder.build(output);

      expect(result.pendingApproval).toBeDefined();
      expect(result.pendingApproval!.impactSummary).toBeDefined();
      expect(result.pendingApproval!.impactSummary).toContain("Buscar y agregar");
    });

    it("preserva impactSummary existente", () => {
      const builder = new ResponseBuilder();
      const output = makeOutput({
        state: "PENDING_APPROVAL",
        pendingApproval: {
          approvalId: "a-3",
          toolName: "archiveBudget",
          reason: "Archivar presupuesto",
          impactSummary: "Presupuesto 'Hospital 4 pisos' será archivado",
        },
      });

      const result = builder.build(output);

      expect(result.pendingApproval!.impactSummary).toBe("Presupuesto 'Hospital 4 pisos' será archivado");
    });

    it("retorna undefined cuando no hay pendingApproval", () => {
      const builder = new ResponseBuilder();
      const output = makeOutput({ state: "EXECUTED" });
      const result = builder.build(output);
      expect(result.pendingApproval).toBeUndefined();
    });

    it("incluye dependencias en impactSummary cuando el paso tiene dependsOn", () => {
      const builder = new ResponseBuilder();
      const step = makeStep({
        id: "step-dep",
        title: "Agregar partida",
        dependsOn: ["step-0"],
        objective: "Agregar partida encontrada",
      });
      const output = makeOutput({
        state: "PENDING_APPROVAL",
        plan: [step],
        pendingApproval: {
          approvalId: "a-4",
          stepId: "step-dep",
          toolName: "addPartida",
          reason: "Requiere aprobación",
        },
      });

      const result = builder.build(output);
      expect(result.pendingApproval!.impactSummary).toContain("1 paso previo");
    });
  });

  // ─── Warnings enrichment ──────────────────────────────────────────────────

  describe("warnings enrichment", () => {
    it("preserva warnings originales", () => {
      const builder = new ResponseBuilder();
      const output = makeOutput({
        state: "EXECUTED",
        warnings: ["Advertencia original"],
        completedSteps: [makeStep()],
      });

      const result = builder.build(output);

      expect(result.warnings).toContain("Advertencia original");
    });

    it("agrega warning de dependencias no resueltas solo cuando corresponde", () => {
      const builder = new ResponseBuilder();
      const output = makeOutput({
        state: "EXECUTED",
        plan: [makeStep({ id: "s1", dependsOn: ["s0"] })],
        failedSteps: [],
        warnings: [],
      });

      const result = builder.build(output);

      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0]).toContain("dependencias");
    });

    it("no agrega warning duplicado de dependencias", () => {
      const builder = new ResponseBuilder();
      const output = makeOutput({
        state: "EXECUTED",
        plan: [makeStep({ dependsOn: ["s0"] })],
        warnings: ["dependencias no satisfechas"],
      });

      const result = builder.build(output);

      // Solo debe tener 1 warning, no duplicado
      const depWarnings = result.warnings.filter((w) => w.includes("dependencias"));
      expect(depWarnings).toHaveLength(1);
    });

    it("no agrega warnings extra en estados no terminales", () => {
      const builder = new ResponseBuilder();
      const output = makeOutput({
        state: "PLAN",
        plan: [makeStep({ dependsOn: ["s0"] })],
        warnings: [],
      });

      const result = builder.build(output);

      // No debe agregar warnings extra porque state no es EXECUTED/FAILED
      expect(result.warnings).toHaveLength(0);
    });

    it("agrega warning informativo en estado terminal sin warnings", () => {
      const builder = new ResponseBuilder();
      const output = makeOutput({
        state: "EXECUTED",
        failedSteps: [makeStep()],
        warnings: [],
      });

      const result = builder.build(output);

      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0]).toContain("1 paso fallido");
    });
  });

  // ─── Edge cases ───────────────────────────────────────────────────────────

  describe("edge cases", () => {
    it("maneja plan vacío sin errores", () => {
      const builder = new ResponseBuilder();
      const output = makeOutput({ state: "EXECUTED", plan: [], completedSteps: [], failedSteps: [] });
      const result = builder.build(output);
      expect(result.summary).toBeDefined();
      expect(result.warnings).toBeDefined();
    });

    it("maneja múltiples tool activity entries", () => {
      const builder = new ResponseBuilder();
      const output = makeOutput({
        state: "EXECUTED",
        plan: [makeStep(), makeStep()],
        completedSteps: [makeStep({ id: "s1" }), makeStep({ id: "s2" })],
        toolActivity: [
          { toolName: "searchPartidas", success: true, latencyMs: 100, summary: "5 resultados" },
          { toolName: "addPartida", success: true, latencyMs: 200, summary: "Creada" },
        ],
      });

      const result = builder.build(output);
      expect(result.summary).toContain("2 pasos completados");
    });

    it("maneja múltiples failed steps con warnings", () => {
      const builder = new ResponseBuilder();
      const output = makeOutput({
        state: "FAILED",
        failedSteps: [makeStep({ id: "s1" }), makeStep({ id: "s2" }), makeStep({ id: "s3" })],
      });

      const result = builder.build(output);
      expect(result.summary).toContain("3 pasos fallidos");
    });

    it("singular vs plural en conteos", () => {
      const builder = new ResponseBuilder();

      // Singular
      const single = builder.build(makeOutput({ state: "EXECUTED", completedSteps: [makeStep()] }));
      expect(single.summary).toContain("1 paso completado");

      // Plural
      const plural = builder.build(makeOutput({ state: "EXECUTED", completedSteps: [makeStep({ id: "s1" }), makeStep({ id: "s2" })] }));
      expect(plural.summary).toContain("2 pasos completados");
    });
  });
});
