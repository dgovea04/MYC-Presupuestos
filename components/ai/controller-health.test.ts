/* @vitest-environment jsdom */

import { describe, expect, it, vi } from "vitest";
import { loadHealth, loadCloudStatus } from "@/components/ai/controller-health";
import type { AiHealth } from "@/components/ai/use-ai-assistant-controller";

function createHealthPayload(overrides?: Partial<AiHealth>): AiHealth {
  return {
    status: "ok",
    ollamaReachable: true,
    availableModels: ["llama3"],
    requiredModels: [{ model: "llama3", installed: true, actions: ["chat", "apu"] }],
    actions: {
      chat: { model: "llama3", requestedModel: "llama3", fallbackUsed: false, warnings: [] },
      apu: { model: "llama3", requestedModel: "llama3", fallbackUsed: false, warnings: [] },
      review: { model: "llama3", requestedModel: "llama3", fallbackUsed: false, warnings: [] },
      autocomplete: { model: "llama3", requestedModel: "llama3", fallbackUsed: false, warnings: [] },
    },
    metrics: {
      chat: { latencyMs: null, lastError: null },
      apu: { latencyMs: null, lastError: null },
      review: { latencyMs: null, lastError: null },
      autocomplete: { latencyMs: null, lastError: null },
    },
    providers: {
      ollama: { configured: true, reachable: true },
      chatgpt_bridge: { configured: true, reachable: true },
      openai: { configured: false, reachable: null },
      gemini: { configured: false, reachable: null },
      openrouter: { configured: true, reachable: null },
    },
    ...overrides,
  };
}

function createResponse(body: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(body), { status }));
}

// ─── loadHealth ─────────────────────────────────────────────────

describe("loadHealth", () => {
  it("sets health and openrouter config on successful response", async () => {
    const healthPayload = createHealthPayload();
    const fetchMock = vi.fn(() => createResponse(healthPayload));
    vi.stubGlobal("fetch", fetchMock);

    let health: AiHealth | null = undefined as unknown as AiHealth | null;
    let cloudConfig = { openai: false, gemini: false, openrouter: false };

    await loadHealth(
      (h) => { health = h; },
      (fn) => { cloudConfig = fn(cloudConfig); },
    );

    expect(health).not.toBeNull();
    expect(health!.status).toBe("ok");
    expect(health!.availableModels).toContain("llama3");
    expect(cloudConfig.openrouter).toBe(true);
  });

  it("sets health to null when response is not ok", async () => {
    const fetchMock = vi.fn(() => createResponse({ error: "Down" }, 503));
    vi.stubGlobal("fetch", fetchMock);

    let health: AiHealth | null = createHealthPayload();
    await loadHealth(
      (h) => { health = h; },
      () => {},
    );

    expect(health).toBeNull();
  });

  it("sets health to null when fetch throws", async () => {
    const fetchMock = vi.fn(() => Promise.reject(new Error("Network error")));
    vi.stubGlobal("fetch", fetchMock);

    let health: AiHealth | null = createHealthPayload();
    await loadHealth(
      (h) => { health = h; },
      () => {},
    );

    expect(health).toBeNull();
  });

  it("sets health to null when payload is malformed", async () => {
    const fetchMock = vi.fn(() => createResponse({ not_health: true }));
    vi.stubGlobal("fetch", fetchMock);

    let health: AiHealth | null = createHealthPayload();
    await loadHealth(
      (h) => { health = h; },
      () => {},
    );

    expect(health).toBeNull();
  });

  it("does not set openrouter to true when provider is not configured", async () => {
    const payload = createHealthPayload({
      providers: {
        ollama: { configured: true, reachable: true },
        chatgpt_bridge: { configured: true, reachable: true },
        openai: { configured: false, reachable: null },
        gemini: { configured: false, reachable: null },
        openrouter: { configured: false, reachable: null },
      },
    });
    const fetchMock = vi.fn(() => createResponse(payload));
    vi.stubGlobal("fetch", fetchMock);

    let cloudConfig = { openai: false, gemini: false, openrouter: false };
    await loadHealth(
      () => {},
      (fn) => { cloudConfig = fn(cloudConfig); },
    );

    expect(cloudConfig.openrouter).toBe(false);
  });

  it("calls the correct health endpoint", async () => {
    const fetchMock = vi.fn(() => createResponse(createHealthPayload()));
    vi.stubGlobal("fetch", fetchMock);

    await loadHealth(() => {}, () => {});

    expect(fetchMock).toHaveBeenCalledWith("/api/ai/health");
  });

  it("preserves existing cloud config fields when updating openrouter", async () => {
    const fetchMock = vi.fn(() => createResponse(createHealthPayload()));
    vi.stubGlobal("fetch", fetchMock);

    let cloudConfig = { openai: true, gemini: true, openrouter: false };
    await loadHealth(
      () => {},
      (fn) => { cloudConfig = fn(cloudConfig); },
    );

    expect(cloudConfig.openai).toBe(true); // preserved
    expect(cloudConfig.gemini).toBe(true); // preserved
    expect(cloudConfig.openrouter).toBe(true); // updated by health
  });
});

// ─── loadCloudStatus ────────────────────────────────────────────

describe("loadCloudStatus", () => {
  it("updates all cloud config flags from response", async () => {
    const fetchMock = vi.fn(() => createResponse({
      openaiConfigured: true,
      geminiConfigured: true,
      openrouterConfigured: false,
    }));
    vi.stubGlobal("fetch", fetchMock);

    let cloudConfig = { openai: false, gemini: false, openrouter: false };
    await loadCloudStatus((fn) => { cloudConfig = fn(cloudConfig); });

    expect(cloudConfig.openai).toBe(true);
    expect(cloudConfig.gemini).toBe(true);
    expect(cloudConfig.openrouter).toBe(false);
  });

  it("preserves openrouter if it was already true", async () => {
    const fetchMock = vi.fn(() => createResponse({
      openaiConfigured: false,
      geminiConfigured: false,
      openrouterConfigured: false,
    }));
    vi.stubGlobal("fetch", fetchMock);

    let cloudConfig = { openai: false, gemini: false, openrouter: true };
    await loadCloudStatus((fn) => { cloudConfig = fn(cloudConfig); });

    expect(cloudConfig.openrouter).toBe(true); // preserved from previous state
  });

  it("does nothing when response is not ok", async () => {
    const fetchMock = vi.fn(() => createResponse({}, 500));
    vi.stubGlobal("fetch", fetchMock);

    let cloudConfig = { openai: false, gemini: false, openrouter: false };
    await loadCloudStatus((fn) => { cloudConfig = fn(cloudConfig); });

    expect(cloudConfig).toEqual({ openai: false, gemini: false, openrouter: false });
  });

  it("does nothing when fetch throws", async () => {
    const fetchMock = vi.fn(() => Promise.reject(new Error("Offline")));
    vi.stubGlobal("fetch", fetchMock);

    let cloudConfig = { openai: true, gemini: false, openrouter: false };
    await loadCloudStatus((fn) => { cloudConfig = fn(cloudConfig); });

    expect(cloudConfig).toEqual({ openai: true, gemini: false, openrouter: false });
  });

  it("does nothing when payload is not a record", async () => {
    const fetchMock = vi.fn(() => createResponse("not an object"));
    vi.stubGlobal("fetch", fetchMock);

    let cloudConfig = { openai: false, gemini: false, openrouter: false };
    await loadCloudStatus((fn) => { cloudConfig = fn(cloudConfig); });

    expect(cloudConfig).toEqual({ openai: false, gemini: false, openrouter: false });
  });

  it("calls the settings endpoint", async () => {
    const fetchMock = vi.fn(() => createResponse({ openaiConfigured: true }));
    vi.stubGlobal("fetch", fetchMock);

    await loadCloudStatus(() => {});

    expect(fetchMock).toHaveBeenCalledWith("/api/settings/ai-provider");
  });
});
