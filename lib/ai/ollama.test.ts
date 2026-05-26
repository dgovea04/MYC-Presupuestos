import { describe, expect, it, vi } from "vitest";
import { askOllama, OllamaConnectionError, OllamaTimeoutError, parseOllamaAnswer } from "@/lib/ai/ollama";
import { AI_MODELS } from "@/lib/ai/models";

describe("Ollama service", () => {
  it("extracts assistant content from Ollama chat responses", () => {
    expect(parseOllamaAnswer({ message: { content: "Respuesta tecnica" } })).toBe("Respuesta tecnica");
  });

  it("posts typed chat requests to the local Ollama endpoint", async () => {
    const fetchImpl = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>(async () => {
      return new Response(JSON.stringify({ message: { content: "APU generado" } }), { status: 200 });
    });

    const answer = await askOllama({
      model: AI_MODELS.APU,
      messages: [{ role: "user", content: "Genera APU" }],
      fetchImpl,
    });

    expect(answer).toBe("APU generado");
    expect(fetchImpl).toHaveBeenCalledWith(
      "http://localhost:11434/api/chat",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          model: "mistral",
          messages: [{ role: "user", content: "Genera APU" }],
          stream: false,
          options: {
            temperature: 0.2,
            num_predict: 1200,
          },
        }),
      }),
    );
  });

  it("requests JSON mode from Ollama when structured output is required", async () => {
    const fetchImpl = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>(async () => {
      return new Response(JSON.stringify({ message: { content: "{\"ok\":true}" } }), { status: 200 });
    });

    await askOllama({
      model: AI_MODELS.CODE,
      messages: [{ role: "user", content: "Devuelve JSON" }],
      responseFormat: "json",
      fetchImpl,
    });

    expect(fetchImpl).toHaveBeenCalledWith(
      "http://localhost:11434/api/chat",
      expect.objectContaining({
        body: JSON.stringify({
          model: "deepseek-coder",
          messages: [{ role: "user", content: "Devuelve JSON" }],
          stream: false,
          options: {
            temperature: 0,
            num_predict: 900,
          },
          format: "json",
        }),
      }),
    );
  });

  it("returns a clear connection error when Ollama is unavailable", async () => {
    const fetchImpl = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>(async () => {
      throw new TypeError("fetch failed");
    });

    await expect(
      askOllama({
        model: AI_MODELS.CHAT,
        messages: [{ role: "user", content: "Hola" }],
        fetchImpl,
      }),
    ).rejects.toBeInstanceOf(OllamaConnectionError);
  });

  it("aborts long Ollama requests with a clear timeout error", async () => {
    const fetchImpl = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
        }),
    );

    await expect(
      askOllama({
        model: AI_MODELS.CODE,
        messages: [{ role: "user", content: "Devuelve JSON" }],
        timeoutMs: 1,
        fetchImpl,
      }),
    ).rejects.toBeInstanceOf(OllamaTimeoutError);
  });
});
