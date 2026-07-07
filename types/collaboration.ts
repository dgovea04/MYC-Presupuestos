import type {
  CollaborationEntityType,
  CollaborationPresenceStatus,
  CollaborationChangeSource,
} from "@prisma/client";

export type { CollaborationEntityType, CollaborationPresenceStatus, CollaborationChangeSource };

export interface CollaborationEntityRef {
  entityType: CollaborationEntityType;
  entityId: string;
}

export interface CollaborationPresenceRecord {
  id: string;
  companyId: string;
  projectId: string;
  budgetId: string;
  userId: string;
  userName: string;
  userAvatarUrl: string | null;
  route: string;
  module: string;
  status: CollaborationPresenceStatus;
  lastSeenAt: string;
  expiresAt: string;
}

export interface CollaborationEditSessionRecord {
  id: string;
  companyId: string;
  projectId: string;
  budgetId: string;
  userId: string;
  userName: string;
  entityType: CollaborationEntityType;
  entityId: string;
  field: string;
  startedAt: string;
  lastHeartbeatAt: string;
  expiresAt: string;
}

export interface CollaborationCommentRecord {
  id: string;
  companyId: string;
  projectId: string;
  budgetId: string;
  entityType: CollaborationEntityType;
  entityId: string;
  parentCommentId: string | null;
  body: string;
  mentions: string[];
  createdById: string;
  createdByName: string;
  createdByAvatarUrl: string | null;
  resolvedAt: string | null;
  resolvedById: string | null;
  resolvedByName: string | null;
  createdAt: string;
  updatedAt: string;
  replyCount: number;
}

export interface BudgetChangeRecord {
  id: string;
  companyId: string;
  projectId: string;
  budgetId: string;
  entityType: CollaborationEntityType;
  entityId: string;
  action: string;
  field: string;
  oldValue: string | null;
  newValue: string | null;
  diffSummary: string | null;
  source: CollaborationChangeSource;
  userId: string | null;
  userName: string | null;
  requestId: string | null;
  createdAt: string;
}

export interface BudgetVersionRecord {
  id: string;
  budgetId: string;
  projectId: string;
  companyId: string;
  versionNumber: number;
  label: string | null;
  reason: string | null;
  createdById: string;
  createdByName: string;
  createdAt: string;
}

export interface BudgetVersionDetailRecord extends BudgetVersionRecord {
  snapshot: unknown;
}

export type CollaborationStreamEventType =
  | "presence.updated"
  | "edit-session.started"
  | "edit-session.heartbeat"
  | "edit-session.finished"
  | "comment.created"
  | "comment.updated"
  | "change.created"
  | "version.created"
  | "version.restored"
  | "note.shared"
  | "ping";

export interface CollaborationStreamEvent {
  type: CollaborationStreamEventType;
  budgetId: string;
  timestamp: string;
  payload: unknown;
}
