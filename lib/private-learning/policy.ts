import { prisma } from "@/lib/db/prisma";
export const DEFAULT_PRIVATE_LEARNING_RETENTION_DAYS = 365;
export type PrivateLearningPolicy = { enabled: boolean; retentionDays: number; allowExternalProviders: boolean };
export async function getPrivateLearningPolicy(companyId: string): Promise<PrivateLearningPolicy> {
  const disabled = new Set(["0", "false", "off", "disabled"]);
  const fallbackEnabled = !disabled.has((process.env.PRIVATE_LEARNING_ENABLED ?? "false").toLowerCase());
  const stored = await prisma.privateLearningPolicy.findUnique({ where: { companyId } });
  return stored ? { enabled: stored.enabled, retentionDays: Math.max(1, Math.min(stored.retentionDays, 3650)), allowExternalProviders: stored.allowExternalProviders } : { enabled: fallbackEnabled, retentionDays: DEFAULT_PRIVATE_LEARNING_RETENTION_DAYS, allowExternalProviders: false };
}
