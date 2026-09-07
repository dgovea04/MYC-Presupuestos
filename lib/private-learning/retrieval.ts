import { prisma } from "@/lib/db/prisma";
import { getPrivateLearningPolicy } from "./policy";
import type { JsonObject, PrivateLearningSuggestion } from "./types";

export async function retrievePrivateExamples(input: { companyId: string; signalType: string; normalizedInput: JsonObject; schemaVersion?: string; limit?: number }): Promise<PrivateLearningSuggestion[]> {
  if (!(await getPrivateLearningPolicy(input.companyId)).enabled) return [];
  const rows = await prisma.privateLearningExample.findMany({ where: { companyId: input.companyId, signalType: input.signalType, status: "ACTIVE", expiresAt: { gt: new Date() }, ...(input.schemaVersion ? { schemaVersion: input.schemaVersion } : {}) }, orderBy: [{ createdAt: "desc" }, { id: "asc" }], take: 50 });
  const ranked = rows.map((row) => ({ row, score: inputSimilarity(input.normalizedInput, row.inputJson) })).sort((left, right) => right.score - left.score || left.row.createdAt.getTime() - right.row.createdAt.getTime() || left.row.id.localeCompare(right.row.id)).slice(0, Math.min(input.limit ?? 10, 50));
  return ranked.map(({ row, score }, index) => ({ id: row.id, companyId: row.companyId, sourceType: row.sourceType, sourceId: row.sourceId, signalType: row.signalType, contentHash: row.contentHash, schemaVersion: row.schemaVersion, status: row.status, expiresAt: row.expiresAt.toISOString(), createdAt: row.createdAt.toISOString(), confidence: Math.min(0.99, Math.max(0.5, 0.5 + score * 0.45 - index * 0.01)), provenance: { sourceType: row.sourceType, sourceId: row.sourceId, createdAt: row.createdAt.toISOString() }, exampleApplied: false }));
}

function inputSimilarity(input: JsonObject, stored: unknown): number {
  if (!stored || typeof stored !== "object" || Array.isArray(stored)) return 0;
  const expected = Object.entries(input).filter(([, value]) => typeof value === "string" && value.trim()).map(([key, value]) => [key, String(value).trim().toLowerCase()] as const);
  if (expected.length === 0) return 0;
  const candidate = stored as Record<string, unknown>;
  return expected.reduce((score, [key, value]) => score + (String(candidate[key] ?? "").trim().toLowerCase() === value ? 1 : 0), 0) / expected.length;
}

export async function recordPrivateLearningUsage(input: { companyId: string; exampleId: string; budgetId?: string; requestId: string }): Promise<void> {
  await prisma.privateLearningUsage.createMany({ data: [{ companyId: input.companyId, exampleId: input.exampleId, budgetId: input.budgetId, requestId: input.requestId }], skipDuplicates: true });
}

export async function revokePrivateLearningExample(input: { companyId: string; exampleId: string }): Promise<void> {
  const result = await prisma.privateLearningExample.updateMany({ where: { id: input.exampleId, companyId: input.companyId, status: "ACTIVE" }, data: { status: "REVOKED", revokedAt: new Date() } });
  if (result.count === 0) throw new Error("Ejemplo privado no encontrado");
}
