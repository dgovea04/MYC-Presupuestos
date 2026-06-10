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

import { streamChatAiResponse } from "@/lib/ai/service";

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
});
