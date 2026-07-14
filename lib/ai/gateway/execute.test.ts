import { describe, expect, it, vi } from "vitest";

// ── Hoisted mocks ──────────────────────────────────────────────────────────
const mocks = vi.hoisted(() => ({
  getSystemSettings: vi.fn(),
}));

vi.mock("@/lib/data/system-settings", () => ({
  getSystemSettings: mocks.getSystemSettings,
}));

// Default empty system-settings response so tests don't hit the DB for the
// newly-added agentModel column (which isn't yet in the test DB).
const EMPTY_SYSTEM_SETTINGS = {
  openaiApiKey: "",
  geminiApiKey: "",
  openrouterApiKey: "",
  openaiApiKeyMasked: "",
  geminiApiKeyMasked: "",
  openrouterApiKeyMasked: "",
  openaiModel: "",
  geminiModel: "",
  openrouterModel: "",
  agentModel: "",
  openaiConfigured: false,
  geminiConfigured: false,
  openrouterConfigured: false,
};

import { executeAiTask } from "@/lib/ai/gateway/execute";

describe("executeAiTask", () => {
  // Default the system-settings mock to empty before each test so the runtime
  // fallback chain (settings → system) short-circuits consistently across
  // existing tests, since they neither expect nor assert on systemSettings.
  mocks.getSystemSettings.mockResolvedValue(EMPTY_SYSTEM_SETTINGS);

  it("builds assembled context and falls back from unavailable cloud providers to Ollama in auto mode", async () => {
    const openai = vi.fn().mockRejectedValue(new Error("OPENAI_API_KEY no configurado"));
    const gemini = vi.fn().mockRejectedValue(new Error("GEMINI_API_KEY no configurado"));
    const ollama = vi.fn().mockResolvedValue({
      answer: "Revision tecnica",
      model: "llama3.1",
      requestedModel: "llama3.1",
      fallbackUsed: false,
      warnings: [],
    });
    const buildContext = vi.fn().mockResolvedValue({
      projectContext: "Proyecto: Hospital Norte",
      projectHistory: [],
      projectMemory: [],
      retrievalEvidence: [],
      userRequest: {
        task: "review_budget",
        payload: { budgetSummary: "Partida de concreto" },
      },
    });

    const result = await executeAiTask({
      provider: "auto",
      task: "review_budget",
      payload: { budgetSummary: "Partida de concreto" },
      projectId: "project-1",
      userId: "user-1",
      deps: {
        buildKhipuAssembledContext: buildContext,
        providers: {
          openai,
          gemini,
          ollama,
        },
      },
    });

    expect(openai).toHaveBeenCalledOnce();
    expect(gemini).toHaveBeenCalledOnce();
    expect(ollama).toHaveBeenCalledOnce();
    expect(ollama.mock.calls[0]?.[0].messages.map((message) => message.content).join("\n")).toContain("Proyecto: Hospital Norte");
    expect(result).toMatchObject({
      answer: "Revision tecnica",
      provider: "ollama",
      promptHash: expect.any(String),
      responseHash: expect.any(String),
    });
  });

  it("keeps explicit provider execution exact", async () => {
    const ollama = vi.fn().mockResolvedValue({
      answer: "Autocomplete",
      model: "mistral",
      requestedModel: "mistral",
      fallbackUsed: false,
      warnings: [],
    });

    await executeAiTask({
      provider: "ollama",
      task: "autocomplete",
      payload: { input: "Concreto armado" },
      userId: "user-1",
      deps: {
        buildKhipuAssembledContext: vi.fn().mockResolvedValue({
          projectContext: "",
          projectHistory: [],
          projectMemory: [],
          retrievalEvidence: [],
          userRequest: {
            task: "autocomplete",
            payload: { input: "Concreto armado" },
          },
        }),
        providers: {
          ollama,
        },
      },
    });

    expect(ollama).toHaveBeenCalledOnce();
  });
});
