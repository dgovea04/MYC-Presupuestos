import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  license: vi.fn(),
  policyFindUnique: vi.fn(),
  planFindUnique: vi.fn(),
  requireRole: vi.fn(),
  upsert: vi.fn(),
}));

vi.mock("@/lib/workspace/entitlements", () => ({ getEffectiveWorkspaceLicense: mocks.license }));
vi.mock("@/lib/workspace/authorization", () => ({ requireWorkspaceRole: mocks.requireRole }));
vi.mock("next/cache", () => ({ revalidateTag: vi.fn() }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { aiPolicy: { findUnique: mocks.policyFindUnique, upsert: mocks.upsert }, membershipPlan: { findUnique: mocks.planFindUnique } } }));

import { AiPolicyAccessError, assertAiPolicyAllows, getEffectiveAiPolicy } from "@/lib/ai/credentials/policy-service";
import { defaultAiPolicyInput } from "@/lib/ai/credentials/policy-types";

describe("AI policy service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.license.mockResolvedValue({ planSlug: "pro", availableFeatures: ["ai.local", "khipu.agent"] });
    mocks.policyFindUnique.mockResolvedValue(null);
    mocks.planFindUnique.mockResolvedValue({ allowByok: true, allowWorkspaceKey: true, allowKhipuChat: true, allowKhipuAgent: true, allowAgentWrites: true, allowedAiProviders: [], allowedAiModels: [], userAiTokenLimit: 1000, workspaceAiTokenLimit: 5000 });
    mocks.requireRole.mockResolvedValue(undefined);
  });

  it("rejects users without an active workspace license", async () => {
    mocks.license.mockResolvedValue(null);
    await expect(getEffectiveAiPolicy({ userId: "u1", workspaceId: "w1" })).rejects.toBeInstanceOf(AiPolicyAccessError);
  });

  it("derives effective capabilities from the membership plan", async () => {
    const policy = await getEffectiveAiPolicy({ userId: "u1", workspaceId: "w1" });
    expect(policy.workspaceId).toBe("w1");
    expect(policy.canUseChat).toBe(true);
    expect(policy.workspaceTokenLimit).toBe(5000);
  });

  it("blocks disabled tasks, providers, and models", async () => {
    const policy = { ...defaultAiPolicyInput, workspaceId: "w1", planSlug: "starter", canUseChat: false, canUseAgent: false, canUseByok: false, canUseWorkspaceCredential: false, userTokenLimit: null, workspaceTokenLimit: null };
    await expect(assertAiPolicyAllows({ policy, provider: "OPENAI", task: "chat" })).rejects.toBeInstanceOf(AiPolicyAccessError);
    await expect(assertAiPolicyAllows({ policy: { ...policy, canUseChat: true, allowedProviders: ["GEMINI"] }, provider: "OPENAI", task: "chat" })).rejects.toBeInstanceOf(AiPolicyAccessError);
    await expect(assertAiPolicyAllows({ policy: { ...policy, canUseChat: true, allowedModels: ["allowed"] }, provider: "GEMINI", task: "chat", model: "blocked" })).rejects.toBeInstanceOf(AiPolicyAccessError);
  });
});
