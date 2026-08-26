import { getEffectiveWorkspaceLicense } from "@/lib/workspace/entitlements";
import { requireWorkspaceRole } from "@/lib/workspace/authorization";
import type { KhipuAiTask } from "@/lib/ai/gateway/types";
import type { FeatureKey } from "@/lib/billing/entitlements";

export type AiCapability = "chat" | "apu" | "review" | "autocomplete" | "pdf" | "agent";

export const AI_ROUTE_ACCESS_MATRIX: Record<AiCapability, {
  feature: FeatureKey;
  tasks: readonly KhipuAiTask[];
}> = {
  chat: { feature: "ai.chat", tasks: ["chat"] },
  apu: { feature: "ai.apu", tasks: ["generate_apu", "suggest_insumos"] },
  review: { feature: "ai.review", tasks: ["review_apu", "review_budget", "review_formula_polinomica", "review_quantity_takeoff"] },
  autocomplete: { feature: "ai.autocomplete", tasks: ["autocomplete", "generate_partida"] },
  pdf: { feature: "ai.pdf", tasks: ["pdf_import_structure"] },
  agent: { feature: "khipu.agent", tasks: ["chat", "generate_apu", "generate_partida", "suggest_insumos", "review_budget", "montecarlo_risk_analysis"] },
};

export function getAiCapabilityForTask(task: KhipuAiTask): AiCapability {
  for (const [capability, entry] of Object.entries(AI_ROUTE_ACCESS_MATRIX) as Array<[AiCapability, typeof AI_ROUTE_ACCESS_MATRIX[AiCapability]]>) {
    if (entry.tasks.includes(task)) return capability;
  }
  return "chat";
}

export async function assertAiCapabilityAccess(input: {
  userId: string;
  workspaceId?: string | null;
  capability: AiCapability;
}) {
  if (!input.workspaceId) return null;
  await requireWorkspaceRole({ userId: input.userId, companyId: input.workspaceId, minimumRole: "VIEWER" });
  const license = await getEffectiveWorkspaceLicense({ userId: input.userId, companyId: input.workspaceId });
  if (!license?.availableFeatures.includes(AI_ROUTE_ACCESS_MATRIX[input.capability].feature)) {
    throw new AiRouteAccessError(input.capability);
  }
  return license;
}

export class AiRouteAccessError extends Error {
  readonly statusCode = 403;
  constructor(readonly capability: AiCapability) {
    super(`La capacidad IA "${capability}" no está disponible para este workspace.`);
    this.name = "AiRouteAccessError";
  }
}
