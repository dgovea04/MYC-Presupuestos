import { AiSuggestionFeedbackType } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";

export type AiSuggestionFeedbackEventDto = {
  id: string;
  historyEntryId: string;
  projectId: string;
  userId: string;
  feedbackType: AiSuggestionFeedbackType;
  notes?: string;
  provider?: string;
  model?: string;
  task?: string;
  suggestionType?: string;
  actionType?: string;
  promptHash?: string;
  responseHash?: string;
  timestamp: string;
};

export type AiSuggestionFeedbackSummary = {
  applied: number;
  edited: number;
  dismissed: number;
  total: number;
  acceptanceRate: string;
  editRate: string;
  discardRate: string;
  providerQuality: AiSuggestionFeedbackProviderQuality[];
};

export type AiSuggestionFeedbackProviderQuality = {
  provider: string;
  applied: number;
  edited: number;
  dismissed: number;
  total: number;
  acceptanceRate: string;
};

export type RecordAiSuggestionFeedbackInput = {
  historyEntryId: string;
  projectId: string;
  userId: string;
  feedbackType: AiSuggestionFeedbackType;
  notes?: string;
  provider?: string;
  model?: string;
  task?: string;
  suggestionType?: string;
  actionType?: string;
  promptHash?: string;
  responseHash?: string;
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

export type GetUserAiFeedbackSummaryInput = {
  userId: string;
};

export type FeedbackTrendPoint = {
  weekKey: string;
  weekLabel: string;
  applied: number;
  edited: number;
  dismissed: number;
  total: number;
  acceptanceRate: string;
};

type AiSuggestionFeedbackEventRecord = {
  id: string;
  historyEntryId: string;
  projectId: string;
  userId: string;
  feedbackType: AiSuggestionFeedbackType;
  notes: string | null;
  provider?: string | null;
  model?: string | null;
  task?: string | null;
  suggestionType?: string | null;
  actionType?: string | null;
  promptHash?: string | null;
  responseHash?: string | null;
  createdAt: Date;
};

const MAX_NOTES_LENGTH = 500;

export async function recordAiSuggestionFeedback({
  actionType,
  feedbackType,
  historyEntryId,
  model,
  notes,
  promptHash,
  projectId,
  provider,
  responseHash,
  suggestionType,
  task,
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
      provider: normalizeMetadata(provider) ?? normalizeMetadata(historyEntry.provider),
      model: normalizeMetadata(model) ?? normalizeMetadata(historyEntry.model),
      task: normalizeMetadata(task) ?? normalizeMetadata(historyEntry.task),
      suggestionType: normalizeMetadata(suggestionType),
      actionType: normalizeMetadata(actionType),
      promptHash: normalizeMetadata(promptHash) ?? normalizeMetadata(historyEntry.promptHash),
      responseHash: normalizeMetadata(responseHash) ?? normalizeMetadata(historyEntry.responseHash),
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
        project: {            company: {
              memberships: {
                some: {
                  userId,
                  status: "ACTIVE",
                },
              },
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
        project: {            company: {
              memberships: {
                some: {
                  userId,
                  status: "ACTIVE",
                },
              },
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

export async function getUserAiFeedbackSummary({
  userId,
}: GetUserAiFeedbackSummaryInput): Promise<AiSuggestionFeedbackSummary> {
  const events = await prisma.aiSuggestionFeedbackEvent.findMany({
    where: {
      userId,
      historyEntry: {
        userId,
        project: {            company: {
              memberships: {
                some: {
                  userId,
                  status: "ACTIVE",
                },
              },
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

export async function getUserFeedbackTrends({
  userId,
}: GetUserAiFeedbackSummaryInput): Promise<FeedbackTrendPoint[]> {
  const events = await prisma.aiSuggestionFeedbackEvent.findMany({
    where: {
      userId,
      historyEntry: {
        userId,
        project: {            company: {
              memberships: {
                some: {
                  userId,
                  status: "ACTIVE",
                },
              },
            },
        },
      },
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  return computeWeeklyTrends(events);
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
      provider: true,
      model: true,
      task: true,
      promptHash: true,
      responseHash: true,
    },
  });
}

function computeWeeklyTrends(events: AiSuggestionFeedbackEventRecord[]): FeedbackTrendPoint[] {
  const latestByEntry = getLatestFeedbackEvents(events);
  const byWeek = new Map<string, Pick<FeedbackTrendPoint, "applied" | "edited" | "dismissed"> & { weekStart: Date }>();

  // Sort by createdAt ascending (oldest first) for consistent week ordering
  const sorted = [...latestByEntry].sort(
    (left, right) => left.createdAt.getTime() - right.createdAt.getTime(),
  );

  for (const event of sorted) {
    const weekKey = getIsoWeekKey(event.createdAt);
    const existing = byWeek.get(weekKey);
    if (!existing) {
      byWeek.set(weekKey, {
        weekStart: getWeekStart(event.createdAt),
        applied: 0,
        edited: 0,
        dismissed: 0,
      });
    }
    const bucket = byWeek.get(weekKey)!;
    incrementSummary(bucket, event.feedbackType);
  }

  const sortedWeeks = [...byWeek.entries()].sort(
    ([, left], [, right]) => left.weekStart.getTime() - right.weekStart.getTime(),
  );

  return sortedWeeks.map(([weekKey, bucket]) => {
    const total = bucket.applied + bucket.edited + bucket.dismissed;
    return {
      weekKey,
      weekLabel: formatWeekLabel(bucket.weekStart),
      applied: bucket.applied,
      edited: bucket.edited,
      dismissed: bucket.dismissed,
      total,
      acceptanceRate: formatRate(bucket.applied, total),
    };
  });
}

function getIsoWeekKey(date: Date): string {
  const year = date.getFullYear();
  const startOfYear = new Date(year, 0, 1);
  const dayOfYear = Math.floor((date.getTime() - startOfYear.getTime()) / 86400000);
  const week = Math.ceil((dayOfYear + startOfYear.getDay() + 1) / 7);
  return `${year}-W${String(week).padStart(2, "0")}`;
}

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay());
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatWeekLabel(weekStart: Date): string {
  const months = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  const day = weekStart.getDate();
  const month = months[weekStart.getMonth()];
  return `${day} ${month}`;
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
    acceptanceRate: "0.000",
    editRate: "0.000",
    discardRate: "0.000",
    providerQuality: [],
  };
  const latestEvents = getLatestFeedbackEvents(events);

  for (const event of latestEvents) {
    incrementSummary(summary, event.feedbackType);
  }

  summary.total = summary.applied + summary.edited + summary.dismissed;
  summary.acceptanceRate = formatRate(summary.applied, summary.total);
  summary.editRate = formatRate(summary.edited, summary.total);
  summary.discardRate = formatRate(summary.dismissed, summary.total);
  summary.providerQuality = summarizeProviderQuality(latestEvents);

  return summary;
}

function getLatestFeedbackEvents(events: AiSuggestionFeedbackEventRecord[]): AiSuggestionFeedbackEventRecord[] {
  const latestByHistoryEntry: Record<string, AiSuggestionFeedbackEventRecord> = {};

  for (const event of events) {
    if (latestByHistoryEntry[event.historyEntryId] === undefined) {
      latestByHistoryEntry[event.historyEntryId] = event;
    }
  }

  return Object.values(latestByHistoryEntry);
}

function summarizeProviderQuality(events: AiSuggestionFeedbackEventRecord[]): AiSuggestionFeedbackProviderQuality[] {
  const byProvider = new Map<string, AiSuggestionFeedbackProviderQuality>();

  for (const event of events) {
    const provider = event.provider?.trim();
    if (!provider) {
      continue;
    }

    const summary =
      byProvider.get(provider) ??
      ({
        provider,
        applied: 0,
        edited: 0,
        dismissed: 0,
        total: 0,
        acceptanceRate: "0.000",
      } satisfies AiSuggestionFeedbackProviderQuality);

    incrementSummary(summary, event.feedbackType);
    summary.total = summary.applied + summary.edited + summary.dismissed;
    summary.acceptanceRate = formatRate(summary.applied, summary.total);
    byProvider.set(provider, summary);
  }

  return [...byProvider.values()].sort((left, right) => {
    if (right.total !== left.total) return right.total - left.total;
    return left.provider.localeCompare(right.provider);
  });
}

function incrementSummary(
  summary: Pick<AiSuggestionFeedbackSummary, "applied" | "edited" | "dismissed">,
  feedbackType: AiSuggestionFeedbackType,
) {
  if (feedbackType === AiSuggestionFeedbackType.APPLIED) {
    summary.applied += 1;
  } else if (feedbackType === AiSuggestionFeedbackType.EDITED) {
    summary.edited += 1;
  } else if (feedbackType === AiSuggestionFeedbackType.DISMISSED) {
    summary.dismissed += 1;
  }
}

function formatRate(part: number, total: number) {
  if (total === 0) {
    return "0.000";
  }

  return (part / total).toFixed(3);
}

function mapFeedbackEvent(event: AiSuggestionFeedbackEventRecord): AiSuggestionFeedbackEventDto {
  return {
    id: event.id,
    historyEntryId: event.historyEntryId,
    projectId: event.projectId,
    userId: event.userId,
    feedbackType: event.feedbackType,
    notes: event.notes ?? undefined,
    provider: event.provider ?? undefined,
    model: event.model ?? undefined,
    task: event.task ?? undefined,
    suggestionType: event.suggestionType ?? undefined,
    actionType: event.actionType ?? undefined,
    promptHash: event.promptHash ?? undefined,
    responseHash: event.responseHash ?? undefined,
    timestamp: event.createdAt.toISOString(),
  };
}

function normalizeNotes(notes: string | undefined): string | undefined {
  const normalized = notes?.trim().slice(0, MAX_NOTES_LENGTH);

  return normalized === "" ? undefined : normalized;
}

function normalizeMetadata(value: string | null | undefined): string | undefined {
  const normalized = value?.trim();

  return normalized ? normalized : undefined;
}
