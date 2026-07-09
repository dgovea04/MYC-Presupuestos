import { z } from "zod";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AgentToolDefinition } from "@/lib/ai/agent/types";
import type {
  AgentPlanner,
  AgentPolicyEngine,
  AgentToolRegistry,
  AgentToolExecutor,
  AgentVercelSdkAdapter,
  AgentLoopMessage,
  ToolExecutorOutput,
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

function makeMockRegistry(toolNames: string[] = ["searchPartidas", "addPartida"]): AgentToolRegistry {
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
  } as unknown as AgentToolRegistry;
}

function makeMockToolExecutor(success = true): AgentToolExecutor {
  return {
    execute: vi.fn().mockImplementation(async (input) => {
      const toolCall = input.toolCall;
      // Si la tool es "addPartida" y queremos simular aprobación
      if (toolCall.name === "addPartida" && !success) {
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
      return {
        toolResult: { toolCallId: toolCall.id, output: JSON.stringify({ done: true }) },
        success,
        latencyMs: 10,
        summary: `Tool "${toolCall.name}" ejecutada.`,
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

function makeOrchestrator(overrides: {
  planner?: AgentPlanner;
  policyEngine?: AgentPolicyEngine;
  registry?: AgentToolRegistry;
  toolExecutor?: AgentToolExecutor;
  adapter?: AgentVercelSdkAdapter;
} = {}) {
  return new AgentOrchestratorImpl(
    overrides.planner ?? makeMockPlanner(Promise.resolve([])),
    overrides.policyEngine ?? makeMockPolicyEngine(),
    overrides.registry ?? makeMockRegistry(),
    overrides.toolExecutor ?? makeMockToolExecutor(),
    overrides.adapter ?? makeMockAdapter(),
    { provider: "test", modelId: "test-model" },
    "test-provider",
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
    const toolExecutor = makeMockToolExecutor(false); // success=false
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
    const toolExecutor = makeMockToolExecutor(false); // approval needed
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
});
