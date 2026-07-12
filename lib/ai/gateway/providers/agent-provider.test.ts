import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AgentToolDefinition } from "@/lib/ai/agent/types";
import type { AgentVercelSdkLoopOutput } from "@/lib/ai/agent/contracts";

// ─── Hoisted mocks (must be before vi.mock) ──────────────────────────────────

const { mockChat, mockCreateOpenRouter, mockRunLoop, testTools } = vi.hoisted(() => {
  const { z } = require("zod");

  const tools: AgentToolDefinition[] = [
    {
      name: "searchPartidas",
      description: "Busca partidas en el catálogo",
      risk: "read" as const,
      requiresProjectId: false,
      inputSchema: z.object({ query: z.string().min(1) }),
      execute: async (input: { query: string }) => ({
        query: input.query,
        matchCount: 3,
        partidas: [{ id: "p-1", description: "Concreto f'c=210", unit: "m3" }],
      }),
      summarizeResult: (r: Record<string, unknown>) =>
        `${r.matchCount} partidas encontradas.`,
    },
    {
      name: "addPartida",
      description: "Agrega una nueva partida al catálogo",
      risk: "write" as const,
      requiresProjectId: false,
      inputSchema: z.object({
        description: z.string().min(3),
        unit: z.string().min(1),
        unitPrice: z.number().positive(),
      }),
      execute: async (input: { description: string }) => ({
        id: "new-partida-1",
        description: input.description,
      }),
      summarizeResult: () => "Partida creada.",
    },
    {
      name: "calculateBudget",
      description: "Calcula totales de un presupuesto",
      risk: "read" as const,
      requiresProjectId: false,
      inputSchema: z.object({ budgetId: z.string().min(1) }),
      execute: async (input: { budgetId: string }) => ({
        budgetId: input.budgetId,
        totalAmount: 125000,
      }),
      summarizeResult: () => "Presupuesto calculado.",
    },
    {
      name: "generateBudget",
      description: "Genera un presupuesto preliminar",
      risk: "write" as const,
      requiresProjectId: true,
      inputSchema: z.object({
        projectId: z.string().min(1),
        description: z.string().min(10),
        templateType: z.enum(["edificio", "carretera", "hospital", "colegio", "vivienda", "industrial"]).optional(),
        templateSource: z.enum(["auto", "mcp", "project", "catalog"]).default("auto"),
        previewOnly: z.boolean().default(false),
      }),
      execute: async (input: { projectId: string; description: string }) => ({
        projectId: input.projectId,
        description: input.description,
        totalItemsAdded: 25,
        message: "Presupuesto generado exitosamente.",
      }),
      summarizeResult: () => "Presupuesto generado: 25 partidas.",
    },
  ];

  return {
    mockChat: vi.fn(),
    mockCreateOpenRouter: vi.fn(),
    mockRunLoop: vi.fn(),
    testTools: tools,
  };
});

vi.mock("@openrouter/ai-sdk-provider", () => ({
  createOpenRouter: mockCreateOpenRouter,
}));

vi.mock("@/lib/ai/agent/vercel-sdk-adapter", () => ({
  createVercelSdkAdapter: () => ({ runLoop: mockRunLoop }),
}));



vi.mock("@/lib/ai/agent/tools", () => ({
  allTools: testTools,
}));

// Must import after mocks
import { executeAgentProvider, taskToExecutionMode } from "@/lib/ai/gateway/providers/agent-provider";
import type { AiProviderRequest, KhipuAiTask } from "@/lib/ai/gateway/types";

// ─── taskToExecutionMode unit tests ──────────────────────────────────────────

describe("taskToExecutionMode", () => {
  // ─── Conversational tasks → "chat" mode ───────────────────────────────────

  describe("conversational tasks return 'chat'", () => {
    it("maps 'chat' to 'chat' mode", () => {
      expect(taskToExecutionMode("chat")).toBe("chat");
    });

    it("maps 'autocomplete' to 'chat' mode", () => {
      expect(taskToExecutionMode("autocomplete")).toBe("chat");
    });
  });

  // ─── Goal-oriented tasks → "goal" mode ───────────────────────────────────

  describe("goal-oriented tasks return 'goal'", () => {
    const goalTasks = [
      "review_apu",
      "generate_apu",
      "suggest_insumos",
      "review_budget",
      "generate_partida",
      "review_formula_polinomica",
      "review_quantity_takeoff",
      "montecarlo_risk_analysis",
    ] as const;

    for (const task of goalTasks) {
      it(`maps '${task}' to 'goal' mode`, () => {
        expect(taskToExecutionMode(task)).toBe("goal");
      });
    }
  });

  // ─── Exhaustiveness: all 10 KhipuAiTask values are covered ───────────────

  it("covers all KhipuAiTask values without returning undefined or throwing", () => {
    const allTasks = [
      "chat",
      "autocomplete",
      "review_apu",
      "generate_apu",
      "suggest_insumos",
      "review_budget",
      "generate_partida",
      "review_formula_polinomica",
      "review_quantity_takeoff",
      "montecarlo_risk_analysis",
    ] as const;

    expect(allTasks).toHaveLength(10);

    for (const task of allTasks) {
      const mode = taskToExecutionMode(task);
      expect(["chat", "goal"]).toContain(mode);
    }
  });

  // ─── Default behavior for unknown/future tasks ────────────────────────────

  it("defaults to 'goal' for unknown task strings (future-proof)", () => {
    // Use a type assertion to simulate an unknown future task value
    const unknownTask = "future_task_type" as unknown as KhipuAiTask;
    expect(taskToExecutionMode(unknownTask)).toBe("goal");
  });
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeRequest(overrides: Partial<AiProviderRequest> = {}): AiProviderRequest {
  return {
    task: "chat",
    messages: [
      { role: "system", content: "Eres un asistente de construcción." },
      { role: "user", content: "¿Cuánto cuesta el concreto?" },
    ],
    apiKey: "sk-test-key",
    modelPreference: "deepseek/deepseek-chat-v3-0324:free",
    ...overrides,
  };
}

function makeLoopOutput(
  overrides: Partial<AgentVercelSdkLoopOutput> = {},
): AgentVercelSdkLoopOutput {
  return {
    messages: [
      { role: "user", content: "¿Cuánto cuesta el concreto?" },
      { role: "assistant", content: "El concreto cuesta aproximadamente S/ 350 por m3." },
    ],
    toolCalls: [],
    finishReason: "stop",
    provider: "openrouter",
    model: "deepseek/deepseek-chat-v3-0324:free",
    usage: { promptTokens: 50, completionTokens: 30, totalTokens: 80 },
    warnings: [],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();

  // Default: createOpenRouter returns a mock with .chat() returning a fake model
  mockCreateOpenRouter.mockReturnValue({
    chat: mockChat.mockReturnValue({ provider: "openrouter", modelId: "test-model" }),
  });

  // Default: adapter returns a simple answer with no tool calls
  mockRunLoop.mockResolvedValue(makeLoopOutput());
});

afterEach(() => {
  vi.unstubAllEnvs();
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("executeAgentProvider", () => {
  // ─── Happy path: simple answer, no tool calls ─────────────────────────────

  it("devuelve respuesta final cuando el modelo no pide herramientas", async () => {
    const result = await executeAgentProvider(makeRequest());

    expect(result.provider).toBe("agent");
    expect(result.fallbackUsed).toBe(false);
    expect(result.answer).toContain("El concreto cuesta");
    expect(result.warnings).toEqual([]);
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    expect(result.requestBody).toMatchObject({
      iterations: 1,
      totalToolCalls: 0,
    });
    expect(mockRunLoop).toHaveBeenCalledTimes(1);
  });

  // ─── Tool calls → loop → final answer ─────────────────────────────────────

  it("ejecuta herramientas y continúa el loop hasta respuesta final", async () => {
    mockRunLoop
      .mockResolvedValueOnce(makeLoopOutput({
        messages: [
          { role: "user", content: "Busca partidas de concreto" },
          { role: "assistant", content: "Voy a buscar." },
        ],
        toolCalls: [
          { id: "tc-1", name: "searchPartidas", arguments: { query: "concreto" } },
        ],
        finishReason: "approval_boundary",
        usage: { promptTokens: 40, completionTokens: 10, totalTokens: 50 },
      }))
      .mockResolvedValueOnce(makeLoopOutput({
        messages: [
          { role: "user", content: "Busca partidas de concreto" },
          { role: "assistant", content: "Voy a buscar." },
          { role: "user", content: "Resultados..." },
          { role: "assistant", content: "Encontré 3 partidas de concreto." },
        ],
        toolCalls: [],
        finishReason: "stop",
        usage: { promptTokens: 60, completionTokens: 40, totalTokens: 100 },
      }));

    const result = await executeAgentProvider(makeRequest());

    expect(result.provider).toBe("agent");
    expect(result.answer).toContain("Encontré 3 partidas");
    expect(mockRunLoop).toHaveBeenCalledTimes(2);
    expect(result.requestBody).toMatchObject({
      iterations: 2,
      totalToolCalls: 1,
      usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
    });
  });

  // ─── Approval boundary: write tool requires approval ──────────────────────

  it("detiene el loop cuando una herramienta requiere aprobación", async () => {
    mockRunLoop.mockResolvedValueOnce(makeLoopOutput({
      messages: [
        { role: "user", content: "Agrega una partida de concreto" },
        { role: "assistant", content: "Voy a agregar la partida." },
      ],
      toolCalls: [
        { id: "tc-2", name: "addPartida", arguments: { description: "Concreto", unit: "m3", unitPrice: 350 } },
      ],
      finishReason: "approval_boundary",
      usage: { promptTokens: 30, completionTokens: 10, totalTokens: 40 },
    }));

    // Usar task="generate_apu" → taskToExecutionMode → "goal" → write requiere aprobación
    const result = await executeAgentProvider(makeRequest({ task: "generate_apu" }));

    expect(result.provider).toBe("agent");
    expect(result.answer).toContain("Se requiere tu aprobación");
    expect(result.answer).toContain("addPartida");
    expect(result.warnings.some((w) => w.includes("addPartida") && w.includes("aprobación"))).toBe(true);
    expect(result.requestBody).toHaveProperty("approvalRequired");
    expect(mockRunLoop).toHaveBeenCalledTimes(1);
  });

  // ─── Multiple tool calls: one succeeds, next requires approval ────────────

  it("ejecuta herramientas read hasta encontrar una que requiere aprobación", async () => {
    mockRunLoop.mockResolvedValueOnce(makeLoopOutput({
      messages: [
        { role: "user", content: "Busca y agrega" },
        { role: "assistant", content: "Procesando..." },
      ],
      toolCalls: [
        { id: "tc-read", name: "searchPartidas", arguments: { query: "concreto" } },
        { id: "tc-write", name: "addPartida", arguments: { description: "Nuevo", unit: "m3", unitPrice: 400 } },
      ],
      finishReason: "approval_boundary",
      usage: { promptTokens: 30, completionTokens: 15, totalTokens: 45 },
    }));

    // Usar task="review_budget" → taskToExecutionMode → "goal" → write requiere aprobación
    const result = await executeAgentProvider(makeRequest({ task: "review_budget" }));

    // searchPartidas (read) should execute, addPartida (write) should trigger approval
    expect(result.answer).toContain("addPartida");
    expect(result.warnings.some((w) => w.includes("addPartida"))).toBe(true);
    // El aviso de aprobación menciona la herramienta correcta
    expect(mockRunLoop).toHaveBeenCalledTimes(1);
  });

  // ─── Adapter error ────────────────────────────────────────────────────────

  it("retorna mensaje de error cuando el adapter reporta finishReason='error'", async () => {
    mockRunLoop.mockResolvedValueOnce(makeLoopOutput({
      toolCalls: [],
      finishReason: "error",
      warnings: ["Error de conexión con el modelo"],
      messages: [{ role: "user", content: "Hola" }],
    }));

    const result = await executeAgentProvider(makeRequest());

    expect(result.provider).toBe("agent");
    expect(result.answer).toContain("Error del agente: Error de conexión con el modelo");
    expect(result.warnings).toContain("Error de conexión con el modelo");
  });

  // ─── API key missing ──────────────────────────────────────────────────────

  it("lanza error cuando no hay API key configurada", async () => {
    await expect(
      executeAgentProvider(makeRequest({ apiKey: undefined })),
    ).rejects.toThrow("No hay API key configurada");
  });

  // ─── Max iterations reached ───────────────────────────────────────────────

  it("retorna advertencia cuando se alcanza el límite de iteraciones", async () => {
    for (let i = 0; i < 5; i++) {
      mockRunLoop.mockResolvedValueOnce(makeLoopOutput({
        messages: [
          { role: "user", content: `Paso ${i + 1}` },
          { role: "assistant", content: `Ejecutando paso ${i + 1}...` },
        ],
        toolCalls: [
          { id: `tc-${i}`, name: "searchPartidas", arguments: { query: `paso-${i}` } },
        ],
        finishReason: "approval_boundary",
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
      }));
    }

    const result = await executeAgentProvider(makeRequest());

    expect(result.provider).toBe("agent");
    expect(result.warnings.some((w) => w.includes("iteraciones") && w.includes("alcanzado"))).toBe(true);
    expect(result.requestBody).toMatchObject({
      iterations: 5,
      limitReached: true,
    });
  });

  // ─── Usage accumulation across iterations ─────────────────────────────────

  it("acumula usage de todas las iteraciones", async () => {
    mockRunLoop
      .mockResolvedValueOnce(makeLoopOutput({
        toolCalls: [{ id: "tc-1", name: "searchPartidas", arguments: { query: "a" } }],
        finishReason: "approval_boundary",
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
        messages: [
          { role: "user", content: "Busca" },
          { role: "assistant", content: "Buscando..." },
        ],
      }))
      .mockResolvedValueOnce(makeLoopOutput({
        toolCalls: [{ id: "tc-2", name: "searchPartidas", arguments: { query: "b" } }],
        finishReason: "approval_boundary",
        usage: { promptTokens: 200, completionTokens: 80, totalTokens: 280 },
        messages: [
          { role: "user", content: "Busca" },
          { role: "assistant", content: "Buscando..." },
          { role: "user", content: "Resultados..." },
          { role: "assistant", content: "Buscando más..." },
        ],
      }))
      .mockResolvedValueOnce(makeLoopOutput({
        toolCalls: [],
        finishReason: "stop",
        usage: { promptTokens: 300, completionTokens: 100, totalTokens: 400 },
        messages: [
          { role: "user", content: "Busca" },
          { role: "assistant", content: "Buscando..." },
          { role: "user", content: "Resultados..." },
          { role: "assistant", content: "Resultado final." },
        ],
      }));

    const result = await executeAgentProvider(makeRequest());

    expect(result.requestBody).toMatchObject({
      usage: {
        promptTokens: 600,
        completionTokens: 230,
        totalTokens: 830,
      },
    });
  });

  // ─── Empty system prompt ──────────────────────────────────────────────────

  it("maneja mensajes sin system prompt", async () => {
    const result = await executeAgentProvider(
      makeRequest({
        messages: [{ role: "user", content: "¿Cuánto cuesta el concreto?" }],
      }),
    );

    expect(result.answer).toContain("El concreto cuesta");
  });

  // ─── Custom model preference ──────────────────────────────────────────────

  it("usa el modelo especificado en modelPreference", async () => {
    await executeAgentProvider(
      makeRequest({ modelPreference: "anthropic/claude-3-sonnet" }),
    );

    expect(mockChat).toHaveBeenCalledWith("anthropic/claude-3-sonnet");
  });

  // ─── fetch passthrough ────────────────────────────────────────────────────

  it("pasa fetchImpl a createOpenRouter cuando se proporciona", async () => {
    const customFetch = vi.fn() as unknown as typeof fetch;

    await executeAgentProvider(makeRequest({ fetchImpl: customFetch }));

    expect(mockCreateOpenRouter).toHaveBeenCalledWith(
      expect.objectContaining({ fetch: customFetch }),
    );
  });

  // ─── Error finishReason prioritized over tool calls ───────────────────────

  it("prioriza finishReason='error' incluso si hay tool calls", async () => {
    mockRunLoop.mockResolvedValueOnce(makeLoopOutput({
      toolCalls: [
        { id: "tc-err", name: "searchPartidas", arguments: { query: "test" } },
      ],
      finishReason: "error",
      warnings: ["Timeout del modelo"],
      messages: [
        { role: "user", content: "Hola" },
        { role: "assistant", content: "" },
      ],
    }));

    const result = await executeAgentProvider(makeRequest());

    expect(result.answer).toContain("Error del agente");
    expect(result.warnings).toContain("Timeout del modelo");
  });

  // ─── Tool execution failure (non-approval) continues loop ────────────────

  it("continúa el loop cuando una herramienta falla sin ser de aprobación", async () => {
    // Primera iteración: searchPartidas falla (Zod validation error — input inválido)
    mockRunLoop.mockResolvedValueOnce(makeLoopOutput({
      messages: [
        { role: "user", content: "Busca" },
        { role: "assistant", content: "Buscando..." },
      ],
      toolCalls: [
        // El modelo pasó argumentos que no pasan Zod validation (falta "query")
        { id: "tc-bad", name: "searchPartidas", arguments: {} as Record<string, unknown> },
      ],
      finishReason: "approval_boundary",
      usage: { promptTokens: 20, completionTokens: 5, totalTokens: 25 },
    }));

    // Segunda iteración: modelo ve el error y responde sin tools
    mockRunLoop.mockResolvedValueOnce(makeLoopOutput({
      messages: [
        { role: "user", content: "Busca" },
        { role: "assistant", content: "Buscando..." },
        { role: "user", content: "Resultados de las herramientas..." },
        { role: "assistant", content: "No pude buscar. ¿Puedes darme más detalles?" },
      ],
      toolCalls: [],
      finishReason: "stop",
      usage: { promptTokens: 30, completionTokens: 15, totalTokens: 45 },
    }));

    const result = await executeAgentProvider(makeRequest());

    expect(result.provider).toBe("agent");
    expect(result.answer).toContain("No pude buscar");
    expect(mockRunLoop).toHaveBeenCalledTimes(2);
  });

  // ─── Repeated failure detection ───────────────────────────────────────────

  it("detiene el loop cuando la misma tool falla 2 veces con el mismo error", async () => {
    // Iteración 1: createProject falla por falta de name
    mockRunLoop.mockResolvedValueOnce(makeLoopOutput({
      messages: [
        { role: "user", content: "Crea proyecto" },
        { role: "assistant", content: "Creando proyecto..." },
      ],
      toolCalls: [
        { id: "tc-1", name: "searchPartidas", arguments: {} as Record<string, unknown> },
      ],
      finishReason: "approval_boundary",
      usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
    }));

    // Iteración 2: mismo error — el LLM repite la misma llamada inválida
    mockRunLoop.mockResolvedValueOnce(makeLoopOutput({
      messages: [
        { role: "user", content: "Crea proyecto" },
        { role: "assistant", content: "Creando proyecto..." },
        { role: "user", content: "Resultados: falló searchPartidas..." },
        { role: "assistant", content: "Reintentando..." },
      ],
      toolCalls: [
        { id: "tc-2", name: "searchPartidas", arguments: {} as Record<string, unknown> },
      ],
      finishReason: "approval_boundary",
      usage: { promptTokens: 15, completionTokens: 5, totalTokens: 20 },
    }));

    const result = await executeAgentProvider(makeRequest());

    // Debe detenerse tras 2 iteraciones, no seguir hasta 5
    expect(mockRunLoop).toHaveBeenCalledTimes(2);
    expect(result.warnings.some((w) => w.includes("2 veces seguidas") && w.includes("mismo error"))).toBe(true);
    expect(result.requestBody).toMatchObject({
      iterations: 2,
    });
  });

  it("continúa el loop cuando la misma tool falla pero con errores diferentes", async () => {
    // Iteración 1: searchPartidas falla por falta de query
    mockRunLoop.mockResolvedValueOnce(makeLoopOutput({
      messages: [
        { role: "user", content: "Busca" },
        { role: "assistant", content: "Buscando..." },
      ],
      toolCalls: [
        { id: "tc-1", name: "searchPartidas", arguments: {} as Record<string, unknown> },
      ],
      finishReason: "approval_boundary",
      usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
    }));

    // Iteración 2: searchPartidas falla pero con argumentos diferentes (el LLM intentó corregir)
    mockRunLoop.mockResolvedValueOnce(makeLoopOutput({
      messages: [
        { role: "user", content: "Busca" },
        { role: "assistant", content: "Corrigiendo..." },
      ],
      toolCalls: [
        { id: "tc-2", name: "searchPartidas", arguments: { query: "" } },
      ],
      finishReason: "approval_boundary",
      usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
    }));

    // Iteración 3: el LLM aprende y responde sin tools
    mockRunLoop.mockResolvedValueOnce(makeLoopOutput({
      messages: [
        { role: "user", content: "Busca" },
        { role: "assistant", content: "Necesito más detalles para buscar." },
      ],
      toolCalls: [],
      finishReason: "stop",
      usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 },
    }));

    const result = await executeAgentProvider(makeRequest());

    // Debe continuar porque los errores son diferentes (distinto summary)
    expect(mockRunLoop).toHaveBeenCalledTimes(3);
    expect(result.answer).toContain("Necesito más detalles");
    // No debe tener warning de fallo repetido
    expect(result.warnings.some((w) => w.includes("veces seguidas"))).toBe(false);
  });

  it("resetea el tracker cuando una herramienta tiene éxito en la misma iteración", async () => {
    // Iteración 1: searchPartidas falla
    mockRunLoop.mockResolvedValueOnce(makeLoopOutput({
      messages: [
        { role: "user", content: "Busca y calcula" },
        { role: "assistant", content: "Procesando..." },
      ],
      toolCalls: [
        { id: "tc-1", name: "searchPartidas", arguments: {} as Record<string, unknown> },
      ],
      finishReason: "approval_boundary",
      usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
    }));

    // Iteración 2: searchPartidas falla otra vez, pero calculateBudget SÍ funciona
    // → el tracker debe resetearse porque hubo progreso
    mockRunLoop.mockResolvedValueOnce(makeLoopOutput({
      messages: [
        { role: "user", content: "Busca y calcula" },
        { role: "assistant", content: "Reintentando..." },
      ],
      toolCalls: [
        { id: "tc-2", name: "searchPartidas", arguments: {} as Record<string, unknown> },
        { id: "tc-3", name: "calculateBudget", arguments: { budgetId: "b1" } },
      ],
      finishReason: "approval_boundary",
      usage: { promptTokens: 15, completionTokens: 10, totalTokens: 25 },
    }));

    // Iteración 3: modelo responde sin tools
    mockRunLoop.mockResolvedValueOnce(makeLoopOutput({
      messages: [
        { role: "user", content: "Busca y calcula" },
        { role: "assistant", content: "Resultados parciales." },
      ],
      toolCalls: [],
      finishReason: "stop",
      usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 },
    }));

    const result = await executeAgentProvider(makeRequest());

    // Debe continuar hasta el final (3 iteraciones)
    expect(mockRunLoop).toHaveBeenCalledTimes(3);
    expect(result.answer).toContain("Resultados parciales");
    expect(result.warnings.some((w) => w.includes("veces seguidas"))).toBe(false);
  });

  it("no detiene el loop si solo falla una vez (primera falla)", async () => {
    // Iteración 1: searchPartidas falla
    mockRunLoop.mockResolvedValueOnce(makeLoopOutput({
      messages: [
        { role: "user", content: "Busca" },
        { role: "assistant", content: "Buscando..." },
      ],
      toolCalls: [
        { id: "tc-1", name: "searchPartidas", arguments: {} as Record<string, unknown> },
      ],
      finishReason: "approval_boundary",
      usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
    }));

    // Iteración 2: modelo corrige y responde sin tools
    mockRunLoop.mockResolvedValueOnce(makeLoopOutput({
      messages: [
        { role: "user", content: "Busca" },
        { role: "assistant", content: "No puedo buscar sin query." },
      ],
      toolCalls: [],
      finishReason: "stop",
      usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 },
    }));

    const result = await executeAgentProvider(makeRequest());

    expect(mockRunLoop).toHaveBeenCalledTimes(2);
    expect(result.answer).toContain("No puedo buscar");
    expect(result.warnings.some((w) => w.includes("veces seguidas"))).toBe(false);
  });

  // ─── TOOL_CALL_LIMITS: generateBudget ─────────────────────────────────----

  it("retorna error de validación cuando generateBudget recibe argumentos inválidos", async () => {
    mockRunLoop.mockResolvedValueOnce(makeLoopOutput({
      messages: [
        { role: "user", content: "Genera presupuesto" },
        { role: "assistant", content: "Generando..." },
      ],
      // Argumentos vacíos → Zod validation falla
      toolCalls: [
        { id: "tc-bad", name: "generateBudget", arguments: {} as Record<string, unknown> },
      ],
      finishReason: "approval_boundary",
      usage: { promptTokens: 20, completionTokens: 5, totalTokens: 25 },
    }))
    .mockResolvedValueOnce(makeLoopOutput({
      messages: [
        { role: "user", content: "Genera presupuesto" },
        { role: "assistant", content: "Corrigiendo..." },
        { role: "user", content: "Resultados: error de validación..." },
        { role: "assistant", content: "Necesito el projectId y la descripción." },
      ],
      toolCalls: [],
      finishReason: "stop",
      usage: { promptTokens: 30, completionTokens: 15, totalTokens: 45 },
    }));

    const result = await executeAgentProvider(makeRequest());

    expect(result.provider).toBe("agent");
    expect(result.answer).toContain("Necesito el projectId");
    expect(mockRunLoop).toHaveBeenCalledTimes(2);
  });

  it("bloquea generateBudget cuando excede el límite de 2 llamadas por conversación", async () => {
    // Las primeras 2 llamadas con argumentos válidos deberían ejecutarse
    for (let i = 0; i < 2; i++) {
      mockRunLoop.mockResolvedValueOnce(makeLoopOutput({
        messages: [
          { role: "user", content: `Intento ${i + 1}` },
          { role: "assistant", content: `Ejecutando intento ${i + 1}...` },
        ],
        toolCalls: [
          {
            id: `tc-ok-${i}`,
            name: "generateBudget",
            arguments: { projectId: "proj-1", description: "vivienda unifamiliar de 2 pisos 120m2" },
          },
        ],
        finishReason: "approval_boundary",
        usage: { promptTokens: 15, completionTokens: 10, totalTokens: 25 },
      }));
    }

    // La 3ra llamada debe ser bloqueada por TOOL_CALL_LIMITS
    mockRunLoop.mockResolvedValueOnce(makeLoopOutput({
      messages: [
        { role: "user", content: "Intento 3" },
        { role: "assistant", content: "Ejecutando intento 3..." },
      ],
      toolCalls: [
        {
          id: "tc-limit",
          name: "generateBudget",
          arguments: { projectId: "proj-1", description: "vivienda unifamiliar de 2 pisos 120m2" },
        },
      ],
      finishReason: "approval_boundary",
      usage: { promptTokens: 15, completionTokens: 10, totalTokens: 25 },
    }))
    .mockResolvedValueOnce(makeLoopOutput({
      messages: [
        { role: "user", content: "Intento 3" },
        { role: "assistant", content: "Ejecutando..." },
        { role: "user", content: "Resultados: límite alcanzado..." },
        { role: "assistant", content: "Entendido, ya no llamaré más generateBudget." },
      ],
      toolCalls: [],
      finishReason: "stop",
      usage: { promptTokens: 20, completionTokens: 10, totalTokens: 30 },
    }));

    const result = await executeAgentProvider(makeRequest({ projectId: "proj-1" }));

    // 2 ejecuciones exitosas + 1 bloqueada + 1 respuesta final = 4 iteraciones de loop
    expect(mockRunLoop).toHaveBeenCalledTimes(4);
    expect(result.answer).toContain("Entendido");
    // El warning debe mencionar el límite de generateBudget (ahora se agrega a allWarnings)
    expect(result.warnings.some((w) => w.includes("generateBudget") && w.includes("Límite"))).toBe(true);
  });
});
