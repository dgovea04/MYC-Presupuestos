import { prisma } from "@/lib/db/prisma";
import { normalizeKnowledgeText } from "./normalization";

export async function findExactItemCandidates(query: string, companyId?: string) {
  const normalized = normalizeKnowledgeText(query);
  return prisma.canonicalItem.findMany({ where: { normalizedName: normalized, OR: [{ scope: "GLOBAL" }, ...(companyId ? [{ scope: "COMPANY" as const, companyId }] : [])] }, include: { aliases: true }, orderBy: { updatedAt: "desc" } });
}

export async function findExactResourceCandidates(query: string, companyId?: string) {
  const normalized = normalizeKnowledgeText(query);
  return prisma.canonicalResource.findMany({ where: { normalizedName: normalized, OR: [{ scope: "GLOBAL" }, ...(companyId ? [{ scope: "COMPANY" as const, companyId }] : [])] }, include: { aliases: true }, orderBy: { updatedAt: "desc" } });
}

