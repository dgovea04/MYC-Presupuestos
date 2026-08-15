import { describe, expect, it } from "vitest";
import { AI_MODELS, AI_REQUIRED_MODELS, resolveAiModel, summarizeAvailableModels } from "@/lib/ai/models";
import { getAiHealth } from "@/lib/ai/runtime";

describe("AI model runtime", () => {
  it("keeps the requested model when it is available", () => {
    const resolution = resolveAiModel("chat", ["llama3.1", "mistral"]);

    expect(resolution).toEqual({
      action: "chat",
      requestedModel: AI_MODELS.CHAT,
      model: AI_MODELS.CHAT,
      fallbackUsed: false,
      warnings: [],
    });
  });

  it("falls back to llama3.1 when mistral is missing for APU actions", () => {
    const resolution = resolveAiModel("apu", ["llama3.1"]);

    expect(resolution.requestedModel).toBe("mistral");
    expect(resolution.model).toBe("llama3.1");
    expect(resolution.fallbackUsed).toBe(true);
    expect(resolution.warnings[0]).toContain("mistral");
    expect(resolution.warnings[0]).toContain("llama3.1");
  });

  it("throws a functional error when neither the requested model nor its fallback is installed", () => {
    expect(() => resolveAiModel("autocomplete", ["deepseek-coder"])).toThrowError(
      "Falta instalar mistral en Ollama para autocomplete. Tambien se intento usar llama3.1 como fallback, pero no esta disponible.",
    );
  });

  it("uses qwen2.5-coder:7b for structured JSON generation when available", () => {
    const resolution = resolveAiModel("json", ["qwen2.5-coder:7b", "deepseek-coder", "mistral"]);

    expect(resolution).toEqual({
      action: "json",
      requestedModel: AI_MODELS.QWEN_CODE,
      model: AI_MODELS.QWEN_CODE,
      fallbackUsed: false,
      warnings: [],
    });
  });

  it("falls back to deepseek-coder when qwen2.5-coder:7b is missing for structured JSON generation", () => {
    const resolution = resolveAiModel("json", ["deepseek-code:latest", "mistral"]);

    expect(resolution.model).toBe(AI_MODELS.CODE);
    expect(resolution.requestedModel).toBe(AI_MODELS.QWEN_CODE);
    expect(resolution.fallbackUsed).toBe(true);
  });

  it("accepts qwen2.5-coder without a tag as the 7b default for structured JSON generation", () => {
    const resolution = resolveAiModel("json", ["qwen2.5-coder:latest", "mistral"]);

    expect(resolution.model).toBe(AI_MODELS.QWEN_CODE);
    expect(resolution.fallbackUsed).toBe(false);
  });

  it("accepts deepseek-code as an Ollama alias for the JSON fallback model", () => {
    expect(resolveAiModel("json", ["deepseek-code:latest"]).model).toBe(AI_MODELS.CODE);
  });

  it("uses qwen2.5-coder:7b for review budget when available", () => {
    const resolution = resolveAiModel("review", ["qwen2.5-coder:7b", "deepseek-coder", "llama3.1"]);

    expect(resolution).toEqual({
      action: "review",
      requestedModel: AI_MODELS.REVIEW,
      model: AI_MODELS.REVIEW,
      fallbackUsed: false,
      warnings: [],
    });
  });

  it("falls back to deepseek-coder when qwen2.5-coder:7b is missing for review budget", () => {
    const resolution = resolveAiModel("review", ["deepseek-code:latest", "llama3.1"]);

    expect(resolution.model).toBe(AI_MODELS.CODE);
    expect(resolution.requestedModel).toBe(AI_MODELS.REVIEW);
    expect(resolution.fallbackUsed).toBe(true);
    expect(resolution.warnings[0]).toContain("qwen2.5-coder:7b");
    expect(resolution.warnings[0]).toContain("deepseek-coder");
  });

  it("throws a functional error when neither qwen2.5-coder:7b nor its fallback is installed for review", () => {
    expect(() => resolveAiModel("review", ["mistral"])).toThrowError(
      "Falta instalar qwen2.5-coder:7b en Ollama para review. Tambien se intento usar deepseek-coder como fallback, pero no esta disponible.",
    );
  });

  it("accepts qwen2.5-coder:latest as the 7b model for review", () => {
    const resolution = resolveAiModel("review", ["qwen2.5-coder:latest"]);

    expect(resolution.model).toBe(AI_MODELS.QWEN_CODE);
    expect(resolution.fallbackUsed).toBe(false);
  });

  it("accepts deepseek-code as an Ollama alias for the review fallback model", () => {
    const resolution = resolveAiModel("review", ["deepseek-code:latest", "llama3.1"]);

    expect(resolution.model).toBe(AI_MODELS.CODE);
    expect(resolution.fallbackUsed).toBe(true);
  });

  it("does not fall back to mistral for structured JSON generation", () => {
    expect(() => resolveAiModel("json", ["mistral"])).toThrowError(
      "Falta instalar qwen2.5-coder:7b en Ollama para json. Tambien se intento usar deepseek-coder como fallback, pero no esta disponible.",
    );
  });

  it("reports required models with installation status for the diagnostics panel", () => {
    expect(summarizeAvailableModels(["llama3.1", "llama3.2:3b"])).toEqual([
      { model: "llama3.1", installed: true, actions: ["chat", "apu", "autocomplete"] },
      { model: "mistral", installed: false, actions: ["apu", "autocomplete"] },
      { model: "qwen2.5-coder:7b", installed: false, actions: ["review", "json"] },
      { model: "deepseek-coder", installed: false, actions: ["review", "json"] },
    ]);

    expect(AI_REQUIRED_MODELS).toEqual(["llama3.1", "mistral", "qwen2.5-coder:7b", "deepseek-coder"]);
  });

  it("reports multi-provider health and auto routing without removing Ollama diagnostics", async () => {
    const fetchImpl = async () =>
      new Response(
        JSON.stringify({
          models: [{ name: "llama3.1" }, { name: "mistral" }, { name: "qwen2.5-coder:7b" }, { name: "deepseek-coder" }],
        }),
      );

    const health = await getAiHealth(fetchImpl);

    expect(health.providers).toEqual({
      ollama: { configured: true, reachable: true },
      openai: { configured: false, reachable: null },
      gemini: { configured: false, reachable: null },
      openrouter: { configured: expect.any(Boolean), reachable: null },
      agent: { configured: false, reachable: null },
      chatgpt_bridge: { configured: true, reachable: null },
    });
    expect(health.routing.review_budget).toEqual(["openai", "gemini", "ollama"]);
    expect(health.routing.autocomplete).toEqual(["ollama"]);
    expect(health.availableModels).toEqual(["llama3.1", "mistral", "qwen2.5-coder:7b", "deepseek-coder"]);
  });
});
