import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/session", () => ({
  getAuthSession: vi.fn(),
}));

vi.mock("@/lib/ai/ollama", () => ({
  listInstalledOllamaModels: vi.fn(),
  OllamaConnectionError: class OllamaConnectionError extends Error {},
}));

import { GET } from "@/app/api/ai/ollama-check/route";
import { getAuthSession } from "@/lib/auth/session";
import { listInstalledOllamaModels } from "@/lib/ai/ollama";

describe("GET /api/ai/ollama-check", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getAuthSession).mockResolvedValue({ user: { id: "user-1" } });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("rejects unauthenticated requests", async () => {
    vi.mocked(getAuthSession).mockResolvedValue(null);

    const response = await GET(new Request("http://localhost/api/ai/ollama-check"));

    expect(response.status).toBe(401);
    expect(listInstalledOllamaModels).not.toHaveBeenCalled();
  });

  it("rejects local checks in production before contacting Ollama", async () => {
    vi.stubEnv("NODE_ENV", "production");

    const response = await GET(new Request("http://localhost/api/ai/ollama-check?model=llama3.1"));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "Ollama solo esta disponible en la app local." });
    expect(listInstalledOllamaModels).not.toHaveBeenCalled();
  });
});
