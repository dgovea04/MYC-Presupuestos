import { assertProjectInWorkspace, assertWorkspaceMembership } from "@/lib/workspace/access";
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
