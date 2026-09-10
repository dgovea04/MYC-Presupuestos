import { prisma } from "@/lib/db/prisma";
import { normalizeKnowledgeText, normalizeKnowledgeUnit } from "./normalization";
import { validateKnowledgeScope } from "./validation";
import type { KnowledgeScopeContext } from "./types";

export interface CanonicalResourceInput extends KnowledgeScopeContext { name: string; category: string; canonicalUnit?: string; }

export type CanonicalResourceLookupCandidate = {
  id: string;
  normalizedName: string;
  canonicalUnit: string | null;
  scope: "GLOBAL" | "COMPANY";
  companyId: string | null;
  aliases: readonly { normalizedAlias: string }[];
};

export type CanonicalResourceLookupIndex = ReadonlyMap<string, readonly CanonicalResourceLookupCandidate[]>;

export function buildCanonicalResourceLookupIndex(candidates: readonly CanonicalResourceLookupCandidate[]): CanonicalResourceLookupIndex {
  const index = new Map<string, CanonicalResourceLookupCandidate[]>();
  for (const candidate of candidates) {
    for (const value of [candidate.normalizedName, ...candidate.aliases.map((alias) => alias.normalizedAlias)]) {
      const key = normalizeKnowledgeText(value);
      if (!key) continue;
      const matches = index.get(key) ?? [];
      if (!matches.some((match) => match.id === candidate.id)) matches.push(candidate);
      index.set(key, matches);
    }
  }
  return index;
}

export function lookupCanonicalResourceCandidates(index: CanonicalResourceLookupIndex, description: string): readonly CanonicalResourceLookupCandidate[] {
  return index.get(normalizeKnowledgeText(description)) ?? [];
}

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
