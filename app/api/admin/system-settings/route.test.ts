import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/session", () => ({
  requireAdminSession: vi.fn(),
}));

const { getSystemSettingsMock, updateSystemSettingsMock } = vi.hoisted(() => ({
  getSystemSettingsMock: vi.fn(),
  updateSystemSettingsMock: vi.fn(),
}));

vi.mock("@/lib/data/system-settings", () => ({
  getSystemSettings: getSystemSettingsMock,
  updateSystemSettings: updateSystemSettingsMock,
}));

import { GET, PUT } from "@/app/api/admin/system-settings/route";
import { requireAdminSession } from "@/lib/auth/session";

function mockAdminSession() {
  vi.mocked(requireAdminSession).mockResolvedValue({ expires: new Date().toISOString(), user: { id: "admin-1", role: "ADMIN" } });
}

function mockUnauthenticated() {
  vi.mocked(requireAdminSession).mockResolvedValue(null);
}

function mockSystemSettings(overrides?: {
  openaiConfigured?: boolean;
  geminiConfigured?: boolean;
  openaiModel?: string;
  geminiModel?: string;
}) {
  getSystemSettingsMock.mockResolvedValue({
    openaiApiKey: "sk-decrypted-openai",
    geminiApiKey: "ai-decrypted-gemini",
    openaiApiKeyMasked: "sk-d...-key",
    geminiApiKeyMasked: "ai-d...-key",
    openaiModel: overrides?.openaiModel ?? "gpt-5-mini",
    geminiModel: overrides?.geminiModel ?? "gemini-2.5-flash",
    openaiConfigured: overrides?.openaiConfigured ?? true,
    geminiConfigured: overrides?.geminiConfigured ?? true,
  });
}

describe("admin system settings route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET", () => {
    it("returns 401 when user is not an admin", async () => {
      mockUnauthenticated();

      const response = await GET();

      expect(response.status).toBe(401);
      expect(getSystemSettingsMock).not.toHaveBeenCalled();
    });

    it("returns settings without decrypted API keys", async () => {
      mockAdminSession();
      mockSystemSettings();

      const response = await GET();

      expect(response.status).toBe(200);
      const body = await response.json();

      // Safe fields should be present
      expect(body.openaiApiKeyMasked).toBe("sk-d...-key");
      expect(body.geminiApiKeyMasked).toBe("ai-d...-key");
      expect(body.openaiModel).toBe("gpt-5-mini");
      expect(body.geminiModel).toBe("gemini-2.5-flash");
      expect(body.openaiConfigured).toBe(true);
      expect(body.geminiConfigured).toBe(true);

      // CRITICAL: decrypted keys must NOT be exposed
      expect(body).not.toHaveProperty("openaiApiKey");
      expect(body).not.toHaveProperty("geminiApiKey");
    });

    it("returns 500 when getSystemSettings throws", async () => {
      mockAdminSession();
      getSystemSettingsMock.mockRejectedValue(new Error("DB error"));

      const response = await GET();

      expect(response.status).toBe(500);
      const body = await response.json();
      expect(body.error).toBe("DB error");
    });
  });

  describe("PUT", () => {
    it("returns 401 when user is not an admin", async () => {
      mockUnauthenticated();

      const response = await PUT(
        new Request("http://localhost/api/admin/system-settings", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ openaiApiKey: "sk-test" }),
        }),
      );

      expect(response.status).toBe(401);
      expect(updateSystemSettingsMock).not.toHaveBeenCalled();
    });

    it("saves settings and returns safe response without decrypted keys", async () => {
      mockAdminSession();
      updateSystemSettingsMock.mockResolvedValue({
        openaiApiKey: "sk-saved-decrypted",
        geminiApiKey: "ai-saved-decrypted",
        openaiApiKeyMasked: "sk-s...-ted",
        geminiApiKeyMasked: "ai-s...-ted",
        openaiModel: "custom-model",
        geminiModel: "",
        openaiConfigured: true,
        geminiConfigured: false,
      });

      const response = await PUT(
        new Request("http://localhost/api/admin/system-settings", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            openaiApiKey: "sk-my-key",
            openaiModel: "custom-model",
          }),
        }),
      );

      expect(response.status).toBe(200);
      const body = await response.json();

      expect(updateSystemSettingsMock).toHaveBeenCalledWith({
        openaiApiKey: "sk-my-key",
        geminiApiKey: null,
        openaiModel: "custom-model",
        geminiModel: null,
      });

      // Safe fields present
      expect(body.openaiApiKeyMasked).toBe("sk-s...-ted");
      expect(body.openaiConfigured).toBe(true);
      expect(body.geminiConfigured).toBe(false);

      // CRITICAL: decrypted keys must NOT be exposed
      expect(body).not.toHaveProperty("openaiApiKey");
      expect(body).not.toHaveProperty("geminiApiKey");
    });

    it("returns 400 for invalid JSON body", async () => {
      mockAdminSession();

      const response = await PUT(
        new Request("http://localhost/api/admin/system-settings", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify("not an object"),
        }),
      );

      expect(response.status).toBe(400);
    });

    it("returns 500 when updateSystemSettings throws", async () => {
      mockAdminSession();
      updateSystemSettingsMock.mockRejectedValue(new Error("DB write error"));

      const response = await PUT(
        new Request("http://localhost/api/admin/system-settings", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ openaiApiKey: "sk-test" }),
        }),
      );

      expect(response.status).toBe(500);
      const body = await response.json();
      expect(body.error).toBe("DB write error");
    });

    it("passes empty string to clear an API key", async () => {
      mockAdminSession();
      updateSystemSettingsMock.mockResolvedValue({
        openaiApiKey: "",
        geminiApiKey: "ai-kept",
        openaiApiKeyMasked: "",
        geminiApiKeyMasked: "ai-k...-ept",
        openaiModel: "",
        geminiModel: "",
        openaiConfigured: false,
        geminiConfigured: true,
      });

      const response = await PUT(
        new Request("http://localhost/api/admin/system-settings", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ openaiApiKey: "" }),
        }),
      );

      expect(response.status).toBe(200);
      const body = await response.json();

      expect(updateSystemSettingsMock).toHaveBeenCalledWith(
        expect.objectContaining({ openaiApiKey: "" }),
      );
      expect(body.openaiConfigured).toBe(false);
      expect(body).not.toHaveProperty("openaiApiKey");
    });
  });
});
