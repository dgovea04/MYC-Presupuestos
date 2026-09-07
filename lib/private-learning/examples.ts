import { prisma } from "@/lib/db/prisma";
import { getPrivateLearningPolicy } from "./policy";
import { privateLearningContentHash, sanitizePrivateLearningPayload } from "./sanitization";
import type { JsonObject, PrivateLearningExampleView } from "./types";

export async function captureConfirmedExample(input: { companyId: string; createdById: string; sourceType: string; sourceId: string; signalType: string; inputJson: JsonObject; resultJson: JsonObject; schemaVersion: string; confirmed: boolean }): Promise<PrivateLearningExampleView | null> {
  const policy = getPrivateLearningPolicy(input.companyId);
  if (!policy.enabled || !input.confirmed) return null;
  const inputJson = sanitizePrivateLearningPayload(input.inputJson);
  const resultJson = sanitizePrivateLearningPayload(input.resultJson);
  const contentHash = privateLearningContentHash({ companyId: input.companyId, signalType: input.signalType, inputJson, resultJson, schemaVersion: input.schemaVersion });
  const example = await prisma.privateLearningExample.upsert({
    where: { companyId_contentHash_schemaVersion: { companyId: input.companyId, contentHash, schemaVersion: input.schemaVersion } },
    create: { companyId: input.companyId, sourceType: input.sourceType, sourceId: input.sourceId, signalType: input.signalType, inputJson, resultJson, contentHash, schemaVersion: input.schemaVersion, createdById: input.createdById, expiresAt: new Date(Date.now() + policy.retentionDays * 86400000) },
    update: { status: "ACTIVE", revokedAt: null, expiresAt: new Date(Date.now() + policy.retentionDays * 86400000) },
  });
  return { id: example.id, companyId: example.companyId, sourceType: example.sourceType, sourceId: example.sourceId, signalType: example.signalType, contentHash: example.contentHash, schemaVersion: example.schemaVersion, status: example.status, expiresAt: example.expiresAt.toISOString(), createdAt: example.createdAt.toISOString() };
}
