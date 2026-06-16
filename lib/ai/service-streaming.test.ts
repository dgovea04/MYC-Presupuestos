import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  assertCanUseAi: vi.fn(),
  listInstalledOllamaModels: vi.fn(),
  recordAiActionMetric: vi.fn(),
  recordAiUsage: vi.fn(),
  resolveAiModel: vi.fn(),
  streamOllamaChat: vi.fn(),
}));

vi.mock("@/lib/ai/ollama", async () => {
  const actual = await vi.importActual<typeof import("@/lib/ai/ollama")>("@/lib/ai/ollama");
  return {
    ...actual,
    listInstalledOllamaModels: mocks.listInstalledOllamaModels,
    streamOllamaChat: mocks.streamOllamaChat,
  };
});

vi.mock("@/lib/ai/models", () => ({
  resolveAiModel: mocks.resolveAiModel,
}));

vi.mock("@/lib/ai/runtime", () => ({
  recordAiActionMetric: mocks.recordAiActionMetric,
}));

vi.mock("@/lib/ai/usage", () => ({
  assertCanUseAi: mocks.assertCanUseAi,
  recordAiUsage: mocks.recordAiUsage,
}));

import { streamChatAiResponse, streamOpenAIChat, streamGeminiChat } from "@/lib/ai/service";

// --- SSE stream helpers ---

function createMockStreamResponse(chunks: string[]): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  });

  return {
    ok: true,
    status: 200,
    body: stream,
    json: async () => ({}),
    text: async () => chunks.join(""),
  } as unknown as Response;
}

function createMockErrorResponse(status: number, bodyText: string): Response {
  return {
    ok: false,
    status,
    body: null,
    json: async () => ({}),
    text: async () => bodyText,
  } as unknown as Response;
}

// --- streamChatAiResponse tests (run first, uses clean module imports) ---

describe("streamChatAiResponse", () => {
  beforeEach(() => {
    mocks.assertCanUseAi.mockReset();
    mocks.listInstalledOllamaModels.mockReset();
    mocks.recordAiActionMetric.mockReset();
    mocks.recordAiUsage.mockReset();
    mocks.resolveAiModel.mockReset();
    mocks.streamOllamaChat.mockReset();

    mocks.listInstalledOllamaModels.mockResolvedValue(["llama3.1"]);
    mocks.resolveAiModel.mockReturnValue({
      model: "llama3.1",
      requestedModel: "llama3.1",
      fallbackUsed: false,
      warnings: [],
    });
  });

  // --- Ollama tests (existing) ---

  it("yields chat deltas and returns final metadata after completion", async () => {
    mocks.streamOllamaChat.mockImplementation(async function* () {
      yield "Hola ";
      yield "obra";
    });

    const deltas: string[] = [];
    let finalResult: unknown;
    for await (const event of streamChatAiResponse({
      messages: [{ role: "user", content: "Hola" }],
      userId: "user-1",
    })) {
      if (event.type === "delta") {
        deltas.push(event.text);
      } else {
        finalResult = event.result;
      }
    }

    expect(deltas).toEqual(["Hola ", "obra"]);
    expect(finalResult).toEqual(
      expect.objectContaining({
        answer: "Hola obra",
        model: "llama3.1",
        requestedModel: "llama3.1",
        fallbackUsed: false,
        warnings: [],
      }),
    );
    expect(mocks.assertCanUseAi).toHaveBeenCalledWith({ userId: "user-1", estimatedTokens: expect.any(Number) });
    expect(mocks.recordAiUsage).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        action: "chat",
        provider: "ollama",
        model: "llama3.1",
        actualTokens: expect.any(Number),
      }),
    );
    expect(mocks.recordAiActionMetric).toHaveBeenCalledWith("chat", {
      latencyMs: expect.any(Number),
      lastError: null,
    });
  });

  it("preserves fallback metadata and warnings in the final result", async () => {
    mocks.resolveAiModel.mockReturnValue({
      model: "llama3.1",
      requestedModel: "mistral",
      fallbackUsed: true,
      warnings: ["Modelo mistral no instalado; usando llama3.1."],
    });
    mocks.streamOllamaChat.mockImplementation(async function* () {
      yield "Respuesta";
    });

    const events = [];
    for await (const event of streamChatAiResponse({
      messages: [{ role: "user", content: "Hola" }],
    })) {
      events.push(event);
    }

    expect(events.at(-1)).toEqual({
      type: "final",
      result: expect.objectContaining({
        answer: "Respuesta",
        requestedModel: "mistral",
        fallbackUsed: true,
        warnings: ["Modelo mistral no instalado; usando llama3.1."],
      }),
    });
  });

  // --- OpenAI streaming integration tests ---

  it("streams OpenAI deltas via fetchImpl mock and records usage with openai provider", async () => {
    const sseEvents = [
      'data: {"type":"response.output_text.delta","delta":"Hola "}\n\n',
      'data: {"type":"response.output_text.delta","delta":"desde OpenAI"}\n\n',
      'data: {"type":"response.output_text.delta","delta":"!"}\n\n',
      "data: [DONE]\n\n",
    ];
    const mockFetch = vi.fn().mockResolvedValue(createMockStreamResponse(sseEvents));

    const deltas: string[] = [];
    let finalResult: unknown;
    for await (const event of streamChatAiResponse({
      messages: [{ role: "user", content: "Hola" }],
      userId: "user-1",
      provider: "openai",
      apiKey: "sk-test-key",
      modelPreference: "gpt-5-mini",
      fetchImpl: mockFetch,
    })) {
      if (event.type === "delta") {
        deltas.push(event.text);
      } else {
        finalResult = event.result;
      }
    }

    expect(deltas).toEqual(["Hola ", "desde OpenAI", "!"]);
    expect(finalResult).toEqual(
      expect.objectContaining({
        answer: "Hola desde OpenAI!",
        model: "gpt-5-mini",
        requestedModel: "gpt-5-mini",
        fallbackUsed: false,
        warnings: [],
      }),
    );
    expect(mocks.recordAiUsage).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        action: "chat",
        provider: "openai",
        model: "gpt-5-mini",
        actualTokens: expect.any(Number),
      }),
    );
    expect(mocks.listInstalledOllamaModels).not.toHaveBeenCalled();
    expect(mocks.streamOllamaChat).not.toHaveBeenCalled();
  });

  it("propagates error when OpenAI apiKey is missing", async () => {
    const events: unknown[] = [];
    try {
      for await (const event of streamChatAiResponse({
        messages: [{ role: "user", content: "Hola" }],
        provider: "openai",
      })) {
        events.push(event);
      }
      expect.fail("Expected streamChatAiResponse to throw");
    } catch (error) {
      expect((error as Error).message).toContain("OPENAI_API_KEY no configurado");
    }

    expect(events).toEqual([]);
  });

  // --- Gemini streaming integration tests ---

  it("streams Gemini deltas via fetchImpl mock and records usage with gemini provider", async () => {
    const sseEvents = [
      'data: {"candidates":[{"content":{"role":"model","parts":[{"text":"Hola "}]},"finishReason":null,"index":0}]}\n\n',
      'data: {"candidates":[{"content":{"role":"model","parts":[{"text":"desde Gemini"}]},"finishReason":null,"index":0}]}\n\n',
      'data: {"candidates":[{"content":{"role":"model","parts":[{"text":"!"}]},"finishReason":"STOP","index":0}]}\n\n',
    ];
    const mockFetch = vi.fn().mockResolvedValue(createMockStreamResponse(sseEvents));

    const deltas: string[] = [];
    let finalResult: unknown;
    for await (const event of streamChatAiResponse({
      messages: [{ role: "user", content: "Hola" }],
      userId: "user-1",
      provider: "gemini",
      apiKey: "gemini-test-key",
      modelPreference: "gemini-2.5-flash",
      fetchImpl: mockFetch,
    })) {
      if (event.type === "delta") {
        deltas.push(event.text);
      } else {
        finalResult = event.result;
      }
    }

    expect(deltas).toEqual(["Hola ", "desde Gemini", "!"]);
    expect(finalResult).toEqual(
      expect.objectContaining({
        answer: "Hola desde Gemini!",
        model: "gemini-2.5-flash",
        requestedModel: "gemini-2.5-flash",
        fallbackUsed: false,
        warnings: [],
      }),
    );
    expect(mocks.recordAiUsage).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        action: "chat",
        provider: "gemini",
        model: "gemini-2.5-flash",
        actualTokens: expect.any(Number),
      }),
    );
    expect(mocks.listInstalledOllamaModels).not.toHaveBeenCalled();
    expect(mocks.streamOllamaChat).not.toHaveBeenCalled();
  });

  it("propagates error when Gemini apiKey is missing", async () => {
    const events: unknown[] = [];
    try {
      for await (const event of streamChatAiResponse({
        messages: [{ role: "user", content: "Hola" }],
        provider: "gemini",
      })) {
        events.push(event);
      }
      expect.fail("Expected streamChatAiResponse to throw");
    } catch (error) {
      expect((error as Error).message).toContain("GEMINI_API_KEY no configurado");
    }

    expect(events).toEqual([]);
  });

  it("routes to Ollama when provider is not recognized", async () => {
    mocks.streamOllamaChat.mockImplementation(async function* () {
      yield "Ollama fallback";
    });

    const events = [];
    for await (const event of streamChatAiResponse({
      messages: [{ role: "user", content: "Hola" }],
      provider: "chatgpt_bridge",
    })) {
      events.push(event);
    }

    expect(events.at(-1)).toEqual({
      type: "final",
      result: expect.objectContaining({
        answer: "Ollama fallback",
        model: "llama3.1",
      }),
    });
    expect(mocks.streamOllamaChat).toHaveBeenCalled();
  });
});

// --- Direct unit tests for streamOpenAIChat with fetchImpl mock ---

describe("streamOpenAIChat", () => {
  it("yields text chunks from OpenAI SSE events", async () => {
    const sseEvents = [
      'data: {"type":"response.output_text.delta","delta":"Hola "}\n\n',
      'data: {"type":"response.output_text.delta","delta":"desde OpenAI"}\n\n',
      'data: {"type":"response.output_text.delta","delta":"!"}\n\n',
      "data: [DONE]\n\n",
    ];
    const mockFetch = vi.fn().mockResolvedValue(createMockStreamResponse(sseEvents));

    const chunks: string[] = [];
    for await (const text of streamOpenAIChat({
      messages: [{ role: "user", content: "Hola" }],
      apiKey: "sk-test",
      fetchImpl: mockFetch,
    })) {
      chunks.push(text);
    }

    expect(chunks).toEqual(["Hola ", "desde OpenAI", "!"]);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("api.openai.com"),
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer sk-test",
        }),
      }),
    );
  });

  it("ignores non-delta SSE events", async () => {
    const sseEvents = [
      'data: {"type":"response.created","response":{"id":"123"}}\n\n',
      'data: {"type":"response.output_text.delta","delta":"Hola"}\n\n',
      'data: {"type":"response.output_text.delta","delta":" mundo"}\n\n',
      'data: {"type":"response.completed","response":{"id":"123"}}\n\n',
      "data: [DONE]\n\n",
    ];
    const mockFetch = vi.fn().mockResolvedValue(createMockStreamResponse(sseEvents));

    const chunks: string[] = [];
    for await (const text of streamOpenAIChat({
      messages: [{ role: "user", content: "Hola" }],
      apiKey: "sk-test",
      fetchImpl: mockFetch,
    })) {
      chunks.push(text);
    }

    expect(chunks).toEqual(["Hola", " mundo"]);
  });

  it("throws on non-ok HTTP response", async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      createMockErrorResponse(401, "Invalid API key"),
    );

    const chunks: string[] = [];
    try {
      for await (const text of streamOpenAIChat({
        messages: [{ role: "user", content: "Hola" }],
        apiKey: "sk-bad",
        fetchImpl: mockFetch,
      })) {
        chunks.push(text);
      }
      expect.fail("Expected streamOpenAIChat to throw");
    } catch (error) {
      expect((error as Error).message).toContain("401");
      expect((error as Error).message).toContain("Invalid API key");
    }

    expect(chunks).toEqual([]);
  });

  it("throws when response body is null", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      body: null,
    } as Response);

    const chunks: string[] = [];
    try {
      for await (const text of streamOpenAIChat({
        messages: [{ role: "user", content: "Hola" }],
        apiKey: "sk-test",
        fetchImpl: mockFetch,
      })) {
        chunks.push(text);
      }
      expect.fail("Expected streamOpenAIChat to throw");
    } catch (error) {
      expect((error as Error).message).toContain("no devolvio un stream");
    }

    expect(chunks).toEqual([]);
  });

  it("throws connection error when fetch rejects", async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error("Network error"));

    const chunks: string[] = [];
    try {
      for await (const text of streamOpenAIChat({
        messages: [{ role: "user", content: "Hola" }],
        apiKey: "sk-test",
        fetchImpl: mockFetch,
      })) {
        chunks.push(text);
      }
      expect.fail("Expected streamOpenAIChat to throw");
    } catch (error) {
      expect((error as Error).message).toContain("No se pudo conectar con OpenAI");
    }

    expect(chunks).toEqual([]);
  });
});

// --- Direct unit tests for streamGeminiChat with fetchImpl mock ---

describe("streamGeminiChat", () => {
  it("yields text chunks from Gemini SSE events", async () => {
    const sseEvents = [
      'data: {"candidates":[{"content":{"role":"model","parts":[{"text":"Hola "}]},"finishReason":null,"index":0}]}\n\n',
      'data: {"candidates":[{"content":{"role":"model","parts":[{"text":"desde Gemini"}]},"finishReason":null,"index":0}]}\n\n',
      'data: {"candidates":[{"content":{"role":"model","parts":[{"text":"!"}]},"finishReason":"STOP","index":0}]}\n\n',
    ];
    const mockFetch = vi.fn().mockResolvedValue(createMockStreamResponse(sseEvents));

    const chunks: string[] = [];
    for await (const text of streamGeminiChat({
      messages: [{ role: "user", content: "Hola" }],
      apiKey: "gemini-key",
      fetchImpl: mockFetch,
    })) {
      chunks.push(text);
    }

    expect(chunks).toEqual(["Hola ", "desde Gemini", "!"]);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("generativelanguage.googleapis.com"),
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
        }),
      }),
    );
  });

  it("concatenates multiple text parts within one SSE event", async () => {
    const sseEvents = [
      'data: {"candidates":[{"content":{"role":"model","parts":[{"text":"Parte 1 "},{"text":"Parte 2"}]},"finishReason":null,"index":0}]}\n\n',
    ];
    const mockFetch = vi.fn().mockResolvedValue(createMockStreamResponse(sseEvents));

    const chunks: string[] = [];
    for await (const text of streamGeminiChat({
      messages: [{ role: "user", content: "Hola" }],
      apiKey: "gemini-key",
      fetchImpl: mockFetch,
    })) {
      chunks.push(text);
    }

    expect(chunks).toEqual(["Parte 1 Parte 2"]);
  });

  it("skips candidates without text parts", async () => {
    const sseEvents = [
      'data: {"candidates":[{"content":{"role":"model"},"finishReason":"SAFETY","index":0}]}\n\n',
      'data: {"candidates":[{"content":{"role":"model","parts":[{"text":"Texto valido"}]},"finishReason":null,"index":0}]}\n\n',
    ];
    const mockFetch = vi.fn().mockResolvedValue(createMockStreamResponse(sseEvents));

    const chunks: string[] = [];
    for await (const text of streamGeminiChat({
      messages: [{ role: "user", content: "Hola" }],
      apiKey: "gemini-key",
      fetchImpl: mockFetch,
    })) {
      chunks.push(text);
    }

    expect(chunks).toEqual(["Texto valido"]);
  });

  it("throws on non-ok HTTP response", async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      createMockErrorResponse(403, "API key not valid"),
    );

    const chunks: string[] = [];
    try {
      for await (const text of streamGeminiChat({
        messages: [{ role: "user", content: "Hola" }],
        apiKey: "bad-key",
        fetchImpl: mockFetch,
      })) {
        chunks.push(text);
      }
      expect.fail("Expected streamGeminiChat to throw");
    } catch (error) {
      expect((error as Error).message).toContain("403");
      expect((error as Error).message).toContain("API key not valid");
    }

    expect(chunks).toEqual([]);
  });

  it("throws when response body is null", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      body: null,
    } as Response);

    const chunks: string[] = [];
    try {
      for await (const text of streamGeminiChat({
        messages: [{ role: "user", content: "Hola" }],
        apiKey: "gemini-key",
        fetchImpl: mockFetch,
      })) {
        chunks.push(text);
      }
      expect.fail("Expected streamGeminiChat to throw");
    } catch (error) {
      expect((error as Error).message).toContain("no devolvio un stream");
    }

    expect(chunks).toEqual([]);
  });

  it("throws connection error when fetch rejects", async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error("Network down"));

    const chunks: string[] = [];
    try {
      for await (const text of streamGeminiChat({
        messages: [{ role: "user", content: "Hola" }],
        apiKey: "gemini-key",
        fetchImpl: mockFetch,
      })) {
        chunks.push(text);
      }
      expect.fail("Expected streamGeminiChat to throw");
    } catch (error) {
      expect((error as Error).message).toContain("No se pudo conectar con Gemini");
    }

    expect(chunks).toEqual([]);
  });
});
