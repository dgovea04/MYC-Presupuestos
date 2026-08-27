import { describe, expect, it } from "vitest";
import { canDelegateAgent, mergeGovernancePolicies } from "@/lib/ai/governance";

const parent = {
  allowedProviders: ["OPENAI", "GEMINI"],
  allowedModels: ["gpt-4o-mini", "gemini-1.5-flash"],
  monthlyTokenLimit: 1000,
  monthlyBudgetMinor: 500,
  allowUserKeys: true,
  allowWorkspaceKey: true,
  fallbackEnabled: true,
  allowAgentWrites: true,
};

describe("AI governance", () => {
  it("prevents child policies from expanding parent capabilities", () => {
    expect(mergeGovernancePolicies(parent, {
      allowedProviders: ["OPENAI", "OPENROUTER"],
      allowedModels: ["gpt-4o-mini", "new-model"],
      monthlyTokenLimit: 2000,
      monthlyBudgetMinor: 1000,
    })).toMatchObject({
      allowedProviders: ["OPENAI"],
      allowedModels: ["gpt-4o-mini"],
      monthlyTokenLimit: 1000,
      monthlyBudgetMinor: 500,
    });
  });

  it("allows only authorized actors to delegate writable agents", () => {
    expect(canDelegateAgent({ actorRole: "ADMIN", actorUserId: "a", targetUserId: "b", allowAgentWrites: true, requiresApproval: true })).toBe(true);
    expect(canDelegateAgent({ actorRole: "EDITOR", actorUserId: "a", targetUserId: "b", allowAgentWrites: true, requiresApproval: true })).toBe(false);
    expect(canDelegateAgent({ actorRole: "OWNER", actorUserId: "a", targetUserId: "b", allowAgentWrites: false, requiresApproval: false })).toBe(false);
  });
});
