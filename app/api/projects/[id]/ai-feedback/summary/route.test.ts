import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAiSuggestionFeedbackSummary: vi.fn(),
  getAuthSession: vi.fn(),
  getProjectHeaderById: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  getAuthSession: mocks.getAuthSession,
}));

vi.mock("@/lib/data/projects", () => ({
  getProjectHeaderById: mocks.getProjectHeaderById,
}));

vi.mock("@/lib/ai/suggestion-feedback", () => ({
  getAiSuggestionFeedbackSummary: mocks.getAiSuggestionFeedbackSummary,
}));

import { GET } from "@/app/api/projects/[id]/ai-feedback/summary/route";

describe("GET /api/projects/[id]/ai-feedback/summary", () => {
  beforeEach(() => {
    mocks.getAiSuggestionFeedbackSummary.mockReset();
    mocks.getAuthSession.mockReset();
    mocks.getProjectHeaderById.mockReset();
  });

  it("returns 401 when unauthenticated", async () => {
    mocks.getAuthSession.mockResolvedValue(null);

    const response = await GET(new Request("http://localhost/api/projects/project-1/ai-feedback/summary"), {
      params: Promise.resolve({ id: "project-1" }),
    });

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
    expect(mocks.getProjectHeaderById).not.toHaveBeenCalled();
    expect(mocks.getAiSuggestionFeedbackSummary).not.toHaveBeenCalled();
  });

  it("returns 404 when the project is missing or inaccessible", async () => {
    mocks.getAuthSession.mockResolvedValue({ user: { id: "user-1" } });
    mocks.getProjectHeaderById.mockResolvedValue(null);

    const response = await GET(new Request("http://localhost/api/projects/project-1/ai-feedback/summary"), {
      params: Promise.resolve({ id: "project-1" }),
    });

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Project not found" });
    expect(mocks.getAiSuggestionFeedbackSummary).not.toHaveBeenCalled();
  });

  it("returns the feedback summary after project access is verified", async () => {
    const summary = {
      applied: 3,
      edited: 2,
      dismissed: 1,
      total: 6,
    };
    mocks.getAuthSession.mockResolvedValue({ user: { id: "user-1" } });
    mocks.getProjectHeaderById.mockResolvedValue({ id: "project-1", name: "Hospital Norte" });
    mocks.getAiSuggestionFeedbackSummary.mockResolvedValue(summary);

    const response = await GET(new Request("http://localhost/api/projects/project-1/ai-feedback/summary"), {
      params: Promise.resolve({ id: "project-1" }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ summary });
    expect(mocks.getProjectHeaderById).toHaveBeenCalledWith("project-1", "user-1");
    expect(mocks.getAiSuggestionFeedbackSummary).toHaveBeenCalledWith({
      projectId: "project-1",
      userId: "user-1",
    });
  });

  it("returns 500 when loading the feedback summary fails unexpectedly", async () => {
    mocks.getAuthSession.mockResolvedValue({ user: { id: "user-1" } });
    mocks.getProjectHeaderById.mockResolvedValue({ id: "project-1", name: "Hospital Norte" });
    mocks.getAiSuggestionFeedbackSummary.mockRejectedValue(new Error("database unavailable"));

    const response = await GET(new Request("http://localhost/api/projects/project-1/ai-feedback/summary"), {
      params: Promise.resolve({ id: "project-1" }),
    });

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Unable to load feedback summary" });
  });
});
