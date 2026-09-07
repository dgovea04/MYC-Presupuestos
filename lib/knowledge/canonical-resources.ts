import { prisma } from "@/lib/db/prisma";
import { normalizeKnowledgeText, normalizeKnowledgeUnit } from "./normalization";
import { validateKnowledgeScope } from "./validation";
import type { KnowledgeScopeContext } from "./types";

export interface CanonicalResourceInput extends KnowledgeScopeContext { name: string; category: string; canonicalUnit?: string; }

export async function createCanonicalResource(input: CanonicalResourceInput) {
  validateKnowledgeScope(input);
  const normalizedName = normalizeKnowledgeText(input.name);
  if (!normalizedName) throw new Error("Resource name is required");
  if (!input.category.trim()) throw new Error("Resource category is required");
  return prisma.canonicalResource.create({ data: {
    name: input.name.trim(), normalizedName, category: input.category.trim().toUpperCase(),
    canonicalUnit: input.canonicalUnit ? normalizeKnowledgeUnit(input.canonicalUnit) : undefined, scope: input.scope, companyId: input.companyId,
  }});
}

export async function addResourceAlias(canonicalResourceId: string, alias: string, confirmed = false) {
  const normalizedAlias = normalizeKnowledgeText(alias);
  if (!normalizedAlias) throw new Error("Alias is required");
  return prisma.canonicalResourceAlias.create({ data: { canonicalResourceId, alias: alias.trim(), normalizedAlias, confirmed } });
}

