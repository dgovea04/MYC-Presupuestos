import { AiSuggestionFeedbackType } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";

export type AiSuggestionFeedbackEventDto = {
  id: string;
  historyEntryId: string;
  projectId: string;
  userId: string;
  feedbackType: AiSuggestionFeedbackType;
  notes?: string;
  timestamp: string;
};

export type AiSuggestionFeedbackSummary = {
  applied: number;
  edited: number;
  dismissed: number;
  total: number;
};

export type RecordAiSuggestionFeedbackInput = {
  historyEntryId: string;
  projectId: string;
  userId: string;
  feedbackType: AiSuggestionFeedbackType;
  notes?: string;
};

export type GetLatestAiSuggestionFeedbackInput = {
  projectId: string;
  userId: string;
  historyEntryIds: string[];
};

export type GetAiSuggestionFeedbackSummaryInput = {
  projectId: string;
  userId: string;
};

type AiSuggestionFeedbackEventRecord = {
  id: string;
  historyEntryId: string;
  projectId: string;
  userId: string;
  feedbackType: AiSuggestionFeedbackType;
  notes: string | null;
  createdAt: Date;
};

const MAX_NOTES_LENGTH = 500;

export async function recordAiSuggestionFeedback({
  feedbackType,
  historyEntryId,
  notes,
  projectId,
  userId,
}: RecordAiSuggestionFeedbackInput): Promise<AiSuggestionFeedbackEventDto | null> {
  const historyEntry = await findOwnedHistoryEntry({ historyEntryId, projectId, userId });

  if (!historyEntry) {
    return null;
  }

  const event = await prisma.aiSuggestionFeedbackEvent.create({
    data: {
      historyEntryId: historyEntry.id,
      projectId: historyEntry.projectId,
      userId: historyEntry.userId,
      feedbackType,
      notes: normalizeNotes(notes),
    },
  });

  return mapFeedbackEvent(event);
}

export async function getLatestAiSuggestionFeedbackByHistoryEntry({
  historyEntryIds,
  projectId,
  userId,
}: GetLatestAiSuggestionFeedbackInput): Promise<Record<string, AiSuggestionFeedbackType>> {
  const uniqueHistoryEntryIds = Array.from(new Set(historyEntryIds));

  if (uniqueHistoryEntryIds.length === 0) {
    return {};
  }

  const events = await prisma.aiSuggestionFeedbackEvent.findMany({
    where: {
      historyEntryId: {
        in: uniqueHistoryEntryIds,
      },
      projectId,
      userId,
      historyEntry: {
        projectId,
        userId,
        project: {
          company: {
            userId,
          },
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return getLatestFeedbackState(events);
}

export async function getAiSuggestionFeedbackSummary({
  projectId,
  userId,
}: GetAiSuggestionFeedbackSummaryInput): Promise<AiSuggestionFeedbackSummary> {
  const events = await prisma.aiSuggestionFeedbackEvent.findMany({
    where: {
      projectId,
      userId,
      historyEntry: {
        projectId,
        userId,
        project: {
          company: {
            userId,
          },
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return summarizeLatestFeedbackState(events);
}

function findOwnedHistoryEntry({
  historyEntryId,
  projectId,
  userId,
}: {
  historyEntryId: string;
  projectId: string;
  userId: string;
}) {
  return prisma.aiProjectHistoryEntry.findFirst({
    where: {
      id: historyEntryId,
      projectId,
      userId,
      project: {
        company: {
          userId,
        },
      },
    },
    select: {
      id: true,
      projectId: true,
      userId: true,
    },
  });
}

function getLatestFeedbackState(
  events: AiSuggestionFeedbackEventRecord[],
): Record<string, AiSuggestionFeedbackType> {
  const latestByHistoryEntry: Record<string, AiSuggestionFeedbackType> = {};

  for (const event of events) {
    if (latestByHistoryEntry[event.historyEntryId] === undefined) {
      latestByHistoryEntry[event.historyEntryId] = event.feedbackType;
    }
  }

  return latestByHistoryEntry;
}

function summarizeLatestFeedbackState(events: AiSuggestionFeedbackEventRecord[]): AiSuggestionFeedbackSummary {
  const summary: AiSuggestionFeedbackSummary = {
    applied: 0,
    edited: 0,
    dismissed: 0,
    total: 0,
  };
  const latestByHistoryEntry = getLatestFeedbackState(events);

  for (const feedbackType of Object.values(latestByHistoryEntry)) {
    if (feedbackType === AiSuggestionFeedbackType.APPLIED) {
      summary.applied += 1;
    } else if (feedbackType === AiSuggestionFeedbackType.EDITED) {
      summary.edited += 1;
    } else if (feedbackType === AiSuggestionFeedbackType.DISMISSED) {
      summary.dismissed += 1;
    }
  }

  summary.total = summary.applied + summary.edited + summary.dismissed;

  return summary;
}

function mapFeedbackEvent(event: AiSuggestionFeedbackEventRecord): AiSuggestionFeedbackEventDto {
  return {
    id: event.id,
    historyEntryId: event.historyEntryId,
    projectId: event.projectId,
    userId: event.userId,
    feedbackType: event.feedbackType,
    notes: event.notes ?? undefined,
    timestamp: event.createdAt.toISOString(),
  };
}

function normalizeNotes(notes: string | undefined): string | undefined {
  const normalized = notes?.trim().slice(0, MAX_NOTES_LENGTH);

  return normalized === "" ? undefined : normalized;
}
