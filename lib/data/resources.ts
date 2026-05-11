import { prisma } from "@/lib/db/prisma";
import { serializeResource } from "@/lib/db/serializers";
import { resourceSchema, resourceStatePatchSchema, type ResourceInput } from "@/lib/validations/resource";
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
};

export async function getResourcesByUser(userId: string) {
  return prisma.resource.findMany({
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
    include: {
      company: true,
    },
    orderBy: [{ category: "asc" }, { description: "asc" }],
  });
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
    const company = await prisma.company.findFirst({
      where: {
        id: normalized.companyId,
        userId,
      },
      select: { id: true },
    });

    if (!company) {
      throw new Error("No puedes crear insumos en una empresa que no te pertenece");
    }
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
        userId,
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
        userId,
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
          company: {
            userId,
          },
        },
      });

      if (!existing) {
        throw new Error("No tienes permisos para editar este insumo");
      }

      const normalizedChanges = normalizeResourcePatchChanges(entry.changes);
      const nextCompanyId =
        normalizedChanges.companyId !== undefined ? (normalizedChanges.companyId ?? null) : existing.companyId;
      const nextCategory = normalizedChanges.category ?? existing.category;

      if (nextCompanyId) {
        await assertCompanyOwnership(tx, userId, nextCompanyId);
      }

      const shouldRegenerateCode =
        normalizedChanges.category !== undefined ||
        normalizedChanges.companyId !== undefined ||
        !existing.code;

      const resource = await tx.resource.update({
        where: { id: entry.id },
        data: buildResourceUpdateData(
          normalizedChanges,
          shouldRegenerateCode ? await generateNextResourceCode(tx, nextCompanyId, nextCategory, existing.id) : undefined,
        ),
      });

      updated.push(serializeResource(resource));
    }

    for (const id of patch.delete) {
      const resource = await tx.resource.findFirst({
        where: {
          id,
          company: {
            userId,
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

function normalizeResourceFields(input: ResourceInput | ResourcePatchFields) {
  return {
    companyId: normalizeOptionalString(input.companyId),
    code: normalizeOptionalString(input.code),
    description: input.description.trim(),
    category: input.category,
    iu: normalizeOptionalString(input.iu),
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
  if ("iu" in changes) normalized.iu = normalizeOptionalString(changes.iu);
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
): Prisma.ResourceUpdateInput {
  const { companyId, code: removedCode, ...rest } = normalized;
  void removedCode;

  return {
    ...rest,
    ...(code !== undefined ? { code } : {}),
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
  const company = await tx.company.findFirst({
    where: {
      id: companyId,
      userId,
    },
    select: { id: true },
  });

  if (!company) {
    throw new Error("No puedes crear o mover insumos a una empresa que no te pertenece");
  }
}
