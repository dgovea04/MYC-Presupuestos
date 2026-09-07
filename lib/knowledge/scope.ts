import type { KnowledgeActor, KnowledgeScopeContext } from "./types";

export function assertKnowledgeScopeAccess(input: KnowledgeScopeContext & { actor: KnowledgeActor }): void {
  const { scope, actor } = input;
  if (scope === "GLOBAL") return;
  if (scope === "USER") {
    if (!input.userId || input.userId !== actor.userId) throw new Error("User scope denied");
    return;
  }
  if (!input.companyId || input.companyId !== actor.companyId) throw new Error("Knowledge tenant access denied");
  if (scope === "PROJECT" && (!input.projectId || !actor.projectIds?.includes(input.projectId))) {
    throw new Error("Knowledge project access denied");
  }
}

export function getVisibleScopes(input: { companyId: string; projectId?: string }): KnowledgeScopeContext[] {
  const scopes: KnowledgeScopeContext[] = [];
  if (input.projectId) scopes.push({ scope: "PROJECT", companyId: input.companyId, projectId: input.projectId });
  scopes.push({ scope: "COMPANY", companyId: input.companyId });
  scopes.push({ scope: "GLOBAL" });
  return scopes;
}
