import { assertProjectInWorkspace, assertWorkspaceMembership } from "@/lib/workspace/access";
import { WorkspaceAuthorizationError } from "@/lib/workspace/authorization";
import { prisma } from "@/lib/db/prisma";
import type { AdminCapability } from "@/lib/auth/admin-permissions";
import type { KnowledgeScope } from "@/lib/knowledge/types";
import type { WorkspaceRole } from "@/types/workspace";
import { KnowledgeRequestValidationError } from "@/lib/knowledge/route-errors";

export type KnowledgeEntityType = "KnowledgeSource" | "KnowledgeEvidence" | "CanonicalItem" | "CanonicalResource";

export type KnowledgeOwnership = {
  companyId: string | null;
  projectId: string | null;
  scope: KnowledgeScope;
};

export type KnowledgeAccessOptions = {
  actorUserId: string;
  companyId?: string;
  projectId?: string;
  scope?: KnowledgeScope;
  entityType?: KnowledgeEntityType;
  entityId?: string;
  userId?: string;
  minimumRole?: WorkspaceRole;
  capability?: AdminCapability;
  /** Allows tenant knowledge to reference a GLOBAL catalog entity without mutating it. */
  allowGlobalReference?: boolean;
};

const KNOWLEDGE_ACCESS_DENIED = "Knowledge tenant access denied";

const workspaceRoleRank: Record<WorkspaceRole, number> = {
  OWNER: 4,
  ADMIN: 3,
  EDITOR: 2,
  VIEWER: 1,
};

const workspaceAuthorizationMessages = new Set([
  "Workspace no disponible",
  "No tienes el rol necesario en este workspace",
  "El proyecto no pertenece a este workspace",
]);

function authorizationError(error: unknown): WorkspaceAuthorizationError | null {
  if (error instanceof WorkspaceAuthorizationError) return error;
  if (error instanceof Error && workspaceAuthorizationMessages.has(error.message)) {
    return new WorkspaceAuthorizationError(error.message);
  }
  return null;
}

export async function assertKnowledgeApiScopeAccess(options: {
  actorUserId: string;
  scope: KnowledgeScope;
  companyId?: string;
  projectId?: string;
  userId?: string;
  minimumRole?: WorkspaceRole;
}) {
  if (options.scope === "USER" && options.userId && options.userId !== options.actorUserId) {
    throw new Error("No puedes escribir conocimiento de otro usuario");
  }
  if (options.scope === "COMPANY" || options.scope === "PROJECT") {
    if (!options.companyId) throw new KnowledgeRequestValidationError("companyId es requerido para este alcance");
    await assertWorkspaceMembership({ userId: options.actorUserId, companyId: options.companyId, minimumRole: options.minimumRole ?? "EDITOR" });
  }
  if (options.scope === "PROJECT") {
    if (!options.projectId) throw new KnowledgeRequestValidationError("projectId es requerido para alcance PROJECT");
    await assertProjectInWorkspace({ companyId: options.companyId!, projectId: options.projectId });
  }
}

export async function assertKnowledgeReadAccess(options: KnowledgeAccessOptions): Promise<KnowledgeOwnership> {
  return assertKnowledgeAccess(options, "VIEWER");
}

export async function assertKnowledgeWriteAccess(options: KnowledgeAccessOptions): Promise<KnowledgeOwnership> {
  return assertKnowledgeAccess(options, "EDITOR");
}

async function assertKnowledgeAccess(options: KnowledgeAccessOptions, defaultRole: WorkspaceRole): Promise<KnowledgeOwnership> {
  if ((options.entityType === undefined) !== (options.entityId === undefined)) {
    throw new KnowledgeRequestValidationError("entityType y entityId deben proporcionarse juntos");
  }

  if (options.scope === "USER" && options.userId && options.userId !== options.actorUserId) {
    throw new WorkspaceAuthorizationError("No puedes escribir conocimiento de otro usuario");
  }

  if (options.scope === "GLOBAL" && options.capability !== "knowledge.manage") {
    throw new WorkspaceAuthorizationError(KNOWLEDGE_ACCESS_DENIED);
  }

  const requestedRole = options.minimumRole ?? defaultRole;
  const minimumRole = defaultRole === "EDITOR" && workspaceRoleRank[requestedRole] < workspaceRoleRank.EDITOR
    ? "EDITOR"
    : requestedRole;

  if (options.scope !== "GLOBAL" && (options.scope === "COMPANY" || options.scope === "PROJECT") && !options.companyId) {
    throw new KnowledgeRequestValidationError("companyId es requerido para este alcance");
  }

  if (options.companyId && options.scope !== "GLOBAL") {
    try {
      await assertWorkspaceMembership({ userId: options.actorUserId, companyId: options.companyId, minimumRole });
    } catch (error) {
      const authorizationFailure = authorizationError(error);
      if (authorizationFailure) throw authorizationFailure;
      throw error;
    }
  }

  if (options.projectId) {
    if (!options.companyId) throw new KnowledgeRequestValidationError("companyId es requerido para alcance PROJECT");
    try {
      await assertProjectInWorkspace({ companyId: options.companyId, projectId: options.projectId });
    } catch (error) {
      const authorizationFailure = authorizationError(error);
      if (authorizationFailure) throw authorizationFailure;
      throw error;
    }
  }

  const requestedOwnership: KnowledgeOwnership = {
    companyId: options.scope === "GLOBAL" ? null : options.companyId ?? null,
    projectId: options.projectId ?? null,
    scope: options.scope ?? (options.projectId ? "PROJECT" : options.companyId ? "COMPANY" : "USER"),
  };

  if (!options.entityType || !options.entityId) return requestedOwnership;

  const ownership = await findKnowledgeEntityOwnership(options.entityType, options.entityId);
  if (!ownership) throw new WorkspaceAuthorizationError(KNOWLEDGE_ACCESS_DENIED);

  if (ownership.scope === "GLOBAL") {
    if (options.capability !== "knowledge.manage" && !options.allowGlobalReference) throw new WorkspaceAuthorizationError(KNOWLEDGE_ACCESS_DENIED);
    return ownership;
  }

  if (!options.companyId || ownership.companyId !== options.companyId || (options.projectId !== undefined && ownership.projectId !== options.projectId)) {
    throw new WorkspaceAuthorizationError(KNOWLEDGE_ACCESS_DENIED);
  }

  if (options.scope === "GLOBAL") throw new WorkspaceAuthorizationError(KNOWLEDGE_ACCESS_DENIED);
  return ownership;
}

export async function assertKnowledgeEntityAccess(options: {
  actorUserId: string;
  entityType: KnowledgeEntityType;
  entityId: string;
  companyId: string;
  projectId?: string;
  minimumRole?: WorkspaceRole;
}) {
  return assertKnowledgeWriteAccess(options);
}

async function findKnowledgeEntityOwnership(entityType: KnowledgeEntityType, entityId: string): Promise<KnowledgeOwnership | null> {
  if (entityType === "KnowledgeSource") {
    return prisma.knowledgeSource.findUnique({ where: { id: entityId }, select: { companyId: true, projectId: true } }).then((row) => row ? { ...row, scope: "COMPANY" as const } : null);
  }
  if (entityType === "KnowledgeEvidence") {
    const evidence = await prisma.knowledgeEvidence.findUnique({ where: { id: entityId }, select: { companyId: true, projectId: true, source: { select: { companyId: true, projectId: true } } } });
    return evidence ? { companyId: evidence.companyId ?? evidence.source.companyId, projectId: evidence.projectId ?? evidence.source.projectId, scope: "COMPANY" as const } : null;
  }
  if (entityType === "CanonicalItem") {
    return prisma.canonicalItem.findUnique({ where: { id: entityId }, select: { companyId: true, scope: true } }).then((row) => row ? { companyId: row.scope === "GLOBAL" ? null : row.companyId, projectId: null, scope: row.scope } : null);
  }
  return prisma.canonicalResource.findUnique({ where: { id: entityId }, select: { companyId: true, scope: true } }).then((row) => row ? { companyId: row.scope === "GLOBAL" ? null : row.companyId, projectId: null, scope: row.scope } : null);
}
