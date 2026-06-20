import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/session", () => ({
  getAuthSession: vi.fn(),
}));

vi.mock("@/lib/ai/runtime", () => ({
  getAiHealth: vi.fn(),
}));

vi.mock("@/lib/billing/entitlements", () => ({
  assertFeatureAccess: vi.fn(),
}));

import { GET } from "@/app/api/ai/health/route";
import { getAuthSession } from "@/lib/auth/session";
import { getAiHealth } from "@/lib/ai/runtime";
import { assertFeatureAccess } from "@/lib/billing/entitlements";

describe("GET /api/ai/health", () => {
  it("returns 401 when unauthenticated", async () => {
    vi.mocked(getAuthSession).mockResolvedValue(null);

    const response = await GET();

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" });
  });

  it("returns Ollama diagnostics with model availability", async () => {
    vi.mocked(getAuthSession).mockResolvedValue({ expires: new Date().toISOString(), user: { id: "user-1" } });
    vi.mocked(assertFeatureAccess).mockResolvedValue(undefined);
    vi.mocked(getAiHealth).mockResolvedValue({
      status: "degraded",
      ollamaReachable: true,
      availableModels: ["llama3.1", "llama3.2:3b"],
      requiredModels: [
        { model: "llama3.1", installed: true, actions: ["chat", "review", "apu", "autocomplete"] },
        { model: "mistral", installed: false, actions: ["apu", "autocomplete"] },
        { model: "deepseek-coder", installed: false, actions: [] },
      ],
      actions: {
        chat: {
          requestedModel: "llama3.1",
          model: "llama3.1",
          fallbackUsed: false,
          warnings: [],
        },
        apu: {
          requestedModel: "mistral",
          model: "llama3.1",
          fallbackUsed: true,
          warnings: ["Falta instalar mistral en Ollama para apu. Se usa llama3.1 como fallback local."],
        },
        review: {
          requestedModel: "llama3.1",
          model: "llama3.1",
          fallbackUsed: false,
          warnings: [],
        },
        autocomplete: {
          requestedModel: "mistral",
          model: "llama3.1",
          fallbackUsed: true,
          warnings: ["Falta instalar mistral en Ollama para autocomplete. Se usa llama3.1 como fallback local."],
        },
      },
      metrics: {
        chat: { latencyMs: 1200, lastError: null },
        apu: { latencyMs: 1800, lastError: "Falta instalar mistral en Ollama para apu. Se usa llama3.1 como fallback local." },
        review: { latencyMs: null, lastError: null },
        autocomplete: { latencyMs: null, lastError: null },
      },
    });

    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      status: "degraded",
      ollamaReachable: true,
      actions: {
        apu: {
          model: "llama3.1",
          fallbackUsed: true,
        },
      },
    });
  });
});
