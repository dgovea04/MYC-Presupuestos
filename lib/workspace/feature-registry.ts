export const WORKSPACE_FEATURES = [
  { key: "ai.local", minimumPlan: "pro" as const },
  { key: "khipu.agent", minimumPlan: "pro" as const },
  { key: "partidas.similarity", minimumPlan: "pro" as const },
  { key: "work_schedule.intelligent", minimumPlan: "pro" as const },
  { key: "polynomial_formula", minimumPlan: "starter" as const },
  { key: "polynomial_formula.adjustments", minimumPlan: "pro" as const },
  { key: "risk_analysis", minimumPlan: "pro" as const },
  { key: "exports.advanced", minimumPlan: "pro" as const },
  { key: "exports.basic", minimumPlan: "starter" as const },
  { key: "collaboration.realtime", minimumPlan: "pro" as const },
  { key: "desktop.native_bridge", minimumPlan: "empresa" as const },
] as const;

export type WorkspaceFeatureKey = (typeof WORKSPACE_FEATURES)[number]["key"];

const planRank: Record<string, number> = {
  starter: 1,
  pro: 2,
  empresa: 3,
};

export function isFeatureAvailableForPlan(
  featureKey: WorkspaceFeatureKey,
  planSlug: string,
): boolean {
  const feature = WORKSPACE_FEATURES.find((f) => f.key === featureKey);
  if (!feature) return false;

  const requiredRank = planRank[feature.minimumPlan] ?? 1;
  const currentRank = planRank[planSlug] ?? 0;
  return currentRank >= requiredRank;
}

export function getAvailableFeatures(planSlug: string): WorkspaceFeatureKey[] {
  return WORKSPACE_FEATURES
    .filter((f) => isFeatureAvailableForPlan(f.key, planSlug))
    .map((f) => f.key);
}
