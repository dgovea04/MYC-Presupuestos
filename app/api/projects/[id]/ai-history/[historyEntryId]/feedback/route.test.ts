import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAuthSession: vi.fn(),
  getProjectHeaderById: vi.fn(),
  recordAiSuggestionFeedback: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  getAuthSession: mocks.getAuthSession,
}));

vi.mock("@/lib/data/projects", () => ({
  getProjectHeaderById: mocks.getProjectHeaderById,
}));

vi.mock("@/lib/ai/suggestion-feedback", () => ({
  recordAiSuggestionFeedback: mocks.recordAiSuggestionFeedback,
}));

import { POST } from "@/app/api/projects/[id]/ai-history/[historyEntryId]/feedback/route";

describe("POST /api/projects/[id]/ai-history/[historyEntryId]/feedback", () => {
  beforeEach(() => {
    mocks.getAuthSession.mockReset();
    mocks.getProjectHeaderById.mockReset();
    mocks.recordAiSuggestionFeedback.mockReset();
  });

  it("returns 401 when unauthenticated", async () => {
    mocks.getAuthSession.mockResolvedValue(null);

    const response = await POST(createRequest({ feedbackType: "APPLIED" }), {
      params: Promise.resolve({ id: "project-1", historyEntryId: "history-1" }),
    });

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
    expect(mocks.getProjectHeaderById).not.toHaveBeenCalled();
    expect(mocks.recordAiSuggestionFeedback).not.toHaveBeenCalled();
  });

  it("returns 400 for an invalid feedback type", async () => {
    mocks.getAuthSession.mockResolvedValue({ user: { id: "user-1" } });
    mocks.getProjectHeaderById.mockResolvedValue({ id: "project-1", name: "Hospital Norte" });

    const response = await POST(createRequest({ feedbackType: "ARCHIVED" }), {
      params: Promise.resolve({ id: "project-1", historyEntryId: "history-1" }),
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid feedback type" });
    expect(mocks.getProjectHeaderById).toHaveBeenCalledWith("project-1", "user-1");
    expect(mocks.recordAiSuggestionFeedback).not.toHaveBeenCalled();
  });

  it("returns 400 for a null request body", async () => {
    mocks.getAuthSession.mockResolvedValue({ user: { id: "user-1" } });
    mocks.getProjectHeaderById.mockResolvedValue({ id: "project-1", name: "Hospital Norte" });

    const response = await POST(createRawRequest("null"), {
      params: Promise.resolve({ id: "project-1", historyEntryId: "history-1" }),
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid request body" });
    expect(mocks.recordAiSuggestionFeedback).not.toHaveBeenCalled();
  });

  it("returns 400 for malformed JSON", async () => {
    mocks.getAuthSession.mockResolvedValue({ user: { id: "user-1" } });
    mocks.getProjectHeaderById.mockResolvedValue({ id: "project-1", name: "Hospital Norte" });

    const response = await POST(createRawRequest("{"), {
      params: Promise.resolve({ id: "project-1", historyEntryId: "history-1" }),
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid request body" });
    expect(mocks.recordAiSuggestionFeedback).not.toHaveBeenCalled();
  });

  it("records feedback after project access is verified", async () => {
    const feedback = {
      id: "feedback-1",
      historyEntryId: "history-1",
      projectId: "project-1",
      userId: "user-1",
      feedbackType: "EDITED",
      notes: "Adjusted quantity",
      timestamp: "2026-06-11T10:00:00.000Z",
    };
    mocks.getAuthSession.mockResolvedValue({ user: { id: "user-1" } });
    mocks.getProjectHeaderById.mockResolvedValue({ id: "project-1", name: "Hospital Norte" });
    mocks.recordAiSuggestionFeedback.mockResolvedValue(feedback);

    const response = await POST(createRequest({ feedbackType: "EDITED", notes: "  Adjusted quantity  " }), {
      params: Promise.resolve({ id: "project-1", historyEntryId: "history-1" }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ feedback });
    expect(mocks.getProjectHeaderById).toHaveBeenCalledWith("project-1", "user-1");
    expect(mocks.recordAiSuggestionFeedback).toHaveBeenCalledWith({
      historyEntryId: "history-1",
      projectId: "project-1",
      userId: "user-1",
      feedbackType: "EDITED",
      notes: "Adjusted quantity",
    });
  });

  it("returns 404 when the project is missing or inaccessible", async () => {
    mocks.getAuthSession.mockResolvedValue({ user: { id: "user-1" } });
    mocks.getProjectHeaderById.mockResolvedValue(null);

    const response = await POST(createRequest({ feedbackType: "DISMISSED" }), {
      params: Promise.resolve({ id: "project-1", historyEntryId: "history-1" }),
    });

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Project not found" });
    expect(mocks.recordAiSuggestionFeedback).not.toHaveBeenCalled();
  });

  it("returns 404 when the feedback target is missing or inaccessible", async () => {
    mocks.getAuthSession.mockResolvedValue({ user: { id: "user-1" } });
    mocks.getProjectHeaderById.mockResolvedValue({ id: "project-1", name: "Hospital Norte" });
    mocks.recordAiSuggestionFeedback.mockResolvedValue(null);

    const response = await POST(createRequest({ feedbackType: "DISMISSED", notes: "   " }), {
      params: Promise.resolve({ id: "project-1", historyEntryId: "history-1" }),
    });

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Feedback target not found" });
    expect(mocks.recordAiSuggestionFeedback).toHaveBeenCalledWith({
      historyEntryId: "history-1",
      projectId: "project-1",
      userId: "user-1",
      feedbackType: "DISMISSED",
      notes: undefined,
    });
  });

  it("returns 500 when recording feedback fails unexpectedly", async () => {
    mocks.getAuthSession.mockResolvedValue({ user: { id: "user-1" } });
    mocks.getProjectHeaderById.mockResolvedValue({ id: "project-1", name: "Hospital Norte" });
    mocks.recordAiSuggestionFeedback.mockRejectedValue(new Error("database unavailable"));

    const response = await POST(createRequest({ feedbackType: "APPLIED" }), {
      params: Promise.resolve({ id: "project-1", historyEntryId: "history-1" }),
    });

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Unable to record feedback" });
  });
});

function createRequest(body: Record<string, unknown>): Request {
  return createRawRequest(JSON.stringify(body));
}

function createRawRequest(body: string): Request {
  return new Request("http://localhost/api/projects/project-1/ai-history/history-1/feedback", {
    method: "POST",
    body,
  });
}
