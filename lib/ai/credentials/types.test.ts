import { describe, expect, it } from "vitest";
import { aiCredentialInputSchema, providerToCredentialProvider } from "@/lib/ai/credentials/types";
import { aiPolicyInputSchema, defaultAiPolicyInput, normalizePolicyForPlan } from "@/lib/ai/credentials/policy-types";

describe("scoped AI credential types", () => {
  it("accepts exactly one owner for each scope", () => {
    expect(aiCredentialInputSchema.safeParse({ scope: "USER", userId: "u1", workspaceId: null, provider: "OPENAI", apiKey: "secret" }).success).toBe(true);
    expect(aiCredentialInputSchema.safeParse({ scope: "WORKSPACE", userId: null, workspaceId: "w1", provider: "OPENAI", apiKey: "secret" }).success).toBe(true);
    expect(aiCredentialInputSchema.safeParse({ scope: "PLATFORM", userId: null, workspaceId: null, provider: "OPENAI", apiKey: "secret" }).success).toBe(true);
  });

  it("rejects mismatched scope ownership", () => {
    expect(aiCredentialInputSchema.safeParse({ scope: "USER", userId: "u1", workspaceId: "w1", provider: "OPENAI", apiKey: "secret" }).success).toBe(false);
    expect(aiCredentialInputSchema.safeParse({ scope: "PLATFORM", userId: "u1", workspaceId: null, provider: "OPENAI", apiKey: "secret" }).success).toBe(false);
  });

  it("normalizes plan restrictions instead of allowing an invalid mode", () => {
    const normalized = normalizePolicyForPlan({ ...defaultAiPolicyInput, mode: "BYOK_ONLY", allowUserKeys: true }, {
      slug: "starter",
      allowByok: false,
      allowWorkspaceKey: false,
      allowKhipuChat: false,
      allowKhipuAgent: false,
      allowAgentWrites: false,
      allowedAiProviders: [],
      allowedAiModels: [],
    });
    expect(normalized.mode).toBe("PLATFORM");
    expect(normalized.allowUserKeys).toBe(false);
  });

  it("maps agent to OpenRouter without exposing a secret", () => {
    expect(providerToCredentialProvider("agent")).toBe("OPENROUTER");
  });

  it("rejects malformed policy input", () => {
    expect(aiPolicyInputSchema.safeParse({ ...defaultAiPolicyInput, monthlyBudgetMinor: -1 }).success).toBe(false);
  });
});
