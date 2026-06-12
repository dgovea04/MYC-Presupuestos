import { Prisma } from "@prisma/client";

import type { AiAction, AiContext, AiEndpointResult } from "@/lib/ai/types";
import { prisma } from "@/lib/db/prisma";

export type AiProjectHistoryEntry = {
  id: string;
  projectId: string;
  userId: string;
  action: AiProjectHistoryAction;
  summary: string;
  context: AiContext;
  result: AiEndpointResult;
  provider?: string;
  task?: string;
  promptHash?: string;
  responseHash?: string;
  timestamp: string;
};

export type RecordAiProjectHistoryInput = {
  projectId: string;
  userId: string;
  action: AiProjectHistoryAction;
  summary: string;
  context?: AiContext;
  result: AiEndpointResult;
};

type AiProjectHistoryAction = Exclude<AiAction, "json">;

const DEFAULT_HISTORY_LIMIT = 20;
const MAX_SUMMARY_LENGTH = 240;

export async function getAiProjectHistory(
  projectId: string,
  userId: string,
  limit = DEFAULT_HISTORY_LIMIT,
): Promise<AiProjectHistoryEntry[]> {
  const project = await findOwnedProject(projectId, userId);

  if (!project) {
    return [];
  }

  const entries = await prisma.aiProjectHistoryEntry.findMany({
    where: {
      projectId,
      userId,
    },
    orderBy: {
      createdAt: "desc",
    },
    take: clampHistoryLimit(limit),
  });

  return entries.map(mapHistoryEntry);
}

export async function recordAiProjectHistory({
  action,
  context = {},
  projectId,
  result,
  summary,
  userId,
}: RecordAiProjectHistoryInput): Promise<AiProjectHistoryEntry | null> {
  const project = await findOwnedProject(projectId, userId);

  if (!project) {
    return null;
  }

  const entry = await prisma.aiProjectHistoryEntry.create({
    data: {
      projectId,
      userId,
      action,
      summary: summary.slice(0, MAX_SUMMARY_LENGTH),
      context: toJsonObject(context),
      answer: result.answer,
      structuredData: result.structuredData === undefined ? Prisma.JsonNull : toJsonValue(result.structuredData),
      model: result.model,
      requestedModel: result.requestedModel,
      fallbackUsed: result.fallbackUsed,
      warnings: result.warnings,
      latencyMs: result.latencyMs,
      provider: result.provider,
      task: result.task,
      promptHash: result.promptHash,
      responseHash: result.responseHash,
    },
  });

  return mapHistoryEntry(entry);
}

function findOwnedProject(projectId: string, userId: string) {
  return prisma.project.findFirst({
    where: {
      id: projectId,
      company: {
        userId,
      },
    },
    select: {
      id: true,
    },
  });
}

function clampHistoryLimit(limit: number) {
  if (!Number.isFinite(limit)) {
    return DEFAULT_HISTORY_LIMIT;
  }

  return Math.min(Math.max(Math.trunc(limit), 1), DEFAULT_HISTORY_LIMIT);
}

function mapHistoryEntry(entry: {
  id: string;
  projectId: string;
  userId: string;
  action: string;
  summary: string;
  context: unknown;
  answer: string;
  structuredData: unknown;
  model: string;
  requestedModel: string;
  fallbackUsed: boolean;
  warnings: string[];
  latencyMs: number | null;
  provider: string | null;
  task: string | null;
  promptHash: string | null;
  responseHash: string | null;
  createdAt: Date;
}): AiProjectHistoryEntry {
  return {
    id: entry.id,
    projectId: entry.projectId,
    userId: entry.userId,
    action: readHistoryAction(entry.action),
    summary: entry.summary,
    context: readHistoryContext(entry.context),
    result: {
      answer: entry.answer,
      model: entry.model,
      requestedModel: entry.requestedModel,
      fallbackUsed: entry.fallbackUsed,
      warnings: entry.warnings,
      latencyMs: entry.latencyMs ?? undefined,
      structuredData: entry.structuredData ?? undefined,
    },
    provider: entry.provider ?? undefined,
    task: entry.task ?? undefined,
    promptHash: entry.promptHash ?? undefined,
    responseHash: entry.responseHash ?? undefined,
    timestamp: entry.createdAt.toISOString(),
  };
}

function readHistoryAction(action: string): AiProjectHistoryAction {
  if (action === "apu" || action === "review" || action === "autocomplete") {
    return action;
  }

  return "chat";
}

function readHistoryContext(value: unknown): AiContext {
  if (!isRecord(value)) {
    return {};
  }

  return removeUndefinedValues({
    project: typeof value.project === "string" ? value.project : undefined,
    module: typeof value.module === "string" ? value.module : undefined,
    selectedItem: typeof value.selectedItem === "string" ? value.selectedItem : undefined,
    unit: typeof value.unit === "string" ? value.unit : undefined,
    currentCost: typeof value.currentCost === "number" ? value.currentCost : undefined,
    activeTable: typeof value.activeTable === "string" ? value.activeTable : undefined,
  });
}

function toJsonObject(context: AiContext): Prisma.JsonObject {
  return removeUndefinedValues(context) as Prisma.JsonObject;
}

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value ?? null)) as Prisma.InputJsonValue;
}

function removeUndefinedValues<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, entryValue]) => entryValue !== undefined)) as T;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
