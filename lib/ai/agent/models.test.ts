import { describe, expect, it } from "vitest";
import {
  AGENT_MODELS,
  DEFAULT_AGENT_MODEL,
  COST_EMOJI,
  getAgentModelLabel,
  getAgentModelShortLabel,
  getAgentModelCostEmoji,
} from "@/lib/ai/agent/models";

// ─── AGENT_MODELS integrity ─────────────────────────────────────

describe("AGENT_MODELS", () => {
  it("has at least one free and one paid model", () => {
    const free = AGENT_MODELS.filter((m) => m.cost === "free");
    const paid = AGENT_MODELS.filter((m) => m.cost === "paid");
    expect(free.length).toBeGreaterThan(0);
    expect(paid.length).toBeGreaterThan(0);
  });

  it("has unique IDs", () => {
    const ids = AGENT_MODELS.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("DEFAULT_AGENT_MODEL exists in AGENT_MODELS", () => {
    const found = AGENT_MODELS.find((m) => m.id === DEFAULT_AGENT_MODEL);
    expect(found).toBeDefined();
  });

  it("COST_EMOJI has entries for free and paid", () => {
    expect(COST_EMOJI.free).toBe("🆓");
    expect(COST_EMOJI.paid).toBe("💲");
  });
});

// ─── getAgentModelLabel ─────────────────────────────────────────

describe("getAgentModelLabel", () => {
  it("returns the label for a valid free model ID", () => {
    expect(getAgentModelLabel("openrouter/free")).toBe("OpenRouter Free (recomendado)");
  });

  it("returns the label for a valid paid model ID", () => {
    expect(getAgentModelLabel("openai/gpt-4o")).toBe("GPT-4o");
  });

  it("returns the raw ID for an unknown model", () => {
    expect(getAgentModelLabel("unknown/model")).toBe("unknown/model");
  });

  it("returns empty string for empty ID", () => {
    expect(getAgentModelLabel("")).toBe("");
  });
});

// ─── getAgentModelShortLabel ────────────────────────────────────

describe("getAgentModelShortLabel", () => {
  it("extracts short name from openai/gpt-4o", () => {
    expect(getAgentModelShortLabel("openai/gpt-4o")).toBe("gpt-4o");
  });

  it("extracts short name from anthropic/claude-sonnet-4-20250514", () => {
    expect(getAgentModelShortLabel("anthropic/claude-sonnet-4-20250514")).toBe("claude-sonnet-4-20250514");
  });

  it("extracts short name from openrouter/free", () => {
    expect(getAgentModelShortLabel("openrouter/free")).toBe("free");
  });

  it("returns the ID unchanged if no slash", () => {
    expect(getAgentModelShortLabel("gpt-4o")).toBe("gpt-4o");
  });

  it("returns the raw ID for unknown models", () => {
    expect(getAgentModelShortLabel("unknown/model")).toBe("unknown/model");
  });

  it("returns empty string for empty ID", () => {
    expect(getAgentModelShortLabel("")).toBe("");
  });
});

// ─── getAgentModelCostEmoji ─────────────────────────────────────

describe("getAgentModelCostEmoji", () => {
  it("returns 🆓 for free models", () => {
    expect(getAgentModelCostEmoji("openrouter/free")).toBe("🆓");
    expect(getAgentModelCostEmoji("google/gemini-2.5-pro-exp-03-25:free")).toBe("🆓");
    expect(getAgentModelCostEmoji("meta-llama/llama-4-maverick:free")).toBe("🆓");
  });

  it("returns 💲 for paid models", () => {
    expect(getAgentModelCostEmoji("openai/gpt-4o")).toBe("💲");
    expect(getAgentModelCostEmoji("anthropic/claude-3.5-sonnet")).toBe("💲");
    expect(getAgentModelCostEmoji("google/gemini-2.0-flash-001")).toBe("💲");
  });

  it("returns empty string for unknown model ID", () => {
    expect(getAgentModelCostEmoji("nonexistent/model")).toBe("");
  });

  it("returns empty string for empty ID", () => {
    expect(getAgentModelCostEmoji("")).toBe("");
  });
});
