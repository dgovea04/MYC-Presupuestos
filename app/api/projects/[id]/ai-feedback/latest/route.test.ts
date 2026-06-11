import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAuthSession: vi.fn(),
  getLatestAiSuggestionFeedbackByHistoryEntry: vi.fn(),
  getProjectHeaderById: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  getAuthSession: mocks.getAuthSession,
}));

vi.mock("@/lib/data/projects", () => ({
  getProjectHeaderById: mocks.getProjectHeaderById,
}));

vi.mock("@/lib/ai/suggestion-feedback", () => ({
  getLatestAiSuggestionFeedbackByHistoryEntry: mocks.getLatestAiSuggestionFeedbackByHistoryEntry,
}));

import { GET } from "@/app/api/projects/[id]/ai-feedback/latest/route";

describe("GET /api/projects/[id]/ai-feedback/latest", () => {
  beforeEach(() => {
    mocks.getAuthSession.mockReset();
    mocks.getLatestAiSuggestionFeedbackByHistoryEntry.mockReset();
    mocks.getProjectHeaderById.mockReset();
  });

  it("returns 401 when unauthenticated", async () => {
    mocks.getAuthSession.mockResolvedValue(null);

    const response = await GET(new Request("http://localhost/api/projects/project-1/ai-feedback/latest"), {
      params: Promise.resolve({ id: "project-1" }),
    });

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
    expect(mocks.getProjectHeaderById).not.toHaveBeenCalled();
    expect(mocks.getLatestAiSuggestionFeedbackByHistoryEntry).not.toHaveBeenCalled();
  });

  it("returns an empty map when no history entry ids are requested", async () => {
    mocks.getAuthSession.mockResolvedValue({ user: { id: "user-1" } });
    mocks.getProjectHeaderById.mockResolvedValue({ id: "project-1", name: "Hospital Norte" });

    const response = await GET(new Request("http://localhost/api/projects/project-1/ai-feedback/latest"), {
      params: Promise.resolve({ id: "project-1" }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ feedbackByHistoryId: {} });
    expect(mocks.getProjectHeaderById).toHaveBeenCalledWith("project-1", "user-1");
    expect(mocks.getLatestAiSuggestionFeedbackByHistoryEntry).not.toHaveBeenCalled();
  });

  it("returns latest feedback after project access is verified", async () => {
    const feedbackByHistoryId = {
      "history-1": "APPLIED",
      "history-2": "DISMISSED",
    };
    mocks.getAuthSession.mockResolvedValue({ user: { id: "user-1" } });
    mocks.getProjectHeaderById.mockResolvedValue({ id: "project-1", name: "Hospital Norte" });
    mocks.getLatestAiSuggestionFeedbackByHistoryEntry.mockResolvedValue(feedbackByHistoryId);

    const response = await GET(
      new Request(
        "http://localhost/api/projects/project-1/ai-feedback/latest?historyEntryId=history-1&historyEntryId=history-2",
      ),
      {
        params: Promise.resolve({ id: "project-1" }),
      },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ feedbackByHistoryId });
    expect(mocks.getProjectHeaderById).toHaveBeenCalledWith("project-1", "user-1");
    expect(mocks.getLatestAiSuggestionFeedbackByHistoryEntry).toHaveBeenCalledWith({
      projectId: "project-1",
      userId: "user-1",
      historyEntryIds: ["history-1", "history-2"],
    });
  });

  it("returns 404 when the project is missing or inaccessible", async () => {
    mocks.getAuthSession.mockResolvedValue({ user: { id: "user-1" } });
    mocks.getProjectHeaderById.mockResolvedValue(null);

    const response = await GET(
      new Request("http://localhost/api/projects/project-1/ai-feedback/latest?historyEntryId=history-1"),
      {
        params: Promise.resolve({ id: "project-1" }),
      },
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Project not found" });
    expect(mocks.getLatestAiSuggestionFeedbackByHistoryEntry).not.toHaveBeenCalled();
  });

  it("returns 500 when loading latest feedback fails unexpectedly", async () => {
    mocks.getAuthSession.mockResolvedValue({ user: { id: "user-1" } });
    mocks.getProjectHeaderById.mockResolvedValue({ id: "project-1", name: "Hospital Norte" });
    mocks.getLatestAiSuggestionFeedbackByHistoryEntry.mockRejectedValue(new Error("database unavailable"));

    const response = await GET(
      new Request("http://localhost/api/projects/project-1/ai-feedback/latest?historyEntryId=history-1"),
      {
        params: Promise.resolve({ id: "project-1" }),
      },
    );

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Unable to load feedback state" });
  });
});
