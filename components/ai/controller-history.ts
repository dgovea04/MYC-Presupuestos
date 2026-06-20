import type { AiFeedbackState, AiFeedbackSummary, AiFeedbackType, AiHistoryEntry, AiResultWithHistory } from "@/components/ai/use-ai-assistant-controller";
import { isRecord, readHistoryEntry } from "@/components/ai/controller-parsers";

const AI_HISTORY_STORAGE_KEY = "myc-ai-session-history";
const AI_FEEDBACK_STORAGE_KEY = "myc-ai-session-feedback";

export function readStoredHistory(): AiHistoryEntry[] {
  if (typeof window === "undefined") return [];
  const rawHistory = window.localStorage.getItem(AI_HISTORY_STORAGE_KEY);
  if (!rawHistory) return [];
  try {
    const parsed = JSON.parse(rawHistory) as AiHistoryEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function persistStoredHistory(history: AiHistoryEntry[]) {
  try {
    window.localStorage.setItem(AI_HISTORY_STORAGE_KEY, JSON.stringify(history.slice(0, 8)));
  } catch {
    // Best effort only
  }
}

export function readStoredFeedback(): AiFeedbackState {
  if (typeof window === "undefined") return {};
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(AI_FEEDBACK_STORAGE_KEY) ?? "{}");
    if (!isRecord(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed).filter((entry): entry is [string, AiFeedbackType] => isFeedbackType(entry[1])),
    );
  } catch {
    return {};
  }
}

export function persistStoredFeedback(feedback: AiFeedbackState) {
  try {
    window.localStorage.setItem(AI_FEEDBACK_STORAGE_KEY, JSON.stringify(feedback));
  } catch {
    // Best effort only
  }
}

export function isFeedbackType(value: unknown): value is AiFeedbackType {
  return value === "APPLIED" || value === "EDITED" || value === "DISMISSED";
}

export function createEmptyFeedbackSummary(): AiFeedbackSummary {
  return { applied: 0, edited: 0, dismissed: 0 };
}

export function summarizeFeedbackState(state: AiFeedbackState): AiFeedbackSummary {
  return Object.values(state).reduce(
    (summary, feedbackType) => updateFeedbackSummary(summary, undefined, feedbackType),
    createEmptyFeedbackSummary(),
  );
}

export function updateFeedbackSummary(
  summary: AiFeedbackSummary,
  previous: AiFeedbackType | undefined,
  next: AiFeedbackType | undefined,
): AiFeedbackSummary {
  const updated = { ...summary };
  if (previous === "APPLIED") updated.applied -= 1;
  if (previous === "EDITED") updated.edited -= 1;
  if (previous === "DISMISSED") updated.dismissed -= 1;
  if (next === "APPLIED") updated.applied += 1;
  if (next === "EDITED") updated.edited += 1;
  if (next === "DISMISSED") updated.dismissed += 1;
  return {
    applied: Math.max(0, updated.applied),
    edited: Math.max(0, updated.edited),
    dismissed: Math.max(0, updated.dismissed),
    total: updated.total,
  };
}

export function readFeedbackEntryForResult(result: AiResultWithHistory, history: AiHistoryEntry[]) {
  if (result.historyEntry) return result.historyEntry;
  return history.find((entry) => entry.result === result) ?? null;
}

export function readFeedbackSummary(value: Record<string, unknown>): AiFeedbackSummary {
  return {
    applied: typeof value.applied === "number" ? value.applied : 0,
    edited: typeof value.edited === "number" ? value.edited : 0,
    dismissed: typeof value.dismissed === "number" ? value.dismissed : 0,
    total: typeof value.total === "number" ? value.total : undefined,
  };
}

export function readFeedbackErrorMessage(payload: unknown) {
  if (isRecord(payload) && typeof payload.error === "string") return payload.error;
  return "No se pudo registrar la metrica de calidad.";
}

type AiFeedbackSummaryLoadResult =
  | { ok: true; summary: AiFeedbackSummary }
  | { ok: false };

export async function loadProjectHistory(projectId: string): Promise<AiHistoryEntry[]> {
  try {
    const response = await fetch(`/api/projects/${projectId}/ai-history`);
    if (!response.ok) return [];
    const payload: unknown = await response.json();
    if (!isRecord(payload) || !Array.isArray(payload.entries)) return [];
    return payload.entries
      .map(readHistoryEntry)
      .filter((entry): entry is AiHistoryEntry => entry !== null);
  } catch {
    return [];
  }
}

export async function loadProjectFeedbackSummary(projectId: string): Promise<AiFeedbackSummaryLoadResult> {
  try {
    const response = await fetch(`/api/projects/${projectId}/ai-feedback/summary`);
    if (!response.ok) return { ok: false };
    const payload: unknown = await response.json();
    if (!isRecord(payload) || !isRecord(payload.summary)) return { ok: false };
    return { ok: true, summary: readFeedbackSummary(payload.summary) };
  } catch {
    return { ok: false };
  }
}

export async function loadProjectLatestFeedback(projectId: string, historyEntryIds: string[]): Promise<AiFeedbackState> {
  if (historyEntryIds.length === 0) return {};
  const query = new URLSearchParams();
  for (const id of historyEntryIds) query.append("historyEntryId", id);
  try {
    const response = await fetch(`/api/projects/${projectId}/ai-feedback/latest?${query.toString()}`);
    if (!response.ok) return {};
    const payload: unknown = await response.json();
    if (!isRecord(payload) || !isRecord(payload.feedbackByHistoryId)) return {};
    return Object.fromEntries(
      Object.entries(payload.feedbackByHistoryId).filter(
        (entry): entry is [string, AiFeedbackType] => typeof entry[0] === "string" && isFeedbackType(entry[1]),
      ),
    );
  } catch {
    return {};
  }
}
