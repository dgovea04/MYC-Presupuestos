import { normalizeKnowledgeUnit } from "./normalization";
import { normalizeKnowledgeText } from "./normalization";
import { prisma } from "@/lib/db/prisma";
import type { Prisma, PrismaClient } from "@prisma/client";

type CanonicalCandidate = { id: string; canonicalUnit: string | null; aliases: readonly { normalizedAlias?: string }[] };

export function resolveUniqueCanonicalEntity(candidates: readonly CanonicalCandidate[], unit?: string): string | undefined {
  const normalizedUnit = unit ? normalizeKnowledgeUnit(unit) : undefined;
  const compatible = candidates.filter((candidate) => !normalizedUnit || !candidate.canonicalUnit || normalizeKnowledgeUnit(candidate.canonicalUnit) === normalizedUnit);
  return compatible.length === 1 ? compatible[0].id : undefined;
}

type CanonicalResolutionClient = Pick<PrismaClient, "reviewFinding" | "canonicalItem" | "canonicalResource">;

export async function resolvePersistedReviewCanonicalEntities(input: { findingId: string; companyId: string; projectId: string }, client: CanonicalResolutionClient = prisma) {
  const finding = await client.reviewFinding.findFirst({
    where: { id: input.findingId, companyId: input.companyId, projectId: input.projectId },
    select: { findingType: true, budgetItem: { select: { description: true, unit: true } } },
  });
  if (!finding?.budgetItem) return { canonicalItemId: undefined, resourceId: undefined };
  const normalizedDescription = normalizeKnowledgeText(finding.budgetItem.description);
  const entityScope: Prisma.CanonicalItemWhereInput = { OR: [{ scope: "GLOBAL" }, { scope: "COMPANY", companyId: input.companyId }] };
  const resourceScope: Prisma.CanonicalResourceWhereInput = { OR: [{ scope: "GLOBAL" }, { scope: "COMPANY", companyId: input.companyId }] };
  const [items, resources] = await Promise.all([
    client.canonicalItem.findMany({ where: { AND: [entityScope, { OR: [{ normalizedName: normalizedDescription }, { aliases: { some: { normalizedAlias: normalizedDescription } } }] }] }, include: { aliases: true } }),
    client.canonicalResource.findMany({ where: { AND: [resourceScope, { OR: [{ normalizedName: normalizedDescription }, { aliases: { some: { normalizedAlias: normalizedDescription } } }] }] }, include: { aliases: true } }),
  ]);
  const itemId = ["QUANTITY_MISMATCH", "YIELD_MISMATCH", "UNIT_INCONSISTENCY"].includes(String(finding.findingType)) ? resolveUniqueCanonicalEntity(items, finding.budgetItem.unit) : undefined;
  const resourceId = ["PRICE_MISMATCH", "TECHNICAL_SPEC_MISMATCH"].includes(String(finding.findingType)) ? resolveUniqueCanonicalEntity(resources, finding.budgetItem.unit) : undefined;
  return { canonicalItemId: itemId, resourceId };
}
