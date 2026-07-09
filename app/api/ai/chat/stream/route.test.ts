import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  attachProjectHistoryEntry: vi.fn(),
  buildChatMessages: vi.fn(),
  getDecryptedOpenrouterApiKey: vi.fn(),
  getSystemSettings: vi.fn(),
  streamChatAiResponse: vi.fn(),
  withAiRoute: vi.fn(),
}));

vi.mock("@/lib/ai/project-history-route", () => ({
  attachProjectHistoryEntry: mocks.attachProjectHistoryEntry,
}));

vi.mock("@/lib/ai/prompts", () => ({
  buildChatMessages: mocks.buildChatMessages,
}));

vi.mock("@/lib/ai/route-handler", () => ({
  withAiRoute: mocks.withAiRoute,
}));

vi.mock("@/lib/data/settings", () => ({
  getDecryptedOpenaiApiKey: vi.fn().mockResolvedValue(null),
  getDecryptedGeminiApiKey: vi.fn().mockResolvedValue(null),
  getDecryptedOpenrouterApiKey: mocks.getDecryptedOpenrouterApiKey,
  getAiProviderSettings: vi.fn().mockResolvedValue({}),
}));

vi.mock("@/lib/data/system-settings", () => ({
  getSystemSettings: mocks.getSystemSettings,
}));

vi.mock("@/lib/ai/service", () => ({
  streamChatAiResponse: mocks.streamChatAiResponse,
}));

import { POST } from "@/app/api/ai/chat/stream/route";

describe("POST /api/ai/chat/stream", () => {
  beforeEach(() => {
    mocks.attachProjectHistoryEntry.mockReset();
    mocks.buildChatMessages.mockReset();
    mocks.streamChatAiResponse.mockReset();
    mocks.withAiRoute.mockReset();
    mocks.withAiRoute.mockImplementation(async (handler: (session: { user: { id: string } }) => Promise<Response>) =>
      handler({ user: { id: "user-1" } }),
    );
    mocks.buildChatMessages.mockReturnValue([{ role: "user", content: "Consulta tecnica" }]);
    mocks.getDecryptedOpenrouterApiKey.mockReset();
    mocks.getSystemSettings.mockReset();
    mocks.getDecryptedOpenrouterApiKey.mockResolvedValue("sk-test-key");
    mocks.getSystemSettings.mockResolvedValue({});
    mocks.attachProjectHistoryEntry.mockImplementation(async ({ result }) => ({
      ...result,
      historyEntry: { id: "history-1" },
    }));
  });

  it("emits delta and final events for a streamed chat response", async () => {
    mocks.streamChatAiResponse.mockImplementation(async function* () {
      yield { type: "delta", text: "Hola " };
      yield {
        type: "final",
        result: {
          answer: "Hola obra",
          model: "llama3.1",
          requestedModel: "llama3.1",
          fallbackUsed: false,
          warnings: [],
        },
      };
    });

    const response = await POST(
      new Request("http://localhost/api/ai/chat/stream", {
        method: "POST",
        body: JSON.stringify({
          message: "Consulta tecnica",
          projectId: "project-1",
          context: {
            route: "/projects/project-1/budgets/budget-1",
            projectId: "project-1",
            budgetId: "budget-1",
            module: "Presupuestos",
            selectedItem: "Partida de concreto",
            selectionType: "partida",
            selectionId: "partida-1",
            unit: "m3",
            currentCost: 420,
            activeTable: "presupuesto",
            viewSummary: "Partida de concreto en el presupuesto activo",
          },
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/event-stream");
    expect(response.headers.get("x-accel-buffering")).toBe("no");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    const body = await response.text();
    expect(body).toContain('event: delta\ndata: {"text":"Hola "}');
    expect(body).toContain('event: final\ndata: {"answer":"Hola obra"');
    expect(body).toContain('"historyEntry":{"id":"history-1"}');
    expect(mocks.buildChatMessages).toHaveBeenCalledWith({
      message: "Consulta tecnica",
      projectId: "project-1",
      provider: "auto",
      context: {
        route: "/projects/project-1/budgets/budget-1",
        projectId: "project-1",
        budgetId: "budget-1",
        module: "Presupuestos",
        selectedItem: "Partida de concreto",
        selectionType: "partida",
        selectionId: "partida-1",
        unit: "m3",
        currentCost: 420,
        activeTable: "presupuesto",
        viewSummary: "Partida de concreto en el presupuesto activo",
      },
    });
    expect(mocks.attachProjectHistoryEntry).toHaveBeenCalledWith({
      action: "chat",
      context: {
        route: "/projects/project-1/budgets/budget-1",
        projectId: "project-1",
        budgetId: "budget-1",
        module: "Presupuestos",
        selectedItem: "Partida de concreto",
        selectionType: "partida",
        selectionId: "partida-1",
        unit: "m3",
        currentCost: 420,
        activeTable: "presupuesto",
        viewSummary: "Partida de concreto en el presupuesto activo",
      },
      projectId: "project-1",
      result: expect.objectContaining({ answer: "Hola obra" }),
      summary: "Consulta tecnica",
      userId: "user-1",
    });
  });

  it("makes the first delta readable before the final event resolves", async () => {
    let resolveFinal: () => void = () => undefined;
    const waitForFinal = new Promise<void>((resolve) => {
      resolveFinal = resolve;
    });
    mocks.streamChatAiResponse.mockImplementation(async function* () {
      yield { type: "delta", text: "Hola " };
      await waitForFinal;
      yield {
        type: "final",
        result: {
          answer: "Hola obra",
          model: "llama3.1",
          requestedModel: "llama3.1",
          fallbackUsed: false,
          warnings: [],
        },
      };
    });

    const response = await POST(
      new Request("http://localhost/api/ai/chat/stream", {
        method: "POST",
        body: JSON.stringify({ message: "Consulta tecnica" }),
      }),
    );

    const reader = response.body?.getReader();
    expect(reader).toBeTruthy();
    const decoder = new TextDecoder();
    let firstChunk = "";

    while (!firstChunk.includes("event: delta")) {
      const nextRead = await reader?.read();
      expect(nextRead?.done).toBe(false);
      firstChunk += decoder.decode(nextRead?.value);
    }

    expect(firstChunk).toContain('event: delta\ndata: {"text":"Hola "}');
    expect(firstChunk).not.toContain("event: final");

    resolveFinal();
    reader?.releaseLock();
  });

  it("emits an error event when streaming fails after the response starts", async () => {
    mocks.streamChatAiResponse.mockImplementation(async function* () {
      yield { type: "delta", text: "Hola" };
      throw new Error("stream failed");
    });

    const response = await POST(
      new Request("http://localhost/api/ai/chat/stream", {
        method: "POST",
        body: JSON.stringify({ message: "Consulta tecnica" }),
      }),
    );

    const body = await response.text();
    expect(body).toContain('event: delta\ndata: {"text":"Hola"}');
    expect(body).toContain('event: error\ndata: {"error":"stream failed"}');
  });

  // ─── Agent provider streaming integration ─────────────────────

  it("streams agent tool-call deltas and final result through SSE", async () => {
    mocks.streamChatAiResponse.mockImplementation(async function* () {
      // Agent initial delta
      yield { type: "delta", text: "🤖 Khipu Agente iniciando con gpt-4o...\n\n" };
      // Tool call progress
      yield { type: "delta", text: "🔧 Ejecutando searchPartidas...\n" };
      yield { type: "delta", text: "  ✓ Encontré 3 partidas que coinciden" };
      // Analysis delta
      yield { type: "delta", text: "\n💭 Analizando resultados...\n\n" };
      // Final answer delta
      yield { type: "delta", text: "\nEl presupuesto contiene 3 partidas de concreto...\n" };
      // Final event from agent (streamChatAiResponse handles the final yield internally for non-agent providers,
      // but for agent the streamAgentChat yields the final event directly)
      yield {
        type: "final",
        result: {
          answer: "El presupuesto contiene 3 partidas de concreto con un costo total estimado de S/ 45,230.",
          model: "openai/gpt-4o",
          requestedModel: "openai/gpt-4o",
          fallbackUsed: false,
          warnings: [],
        },
      };
    });

    const response = await POST(
      new Request("http://localhost/api/ai/chat/stream", {
        method: "POST",
        body: JSON.stringify({
          message: "Analiza este presupuesto",
          provider: "agent",
          modelPreference: "openai/gpt-4o",
          projectId: "project-1",
          context: { module: "Presupuestos" },
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/event-stream");

    const body = await response.text();
    // Verify agent initial message
    expect(body).toContain('event: delta\ndata: {"text":"🤖 Khipu Agente iniciando con gpt-4o...');
    // Verify tool call deltas
    expect(body).toContain('event: delta\ndata: {"text":"🔧 Ejecutando searchPartidas...');
    expect(body).toContain('✓ Encontré 3 partidas que coinciden');
    // Verify analysis delta
    expect(body).toContain('💭 Analizando resultados...');
    // Verify final result
    expect(body).toContain('event: final');
    expect(body).toContain('"answer":"El presupuesto contiene 3 partidas');
    expect(body).toContain('"model":"openai/gpt-4o"');
    expect(body).toContain('"historyEntry":{"id":"history-1"}');

    // Verify provider was passed correctly to service
    expect(mocks.streamChatAiResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: "agent",
        modelPreference: "openai/gpt-4o",
      }),
    );
  });

  it("handles agent approval boundary by yielding final event with warnings", async () => {
    mocks.streamChatAiResponse.mockImplementation(async function* () {
      yield { type: "delta", text: "🤖 Khipu Agente iniciando...\n\n" };
      yield { type: "delta", text: "🔧 Ejecutando updateBudget...\n" };
      yield { type: "delta", text: "⚠️ Se requiere tu aprobación para ejecutar updateBudget\n" };
      yield {
        type: "final",
        result: {
          answer: "Se requiere aprobación para modificar el presupuesto.",
          model: "anthropic/claude-sonnet-4-20250514",
          requestedModel: "anthropic/claude-sonnet-4-20250514",
          fallbackUsed: false,
          warnings: ["Herramienta updateBudget requiere aprobación: Modificación de datos financieros"],
        },
      };
    });

    const response = await POST(
      new Request("http://localhost/api/ai/chat/stream", {
        method: "POST",
        body: JSON.stringify({
          message: "Actualiza el presupuesto",
          provider: "agent",
          modelPreference: "anthropic/claude-sonnet-4-20250514",
        }),
      }),
    );

    const body = await response.text();
    expect(body).toContain('event: final');
    expect(body).toContain('"answer":"Se requiere aprobación');
    expect(body).toContain('"model":"anthropic/claude-sonnet-4-20250514"');
    expect(body).toContain('"warnings":["Herramienta updateBudget requiere aprobación');
  });

  it("streams agent error content in final event when agent fails gracefully", async () => {
    mocks.streamChatAiResponse.mockImplementation(async function* () {
      yield { type: "delta", text: "🤖 Iniciando...\n" };
      yield { type: "delta", text: "\n❌ Error del agente: OPENROUTER_API_KEY no configurado\n" };
      yield {
        type: "final",
        result: {
          answer: "Error del agente: OPENROUTER_API_KEY no configurado",
          model: "deepseek/deepseek-chat-v3-0324:free",
          requestedModel: "deepseek/deepseek-chat-v3-0324:free",
          fallbackUsed: false,
          warnings: ["OPENROUTER_API_KEY no configurado"],
        },
      };
    });

    const response = await POST(
      new Request("http://localhost/api/ai/chat/stream", {
        method: "POST",
        body: JSON.stringify({
          message: "Test",
          provider: "agent",
        }),
      }),
    );

    const body = await response.text();
    expect(body).toContain('event: final');
    expect(body).toContain('"answer":"Error del agente: OPENROUTER_API_KEY no configurado"');
    expect(body).toContain('"warnings":["OPENROUTER_API_KEY no configurado"]');
  });

  // ─── Agent modelPreference resolution in handler ──────────────

  it("resolves agent modelPreference: user selection > system settings > undefined", async () => {
    mocks.streamChatAiResponse.mockImplementation(async function* () {
      yield {
        type: "final",
        result: {
          answer: "ok",
          model: "openai/gpt-4o",
          requestedModel: "openai/gpt-4o",
          fallbackUsed: false,
          warnings: [],
        },
      };
    });

    // System has a different model configured
    mocks.getSystemSettings.mockResolvedValue({
      openrouterModel: "openai/gpt-4o-mini",
    });

    await POST(
      new Request("http://localhost/api/ai/chat/stream", {
        method: "POST",
        body: JSON.stringify({
          message: "Test",
          provider: "agent",
          modelPreference: "anthropic/claude-sonnet-4-20250514",
        }),
      }),
    );

    // User's modelPreference wins over system settings
    expect(mocks.streamChatAiResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: "agent",
        modelPreference: "anthropic/claude-sonnet-4-20250514",
        apiKey: "sk-test-key",
      }),
    );
  });

  it("falls back to system openrouterModel when no modelPreference in body", async () => {
    mocks.streamChatAiResponse.mockImplementation(async function* () {
      yield {
        type: "final",
        result: {
          answer: "ok",
          model: "openai/gpt-4o-mini",
          requestedModel: "openai/gpt-4o-mini",
          fallbackUsed: false,
          warnings: [],
        },
      };
    });

    mocks.getSystemSettings.mockResolvedValue({
      openrouterModel: "openai/gpt-4o-mini",
    });

    await POST(
      new Request("http://localhost/api/ai/chat/stream", {
        method: "POST",
        body: JSON.stringify({
          message: "Test",
          provider: "agent",
          // No modelPreference — should use system settings
        }),
      }),
    );

    // Falls back to system openrouterModel
    expect(mocks.streamChatAiResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: "agent",
        modelPreference: "openai/gpt-4o-mini",
      }),
    );
  });

  it("passes undefined when neither modelPreference nor system settings are set", async () => {
    mocks.streamChatAiResponse.mockImplementation(async function* () {
      yield {
        type: "final",
        result: {
          answer: "ok",
          model: "deepseek/deepseek-chat-v3-0324:free",
          requestedModel: "deepseek/deepseek-chat-v3-0324:free",
          fallbackUsed: false,
          warnings: [],
        },
      };
    });

    mocks.getSystemSettings.mockResolvedValue({});

    await POST(
      new Request("http://localhost/api/ai/chat/stream", {
        method: "POST",
        body: JSON.stringify({
          message: "Test",
          provider: "agent",
          // No modelPreference, system has no openrouterModel
        }),
      }),
    );

    // modelPreference is undefined — service will use DEFAULT_AGENT_MODEL
    expect(mocks.streamChatAiResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: "agent",
        modelPreference: undefined,
      }),
    );
  });

  it("passes modelPreference through to streamChatAiResponse for agent provider", async () => {
    mocks.streamChatAiResponse.mockImplementation(async function* () {
      yield { type: "delta", text: "ok" };
      yield {
        type: "final",
        result: {
          answer: "ok",
          model: "openai/gpt-4o",
          requestedModel: "openai/gpt-4o",
          fallbackUsed: false,
          warnings: [],
        },
      };
    });

    await POST(
      new Request("http://localhost/api/ai/chat/stream", {
        method: "POST",
        body: JSON.stringify({
          message: "Test",
          provider: "agent",
          modelPreference: "openai/gpt-4o",
        }),
      }),
    );

    expect(mocks.streamChatAiResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: "agent",
        modelPreference: "openai/gpt-4o",
      }),
    );
  });
});
