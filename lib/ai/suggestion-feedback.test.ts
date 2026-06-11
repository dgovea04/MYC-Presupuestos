import { AiSuggestionFeedbackType } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    aiProjectHistoryEntry: {
      findFirst: vi.fn(),
    },
    aiSuggestionFeedbackEvent: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: prismaMock,
}));

import {
  getAiSuggestionFeedbackSummary,
  getLatestAiSuggestionFeedbackByHistoryEntry,
  recordAiSuggestionFeedback,
} from "@/lib/ai/suggestion-feedback";

describe("Khipu suggestion feedback service", () => {
  beforeEach(() => {
    prismaMock.aiProjectHistoryEntry.findFirst.mockReset();
    prismaMock.aiSuggestionFeedbackEvent.create.mockReset();
    prismaMock.aiSuggestionFeedbackEvent.findMany.mockReset();
  });

  it("records feedback only after verifying project history ownership", async () => {
    const createdAt = new Date("2026-06-10T14:00:00.000Z");
    prismaMock.aiProjectHistoryEntry.findFirst.mockResolvedValue({
      id: "history-1",
      projectId: "project-1",
      userId: "user-1",
    });
    prismaMock.aiSuggestionFeedbackEvent.create.mockResolvedValue(
      createDbFeedbackEvent({
        id: "feedback-1",
        historyEntryId: "history-1",
        projectId: "project-1",
        userId: "user-1",
        feedbackType: AiSuggestionFeedbackType.EDITED,
        notes: "Usar metrados actualizados",
        createdAt,
      }),
    );

    const event = await recordAiSuggestionFeedback({
      historyEntryId: "history-1",
      projectId: "project-1",
      userId: "user-1",
      feedbackType: AiSuggestionFeedbackType.EDITED,
      notes: `  Usar metrados actualizados${"x".repeat(600)}  `,
    });

    expect(prismaMock.aiProjectHistoryEntry.findFirst).toHaveBeenCalledWith({
      where: {
        id: "history-1",
        projectId: "project-1",
        userId: "user-1",
        project: {
          company: {
            userId: "user-1",
          },
        },
      },
      select: {
        id: true,
        projectId: true,
        userId: true,
      },
    });
    expect(prismaMock.aiSuggestionFeedbackEvent.create).toHaveBeenCalledWith({
      data: {
        historyEntryId: "history-1",
        projectId: "project-1",
        userId: "user-1",
        feedbackType: AiSuggestionFeedbackType.EDITED,
        notes: `Usar metrados actualizados${"x".repeat(474)}`,
      },
    });
    expect(event).toEqual({
      id: "feedback-1",
      historyEntryId: "history-1",
      projectId: "project-1",
      userId: "user-1",
      feedbackType: AiSuggestionFeedbackType.EDITED,
      notes: "Usar metrados actualizados",
      timestamp: "2026-06-10T14:00:00.000Z",
    });
  });

  it("does not record feedback for inaccessible history", async () => {
    prismaMock.aiProjectHistoryEntry.findFirst.mockResolvedValue(null);

    await expect(
      recordAiSuggestionFeedback({
        historyEntryId: "history-2",
        projectId: "project-1",
        userId: "user-1",
        feedbackType: AiSuggestionFeedbackType.DISMISSED,
        notes: "   ",
      }),
    ).resolves.toBeNull();
    expect(prismaMock.aiSuggestionFeedbackEvent.create).not.toHaveBeenCalled();
  });

  it("returns latest feedback state by history entry", async () => {
    prismaMock.aiSuggestionFeedbackEvent.findMany.mockResolvedValue([
      createDbFeedbackEvent({
        id: "feedback-new",
        historyEntryId: "history-1",
        feedbackType: AiSuggestionFeedbackType.EDITED,
        createdAt: new Date("2026-06-10T14:10:00.000Z"),
      }),
      createDbFeedbackEvent({
        id: "feedback-other",
        historyEntryId: "history-2",
        feedbackType: AiSuggestionFeedbackType.APPLIED,
        createdAt: new Date("2026-06-10T14:05:00.000Z"),
      }),
      createDbFeedbackEvent({
        id: "feedback-old",
        historyEntryId: "history-1",
        feedbackType: AiSuggestionFeedbackType.DISMISSED,
        createdAt: new Date("2026-06-10T14:00:00.000Z"),
      }),
    ]);

    await expect(
      getLatestAiSuggestionFeedbackByHistoryEntry({
        projectId: "project-1",
        userId: "user-1",
        historyEntryIds: ["history-1", "history-2"],
      }),
    ).resolves.toEqual({
      "history-1": AiSuggestionFeedbackType.EDITED,
      "history-2": AiSuggestionFeedbackType.APPLIED,
    });
    expect(prismaMock.aiSuggestionFeedbackEvent.findMany).toHaveBeenCalledWith({
      where: {
        historyEntryId: {
          in: ["history-1", "history-2"],
        },
        projectId: "project-1",
        userId: "user-1",
        historyEntry: {
          projectId: "project-1",
          userId: "user-1",
          project: {
            company: {
              userId: "user-1",
            },
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });
  });

  it("summarizes latest feedback state instead of raw event count", async () => {
    prismaMock.aiSuggestionFeedbackEvent.findMany.mockResolvedValue([
      createDbFeedbackEvent({
        id: "feedback-4",
        historyEntryId: "history-3",
        feedbackType: AiSuggestionFeedbackType.DISMISSED,
        createdAt: new Date("2026-06-10T14:15:00.000Z"),
      }),
      createDbFeedbackEvent({
        id: "feedback-3",
        historyEntryId: "history-2",
        feedbackType: AiSuggestionFeedbackType.APPLIED,
        createdAt: new Date("2026-06-10T14:10:00.000Z"),
      }),
      createDbFeedbackEvent({
        id: "feedback-2",
        historyEntryId: "history-1",
        feedbackType: AiSuggestionFeedbackType.EDITED,
        createdAt: new Date("2026-06-10T14:05:00.000Z"),
      }),
      createDbFeedbackEvent({
        id: "feedback-1",
        historyEntryId: "history-1",
        feedbackType: AiSuggestionFeedbackType.APPLIED,
        createdAt: new Date("2026-06-10T14:00:00.000Z"),
      }),
    ]);

    await expect(
      getAiSuggestionFeedbackSummary({
        projectId: "project-1",
        userId: "user-1",
      }),
    ).resolves.toEqual({
      applied: 1,
      edited: 1,
      dismissed: 1,
      total: 3,
    });
    expect(prismaMock.aiSuggestionFeedbackEvent.findMany).toHaveBeenCalledWith({
      where: {
        projectId: "project-1",
        userId: "user-1",
        historyEntry: {
          projectId: "project-1",
          userId: "user-1",
          project: {
            company: {
              userId: "user-1",
            },
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });
  });
});

function createDbFeedbackEvent({
  createdAt,
  feedbackType,
  historyEntryId,
  id,
  notes = null,
  projectId = "project-1",
  userId = "user-1",
}: {
  createdAt: Date;
  feedbackType: AiSuggestionFeedbackType;
  historyEntryId: string;
  id: string;
  notes?: string | null;
  projectId?: string;
  userId?: string;
}) {
  return {
    id,
    historyEntryId,
    projectId,
    userId,
    feedbackType,
    notes,
    createdAt,
  };
}
