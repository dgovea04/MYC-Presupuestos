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

import { getUserAiFeedbackSummary } from "@/lib/ai/suggestion-feedback";

describe("getUserAiFeedbackSummary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns empty summary when no feedback events exist", async () => {
    mocks.aiSuggestionFeedbackEvent.findMany.mockResolvedValue([]);

    const result = await getUserAiFeedbackSummary({ userId: "user-1" });

    expect(mocks.aiSuggestionFeedbackEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: "user-1",
        }),
      }),
    );
    expect(result).toEqual({
      applied: 0,
      edited: 0,
      dismissed: 0,
      total: 0,
      acceptanceRate: "0.000",
      editRate: "0.000",
      discardRate: "0.000",
      providerQuality: [],
    });
  });

  it("aggregates feedback across all projects for the user", async () => {
    mocks.aiSuggestionFeedbackEvent.findMany.mockResolvedValue([
      createEvent({ historyEntryId: "entry-1", feedbackType: "APPLIED" }),
      createEvent({ historyEntryId: "entry-2", feedbackType: "EDITED" }),
      createEvent({ historyEntryId: "entry-3", feedbackType: "DISMISSED" }),
      createEvent({ historyEntryId: "entry-4", feedbackType: "APPLIED" }),
    ]);

    const result = await getUserAiFeedbackSummary({ userId: "user-1" });

    expect(result).toEqual({
      applied: 2,
      edited: 1,
      dismissed: 1,
      total: 4,
      acceptanceRate: "0.500",
      editRate: "0.250",
      discardRate: "0.250",
      providerQuality: [],
    });
  });

  it("ignores duplicate feedback on same history entry (takes latest)", async () => {
    // The DB query orders by createdAt: "desc", so the most recent event comes first
    // getLatestFeedbackEvents keeps the FIRST event per history entry
    mocks.aiSuggestionFeedbackEvent.findMany.mockResolvedValue([
      createEvent({ historyEntryId: "entry-1", feedbackType: "EDITED", createdAt: new Date("2026-02-01") }),
      createEvent({ historyEntryId: "entry-1", feedbackType: "APPLIED", createdAt: new Date("2026-01-01") }),
    ]);

    const result = await getUserAiFeedbackSummary({ userId: "user-1" });

    expect(result.applied).toBe(0);
    expect(result.edited).toBe(1);
    expect(result.dismissed).toBe(0);
    expect(result.total).toBe(1);
  });

  it("splits provider quality per provider", async () => {
    mocks.aiSuggestionFeedbackEvent.findMany.mockResolvedValue([
      createEvent({ historyEntryId: "entry-1", feedbackType: "APPLIED", provider: "ollama" }),
      createEvent({ historyEntryId: "entry-2", feedbackType: "APPLIED", provider: "openai" }),
      createEvent({ historyEntryId: "entry-3", feedbackType: "EDITED", provider: "ollama" }),
      createEvent({ historyEntryId: "entry-4", feedbackType: "DISMISSED", provider: "gemini" }),
      createEvent({ historyEntryId: "entry-5", feedbackType: "APPLIED", provider: "ollama" }),
    ]);

    const result = await getUserAiFeedbackSummary({ userId: "user-1" });

    expect(result.total).toBe(5);
    expect(result.providerQuality).toHaveLength(3);

    const ollama = result.providerQuality.find((p) => p.provider === "ollama")!;
    expect(ollama.applied).toBe(2);
    expect(ollama.edited).toBe(1);
    expect(ollama.total).toBe(3);
    expect(ollama.acceptanceRate).toBe("0.667");

    const openai = result.providerQuality.find((p) => p.provider === "openai")!;
    expect(openai.applied).toBe(1);
    expect(openai.total).toBe(1);
    expect(openai.acceptanceRate).toBe("1.000");

    const gemini = result.providerQuality.find((p) => p.provider === "gemini")!;
    expect(gemini.dismissed).toBe(1);
    expect(gemini.total).toBe(1);
    expect(gemini.acceptanceRate).toBe("0.000");
  });

  it("skips events without provider when computing provider quality", async () => {
    mocks.aiSuggestionFeedbackEvent.findMany.mockResolvedValue([
      createEvent({ historyEntryId: "entry-1", feedbackType: "APPLIED", provider: null }),
      createEvent({ historyEntryId: "entry-2", feedbackType: "EDITED", provider: "" }),
      createEvent({ historyEntryId: "entry-3", feedbackType: "DISMISSED", provider: "ollama" }),
    ]);

    const result = await getUserAiFeedbackSummary({ userId: "user-1" });

    expect(result.total).toBe(3);
    expect(result.providerQuality).toHaveLength(1);
    expect(result.providerQuality[0].provider).toBe("ollama");
  });

  it("orders providers by total descending then alphabetically", async () => {
    mocks.aiSuggestionFeedbackEvent.findMany.mockResolvedValue([
      createEvent({ historyEntryId: "entry-1", feedbackType: "APPLIED", provider: "ollama" }),
      createEvent({ historyEntryId: "entry-2", feedbackType: "APPLIED", provider: "gemini" }),
      createEvent({ historyEntryId: "entry-3", feedbackType: "APPLIED", provider: "ollama" }),
      createEvent({ historyEntryId: "entry-4", feedbackType: "APPLIED", provider: "ollama" }),
      createEvent({ historyEntryId: "entry-5", feedbackType: "APPLIED", provider: "gemini" }),
      createEvent({ historyEntryId: "entry-6", feedbackType: "APPLIED", provider: "openai" }),
    ]);

    const result = await getUserAiFeedbackSummary({ userId: "user-1" });

    expect(result.providerQuality.map((p) => p.provider)).toEqual(["ollama", "gemini", "openai"]);
  });
});

function createEvent({
  historyEntryId,
  feedbackType,
  provider,
  createdAt,
}: {
  historyEntryId: string;
  feedbackType: keyof typeof AiSuggestionFeedbackType;
  provider?: string | null;
  createdAt?: Date;
}) {
  return {
    id: `event-${historyEntryId}`,
    historyEntryId,
    projectId: "project-1",
    userId: "user-1",
    feedbackType: AiSuggestionFeedbackType[feedbackType],
    notes: null,
    provider: provider ?? null,
    model: null,
    task: null,
    suggestionType: null,
    actionType: null,
    promptHash: null,
    responseHash: null,
    createdAt: createdAt ?? new Date("2026-06-01"),
  };
}
