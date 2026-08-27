export type GovernancePolicy = {
  allowedProviders: string[];
  allowedModels: string[];
  monthlyTokenLimit: number | null;
  monthlyBudgetMinor: number | null;
  allowUserKeys: boolean;
  allowWorkspaceKey: boolean;
  fallbackEnabled: boolean;
  allowAgentWrites: boolean;
};

export type GovernancePolicyOverride = Partial<GovernancePolicy>;

/**
 * Combina políticas desde plataforma hasta usuario. Los niveles inferiores
 * solo pueden restringir listas, límites y permisos; nunca ampliarlos.
 */
export function mergeGovernancePolicies(parent: GovernancePolicy, child: GovernancePolicyOverride): GovernancePolicy {
  return {
    allowedProviders: intersectList(parent.allowedProviders, child.allowedProviders),
    allowedModels: intersectList(parent.allowedModels, child.allowedModels),
    monthlyTokenLimit: minNullable(parent.monthlyTokenLimit, child.monthlyTokenLimit),
    monthlyBudgetMinor: minNullable(parent.monthlyBudgetMinor, child.monthlyBudgetMinor),
    allowUserKeys: parent.allowUserKeys && (child.allowUserKeys ?? true),
    allowWorkspaceKey: parent.allowWorkspaceKey && (child.allowWorkspaceKey ?? true),
    fallbackEnabled: parent.fallbackEnabled && (child.fallbackEnabled ?? true),
    allowAgentWrites: parent.allowAgentWrites && (child.allowAgentWrites ?? true),
  };
}

export function canDelegateAgent(options: {
  actorRole: "OWNER" | "ADMIN" | "EDITOR" | "VIEWER";
  targetUserId: string;
  actorUserId: string;
  allowAgentWrites: boolean;
  requiresApproval: boolean;
  expiresAt?: Date;
  toolNames?: readonly string[];
}) {
  if (!options.allowAgentWrites) return false;
  if (options.expiresAt !== undefined && options.expiresAt <= new Date()) return false;
  if (options.toolNames !== undefined && options.toolNames.length === 0) return false;
  if (options.actorUserId !== options.targetUserId && options.actorRole !== "OWNER" && options.actorRole !== "ADMIN") return false;
  if (options.requiresApproval && options.actorRole === "VIEWER") return false;
  return true;
}

function intersectList(parent: string[], child?: string[]) {
  if (child === undefined) return [...parent];
  if (parent.length === 0) return [...child];
  return child.filter((value) => parent.includes(value));
}

function minNullable(parent: number | null, child?: number | null) {
  if (child === undefined || child === null) return parent;
  if (parent === null) return child;
  return Math.min(parent, child);
}
