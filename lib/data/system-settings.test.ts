import { beforeEach, describe, expect, it, vi } from "vitest";

const { findUniqueMock, upsertMock } = vi.hoisted(() => ({
  findUniqueMock: vi.fn(),
  upsertMock: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    systemSettings: {
      findUnique: findUniqueMock,
      upsert: upsertMock,
    },
  },
}));

const { encryptApiKeyMock, decryptApiKeyMock, maskApiKeyMock } = vi.hoisted(() => ({
  encryptApiKeyMock: vi.fn(),
  decryptApiKeyMock: vi.fn(),
  maskApiKeyMock: vi.fn(),
}));

vi.mock("@/lib/ai/encryption", () => ({
  encryptApiKey: encryptApiKeyMock,
  decryptApiKey: decryptApiKeyMock,
  maskApiKey: maskApiKeyMock,
}));

import {
  getSystemSettings,
  updateSystemSettings,
  getDecryptedSystemOpenaiApiKey,
  getDecryptedSystemGeminiApiKey,
  getDecryptedSystemOpenrouterApiKey,
} from "@/lib/data/system-settings";

function mockEncryption() {
  encryptApiKeyMock.mockImplementation((plaintext: string) => `encrypted:${plaintext}`);
  decryptApiKeyMock.mockImplementation((ciphertext: string) => {
    if (!ciphertext) return "";
    if (ciphertext.startsWith("encrypted:")) return ciphertext.slice("encrypted:".length);
    return ciphertext;
  });
  maskApiKeyMock.mockImplementation((key: string) => {
    if (!key) return "";
    if (key.length <= 8) return `${key.slice(0, 3)}...`;
    return `${key.slice(0, 4)}...${key.slice(-4)}`;
  });
}

function defaultSettingsRow(overrides?: Partial<{
  singletonKey: string;
  openaiApiKey: string | null;
  geminiApiKey: string | null;
  openrouterApiKey: string | null;
  openaiModel: string | null;
  geminiModel: string | null;
  openrouterModel: string | null;
  agentModel: string | null;
}>) {
  return {
    singletonKey: "system",
    openaiApiKey: null,
    geminiApiKey: null,
    openrouterApiKey: null,
    openaiModel: null,
    geminiModel: null,
    openrouterModel: null,
    agentModel: null,
    ...overrides,
  };
}

describe("system settings data", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEncryption();
  });

  describe("getSystemSettings", () => {
    it("returns empty defaults when no settings row exists", async () => {
      findUniqueMock.mockResolvedValue(null);

      const result = await getSystemSettings();

      expect(result).toEqual({
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
      });
      expect(findUniqueMock).toHaveBeenCalledWith({
        where: { singletonKey: "system" },
      });
    });

    it("returns settings with decrypted and masked keys", async () => {
      findUniqueMock.mockResolvedValue(
        defaultSettingsRow({
          openaiApiKey: "encrypted:sk-test-key",
          geminiApiKey: "encrypted:ai-test-key",
          openrouterApiKey: "encrypted:sk-or-test-key",
          openaiModel: "gpt-5-mini",
          geminiModel: "gemini-2.5-flash",
          openrouterModel: "deepseek/deepseek-chat-v3-0324:free",
          agentModel: "google/gemini-2.5-flash",
        }),
      );

      const result = await getSystemSettings();

      expect(result).toEqual({
        openaiApiKey: "sk-test-key",
        geminiApiKey: "ai-test-key",
        openrouterApiKey: "sk-or-test-key",
        openaiApiKeyMasked: "sk-t...-key",
        geminiApiKeyMasked: "ai-t...-key",
        openrouterApiKeyMasked: "sk-o...-key",
        openaiModel: "gpt-5-mini",
        geminiModel: "gemini-2.5-flash",
        openrouterModel: "deepseek/deepseek-chat-v3-0324:free",
        agentModel: "google/gemini-2.5-flash",
        openaiConfigured: true,
        geminiConfigured: true,
        openrouterConfigured: true,
      });
    });

    it("returns not configured when keys are empty", async () => {
      findUniqueMock.mockResolvedValue(
        defaultSettingsRow({
          openaiApiKey: "",
          geminiApiKey: "",
          openrouterApiKey: "",
        }),
      );

      const result = await getSystemSettings();

      expect(result.openaiConfigured).toBe(false);
      expect(result.geminiConfigured).toBe(false);
      expect(result.openrouterConfigured).toBe(false);
      expect(result.openaiApiKey).toBe("");
      expect(result.geminiApiKey).toBe("");
      expect(result.openrouterApiKey).toBe("");
      expect(result.openaiApiKeyMasked).toBe("");
      expect(result.geminiApiKeyMasked).toBe("");
      expect(result.openrouterApiKeyMasked).toBe("");
    });

    it("returns model fields when keys are absent", async () => {
      findUniqueMock.mockResolvedValue(
        defaultSettingsRow({
          openaiModel: "custom-model",
          geminiModel: null,
          openrouterModel: "custom-openrouter",
          agentModel: "openrouter/free",
        }),
      );

      const result = await getSystemSettings();

      expect(result.openaiApiKey).toBe("");
      expect(result.geminiApiKey).toBe("");
      expect(result.openrouterApiKey).toBe("");
      expect(result.openaiModel).toBe("custom-model");
      expect(result.geminiModel).toBe("");
      expect(result.openrouterModel).toBe("custom-openrouter");
      expect(result.agentModel).toBe("openrouter/free");
      expect(result.openaiConfigured).toBe(false);
    });
  });

  describe("updateSystemSettings", () => {
    it("creates a new settings row with encrypted keys", async () => {
      upsertMock.mockResolvedValue(
        defaultSettingsRow({
          openaiApiKey: "encrypted:sk-new-key",
          geminiApiKey: "encrypted:ai-new-key",
          openrouterApiKey: "encrypted:sk-or-new-key",
          openaiModel: "gpt-5-mini",
          geminiModel: "gemini-2.5-flash",
          openrouterModel: "deepseek/deepseek-chat-v3-0324:free",
          agentModel: "google/gemini-2.5-flash",
        }),
      );

      const result = await updateSystemSettings({
        openaiApiKey: "sk-new-key",
        geminiApiKey: "ai-new-key",
        openrouterApiKey: "sk-or-new-key",
        openaiModel: "gpt-5-mini",
        geminiModel: "gemini-2.5-flash",
        openrouterModel: "deepseek/deepseek-chat-v3-0324:free",
        agentModel: "google/gemini-2.5-flash",
      });

      expect(encryptApiKeyMock).toHaveBeenCalledWith("sk-new-key");
      expect(encryptApiKeyMock).toHaveBeenCalledWith("ai-new-key");
      expect(encryptApiKeyMock).toHaveBeenCalledWith("sk-or-new-key");
      expect(upsertMock).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { singletonKey: "system" },
          create: expect.objectContaining({
            openaiApiKey: "encrypted:sk-new-key",
            geminiApiKey: "encrypted:ai-new-key",
            openrouterApiKey: "encrypted:sk-or-new-key",
            agentModel: "google/gemini-2.5-flash",
          }),
        }),
      );
      expect(result.agentModel).toBe("google/gemini-2.5-flash");
      expect(result.openaiConfigured).toBe(true);
      expect(result.geminiConfigured).toBe(true);
      expect(result.openrouterConfigured).toBe(true);
    });

    it("persists agentModel with same 3-state semantics as openrouterModel", async () => {
      upsertMock.mockResolvedValue(
        defaultSettingsRow({ agentModel: "anthropic/claude-sonnet-4-20250514" }),
      );

      type UpsertArgs = { update: Record<string, unknown>; create: Record<string, unknown> };

      // explicit non-empty -> writes
      await updateSystemSettings({ agentModel: "anthropic/claude-sonnet-4-20250514" });
      let upsertCall = upsertMock.mock.calls.at(-1)?.[0] as UpsertArgs;
      expect(upsertCall.update.agentModel).toBe("anthropic/claude-sonnet-4-20250514");
      expect(upsertCall.create.agentModel).toBe("anthropic/claude-sonnet-4-20250514");

      // explicit empty string -> clears to null
      await updateSystemSettings({ agentModel: "" });
      upsertCall = upsertMock.mock.calls.at(-1)?.[0] as UpsertArgs;
      expect(upsertCall.update.agentModel).toBe(null);

      // absent (null/undefined) -> key is not present in update at all
      await updateSystemSettings({});
      upsertCall = upsertMock.mock.calls.at(-1)?.[0] as UpsertArgs;
      expect(upsertCall.update).not.toHaveProperty("agentModel");
    });

    it("updates only provided fields — leaves non-provided keys unchanged", async () => {
      upsertMock.mockResolvedValue(
        defaultSettingsRow({
          openaiApiKey: "encrypted:existing-openai",
          geminiApiKey: "encrypted:existing-gemini",
          openrouterApiKey: "encrypted:existing-openrouter",
          openaiModel: "updated-model",
        }),
      );

      const result = await updateSystemSettings({
        openaiModel: "updated-model",
      });

      // openaiApiKey was not provided, so it should NOT be in the update object
      const upsertCall = upsertMock.mock.calls[0]?.[0] as { update: Record<string, unknown> };
      expect(upsertCall.update).not.toHaveProperty("openaiApiKey");
      expect(upsertCall.update).not.toHaveProperty("geminiApiKey");
      expect(upsertCall.update).not.toHaveProperty("openrouterApiKey");
      expect(upsertCall.update).toHaveProperty("openaiModel", "updated-model");
      expect(result.openaiModel).toBe("updated-model");
    });

    it("trims whitespace from agentModel before persisting", async () => {
      upsertMock.mockResolvedValue(
        defaultSettingsRow({ agentModel: "openrouter/free" }),
      );

      await updateSystemSettings({ agentModel: "  openrouter/free  " });

      const upsertCall = upsertMock.mock.calls[0]?.[0] as { update: Record<string, unknown> };
      expect(upsertCall.update.agentModel).toBe("openrouter/free");
    });

    it("explicitly clears an API key when empty string is sent", async () => {
      upsertMock.mockResolvedValue(
        defaultSettingsRow({
          openaiApiKey: "",
          geminiApiKey: "encrypted:existing-gemini",
          openrouterApiKey: "encrypted:existing-openrouter",
        }),
      );

      const result = await updateSystemSettings({
        openaiApiKey: "",
      });

      const upsertCall = upsertMock.mock.calls[0]?.[0] as { update: Record<string, unknown> };
      expect(upsertCall.update).toHaveProperty("openaiApiKey", null);
      expect(result.openaiConfigured).toBe(false);
      expect(result.geminiConfigured).toBe(true);
      expect(result.openrouterConfigured).toBe(true);
    });

    it("does not clear key when openaiApiKey is null (not sent)", async () => {
      upsertMock.mockResolvedValue(
        defaultSettingsRow({
          openaiApiKey: "encrypted:should-remain",
          geminiApiKey: "encrypted:should-remain",
          openrouterApiKey: "encrypted:should-remain",
        }),
      );

      await updateSystemSettings({
        openaiApiKey: null,
      });

      const upsertCall = upsertMock.mock.calls[0]?.[0] as { update: Record<string, unknown> };
      expect(upsertCall.update).not.toHaveProperty("openaiApiKey");
    });

    it("trims whitespace from API keys before encrypting", async () => {
      upsertMock.mockResolvedValue(
        defaultSettingsRow({
          openaiApiKey: "encrypted:sk-trimmed",
        }),
      );

      await updateSystemSettings({
        openaiApiKey: "  sk-trimmed  ",
      });

      expect(encryptApiKeyMock).toHaveBeenCalledWith("sk-trimmed");
    });
  });

  describe("getDecryptedSystemOpenaiApiKey", () => {
    it("returns empty string when no settings row exists", async () => {
      findUniqueMock.mockResolvedValue(null);

      const result = await getDecryptedSystemOpenaiApiKey();

      expect(result).toBe("");
    });

    it("returns empty string when openaiApiKey is null", async () => {
      findUniqueMock.mockResolvedValue(defaultSettingsRow({ openaiApiKey: null }));

      const result = await getDecryptedSystemOpenaiApiKey();

      expect(result).toBe("");
    });

    it("returns decrypted key when openaiApiKey is set", async () => {
      findUniqueMock.mockResolvedValue(
        defaultSettingsRow({ openaiApiKey: "encrypted:sk-real-key" }),
      );

      const result = await getDecryptedSystemOpenaiApiKey();

      expect(result).toBe("sk-real-key");
      expect(decryptApiKeyMock).toHaveBeenCalledWith("encrypted:sk-real-key");
    });
  });

  describe("getDecryptedSystemGeminiApiKey", () => {
    it("returns empty string when no settings row exists", async () => {
      findUniqueMock.mockResolvedValue(null);

      const result = await getDecryptedSystemGeminiApiKey();

      expect(result).toBe("");
    });

    it("returns empty string when geminiApiKey is null", async () => {
      findUniqueMock.mockResolvedValue(defaultSettingsRow({ geminiApiKey: null }));

      const result = await getDecryptedSystemGeminiApiKey();

      expect(result).toBe("");
    });

    it("returns decrypted key when geminiApiKey is set", async () => {
      findUniqueMock.mockResolvedValue(
        defaultSettingsRow({ geminiApiKey: "encrypted:ai-real-key" }),
      );

      const result = await getDecryptedSystemGeminiApiKey();

      expect(result).toBe("ai-real-key");
      expect(decryptApiKeyMock).toHaveBeenCalledWith("encrypted:ai-real-key");
    });
  });

  describe("getDecryptedSystemOpenrouterApiKey", () => {
    it("returns empty string when no settings row exists", async () => {
      findUniqueMock.mockResolvedValue(null);

      const result = await getDecryptedSystemOpenrouterApiKey();

      expect(result).toBe("");
    });

    it("returns decrypted key when openrouterApiKey is set", async () => {
      findUniqueMock.mockResolvedValue(
        defaultSettingsRow({ openrouterApiKey: "encrypted:sk-or-real-key" }),
      );

      const result = await getDecryptedSystemOpenrouterApiKey();

      expect(result).toBe("sk-or-real-key");
      expect(decryptApiKeyMock).toHaveBeenCalledWith("encrypted:sk-or-real-key");
    });
  });
});
