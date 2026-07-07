import { Prisma } from "@prisma/client";
import type {
  CollaborationPresenceRecord,
  CollaborationEditSessionRecord,
  CollaborationCommentRecord,
  BudgetChangeRecord,
  BudgetVersionRecord,
  BudgetVersionDetailRecord,
} from "@/types/collaboration";

/**
 * Converts Prisma Decimal to a string that preserves full precision.
 * Returns null for null/undefined values.
 */
export function decimalToSerializableString(value: Prisma.Decimal | number | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === "number") {
    return value.toString();
  }
  return value.toString();
}

function toIso(date: Date | string | null | undefined): string | null {
  if (!date) return null;
  return date instanceof Date ? date.toISOString() : new Date(date).toISOString();
}

type RawPresence = {
  id: string;
  companyId: string;
  projectId: string;
  budgetId: string;
  userId: string;
  route: string;
  module: string;
  status: string;
  lastSeenAt: Date;
  expiresAt: Date;
  user?: { name: string; avatarUrl: string | null };
};

export function serializePresence(raw: RawPresence): CollaborationPresenceRecord {
  return {
    id: raw.id,
    companyId: raw.companyId,
    projectId: raw.projectId,
    budgetId: raw.budgetId,
    userId: raw.userId,
    userName: raw.user?.name ?? "Desconocido",
    userAvatarUrl: raw.user?.avatarUrl ?? null,
    route: raw.route,
    module: raw.module,
    status: raw.status as CollaborationPresenceRecord["status"],
    lastSeenAt: toIso(raw.lastSeenAt) ?? "",
    expiresAt: toIso(raw.expiresAt) ?? "",
  };
}

type RawEditSession = {
  id: string;
  companyId: string;
  projectId: string;
  budgetId: string;
  userId: string;
  entityType: string;
  entityId: string;
  field: string;
  startedAt: Date;
  lastHeartbeatAt: Date;
  expiresAt: Date;
  user?: { name: string };
};

export function serializeEditSession(raw: RawEditSession): CollaborationEditSessionRecord {
  return {
    id: raw.id,
    companyId: raw.companyId,
    projectId: raw.projectId,
    budgetId: raw.budgetId,
    userId: raw.userId,
    userName: raw.user?.name ?? "Desconocido",
    entityType: raw.entityType as CollaborationEditSessionRecord["entityType"],
    entityId: raw.entityId,
    field: raw.field,
    startedAt: toIso(raw.startedAt) ?? "",
    lastHeartbeatAt: toIso(raw.lastHeartbeatAt) ?? "",
    expiresAt: toIso(raw.expiresAt) ?? "",
  };
}

type RawComment = {
  id: string;
  companyId: string;
  projectId: string;
  budgetId: string;
  entityType: string;
  entityId: string;
  parentCommentId: string | null;
  body: string;
  mentions: string[];
  createdById: string;
  resolvedAt: Date | null;
  resolvedById: string | null;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: { name: string; avatarUrl: string | null };
  resolvedBy?: { name: string } | null;
  _count?: { replies: number };
};

export function serializeComment(raw: RawComment): CollaborationCommentRecord {
  return {
    id: raw.id,
    companyId: raw.companyId,
    projectId: raw.projectId,
    budgetId: raw.budgetId,
    entityType: raw.entityType as CollaborationCommentRecord["entityType"],
    entityId: raw.entityId,
    parentCommentId: raw.parentCommentId,
    body: raw.body,
    mentions: raw.mentions,
    createdById: raw.createdById,
    createdByName: raw.createdBy?.name ?? "Desconocido",
    createdByAvatarUrl: raw.createdBy?.avatarUrl ?? null,
    resolvedAt: toIso(raw.resolvedAt),
    resolvedById: raw.resolvedById,
    resolvedByName: raw.resolvedBy?.name ?? null,
    createdAt: toIso(raw.createdAt) ?? "",
    updatedAt: toIso(raw.updatedAt) ?? "",
    replyCount: raw._count?.replies ?? 0,
  };
}

type RawChangeEvent = {
  id: string;
  companyId: string;
  projectId: string;
  budgetId: string;
  entityType: string;
  entityId: string;
  action: string;
  field: string;
  oldValue: string | null;
  newValue: string | null;
  diffSummary: string | null;
  source: string;
  userId: string | null;
  requestId: string | null;
  createdAt: Date;
  user?: { name: string } | null;
};

export function serializeChangeEvent(raw: RawChangeEvent): BudgetChangeRecord {
  return {
    id: raw.id,
    companyId: raw.companyId,
    projectId: raw.projectId,
    budgetId: raw.budgetId,
    entityType: raw.entityType as BudgetChangeRecord["entityType"],
    entityId: raw.entityId,
    action: raw.action,
    field: raw.field,
    oldValue: raw.oldValue,
    newValue: raw.newValue,
    diffSummary: raw.diffSummary,
    source: raw.source as BudgetChangeRecord["source"],
    userId: raw.userId,
    userName: raw.user?.name ?? null,
    requestId: raw.requestId,
    createdAt: toIso(raw.createdAt) ?? "",
  };
}

type RawVersion = {
  id: string;
  budgetId: string;
  projectId: string;
  companyId: string;
  versionNumber: number;
  label: string | null;
  reason: string | null;
  snapshot: unknown;
  createdById: string;
  createdAt: Date;
  createdBy?: { name: string };
};

export function serializeVersion(raw: RawVersion): BudgetVersionRecord {
  return {
    id: raw.id,
    budgetId: raw.budgetId,
    projectId: raw.projectId,
    companyId: raw.companyId,
    versionNumber: raw.versionNumber,
    label: raw.label,
    reason: raw.reason,
    createdById: raw.createdById,
    createdByName: raw.createdBy?.name ?? "Desconocido",
    createdAt: toIso(raw.createdAt) ?? "",
  };
}

export function serializeVersionWithSnapshot(raw: RawVersion): BudgetVersionDetailRecord {
  return {
    ...serializeVersion(raw),
    snapshot: raw.snapshot,
  };
}

/**
 * Builds a simple field diff by comparing old and new values.
 * Both values should already be serialized as strings to preserve Decimal precision.
 */
export function buildFieldDiff(
  field: string,
  oldValue: string | null,
  newValue: string | null,
): { diffSummary: string; hasChanged: boolean } {
  if (oldValue === newValue) {
    return { diffSummary: "", hasChanged: false };
  }
  const oldDisplay = oldValue ?? "—";
  const newDisplay = newValue ?? "—";
  return {
    diffSummary: `${field}: ${oldDisplay} → ${newDisplay}`,
    hasChanged: true,
  };
}
