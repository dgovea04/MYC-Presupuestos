import { unstable_cache } from "next/cache";

import { prisma } from "@/lib/db/prisma";
import { unifiedIndexDictionaryData } from "@/lib/polynomial-formula/unified-index-dictionary-data";
import type { UnifiedIndexDictionaryRow, UnifiedIndexRelationRow } from "@/types/unified-index";

export async function getUnifiedIndexRelationRows(userId: string): Promise<UnifiedIndexRelationRow[]> {
  const [indices, resources] = await Promise.all([getCachedOfficialUnifiedIndexRelations(), getCachedVisibleResourceIUsByUser(userId)]);

  const resourceCountByCode = new Map<string, number>();

  for (const resource of resources) {
    const normalizedCode = normalizeUnifiedIndexCode(resource.iu);
    if (!normalizedCode) {
      continue;
    }

    resourceCountByCode.set(normalizedCode, (resourceCountByCode.get(normalizedCode) ?? 0) + 1);
  }

  const seen = new Set<string>();
  const rows: UnifiedIndexRelationRow[] = [];

  for (const index of indices) {
    const compositeKey = `${index.code}|${index.name}`;
    if (seen.has(compositeKey)) {
      continue;
    }

    seen.add(compositeKey);
    rows.push({
      code: index.code,
      name: index.name,
      resourceCount: resourceCountByCode.get(normalizeUnifiedIndexCode(index.code) ?? index.code) ?? 0,
    });
  }

  return rows;
}

export async function getUnifiedIndexDictionaryRows(): Promise<UnifiedIndexDictionaryRow[]> {
  return unifiedIndexDictionaryData;
}

async function getOfficialUnifiedIndexRelations() {
  return prisma.unifiedIndex.findMany({
    select: {
      code: true,
      name: true,
    },
    orderBy: [{ code: "asc" }, { name: "asc" }],
  });
}

async function getVisibleResourceIUsByUser(userId: string) {
  return prisma.resource.findMany({
    select: {
      iu: true,
    },
    where: {
      OR: [
        { companyId: null },
        {
          company: {
            userId,
          },
        },
      ],
    },
  });
}

const isTestEnvironment = process.env.NODE_ENV === "test" || process.env.VITEST === "true";

const getCachedOfficialUnifiedIndexRelations = isTestEnvironment
  ? getOfficialUnifiedIndexRelations
  : unstable_cache(getOfficialUnifiedIndexRelations, ["official-unified-index-relations"]);

const getCachedVisibleResourceIUsByUser = isTestEnvironment
  ? getVisibleResourceIUsByUser
  : unstable_cache(getVisibleResourceIUsByUser, ["visible-resource-iu-by-user"]);

function normalizeUnifiedIndexCode(code: string | null | undefined) {
  const normalized = code?.trim();
  if (!normalized) {
    return null;
  }

  const numericMatch = normalized.match(/^0*(\d+)/);
  if (!numericMatch) {
    return null;
  }

  return numericMatch[1];
}
