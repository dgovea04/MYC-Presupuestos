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
import { executeAgentProvider } from "@/lib/ai/gateway/providers/agent-provider";
import type { AiProviderRequest } from "@/lib/ai/gateway/types";

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

    const result = await executeAgentProvider(makeRequest());

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

    const result = await executeAgentProvider(makeRequest());

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
});
