import { cache } from "react";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { serializeResource } from "@/lib/db/serializers";
import { ensureDate } from "@/lib/utils";
import { normalizeResourceIuCode } from "@/lib/resources/iu";
import { resourceSchema, resourceStatePatchSchema, type ResourceInput } from "@/lib/validations/resource";
import { assertWorkspaceMembership } from "@/lib/workspace/access";
import { measureAsync } from "@/lib/platform/performance";
import type {
  ResourceCategory,
  ResourcePatchFields,
  ResourcePatchResult,
  ResourceRecord,
  ResourceStatePatch,
} from "@/types/resource";
import type { Prisma } from "@prisma/client";

const resourceCodePrefixes: Record<ResourceCategory, string> = {
  MATERIAL: "MAT",
  LABOR: "MO",
  EQUIPMENT: "EQ",
  TOOLS: "HER",
  SUBCONTRACT: "SUB",
};
export const GLOBAL_RESOURCES_CACHE_TAG = "global-resources-v2";
export const RESOURCES_BY_USER_CACHE_TAG = "resources-by-user";
const shouldUseResourcesProcessCache = process.env.NODE_ENV !== "production" && process.env.VITEST !== "true";
const RESOURCES_PROCESS_CACHE_TTL_MS = 5_000;

type ResourcesProcessCacheEntry = {
  expiresAt: number;
  value: Promise<ResourceRecord[]>;
};

const resourcesProcessCache = new Map<string, ResourcesProcessCacheEntry>();

export function clearResourcesProcessCache() {
  resourcesProcessCache.clear();
}

function normalizeResourcesDates<T extends { createdAt?: Date | string | null; updatedAt?: Date | string | null }>(items: T[]): T[] {
  return items.map((item) => ({
    ...item,
    createdAt: ensureDate(item.createdAt),
    updatedAt: ensureDate(item.updatedAt),
  }));
}

export const getResourcesByUser = cache(
  async (userId: string, activeCompanyId?: string | null) => {
    const processCacheKey = `${userId}:${activeCompanyId ?? "all"}`;
    const existing = resourcesProcessCache.get(processCacheKey);
    if (shouldUseResourcesProcessCache && existing && existing.expiresAt > Date.now()) {
      const cachedResult = await measureAsync("data.resources.byUser.processCache", () => existing.value, { activeCompanyId });
      return normalizeResourcesDates(cachedResult);
    }

    const result = await measureAsync("data.resources.byUser.cached", () => unstable_cache(
      async (uid: string) => {
        const [globalResources, userResources] = await measureAsync(
          "data.resources.byUser.query",
          () => Promise.all([getCachedGlobalResources(), getUserOwnedResources(uid, activeCompanyId)]),
          { activeCompanyId },
        );
        return mergeVisibleResourcesForCatalog(globalResources, userResources)
          .sort(compareResourcesForCatalog)
          .map((resource) => serializeResource(resource));
      },
      activeCompanyId
        ? [RESOURCES_BY_USER_CACHE_TAG, activeCompanyId]
        : [RESOURCES_BY_USER_CACHE_TAG],
      { revalidate: 60, tags: [RESOURCES_BY_USER_CACHE_TAG] },
    )(userId), { activeCompanyId });

    if (shouldUseResourcesProcessCache) {
      resourcesProcessCache.set(processCacheKey, {
        expiresAt: Date.now() + RESOURCES_PROCESS_CACHE_TTL_MS,
        value: Promise.resolve(result),
      });
    }

    return normalizeResourcesDates(result);
  },
);

async function getGlobalResources() {
  return prisma.resource.findMany({
    where: {
      companyId: null,
    },
    orderBy: [{ category: "asc" }, { description: "asc" }],
  });
}

const getCachedGlobalResources =
  process.env.NODE_ENV === "development"
    ? getGlobalResources
    : unstable_cache(getGlobalResources, ["global-resources-v2"], {
        tags: [GLOBAL_RESOURCES_CACHE_TAG],
      });

async function getUserOwnedResources(userId: string, activeCompanyId?: string | null) {
  return prisma.resource.findMany({
    where: {
      companyId: activeCompanyId ?? undefined,
      company: {
        memberships: {
          some: {
            userId,
            status: "ACTIVE",
          },
        },
      },
    },
    orderBy: [{ category: "asc" }, { description: "asc" }],
  });
}

function compareResourcesForCatalog(left: { category: ResourceCategory; description: string }, right: { category: ResourceCategory; description: string }) {
  const categoryComparison = left.category.localeCompare(right.category);
  if (categoryComparison !== 0) {
    return categoryComparison;
  }

  return left.description.localeCompare(right.description);
}

export function mergeVisibleResourcesForCatalog<T extends {
  companyId: string | null;
  code: string;
  description: string;
  category: ResourceCategory;
  unit: string;
  iu: string | null;
  iuCurrent?: string | null;
  source: string | null;
}>(globalResources: T[], userResources: T[]) {
  const resourcesByCatalogKey = new Map<string, T>();

  for (const resource of globalResources) {
    resourcesByCatalogKey.set(buildVisibleResourceKey(resource), resource);
  }

  for (const resource of userResources) {
    const key = buildVisibleResourceKey(resource);
    if (resourcesByCatalogKey.has(key)) {
      continue;
    }

    resourcesByCatalogKey.set(key, resource);
  }

  return [...resourcesByCatalogKey.values()];
}

function buildVisibleResourceKey(resource: {
  code: string;
  description: string;
  category: ResourceCategory;
  unit: string;
  iu: string | null;
  source: string | null;
}) {
  return [
    resource.code.trim().toUpperCase(),
    resource.description.trim().toUpperCase(),
    resource.category,
    resource.unit.trim().toUpperCase(),
    (resource.iu ?? "").trim().toUpperCase(),
    (resource.source ?? "").trim().toUpperCase(),
  ].join("|");
}

export async function resourceMutationTouchesGlobalCatalog(resourceIds: string[]) {
  if (resourceIds.length === 0) {
    return false;
  }

  const globalResourcesCount = await prisma.resource.count({
    where: {
      id: {
        in: resourceIds,
      },
      companyId: null,
    },
  });

  return globalResourcesCount > 0;
}

export async function resourcePatchTouchesGlobalCatalog(userId: string, patchInput: ResourceStatePatch) {
  const patch = resourceStatePatchSchema.parse(patchInput);

  if (patch.create.some((entry) => normalizeOptionalString(entry.data.companyId) == null)) {
    return true;
  }

  for (const entry of patch.update) {
    const existing = await prisma.resource.findFirst({
      where: {
        id: entry.id,
        OR: [
          { companyId: null },
          {
            company: {
              memberships: {
                some: {
                  userId,
                  status: "ACTIVE",
                },
              },
            },
          },
        ],
      },
      select: {
        companyId: true,
      },
    });

    if (!existing) {
      continue;
    }

    const nextCompanyId = "companyId" in entry.changes ? normalizeOptionalString(entry.changes.companyId) : existing.companyId;
    if (existing.companyId == null || nextCompanyId == null) {
      return true;
    }
  }

  return resourceMutationTouchesGlobalCatalog(patch.delete);
}

export async function createResource(input: ResourceInput) {
  const parsed = resourceSchema.parse(input);
  const normalized = normalizeResourceFields(parsed);
  const code = await generateNextResourceCode(prisma, normalized.companyId ?? null, normalized.category);
  const resource = await prisma.resource.create({
    data: buildResourceCreateData(normalized, code),
  });

  return serializeResource(resource);
}

export async function createResourceForUser(userId: string, input: ResourceInput) {
  const parsed = resourceSchema.parse(input);
  const normalized = normalizeResourceFields(parsed);

  if (normalized.companyId) {
    await assertWorkspaceMembership({ userId, companyId: normalized.companyId, minimumRole: "EDITOR" });
  }

  const code = await generateNextResourceCode(prisma, normalized.companyId ?? null, normalized.category);
  const resource = await prisma.resource.create({
    data: buildResourceCreateData(normalized, code),
  });

  return serializeResource(resource);
}

export async function updateResource(id: string, userId: string, input: ResourceInput) {
  const parsed = resourceSchema.parse(input);
  const existingResource = await prisma.resource.findFirst({
    where: {
      id,
      company: {
        memberships: {
          some: {
            userId,
            status: "ACTIVE",
          },
        },
      },
    },
  });

  if (!existingResource) {
    throw new Error("No tienes permisos para editar este insumo");
  }

  const normalized = normalizeResourceFields(parsed);
  if (normalized.companyId) {
    await assertCompanyOwnership(prisma, userId, normalized.companyId);
  }

  const shouldRegenerateCode =
    normalized.category !== existingResource.category ||
    normalized.companyId !== existingResource.companyId ||
    !existingResource.code;

  const code = shouldRegenerateCode
    ? await generateNextResourceCode(prisma, normalized.companyId ?? null, normalized.category, existingResource.id)
    : existingResource.code;

  const resource = await prisma.resource.update({
    where: { id },
    data: buildResourceUpdateData(normalized, code),
  });

  return serializeResource(resource);
}

export async function deleteResource(id: string, userId: string) {
  const resource = await prisma.resource.findFirst({
    where: {
      id,
      company: {
        memberships: {
          some: {
            userId,
            status: "ACTIVE",
          },
        },
      },
    },
    include: {
      apuResources: {
        select: { id: true },
        take: 1,
      },
    },
  });

  if (!resource) {
    throw new Error("No tienes permisos para eliminar este insumo");
  }

  if (resource.apuResources.length) {
    throw new Error("No puedes eliminar un insumo que ya esta usado en un APU");
  }

  await prisma.resource.delete({
    where: { id },
  });
}

export async function saveResourcesPatch(userId: string, patchInput: ResourceStatePatch): Promise<ResourcePatchResult> {
  const patch = resourceStatePatchSchema.parse(patchInput);

  return prisma.$transaction(async (tx) => {
    const created: ResourcePatchResult["created"] = [];
    const updated: ResourceRecord[] = [];

    for (const entry of patch.create) {
      const normalized = normalizeResourceFields(entry.data);

      if (normalized.companyId) {
        await assertCompanyOwnership(tx, userId, normalized.companyId);
      }

      const resource = await tx.resource.create({
        data: buildResourceCreateData(
          normalized,
          await generateNextResourceCode(tx, normalized.companyId ?? null, normalized.category),
        ),
      });

      created.push({
        clientId: entry.clientId,
        resource: serializeResource(resource),
      });
    }

    for (const entry of patch.update) {
      const existing = await tx.resource.findFirst({
        where: {
          id: entry.id,
          OR: [
            {
              company: {
                memberships: {
                  some: {
                    userId,
                    status: "ACTIVE",
                  },
                },
              },
            },
            {
              companyId: null,
            },
          ],
        },
      });

      if (!existing) {
        throw new Error("No tienes permisos para editar este insumo");
      }

      const normalizedChanges = normalizeResourcePatchChanges(entry.changes);
      const updateChanges: Partial<ResourcePatchFields> | null =
        existing.companyId == null
          ? getGlobalResourceReviewUpdateChanges(normalizedChanges)
          : normalizedChanges;

      if (existing.companyId == null && !updateChanges) {
        throw new Error("Solo puedes editar el IU 2026 de insumos globales en revision");
      }

      const allowedUpdateChanges = updateChanges ?? {};
      const nextCompanyId =
        allowedUpdateChanges.companyId !== undefined ? (allowedUpdateChanges.companyId ?? null) : existing.companyId;
      const nextCategory = allowedUpdateChanges.category ?? existing.category;

      if (nextCompanyId) {
        await assertCompanyOwnership(tx, userId, nextCompanyId);
      }

      const shouldRegenerateCode =
        allowedUpdateChanges.category !== undefined ||
        allowedUpdateChanges.companyId !== undefined ||
        !existing.code;

      const resource = await tx.resource.update({
        where: { id: entry.id },
        data: buildResourceUpdateData(
          allowedUpdateChanges,
          shouldRegenerateCode ? await generateNextResourceCode(tx, nextCompanyId, nextCategory, existing.id) : undefined,
          existing.companyId == null && allowedUpdateChanges.iuCurrent !== undefined
            ? getNextIuCurrentReviewStatus({
                previousIuCurrent: existing.iuCurrent,
                nextIuCurrent: allowedUpdateChanges.iuCurrent,
              })
            : undefined,
        ),
      });

      updated.push(serializeResource(resource));
    }

    for (const id of patch.delete) {
      const resource = await tx.resource.findFirst({
        where: {
          id,
          company: {
            memberships: {
              some: {
                userId,
                status: "ACTIVE",
              },
            },
          },
        },
        include: {
          apuResources: {
            select: { id: true },
            take: 1,
          },
        },
      });

      if (!resource) {
        throw new Error("No tienes permisos para eliminar este insumo");
      }

      if (resource.apuResources.length) {
        throw new Error("No puedes eliminar un insumo que ya esta usado en un APU");
      }

      await tx.resource.delete({
        where: { id },
      });
    }

    return {
      created,
      updated,
      deleted: patch.delete,
      savedAt: new Date().toISOString(),
    };
  });
}

function getGlobalResourceReviewUpdateChanges(changes: Partial<ResourcePatchFields>) {
  if (changes.iuCurrent === undefined) {
    return null;
  }

  return {
    iuCurrent: changes.iuCurrent,
  } satisfies Partial<ResourcePatchFields>;
}

function getNextIuCurrentReviewStatus({
  previousIuCurrent,
  nextIuCurrent,
}: {
  previousIuCurrent: string | null;
  nextIuCurrent: string | null | undefined;
}) {
  const previousCode = normalizeResourceIuCode(previousIuCurrent);
  const nextCode = normalizeResourceIuCode(nextIuCurrent);

  if (!previousCode && nextCode) {
    return "MANUAL_ASSIGNED";
  }

  return null;
}

function normalizeResourceFields(input: ResourceInput | ResourcePatchFields) {
  return {
    companyId: normalizeOptionalString(input.companyId),
    code: normalizeOptionalString(input.code),
    description: input.description.trim(),
    category: input.category,
    iu: normalizeResourceIuCode(input.iu),
    iuCurrent: normalizeResourceIuCode(input.iuCurrent),
    subcategory: normalizeOptionalString(input.subcategory),
    unit: input.unit.trim(),
    unitPrice: input.unitPrice,
    currency: input.currency.trim() || "PEN",
    source: normalizeOptionalString(input.source),
  };
}

function normalizeResourcePatchChanges(changes: Partial<ResourcePatchFields>) {
  const normalized: Partial<ResourcePatchFields> = {};

  if ("companyId" in changes) normalized.companyId = normalizeOptionalString(changes.companyId);
  if ("description" in changes && changes.description !== undefined) normalized.description = changes.description.trim();
  if ("category" in changes && changes.category !== undefined) normalized.category = changes.category;
  if ("iu" in changes) normalized.iu = normalizeResourceIuCode(changes.iu);
  if ("iuCurrent" in changes) normalized.iuCurrent = normalizeResourceIuCode(changes.iuCurrent);
  if ("subcategory" in changes) normalized.subcategory = normalizeOptionalString(changes.subcategory);
  if ("unit" in changes && changes.unit !== undefined) normalized.unit = changes.unit.trim();
  if ("unitPrice" in changes && changes.unitPrice !== undefined) normalized.unitPrice = changes.unitPrice;
  if ("currency" in changes && changes.currency !== undefined) normalized.currency = changes.currency.trim() || "PEN";
  if ("source" in changes) normalized.source = normalizeOptionalString(changes.source);

  return normalized;
}

function normalizeOptionalString(value: string | null | undefined) {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function buildResourceCreateData(
  normalized: ReturnType<typeof normalizeResourceFields>,
  code: string,
): Prisma.ResourceCreateInput {
  const { companyId, ...rest } = normalized;

  return {
    ...rest,
    code,
    ...(companyId
      ? {
          company: {
            connect: { id: companyId },
          },
        }
      : {}),
  };
}

function buildResourceUpdateData(
  normalized: Partial<ReturnType<typeof normalizeResourceFields>>,
  code?: string,
  iuCurrentReviewStatus?: string | null,
): Prisma.ResourceUpdateInput {
  const { companyId, code: removedCode, ...rest } = normalized;
  void removedCode;

  return {
    ...rest,
    ...(code !== undefined ? { code } : {}),
    ...(iuCurrentReviewStatus !== undefined ? { iuCurrentReviewStatus } : {}),
    ...(companyId !== undefined
      ? companyId
        ? {
            company: {
              connect: { id: companyId },
            },
          }
        : {
            company: {
              disconnect: true,
            },
          }
      : {}),
  };
}

async function generateNextResourceCode(
  tx: Prisma.TransactionClient | typeof prisma,
  companyId: string | null,
  category: ResourceCategory,
  excludeId?: string,
) {
  const prefix = resourceCodePrefixes[category];
  const resources = await tx.resource.findMany({
    where: {
      category,
      companyId,
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: {
      code: true,
    },
  });

  const maxSequence = resources.reduce((max, resource) => {
    const match = resource.code.match(new RegExp(`^${prefix}-(\\d+)$`));
    if (!match) return max;

    const sequence = Number(match[1]);
    return Number.isFinite(sequence) ? Math.max(max, sequence) : max;
  }, 0);

  return `${prefix}-${String(maxSequence + 1).padStart(3, "0")}`;
}

async function assertCompanyOwnership(
  tx: Prisma.TransactionClient | typeof prisma,
  userId: string,
  companyId: string,
) {
  try {
    await assertWorkspaceMembership({ userId, companyId, minimumRole: "EDITOR" });
  } catch {
    throw new Error("No puedes crear o mover insumos a una empresa que no te pertenece");
  }
}
