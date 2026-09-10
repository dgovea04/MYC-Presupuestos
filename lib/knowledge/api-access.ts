import { assertProjectInWorkspace, assertWorkspaceMembership } from "@/lib/workspace/access";
import { prisma } from "@/lib/db/prisma";
import type { KnowledgeScope } from "@/lib/knowledge/types";
import type { WorkspaceRole } from "@/types/workspace";

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
    if (!options.companyId) throw new Error("companyId es requerido para este alcance");
    await assertWorkspaceMembership({ userId: options.actorUserId, companyId: options.companyId, minimumRole: options.minimumRole ?? "EDITOR" });
  }
  if (options.scope === "PROJECT") {
    if (!options.projectId) throw new Error("projectId es requerido para alcance PROJECT");
    await assertProjectInWorkspace({ companyId: options.companyId!, projectId: options.projectId });
  }
}

type KnowledgeEntityType = "KnowledgeSource" | "KnowledgeEvidence" | "CanonicalItem" | "CanonicalResource";

export async function assertKnowledgeEntityAccess(options: {
  actorUserId: string;
  entityType: KnowledgeEntityType;
  entityId: string;
  companyId: string;
  projectId?: string;
  minimumRole?: WorkspaceRole;
}) {
  await assertWorkspaceMembership({ userId: options.actorUserId, companyId: options.companyId, minimumRole: options.minimumRole ?? "EDITOR" });
  if (options.projectId) await assertProjectInWorkspace({ companyId: options.companyId, projectId: options.projectId });

  const ownership = await findKnowledgeEntityOwnership(options.entityType, options.entityId);
  if (!ownership || (ownership.scope !== "GLOBAL" && (ownership.companyId !== options.companyId || (options.projectId !== undefined && ownership.projectId !== options.projectId)))) {
    throw new Error("Knowledge tenant access denied");
  }
  return ownership;
}

async function findKnowledgeEntityOwnership(entityType: KnowledgeEntityType, entityId: string): Promise<{ companyId: string | null; projectId: string | null; scope: KnowledgeScope } | null> {
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
