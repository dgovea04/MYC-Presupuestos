import { AiSuggestionFeedbackType } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  aiSuggestionFeedbackEvent: {
    findMany: vi.fn(),
  },
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    aiSuggestionFeedbackEvent: mocks.aiSuggestionFeedbackEvent,
  },
}));

import { getUserFeedbackTrends } from "@/lib/ai/suggestion-feedback";

describe("getUserFeedbackTrends", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns empty array when no feedback events exist", async () => {
    mocks.aiSuggestionFeedbackEvent.findMany.mockResolvedValue([]);

    const result = await getUserFeedbackTrends({ userId: "user-1" });
    expect(result).toEqual([]);
  });

  it("groups feedback events by ISO week and computes counts", async () => {
    mocks.aiSuggestionFeedbackEvent.findMany.mockResolvedValue([
      createEvent({ historyEntryId: "e1", feedbackType: "APPLIED", createdAt: new Date("2026-06-01") }),
      createEvent({ historyEntryId: "e2", feedbackType: "APPLIED", createdAt: new Date("2026-06-01") }),
      createEvent({ historyEntryId: "e3", feedbackType: "EDITED", createdAt: new Date("2026-06-08") }),
      createEvent({ historyEntryId: "e4", feedbackType: "DISMISSED", createdAt: new Date("2026-06-10") }),
    ]);

    const result = await getUserFeedbackTrends({ userId: "user-1" });

    expect(result).toHaveLength(2);

    // Week of June 1: 2 applied, 0 edited, 0 dismissed
    expect(result[0].applied).toBe(2);
    expect(result[0].edited).toBe(0);
    expect(result[0].dismissed).toBe(0);
    expect(result[0].total).toBe(2);
    expect(result[0].acceptanceRate).toBe("1.000");

    // Week of June 8: 0 applied, 1 edited, 1 dismissed
    expect(result[1].applied).toBe(0);
    expect(result[1].edited).toBe(1);
    expect(result[1].dismissed).toBe(1);
    expect(result[1].total).toBe(2);
    expect(result[1].acceptanceRate).toBe("0.000");
  });

  it("only counts the latest feedback per history entry (deduplication)", async () => {
    // getLatestFeedbackEvents keeps the FIRST event per history entry (oldest in asc order)
    // e1: APPLIED (June 1) is older than e1: EDITED (June 3) -- only APPLIED is counted
    mocks.aiSuggestionFeedbackEvent.findMany.mockResolvedValue([
      createEvent({ historyEntryId: "e1", feedbackType: "APPLIED", createdAt: new Date("2026-06-01") }),
      createEvent({ historyEntryId: "e1", feedbackType: "EDITED", createdAt: new Date("2026-06-03") }),
      createEvent({ historyEntryId: "e2", feedbackType: "DISMISSED", createdAt: new Date("2026-06-01") }),
    ]);

    const result = await getUserFeedbackTrends({ userId: "user-1" });

    expect(result).toHaveLength(1);
    expect(result[0].applied).toBe(1);  // e1-APPLIED kept (first in asc order)
    expect(result[0].edited).toBe(0);
    expect(result[0].dismissed).toBe(1);  // e2-DISMISSED
    expect(result[0].total).toBe(2);
  });

  it("orders weeks chronologically ascending", async () => {
    mocks.aiSuggestionFeedbackEvent.findMany.mockResolvedValue([
      createEvent({ historyEntryId: "e3", feedbackType: "APPLIED", createdAt: new Date("2026-06-15") }),
      createEvent({ historyEntryId: "e1", feedbackType: "APPLIED", createdAt: new Date("2026-06-01") }),
      createEvent({ historyEntryId: "e2", feedbackType: "APPLIED", createdAt: new Date("2026-06-08") }),
    ]);

    const result = await getUserFeedbackTrends({ userId: "user-1" });

    expect(result).toHaveLength(3);
    expect(result[0].weekKey).toBe("2026-W23");
    expect(result[1].weekKey).toBe("2026-W24");
    expect(result[2].weekKey).toBe("2026-W25");
  });

  it("provides weekLabel in Spanish format", async () => {
    mocks.aiSuggestionFeedbackEvent.findMany.mockResolvedValue([
      createEvent({ historyEntryId: "e1", feedbackType: "APPLIED", createdAt: new Date("2026-06-01") }),
    ]);

    const result = await getUserFeedbackTrends({ userId: "user-1" });

    expect(result[0].weekLabel).toMatch(/^\d{1,2} (Ene|Feb|Mar|Abr|May|Jun|Jul|Ago|Sep|Oct|Nov|Dic)$/);
  });
});

function createEvent({
  historyEntryId,
  feedbackType,
  createdAt,
}: {
  historyEntryId: string;
  feedbackType: keyof typeof AiSuggestionFeedbackType;
  createdAt: Date;
}) {
  return {
    id: `event-${historyEntryId}`,
    historyEntryId,
    projectId: "project-1",
    userId: "user-1",
    feedbackType: AiSuggestionFeedbackType[feedbackType],
    notes: null,
    provider: null,
    model: null,
    task: null,
    suggestionType: null,
    actionType: null,
    promptHash: null,
    responseHash: null,
    createdAt,
  };
}
