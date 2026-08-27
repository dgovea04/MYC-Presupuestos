export type GovernanceScope = "PLATFORM" | "WORKSPACE" | "TEAM" | "PROJECT" | "USER";

export type GovernanceContext = {
  workspaceId: string;
  projectId?: string | null;
  teamId?: string | null;
  userId: string;
};

export type GovernanceBinding = {
  scope: GovernanceScope;
  scopeId: string;
  credentialId: string;
  priority: number;
};

/** Returns the most specific binding first, with deterministic tie-breaking. */
export function orderGovernanceBindings(bindings: readonly GovernanceBinding[], context: GovernanceContext) {
  const allowed = new Set<string>([
    `PLATFORM:platform`,
    `WORKSPACE:${context.workspaceId}`,
    ...(context.teamId ? [`TEAM:${context.teamId}`] : []),
    ...(context.projectId ? [`PROJECT:${context.projectId}`] : []),
    `USER:${context.userId}`,
  ]);
  return [...bindings]
    .filter((binding) => allowed.has(`${binding.scope}:${binding.scopeId}`))
    .sort((left, right) => right.priority - left.priority || left.credentialId.localeCompare(right.credentialId));
}

export function assertGovernanceContext(input: GovernanceContext) {
  if (!input.workspaceId || !input.userId) throw new Error("Workspace y usuario son obligatorios para gobierno IA.");
  if (input.projectId === "") throw new Error("El proyecto contextual no puede estar vacío.");
  if (input.teamId === "") throw new Error("El equipo contextual no puede estar vacío.");
}
