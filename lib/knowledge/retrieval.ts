import { prisma } from "@/lib/db/prisma";
import { getVisibleScopes } from "./scope";

export interface KnowledgeRetrievalInput {
  companyId: string;
  projectId?: string;
  query: string;
  limit?: number;
}

export async function retrieveCanonicalItems(input: KnowledgeRetrievalInput) {
  const limit = Math.min(Math.max(input.limit ?? 20, 1), 100);
  const normalizedQuery = input.query.trim().toLocaleLowerCase("es-PE");
  const visible = getVisibleScopes(input);
  const results = await Promise.all(visible.map((scope) => prisma.canonicalItem.findMany({
    where: { scope: scope.scope, companyId: scope.companyId, normalizedName: { contains: normalizedQuery } },
    include: { aliases: true }, orderBy: { updatedAt: "desc" }, take: limit,
  })));
  return results.flat().slice(0, limit);
}

