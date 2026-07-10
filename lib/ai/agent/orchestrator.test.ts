import { z } from "zod";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AgentToolDefinition } from "@/lib/ai/agent/types";
import type {
  AgentPlanner,
  AgentPolicyEngine,
  AgentToolRegistry,
  AgentToolExecutor,
  AgentVercelSdkAdapter,
  AgentRollbackService,
  AgentLoopMessage,
  ToolExecutorOutput,
  RollbackResult,
} from "@/lib/ai/agent/contracts";
import { AgentOrchestratorImpl } from "@/lib/ai/agent/orchestrator";

// ─── Mocks ───────────────────────────────────────────────────────────────────

function makeMockPlanner(plan: ReturnType<AgentPlanner["plan"]>): AgentPlanner {
  return { plan: vi.fn().mockResolvedValue(plan) };
}

function makeMockPolicyEngine(allowed = true): AgentPolicyEngine {
  return {
    evaluate: vi.fn().mockReturnValue({
      allowed,
      approvalRequirement: allowed ? "none" as const : "pre_execute" as const,
      policyReason: "test",
    }),
  };
}

function makeMockRegistry(toolNames: string[] = ["searchPartidas", "addPartida", "createBudget"]): AgentToolRegistry {
  const tools = new Map<string, AgentToolDefinition>();
  for (const name of toolNames) {
    tools.set(name, {
      name,
      description: `${name} description`,
      risk: name.includes("add") || name.includes("create") ? "write" : "read",
      requiresProjectId: name === "createChapter",
      inputSchema: z.object({ query: z.string().optional() }),
      execute: async () => ({}),
    });
  }
  return {
    register: vi.fn(),
    get: (name: string) => tools.get(name),
    list: () => Array.from(tools.values()),
    toSdkDefinitions: () => Array.from(tools.values()).map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema as z.ZodType<Record<string, unknown>>,
    })),
    getToolNames: () => Array.from(tools.keys()),
    getBundleToolNames: (bundleSlug: string) => {
      if (bundleSlug === "budget-agent") return ["createBudget", "searchPartidas"];
      if (bundleSlug === "apu-agent") return ["calculateAPU", "searchPartidas"];
      return [];
    },
    hasBundle: (bundleSlug: string) => bundleSlug === "budget-agent" || bundleSlug === "apu-agent",
  } as unknown as AgentToolRegistry;
}

/**
 * Mock Tool Executor.
 * @param success — si la tool retorna éxito o fallo
 * @param simulateApproval — si se debe simular approvalRequired (independiente de success)
 */
function makeMockToolExecutor(success = true, simulateApproval = false): AgentToolExecutor {
  return {
    execute: vi.fn().mockImplementation(async (input) => {
      const toolCall = input.toolCall;

      // Simular aprobación requerida (para tests de PENDING_APPROVAL)
      if (simulateApproval) {
        return {
          toolResult: { toolCallId: toolCall.id, output: "Aprobación pendiente" },
          success: false,
          approvalRequired: {
            approvalId: `approval_${input.executionId}_${toolCall.id}`,
            toolName: toolCall.name,
            reason: "Escritura en modo chat requiere aprobación",
          },
          latencyMs: 5,
          summary: `Tool "${toolCall.name}" requiere aprobación.`,
        } satisfies ToolExecutorOutput;
      }

      // Fallo o éxito simple
      return {
        toolResult: { toolCallId: toolCall.id, output: JSON.stringify({ done: true }) },
        success,
        latencyMs: 10,
        summary: `Tool "${toolCall.name}" ${success ? "ejecutada" : "falló"}.`,
      } satisfies ToolExecutorOutput;
    }),
  };
}

function makeMockAdapter(toolCalls: Array<{ id: string; name: string; arguments: Record<string, unknown> }> = []): AgentVercelSdkAdapter {
  return {
    runLoop: vi.fn().mockResolvedValue({
      messages: [
        { role: "user" as const, content: "test" },
        { role: "assistant" as const, content: "Resultado del paso." },
      ] as AgentLoopMessage[],
      toolCalls,
      finishReason: toolCalls.length > 0 ? "approval_boundary" : "stop",
      provider: "openrouter",
      model: "test-model",
      usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
      warnings: [],
    }),
  };
}

function makeMockRollbackService(success = true): AgentRollbackService {
  return {
    rollback: vi.fn().mockResolvedValue({
      success,
      rollbackId: success ? "rb-1" : "",
      errorMessage: success ? undefined : "Rollback falló.",
    } satisfies RollbackResult),
    supportsRollback: vi.fn().mockImplementation((toolName: string) =>
      toolName.includes("add") || toolName.includes("create")
    ),
  };
}

function makeOrchestrator(overrides: {
  planner?: AgentPlanner;
  policyEngine?: AgentPolicyEngine;
  registry?: AgentToolRegistry;
  toolExecutor?: AgentToolExecutor;
  adapter?: AgentVercelSdkAdapter;
  rollbackService?: AgentRollbackService;
} = {}) {
  return new AgentOrchestratorImpl(
    overrides.planner ?? makeMockPlanner(Promise.resolve([])),
    overrides.policyEngine ?? makeMockPolicyEngine(),
    overrides.registry ?? makeMockRegistry(),
    overrides.toolExecutor ?? makeMockToolExecutor(),
    overrides.adapter ?? makeMockAdapter(),
    { provider: "test", modelId: "test-model" },
    "test-provider",
    overrides.rollbackService,
  );
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("AgentOrchestrator", () => {
  // ─── Plan generation and execution ────────────────────────────────────────

  it("genera un plan y ejecuta pasos read exitosamente", async () => {
    const planner = makeMockPlanner(Promise.resolve([
      { id: "step-1", title: "Buscar", toolName: "searchPartidas", objective: "Buscar", expectedOutcome: "Lista", dependsOn: [], approvalBoundary: false },
    ]));
    const orchestrator = makeOrchestrator({ planner });

    const output = await orchestrator.run({
      userId: "user-1",
      projectId: "project-1",
      message: "Busca partidas de concreto",
      mode: "chat",
    });

    expect(output.state).toBe("EXECUTED");
    expect(output.completedSteps).toHaveLength(1);
    expect(output.failedSteps).toHaveLength(0);
    expect(output.summary).toContain("1/1");
  });

  it("registra tool failures en toolActivity sin detener el plan", async () => {
    const planner = makeMockPlanner(Promise.resolve([
      { id: "step-1", title: "Buscar", toolName: "searchPartidas", objective: "Buscar", expectedOutcome: "Lista", dependsOn: [], approvalBoundary: false },
    ]));
    const toolExecutor = makeMockToolExecutor(false); // success=false, sin approval
    const adapter = makeMockAdapter([
      { id: "tc-1", name: "searchPartidas", arguments: { query: "test" } },
    ]);
    const orchestrator = makeOrchestrator({ planner, toolExecutor, adapter });

    const output = await orchestrator.run({
      userId: "user-1",
      message: "Busca partidas",
      mode: "chat",
    });

    expect(output.state).toBe("EXECUTED");
    expect(output.toolActivity[0].success).toBe(false);
  });

  // ─── Approval boundary ────────────────────────────────────────────────────

  it("pausa en PENDING_APPROVAL cuando una herramienta requiere aprobación", async () => {
    const planner = makeMockPlanner(Promise.resolve([
      { id: "step-1", title: "Agregar", toolName: "addPartida", objective: "Agregar", expectedOutcome: "Creada", dependsOn: [], approvalBoundary: true },
    ]));
    const policyEngine = makeMockPolicyEngine(true);
    // Override policy to require approval
    (policyEngine.evaluate as ReturnType<typeof vi.fn>).mockReturnValue({
      allowed: true,
      approvalRequirement: "pre_execute",
      policyReason: "Escritura requiere aprobación",
    });
    const toolExecutor = makeMockToolExecutor(false, true); // approval needed!
    const orchestrator = makeOrchestrator({ planner, policyEngine, toolExecutor });

    const output = await orchestrator.run({
      userId: "user-1",
      message: "Agrega una partida",
      mode: "chat",
    });

    expect(output.state).toBe("PENDING_APPROVAL");
    expect(output.pendingApproval).toBeDefined();
  });

  // ─── State machine integration ────────────────────────────────────────────

  it("transiciona a FAILED cuando el plan está vacío", async () => {
    const planner = makeMockPlanner(Promise.resolve([]));
    const orchestrator = makeOrchestrator({ planner });

    const output = await orchestrator.run({
      userId: "user-1",
      message: "Haz algo imposible",
      mode: "chat",
    });

    expect(output.state).toBe("FAILED");
  });

  it("transiciona correctamente por el ciclo READ→PLAN→PROPOSE→SIMULATE→EXECUTING→EXECUTED", async () => {
    const planner = makeMockPlanner(Promise.resolve([
      { id: "step-1", title: "Buscar", toolName: "searchPartidas", objective: "Buscar", expectedOutcome: "Lista", dependsOn: [], approvalBoundary: false },
    ]));
    const orchestrator = makeOrchestrator({ planner });

    const output = await orchestrator.run({
      userId: "user-1",
      message: "Busca partidas",
      mode: "chat",
    });

    expect(output.state).toBe("EXECUTED");
    expect(output.executionId).toBeTruthy();
    expect(output.completedSteps).toHaveLength(1);
  });

  // ─── Dependencies ─────────────────────────────────────────────────────────

  it("omite pasos con dependencias no satisfechas", async () => {
    const planner = makeMockPlanner(Promise.resolve([
      { id: "step-1", title: "Paso con dep", toolName: "searchPartidas", objective: "X", expectedOutcome: "Y", dependsOn: ["missing-step"], approvalBoundary: false },
    ]));
    const orchestrator = makeOrchestrator({ planner });

    const output = await orchestrator.run({
      userId: "user-1",
      message: "Busca partidas",
      mode: "chat",
    });

    expect(output.failedSteps).toHaveLength(1);
    expect(output.warnings.some((w) => w.includes("dependencias"))).toBe(true);
  });

  // ─── Tool activity tracking ───────────────────────────────────────────────

  it("registra actividad de herramientas en toolActivity", async () => {
    const planner = makeMockPlanner(Promise.resolve([
      { id: "step-1", title: "Buscar", toolName: "searchPartidas", objective: "Buscar", expectedOutcome: "Lista", dependsOn: [], approvalBoundary: false },
    ]));
    const adapter = makeMockAdapter([
      { id: "tc-1", name: "searchPartidas", arguments: { query: "concreto" } },
    ]);
    const orchestrator = makeOrchestrator({ planner, adapter });

    const output = await orchestrator.run({
      userId: "user-1",
      message: "Busca partidas de concreto",
      mode: "chat",
    });

    expect(output.toolActivity).toHaveLength(1);
    expect(output.toolActivity[0].toolName).toBe("searchPartidas");
    expect(output.toolActivity[0].success).toBe(true);
  });

  // ─── Error recovery ──────────────────────────────────────────────────────

  it("captura errores del adapter y transiciona a FAILED cuando todos los pasos fallan", async () => {
    const planner = makeMockPlanner(Promise.resolve([
      { id: "step-1", title: "Buscar", toolName: "searchPartidas", objective: "Buscar", expectedOutcome: "Lista", dependsOn: [], approvalBoundary: false },
    ]));
    const adapter: AgentVercelSdkAdapter = {
      runLoop: vi.fn().mockRejectedValue(new Error("Adapter crash")),
    };
    const orchestrator = makeOrchestrator({ planner, adapter });

    const output = await orchestrator.run({
      userId: "user-1",
      message: "Busca partidas",
      mode: "chat",
    });

    expect(output.state).toBe("FAILED");
    expect(output.failedSteps).toHaveLength(1);
  });

  // ─── Plan structure ───────────────────────────────────────────────────────

  it("incluye el plan completo en la salida", async () => {
    const steps = [
      { id: "step-1", title: "Buscar", toolName: "searchPartidas", objective: "Buscar", expectedOutcome: "Lista", dependsOn: [], approvalBoundary: false },
      { id: "step-2", title: "Agregar", toolName: "addPartida", objective: "Agregar", expectedOutcome: "Creada", dependsOn: ["step-1"], approvalBoundary: true },
    ];
    const planner = makeMockPlanner(Promise.resolve(steps));
    const orchestrator = makeOrchestrator({ planner });

    const output = await orchestrator.run({
      userId: "user-1",
      message: "Busca y agrega",
      mode: "chat",
    });

    expect(output.plan).toEqual(steps);
    expect(output.completedSteps).toHaveLength(2);
  });

  // ─── Mode awareness ───────────────────────────────────────────────────────

  it("incluye mode en la salida", async () => {
    const planner = makeMockPlanner(Promise.resolve([
      { id: "step-1", title: "Buscar", toolName: "searchPartidas", objective: "Buscar", expectedOutcome: "Lista", dependsOn: [], approvalBoundary: false },
    ]));
    const orchestrator = makeOrchestrator({ planner });

    const output = await orchestrator.run({
      userId: "user-1",
      message: "Busca partidas",
      mode: "goal",
    });

    expect(output.mode).toBe("goal");
    expect(output.state).toBe("EXECUTED");
  });

  // ─── Generic step (no tool) ──────────────────────────────────────────────

  it("ejecuta pasos sin toolName (razonamiento puro)", async () => {
    const planner = makeMockPlanner(Promise.resolve([
      { id: "step-1", title: "Analizar", toolName: undefined, objective: "Analizar solicitud", expectedOutcome: "Respuesta", dependsOn: [], approvalBoundary: false },
    ]));
    const orchestrator = makeOrchestrator({ planner });

    const output = await orchestrator.run({
      userId: "user-1",
      message: "¿Qué es un APU?",
      mode: "chat",
    });

    expect(output.state).toBe("EXECUTED");
    expect(output.completedSteps).toHaveLength(1);
  });

  // ─── Rollback automático ─────────────────────────────────────────────────

  describe("rollback automático", () => {
    it("intenta rollback cuando una tool de escritura falla (tool-call level)", async () => {
      const rollbackService = makeMockRollbackService(true);
      const toolExecutor = makeMockToolExecutor(false, false); // falla sin approval
      const adapter = makeMockAdapter([
        { id: "tc-1", name: "createBudget", arguments: { name: "Test" } },
      ]);
      const planner = makeMockPlanner(Promise.resolve([
        { id: "step-1", title: "Crear", toolName: "createBudget", objective: "Crear presupuesto", expectedOutcome: "Creado", dependsOn: [], approvalBoundary: false },
      ]));

      const orchestrator = makeOrchestrator({ planner, toolExecutor, adapter, rollbackService });

      const output = await orchestrator.run({
        userId: "user-1",
        message: "Crea un presupuesto",
        mode: "chat",
      });

      expect(output.state).toBe("EXECUTED");
      expect(output.warnings.some((w) => w.includes("Rollback automático"))).toBe(true);
      expect(output.warnings.some((w) => w.includes("createBudget"))).toBe(true);
    });

    it("llama a rollback con los parámetros correctos (tool-call level)", async () => {
      const rollbackService = makeMockRollbackService(true);
      const toolExecutor = makeMockToolExecutor(false, false);
      const adapter = makeMockAdapter([
        { id: "tc-1", name: "createBudget", arguments: { name: "Test" } },
      ]);
      const planner = makeMockPlanner(Promise.resolve([
        { id: "step-1", title: "Crear", toolName: "createBudget", objective: "Crear presupuesto", expectedOutcome: "Creado", dependsOn: [], approvalBoundary: false },
      ]));

      const orchestrator = makeOrchestrator({ planner, toolExecutor, adapter, rollbackService });

      await orchestrator.run({
        userId: "user-1",
        message: "Crea un presupuesto",
        mode: "chat",
      });

      expect(rollbackService.rollback).toHaveBeenCalledTimes(1);
      expect(rollbackService.rollback).toHaveBeenCalledWith({
        executionId: expect.any(String),
        stepId: "step-1",
        userId: "user-1",
        reason: expect.stringContaining("createBudget"),
      });
    });

    it("NO intenta rollback cuando la tool NO soporta rollback", async () => {
      const rollbackService = makeMockRollbackService(true);
      const toolExecutor = makeMockToolExecutor(false, false);
      const adapter = makeMockAdapter([
        { id: "tc-1", name: "searchPartidas", arguments: { query: "test" } },
      ]);
      const planner = makeMockPlanner(Promise.resolve([
        { id: "step-1", title: "Buscar", toolName: "searchPartidas", objective: "Buscar", expectedOutcome: "Lista", dependsOn: [], approvalBoundary: false },
      ]));

      const orchestrator = makeOrchestrator({ planner, toolExecutor, adapter, rollbackService });

      await orchestrator.run({
        userId: "user-1",
        message: "Busca partidas",
        mode: "chat",
      });

      expect(rollbackService.rollback).not.toHaveBeenCalled();
    });

    it("maneja rollback fallido sin romper la ejecución", async () => {
      const rollbackService = makeMockRollbackService(false); // rollback falla
      const toolExecutor = makeMockToolExecutor(false, false);
      const adapter = makeMockAdapter([
        { id: "tc-1", name: "createBudget", arguments: { name: "Test" } },
      ]);
      const planner = makeMockPlanner(Promise.resolve([
        { id: "step-1", title: "Crear", toolName: "createBudget", objective: "Crear presupuesto", expectedOutcome: "Creado", dependsOn: [], approvalBoundary: false },
      ]));

      const orchestrator = makeOrchestrator({ planner, toolExecutor, adapter, rollbackService });

      const output = await orchestrator.run({
        userId: "user-1",
        message: "Crea un presupuesto",
        mode: "chat",
      });

      expect(output.state).toBe("EXECUTED");
      // Debe haber un warning indicando que el rollback falló
      expect(output.warnings.some((w) => w.includes("falló"))).toBe(true);
    });

    it("intenta rollback automático cuando un paso completo falla (catch del adapter)", async () => {
      const rollbackService = makeMockRollbackService(true);
      const adapter: AgentVercelSdkAdapter = {
        runLoop: vi.fn().mockRejectedValue(new Error("Adapter crash")),
      };
      const planner = makeMockPlanner(Promise.resolve([
        { id: "step-1", title: "Crear", toolName: "createBudget", objective: "Crear", expectedOutcome: "Creado", dependsOn: [], approvalBoundary: false },
      ]));

      const orchestrator = makeOrchestrator({ planner, adapter, rollbackService });

      const output = await orchestrator.run({
        userId: "user-1",
        message: "Crea un presupuesto",
        mode: "chat",
      });

      expect(output.state).toBe("FAILED");
      expect(output.warnings.some((w) => w.includes("Rollback automático"))).toBe(true);
      expect(rollbackService.rollback).toHaveBeenCalled();
    });

    it("no intenta rollback si no se provee rollbackService", async () => {
      const toolExecutor = makeMockToolExecutor(false, false);
      const adapter = makeMockAdapter([
        { id: "tc-1", name: "createBudget", arguments: { name: "Test" } },
      ]);
      const planner = makeMockPlanner(Promise.resolve([
        { id: "step-1", title: "Crear", toolName: "createBudget", objective: "Crear presupuesto", expectedOutcome: "Creado", dependsOn: [], approvalBoundary: false },
      ]));

      const orchestrator = makeOrchestrator({ planner, toolExecutor, adapter });

      const output = await orchestrator.run({
        userId: "user-1",
        message: "Crea un presupuesto",
        mode: "chat",
      });

      expect(output.state).toBe("EXECUTED");
      expect(output.warnings.some((w) => w.includes("Rollback"))).toBe(false);
    });
  });

  // ─── Bundle integration ───────────────────────────────────────────────────

  describe("specialist bundle integration", () => {
    it("filtra herramientas disponibles segun el bundle del workflowId", async () => {
      // Registrar tools de varios dominios
      const registry = makeMockRegistry([
        "searchPartidas", "addPartida", "createBudget",
        "exportPDF", "createSchedule", "reviewAPU",
      ]);
      // El mock de getBundleToolNames para "budget-agent" retorna solo
      // ["createBudget", "searchPartidas"]
      const planner = makeMockPlanner(Promise.resolve([
        { id: "step-1", title: "Buscar", toolName: "searchPartidas", objective: "Buscar", expectedOutcome: "Lista", dependsOn: [], approvalBoundary: false },
      ]));
      // Spy en planner.plan para verificar availableTools
      const planSpy = vi.fn().mockResolvedValue([
        { id: "step-1", title: "Buscar", toolName: "searchPartidas", objective: "Buscar", expectedOutcome: "Lista", dependsOn: [], approvalBoundary: false },
      ]);
      const plannerWithSpy: AgentPlanner = { plan: planSpy };

      const orchestrator = makeOrchestrator({ planner: plannerWithSpy, registry });

      // Usar workflowId "crear-presupuesto-base" que se resuelve a budget-agent
      await orchestrator.run({
        userId: "user-1",
        message: "Crea un presupuesto",
        mode: "goal",
        workflowId: "crear-presupuesto-base",
      });

      // Verificar que el planner recibe SOLO las tools del bundle budget-agent
      expect(planSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          availableTools: expect.arrayContaining(["createBudget", "searchPartidas"]),
        }),
      );
      const callArgs = planSpy.mock.calls[0][0] as { availableTools: string[] };
      expect(callArgs.availableTools).not.toContain("addPartida");
      expect(callArgs.availableTools).not.toContain("exportPDF");
      expect(callArgs.availableTools).not.toContain("createSchedule");
    });

    it("usa todas las herramientas cuando no hay workflowId", async () => {
      const registry = makeMockRegistry([
        "searchPartidas", "addPartida", "createBudget", "exportPDF",
      ]);
      const planSpy = vi.fn().mockResolvedValue([
        { id: "step-1", title: "Buscar", toolName: "searchPartidas", objective: "Buscar", expectedOutcome: "Lista", dependsOn: [], approvalBoundary: false },
      ]);
      const plannerWithSpy: AgentPlanner = { plan: planSpy };

      const orchestrator = makeOrchestrator({ planner: plannerWithSpy, registry });

      await orchestrator.run({
        userId: "user-1",
        message: "Busca partidas",
        mode: "chat",
      });

      // Sin workflowId, debe pasar todas las tools disponibles
      const callArgs = planSpy.mock.calls[0][0] as { availableTools: string[] };
      expect(callArgs.availableTools).toContain("searchPartidas");
      expect(callArgs.availableTools).toContain("addPartida");
      expect(callArgs.availableTools).toContain("createBudget");
      expect(callArgs.availableTools).toContain("exportPDF");
      expect(callArgs.availableTools).toHaveLength(4);
    });

    it("inyecta system prompt del bundle en buildStepSystemPrompt", async () => {
      const registry = makeMockRegistry(["createBudget", "searchPartidas"]);
      const planner = makeMockPlanner(Promise.resolve([
        { id: "step-1", title: "Crear", toolName: "createBudget", objective: "Crear presupuesto", expectedOutcome: "Creado", dependsOn: [], approvalBoundary: false },
      ]));

      // Mock adapter para capturar el system prompt
      const adapter: AgentVercelSdkAdapter = {
        runLoop: vi.fn().mockImplementation(async (input) => {
          // Verificar que el system prompt contiene el prompt del bundle
          expect(input.system).toContain("especialista en presupuestos");
          expect(input.system).toContain("Especialidad: Presupuestos");
          return {
            messages: [{ role: "assistant" as const, content: "Ok" }],
            toolCalls: [],
            finishReason: "stop",
            provider: "test",
            model: "test",
            usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
            warnings: [],
          };
        }),
      };

      const orchestrator = makeOrchestrator({ planner, registry, adapter });

      const output = await orchestrator.run({
        userId: "user-1",
        message: "Crea un presupuesto para hospital",
        mode: "goal",
        workflowId: "crear-presupuesto-base",
      });

      expect(output.state).toBe("EXECUTED");
    });

    it("resuelve workflowId a bundle correcto (apu-agent)", async () => {
      const registry = makeMockRegistry([
        "searchPartidas", "calculateAPU", "exportPDF", "createBudget",
      ]);
      const planSpy = vi.fn().mockResolvedValue([
        { id: "step-1", title: "Calcular APU", toolName: "calculateAPU", objective: "Calcular", expectedOutcome: "Costo", dependsOn: [], approvalBoundary: false },
      ]);
      const plannerWithSpy: AgentPlanner = { plan: planSpy };

      const orchestrator = makeOrchestrator({ planner: plannerWithSpy, registry });

      await orchestrator.run({
        userId: "user-1",
        message: "Revisa los APU",
        mode: "goal",
        workflowId: "revisar-apu-proyecto",
      });

      // revisar-apu-proyecto → apu-agent → ["calculateAPU", "searchPartidas"]
      const callArgs = planSpy.mock.calls[0][0] as { availableTools: string[] };
      expect(callArgs.availableTools).toContain("calculateAPU");
      expect(callArgs.availableTools).toContain("searchPartidas");
      expect(callArgs.availableTools).not.toContain("createBudget");
      expect(callArgs.availableTools).not.toContain("exportPDF");
    });
  });
});
