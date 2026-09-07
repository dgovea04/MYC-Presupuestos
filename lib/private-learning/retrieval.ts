import { prisma } from "@/lib/db/prisma";
import { getPrivateLearningPolicy } from "./policy";
import type { JsonObject, PrivateLearningSuggestion } from "./types";

export async function retrievePrivateExamples(input: { companyId: string; signalType: string; normalizedInput: JsonObject; schemaVersion?: string; limit?: number }): Promise<PrivateLearningSuggestion[]> {
  if (!getPrivateLearningPolicy(input.companyId).enabled) return [];
  const rows = await prisma.privateLearningExample.findMany({ where: { companyId: input.companyId, signalType: input.signalType, status: "ACTIVE", expiresAt: { gt: new Date() }, ...(input.schemaVersion ? { schemaVersion: input.schemaVersion } : {}) }, orderBy: [{ createdAt: "desc" }, { id: "asc" }], take: Math.min(input.limit ?? 10, 50) });
  return rows.map((row, index) => ({ id: row.id, companyId: row.companyId, sourceType: row.sourceType, sourceId: row.sourceId, signalType: row.signalType, contentHash: row.contentHash, schemaVersion: row.schemaVersion, status: row.status, expiresAt: row.expiresAt.toISOString(), createdAt: row.createdAt.toISOString(), confidence: Math.max(0.5, 1 - index * 0.05), provenance: { sourceType: row.sourceType, sourceId: row.sourceId, createdAt: row.createdAt.toISOString() }, exampleApplied: false }));
}

export async function recordPrivateLearningUsage(input: { companyId: string; exampleId: string; budgetId?: string; requestId: string }): Promise<void> {
  await prisma.privateLearningUsage.createMany({ data: [{ companyId: input.companyId, exampleId: input.exampleId, budgetId: input.budgetId, requestId: input.requestId }], skipDuplicates: true });
}

export async function revokePrivateLearningExample(input: { companyId: string; exampleId: string }): Promise<void> {
  const result = await prisma.privateLearningExample.updateMany({ where: { id: input.exampleId, companyId: input.companyId, status: "ACTIVE" }, data: { status: "REVOKED", revokedAt: new Date() } });
  if (result.count === 0) throw new Error("Ejemplo privado no encontrado");
}
