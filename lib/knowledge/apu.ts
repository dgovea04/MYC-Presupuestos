import { createHash } from "node:crypto";
import Decimal from "decimal.js";
import { prisma } from "@/lib/db/prisma";
import { assertKnowledgeApiScopeAccess } from "./api-access";
import { validateKnowledgeScope } from "./validation";
import type { Prisma } from "@prisma/client";
import type { KnowledgeScopeContext } from "./types";

export interface ApuSnapshotResource { resourceId?: string; description: string; unit: string; quantity: Decimal.Value; unitPrice: Decimal.Value; resourceType: string; sortOrder: number; }
export interface ApuSnapshotInput extends KnowledgeScopeContext { apuId: string; name: string; unit: string; performance: Decimal.Value; resources: readonly ApuSnapshotResource[]; sourceId?: string; evidenceId?: string; }

function decimal(value: Decimal.Value): string { return new Decimal(value).toFixed(4); }
function snapshotPayload(input: ApuSnapshotInput) { return { apuId: input.apuId, name: input.name, unit: input.unit, performance: decimal(input.performance), resources: input.resources.map((row) => ({ ...row, quantity: decimal(row.quantity), unitPrice: decimal(row.unitPrice) })).sort((a, b) => a.sortOrder - b.sortOrder) }; }
export function apuContentHash(input: ApuSnapshotInput): string { return createHash("sha256").update(JSON.stringify(snapshotPayload(input))).digest("hex"); }

export function buildReviewApuCorrection(input: { findingId: string; decisionId: string; correctionVersionId: string; sourceId: string; evidenceId: string; before: ApuSnapshotInput; after: ApuSnapshotInput }) {
  const beforeSnapshot = snapshotPayload(input.before);
  const afterSnapshot = snapshotPayload(input.after);
  if (JSON.stringify(beforeSnapshot) === JSON.stringify(afterSnapshot)) throw new Error("Corrected APU snapshots must differ");
  return {
    idempotencyKey: `review-apu:${input.decisionId}:${input.correctionVersionId}`,
    findingId: input.findingId,
    decisionId: input.decisionId,
    correctionVersionId: input.correctionVersionId,
    sourceId: input.sourceId,
    evidenceId: input.evidenceId,
    apuId: input.after.apuId,
    name: input.after.name,
    unit: input.after.unit,
    performance: decimal(input.after.performance),
    contentHash: apuContentHash(input.after),
    beforeSnapshot,
    afterSnapshot,
  };
}

export async function persistReviewApuCorrection(input: ReturnType<typeof buildReviewApuCorrection> & { scope: "PROJECT"; companyId: string; projectId: string; actorUserId: string }) {
  await assertKnowledgeApiScopeAccess({ actorUserId: input.actorUserId, scope: input.scope, companyId: input.companyId, projectId: input.projectId });
  const latest = await prisma.knowledgeApuVersion.findFirst({ where: { apuId: input.apuId, companyId: input.companyId, projectId: input.projectId }, orderBy: { versionNumber: "desc" } });
  const beforeSnapshot = JSON.parse(JSON.stringify(input.beforeSnapshot)) as Prisma.InputJsonValue;
  const afterSnapshot = JSON.parse(JSON.stringify(input.afterSnapshot)) as Prisma.InputJsonValue;
  return prisma.knowledgeApuVersion.upsert({
    where: { idempotencyKey: input.idempotencyKey },
    create: { idempotencyKey: input.idempotencyKey, apuId: input.apuId, versionNumber: (latest?.versionNumber ?? 0) + 1, name: input.name, unit: input.unit, performance: input.performance, contentHash: input.contentHash, scope: input.scope, companyId: input.companyId, projectId: input.projectId, sourceId: input.sourceId, evidenceId: input.evidenceId, reviewFindingId: input.findingId, reviewDecisionId: input.decisionId, createdById: input.actorUserId, beforeSnapshot, afterSnapshot },
    update: { afterSnapshot, sourceId: input.sourceId, evidenceId: input.evidenceId },
  });
}

export async function createApuVersionFromExistingApu(input: ApuSnapshotInput) {
  validateKnowledgeScope(input);
  const latest = await prisma.knowledgeApuVersion.findFirst({ where: { apuId: input.apuId }, orderBy: { versionNumber: "desc" } });
  const versionNumber = (latest?.versionNumber ?? 0) + 1;
  const snapshot = snapshotPayload(input);
  return prisma.knowledgeApuVersion.create({ data: { apuId: input.apuId, versionNumber, name: input.name, unit: input.unit, performance: decimal(input.performance), contentHash: apuContentHash(input), scope: input.scope, companyId: input.companyId, projectId: input.projectId, sourceId: input.sourceId, evidenceId: input.evidenceId, resources: { create: snapshot.resources.map((row) => ({ resourceId: row.resourceId, description: row.description, unit: row.unit, quantity: row.quantity, unitPrice: row.unitPrice, resourceType: row.resourceType, sortOrder: row.sortOrder })) } }, include: { resources: true } });
}
