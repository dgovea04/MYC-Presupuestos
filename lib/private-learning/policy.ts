export const DEFAULT_PRIVATE_LEARNING_RETENTION_DAYS = 365;
export type PrivateLearningPolicy = { enabled: boolean; retentionDays: number; allowExternalProviders: boolean };
export function getPrivateLearningPolicy(companyId: string): PrivateLearningPolicy {
  void companyId;
  const disabled = new Set(["0", "false", "off", "disabled"]);
  return { enabled: !disabled.has((process.env.PRIVATE_LEARNING_ENABLED ?? "false").toLowerCase()), retentionDays: DEFAULT_PRIVATE_LEARNING_RETENTION_DAYS, allowExternalProviders: false };
}
