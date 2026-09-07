import { prisma } from "@/lib/db/prisma";
export type PrivateLearningMetrics = { activeExamples: number; revokedExamples: number; expiredExamples: number; usages: number };
export function auditPrivateLearningMetric(input: { companyId: string; activeExamples: number; usages: number }): { companyId: string; activeExamples: number; usages: number } { return { companyId: input.companyId, activeExamples: input.activeExamples, usages: input.usages }; }
export async function getPrivateLearningMetrics(companyId: string): Promise<PrivateLearningMetrics> {
  const [activeExamples, revokedExamples, expiredExamples, usages] = await Promise.all([
    prisma.privateLearningExample.count({ where: { companyId, status: "ACTIVE", expiresAt: { gt: new Date() } } }),
    prisma.privateLearningExample.count({ where: { companyId, status: "REVOKED" } }),
    prisma.privateLearningExample.count({ where: { companyId, status: "EXPIRED" } }),
    prisma.privateLearningUsage.count({ where: { companyId } }),
  ]);
  return { activeExamples, revokedExamples, expiredExamples, usages };
}
