import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAiProjectHistory: vi.fn(),
  getAuthSession: vi.fn(),
  getProjectHeaderById: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  getAuthSession: mocks.getAuthSession,
}));

vi.mock("@/lib/ai/project-history", () => ({
  getAiProjectHistory: mocks.getAiProjectHistory,
}));

vi.mock("@/lib/data/projects", () => ({
  getProjectHeaderById: mocks.getProjectHeaderById,
}));

import { GET } from "@/app/api/projects/[id]/ai-history/route";

describe("GET /api/projects/[id]/ai-history", () => {
  beforeEach(() => {
    mocks.getAiProjectHistory.mockReset();
    mocks.getAuthSession.mockReset();
    mocks.getProjectHeaderById.mockReset();
  });

  it("returns 401 when unauthenticated", async () => {
    mocks.getAuthSession.mockResolvedValue(null);

    const response = await GET(new Request("http://localhost/api/projects/project-1/ai-history"), {
      params: Promise.resolve({ id: "project-1" }),
    });

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" });
    expect(mocks.getProjectHeaderById).not.toHaveBeenCalled();
    expect(mocks.getAiProjectHistory).not.toHaveBeenCalled();
  });

  it("returns 404 when the project is missing or inaccessible", async () => {
    mocks.getAuthSession.mockResolvedValue({ user: { id: "user-1" } });
    mocks.getProjectHeaderById.mockResolvedValue(null);

    const response = await GET(new Request("http://localhost/api/projects/project-1/ai-history"), {
      params: Promise.resolve({ id: "project-1" }),
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "Project not found" });
    expect(mocks.getProjectHeaderById).toHaveBeenCalledWith("project-1", "user-1");
    expect(mocks.getAiProjectHistory).not.toHaveBeenCalled();
  });

  it("returns recent project history after verifying access", async () => {
    const entries = [
      {
        id: "history-1",
        projectId: "project-1",
        userId: "user-1",
        action: "chat",
        summary: "Consulta tecnica",
        context: { project: "Hospital Norte" },
        result: {
          answer: "Respuesta tecnica",
          model: "llama3.1",
          requestedModel: "llama3.1",
          fallbackUsed: false,
          warnings: [],
        },
        timestamp: "2026-06-09T16:00:00.000Z",
      },
    ];

    mocks.getAuthSession.mockResolvedValue({ user: { id: "user-1" } });
    mocks.getProjectHeaderById.mockResolvedValue({ id: "project-1", name: "Hospital Norte" });
    mocks.getAiProjectHistory.mockResolvedValue(entries);

    const response = await GET(new Request("http://localhost/api/projects/project-1/ai-history"), {
      params: Promise.resolve({ id: "project-1" }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ entries });
    expect(mocks.getProjectHeaderById).toHaveBeenCalledWith("project-1", "user-1");
    expect(mocks.getAiProjectHistory).toHaveBeenCalledWith("project-1", "user-1", undefined);
  });

  it("passes a valid limit query parameter to the history service", async () => {
    mocks.getAuthSession.mockResolvedValue({ user: { id: "user-1" } });
    mocks.getProjectHeaderById.mockResolvedValue({ id: "project-1", name: "Hospital Norte" });
    mocks.getAiProjectHistory.mockResolvedValue([]);

    const response = await GET(new Request("http://localhost/api/projects/project-1/ai-history?limit=5"), {
      params: Promise.resolve({ id: "project-1" }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ entries: [] });
    expect(mocks.getAiProjectHistory).toHaveBeenCalledWith("project-1", "user-1", 5);
  });

  it("passes undefined for an invalid limit query parameter", async () => {
    mocks.getAuthSession.mockResolvedValue({ user: { id: "user-1" } });
    mocks.getProjectHeaderById.mockResolvedValue({ id: "project-1", name: "Hospital Norte" });
    mocks.getAiProjectHistory.mockResolvedValue([]);

    const response = await GET(new Request("http://localhost/api/projects/project-1/ai-history?limit=zero"), {
      params: Promise.resolve({ id: "project-1" }),
    });

    expect(response.status).toBe(200);
    expect(mocks.getAiProjectHistory).toHaveBeenCalledWith("project-1", "user-1", undefined);
  });

  it("returns 500 when history loading fails unexpectedly", async () => {
    mocks.getAuthSession.mockResolvedValue({ user: { id: "user-1" } });
    mocks.getProjectHeaderById.mockResolvedValue({ id: "project-1", name: "Hospital Norte" });
    mocks.getAiProjectHistory.mockRejectedValue(new Error("database unavailable"));

    const response = await GET(new Request("http://localhost/api/projects/project-1/ai-history"), {
      params: Promise.resolve({ id: "project-1" }),
    });

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: "Unable to load project history" });
  });
});
