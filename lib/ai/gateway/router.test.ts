import { describe, expect, it } from "vitest";
import { getProviderFallbackChain, resolveAiProvider } from "@/lib/ai/gateway/router";
import { stableHash } from "@/lib/ai/gateway/hash";
import { afterEach, vi } from "vitest";

describe("AI gateway router", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("routes auto provider by task without leaking provider choices into routes", () => {
    expect(resolveAiProvider({ provider: "auto", task: "autocomplete" })).toBe("ollama");
    expect(resolveAiProvider({ provider: "auto", task: "suggest_insumos" })).toBe("ollama");
    expect(resolveAiProvider({ provider: "auto", task: "review_budget" })).toBe("openai");
    expect(resolveAiProvider({ provider: "auto", task: "review_apu" })).toBe("openai");
    expect(resolveAiProvider({ provider: "auto", task: "montecarlo_risk_analysis" })).toBe("gemini");
    expect(resolveAiProvider({ provider: "auto", task: "pdf_import_structure" })).toBe("openai");
  });

  it("keeps explicit provider selections exact", () => {
    expect(resolveAiProvider({ provider: "ollama", task: "review_budget" })).toBe("ollama");
    expect(resolveAiProvider({ provider: "gemini", task: "autocomplete" })).toBe("gemini");
  });

  it("removes local Ollama from automatic production routing", () => {
    vi.stubEnv("NODE_ENV", "production");

    expect(resolveAiProvider({ provider: "auto", task: "autocomplete" })).toBe("openai");
    expect(getProviderFallbackChain({ provider: "auto", task: "review_budget" })).toEqual(["openai", "gemini"]);
    expect(getProviderFallbackChain({ provider: "auto", task: "montecarlo_risk_analysis" })).toEqual(["gemini", "openai"]);
  });

  it("uses the PRD fallback chain only for auto cloud routes", () => {
    expect(getProviderFallbackChain({ provider: "auto", task: "review_budget" })).toEqual(["openai", "gemini", "ollama"]);
    expect(getProviderFallbackChain({ provider: "auto", task: "autocomplete" })).toEqual(["ollama"]);
    expect(getProviderFallbackChain({ provider: "gemini", task: "review_budget" })).toEqual(["gemini"]);
  });

  it("hashes objects deterministically regardless of key order", () => {
    expect(stableHash({ b: 2, a: { d: 4, c: 3 } })).toBe(stableHash({ a: { c: 3, d: 4 }, b: 2 }));
    expect(stableHash({ b: 2, a: { d: 4, c: 3 } })).not.toBe(stableHash({ a: { c: 3, d: 5 }, b: 2 }));
  });
});
