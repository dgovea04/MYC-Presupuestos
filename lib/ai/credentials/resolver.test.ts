import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  activeWorkspace: vi.fn(),
  policy: vi.fn(),
  findMany: vi.fn(),
  decrypt: vi.fn(),
  providerSettings: vi.fn(),
  systemSettings: vi.fn(),
  resolveModel: vi.fn(),
}));

vi.mock("@/lib/workspace/active-workspace", () => ({ getActiveWorkspaceId: mocks.activeWorkspace }));
vi.mock("@/lib/ai/credentials/policy-service", () => ({ getEffectiveAiPolicy: mocks.policy, assertAiPolicyAllows: vi.fn() }));
vi.mock("@/lib/ai/credentials/credential-service", () => ({ decryptStoredCredential: mocks.decrypt }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { aiCredential: { findMany: mocks.findMany } } }));
vi.mock("@/lib/data/settings", () => ({ getAiProviderSettings: mocks.providerSettings, getDecryptedOpenaiApiKey: vi.fn(), getDecryptedGeminiApiKey: vi.fn(), getDecryptedOpenrouterApiKey: vi.fn() }));
vi.mock("@/lib/data/system-settings", () => ({ getSystemSettings: mocks.systemSettings }));

import { resolveAiCredential } from "@/lib/ai/credentials/resolver";

describe("resolveAiCredential", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.activeWorkspace.mockResolvedValue("w1");
    mocks.policy.mockResolvedValue({ mode: "BYOK_ALLOWED", allowUserKeys: true, allowWorkspaceKey: true, fallbackEnabled: false, allowedProviders: ["OPENAI"], allowedModels: [], workspaceId: "w1", planSlug: "pro", canUseChat: true, canUseAgent: true, canUseByok: true, canUseWorkspaceCredential: true, userTokenLimit: 100, workspaceTokenLimit: 1000, hardLimit: true, alertThresholds: [], allowAgentWrites: false, monthlyTokenLimit: null, monthlyBudgetMinor: null, defaultProvider: "OPENAI" });
    mocks.findMany.mockResolvedValue([{ id: "c1", provider: "OPENAI", encryptedSecret: "cipher", status: "ACTIVE" }]);
    mocks.decrypt.mockReturnValue("secret");
    mocks.providerSettings.mockResolvedValue({ openaiModel: "gpt-test", geminiModel: "", openrouterModel: "" });
    mocks.systemSettings.mockResolvedValue({ openaiApiKey: null, geminiApiKey: null, openrouterApiKey: null, openaiModel: "", geminiModel: "", openrouterModel: "" });
  });

  it("resolves an owned USER credential before workspace/platform sources", async () => {
    const credential = await resolveAiCredential({ userId: "u1", workspaceId: "w1", provider: "openai", task: "chat" });
    expect(credential.credentialSource).toBe("USER");
    expect(credential.apiKey).toBe("secret");
    expect(mocks.findMany.mock.calls[0][0].where).toMatchObject({ scope: "USER", userId: "u1", workspaceId: null });
  });

  it("does not use an environment key when fallback is disabled", async () => {
    mocks.findMany.mockResolvedValue([]);
    process.env.OPENAI_API_KEY = "env-secret";
    const credential = await resolveAiCredential({ userId: "u1", workspaceId: "w1", provider: "openai", task: "chat" });
    expect(credential.apiKey).toBeNull();
    delete process.env.OPENAI_API_KEY;
  });
});
