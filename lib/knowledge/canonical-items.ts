import { prisma } from "@/lib/db/prisma";
import { normalizeKnowledgeText, normalizeKnowledgeUnit } from "./normalization";
import { validateKnowledgeScope } from "./validation";
import type { KnowledgeScopeContext } from "./types";

export interface CanonicalItemInput extends KnowledgeScopeContext {
  name: string;
  canonicalUnit?: string;
  classification?: string;
  specialty?: string;
}

export async function createCanonicalItem(input: CanonicalItemInput) {
  validateKnowledgeScope(input);
  const normalizedName = normalizeKnowledgeText(input.name);
  if (!normalizedName) throw new Error("Item name is required");
  return prisma.canonicalItem.create({ data: {
    name: input.name.trim(), normalizedName, canonicalUnit: input.canonicalUnit ? normalizeKnowledgeUnit(input.canonicalUnit) : undefined,
    classification: input.classification?.trim(), specialty: input.specialty?.trim(), scope: input.scope, companyId: input.companyId,
  }});
}

export async function addItemAlias(canonicalItemId: string, alias: string, confirmed = false) {
  const normalizedAlias = normalizeKnowledgeText(alias);
  if (!normalizedAlias) throw new Error("Alias is required");
  return prisma.canonicalItemAlias.create({ data: { canonicalItemId, alias: alias.trim(), normalizedAlias, confirmed } });
}

