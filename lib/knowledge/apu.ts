import { createHash } from "node:crypto";
import Decimal from "decimal.js";
import { prisma } from "@/lib/db/prisma";
import { validateKnowledgeScope } from "./validation";
import type { KnowledgeScopeContext } from "./types";

export interface ApuSnapshotResource { resourceId?: string; description: string; unit: string; quantity: Decimal.Value; unitPrice: Decimal.Value; resourceType: string; sortOrder: number; }
export interface ApuSnapshotInput extends KnowledgeScopeContext { apuId: string; name: string; unit: string; performance: Decimal.Value; resources: readonly ApuSnapshotResource[]; sourceId?: string; evidenceId?: string; }

function decimal(value: Decimal.Value): string { return new Decimal(value).toFixed(4); }
function snapshotPayload(input: ApuSnapshotInput) { return { apuId: input.apuId, name: input.name, unit: input.unit, performance: decimal(input.performance), resources: input.resources.map((row) => ({ ...row, quantity: decimal(row.quantity), unitPrice: decimal(row.unitPrice) })).sort((a, b) => a.sortOrder - b.sortOrder) }; }
export function apuContentHash(input: ApuSnapshotInput): string { return createHash("sha256").update(JSON.stringify(snapshotPayload(input))).digest("hex"); }

export async function createApuVersionFromExistingApu(input: ApuSnapshotInput) {
  validateKnowledgeScope(input);
  const latest = await prisma.knowledgeApuVersion.findFirst({ where: { apuId: input.apuId }, orderBy: { versionNumber: "desc" } });
  const versionNumber = (latest?.versionNumber ?? 0) + 1;
  const snapshot = snapshotPayload(input);
  return prisma.knowledgeApuVersion.create({ data: { apuId: input.apuId, versionNumber, name: input.name, unit: input.unit, performance: decimal(input.performance), contentHash: apuContentHash(input), scope: input.scope, companyId: input.companyId, projectId: input.projectId, sourceId: input.sourceId, evidenceId: input.evidenceId, resources: { create: snapshot.resources.map((row) => ({ resourceId: row.resourceId, description: row.description, unit: row.unit, quantity: row.quantity, unitPrice: row.unitPrice, resourceType: row.resourceType, sortOrder: row.sortOrder })) } }, include: { resources: true } });
}

