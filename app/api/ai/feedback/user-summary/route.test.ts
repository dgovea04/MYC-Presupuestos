import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/ai/feedback/user-summary/route";

const mocks = vi.hoisted(() => ({
  getAuthSession: vi.fn(),
  getUserAiFeedbackSummary: vi.fn(),
  getUserFeedbackTrends: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  getAuthSession: mocks.getAuthSession,
}));

vi.mock("@/lib/ai/suggestion-feedback", () => ({
  getUserAiFeedbackSummary: mocks.getUserAiFeedbackSummary,
  getUserFeedbackTrends: mocks.getUserFeedbackTrends,
}));

describe("GET /api/ai/feedback/user-summary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    mocks.getAuthSession.mockResolvedValue(null);

    const response = await GET();
    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toBe("Unauthorized");
  });

  it("returns feedback summary for authenticated user", async () => {
    mocks.getAuthSession.mockResolvedValue({ user: { id: "user-1" } });
    mocks.getUserAiFeedbackSummary.mockResolvedValue({
      applied: 5,
      edited: 3,
      dismissed: 2,
      total: 10,
      acceptanceRate: "0.500",
      editRate: "0.300",
      discardRate: "0.200",
      providerQuality: [],
    });
    mocks.getUserFeedbackTrends.mockResolvedValue([]);

    const response = await GET();
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.summary).toEqual({
      applied: 5,
      edited: 3,
      dismissed: 2,
      total: 10,
      acceptanceRate: "0.500",
      editRate: "0.300",
      discardRate: "0.200",
      providerQuality: [],
    });
    expect(body.trends).toEqual([]);
    expect(mocks.getUserAiFeedbackSummary).toHaveBeenCalledWith({ userId: "user-1" });
    expect(mocks.getUserFeedbackTrends).toHaveBeenCalledWith({ userId: "user-1" });
  });

  it("returns 500 when service throws", async () => {
    mocks.getAuthSession.mockResolvedValue({ user: { id: "user-1" } });
    mocks.getUserAiFeedbackSummary.mockRejectedValue(new Error("db error"));

    const response = await GET();
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error).toBe("Unable to load feedback summary");
  });
});
