import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { resolveBudgetOwnership } from "./authorization";
import { serializeVersion, serializeVersionWithSnapshot } from "./serializers";
import { publishBudgetEvent } from "./events";
import { versionCreateSchema, type VersionCreateInput } from "@/lib/validations/collaboration";
import type { BudgetVersionRecord, BudgetVersionDetailRecord } from "@/types/collaboration";

type RawVersion = {
  id: string;
  budgetId: string;
  projectId: string;
  companyId: string;
  versionNumber: number;
  label: string | null;
  reason: string | null;
  snapshot: unknown;
  createdById: string;
  createdAt: Date;
  createdBy?: { name: string };
};

export async function createBudgetVersionSnapshot(
  budgetId: string,
  userId: string,
  label?: string,
  reason?: string,
): Promise<BudgetVersionDetailRecord> {
  const { companyId, projectId } = await resolveBudgetOwnership(budgetId, userId);

  // Capture current budget state as the snapshot
  const budget = await prisma.budget.findUnique({
    where: { id: budgetId },
    include: {
      levels: { orderBy: { sortOrder: "asc" } },
      items: {
        orderBy: { sortOrder: "asc" },
        include: {
          apu: {
            include: {
              resources: { orderBy: { id: "asc" } },
            },
          },
        },
      },
    },
  });

  if (!budget) {
    throw new Error("Presupuesto no encontrado");
  }

  // Get next version number
  const latestVersion = await prisma.budgetVersionSnapshot.findFirst({
    where: { budgetId },
    orderBy: { versionNumber: "desc" },
    select: { versionNumber: true },
  });

  const versionNumber = (latestVersion?.versionNumber ?? 0) + 1;    // Serialize budget to plain JSON (convert Decimal types to numbers)
    const plainSnapshot = serializeBudgetToPlainObject(budget);

    const version = await prisma.budgetVersionSnapshot.create({
    data: {
      budgetId,
      projectId,
      companyId,
      versionNumber,
      label: label?.trim() || null,
      reason: reason?.trim() || null,
      snapshot: plainSnapshot as Prisma.InputJsonValue,
      createdById: userId,
    },
    include: {
      createdBy: { select: { name: true } },
    },
  });

  const record = serializeVersionWithSnapshot(version as unknown as RawVersion);
  publishBudgetEvent(budgetId, "version.created", record);
  return record;
}

export async function listBudgetVersionSnapshots(
  budgetId: string,
  userId: string,
  cursor?: string,
  limit = 20,
): Promise<BudgetVersionRecord[]> {
  await resolveBudgetOwnership(budgetId, userId);

  const where: Record<string, unknown> = { budgetId };
  if (cursor) {
    where.createdAt = { lt: new Date(cursor) };
  }

  const versions = await prisma.budgetVersionSnapshot.findMany({
    where: where as never,
    include: {
      createdBy: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return versions.map((v) => serializeVersion(v as unknown as RawVersion));
}

export async function getBudgetVersionSnapshot(
  versionId: string,
  budgetId: string,
  userId: string,
): Promise<BudgetVersionDetailRecord> {
  await resolveBudgetOwnership(budgetId, userId);

  const version = await prisma.budgetVersionSnapshot.findFirst({
    where: { id: versionId, budgetId },
    include: {
      createdBy: { select: { name: true } },
    },
  });

  if (!version) {
    throw new Error("Version no encontrada");
  }

  return serializeVersionWithSnapshot(version as unknown as RawVersion);
}

export async function restoreBudgetVersionSnapshot(
  versionId: string,
  budgetId: string,
  userId: string,
): Promise<BudgetVersionDetailRecord> {
  const detail = await getBudgetVersionSnapshot(versionId, budgetId, userId);

  // Create a new version before restoring (as a safety net)
  await createBudgetVersionSnapshot(
    budgetId,
    userId,
    `Auto-guardado antes de restaurar v${detail.versionNumber}`,
    "Restauracion de version",
  );

  const snapshot = detail.snapshot as {
    name: string;
    currency: string;
    igvRate: unknown;
    generalExpensesRate: unknown;
    utilityRate: unknown;
    totalDirectCost: unknown;
    totalGeneralExpenses: unknown;
    totalUtility: unknown;
    totalTax: unknown;
    totalAmount: unknown;
    levels?: Array<{
      id: string;
      budgetId: string;
      parentId: string | null;
      type: string;
      code: string;
      name: string;
      sortOrder: number;
    }>;
    items?: Array<{
      id: string;
      budgetId: string;
      levelId: string | null;
      code: string;
      description: string;
      unit: string;
      quantity: unknown;
      unitPrice: unknown;
      partial: unknown;
      sortOrder: number;
      apu?: {
        id: string;
        budgetItemId: string;
        name: string;
        unit: string;
        performance: unknown;
        totalUnitCost: unknown;
        resources?: Array<{
          id: string;
          apuId: string;
          resourceId: string | null;
          catalogPartidaId: string | null;
          resourceType: string;
          crew: unknown;
          quantity: unknown;
          unitPrice: unknown;
          subtotal: unknown;
          nestedApuRows: unknown;
        }>;
      } | null;
    }>;
  };

  // Restore budget header
  await prisma.budget.update({
    where: { id: budgetId },
    data: {
      name: snapshot.name,
      currency: snapshot.currency,
      igvRate: snapshot.igvRate as number,
      generalExpensesRate: snapshot.generalExpensesRate as number,
      utilityRate: snapshot.utilityRate as number,
      totalDirectCost: snapshot.totalDirectCost as number,
      totalGeneralExpenses: snapshot.totalGeneralExpenses as number,
      totalUtility: snapshot.totalUtility as number,
      totalTax: snapshot.totalTax as number,
      totalAmount: snapshot.totalAmount as number,
    },
  });

  // Delete current levels and items
  await prisma.budgetItem.deleteMany({ where: { budgetId } });
  await prisma.budgetLevel.deleteMany({ where: { budgetId } });

  // Re-create levels from snapshot
  if (snapshot.levels && snapshot.levels.length > 0) {
    for (const level of snapshot.levels) {
      await prisma.budgetLevel.create({
        data: {
          id: level.id,
          budgetId,
          parentId: level.parentId,
          type: level.type as Parameters<typeof prisma.budgetLevel.create>[0]["data"]["type"],
          code: level.code,
          name: level.name,
          sortOrder: level.sortOrder,
        },
      });
    }
  }

  // Re-create items from snapshot
  if (snapshot.items && snapshot.items.length > 0) {
    for (const item of snapshot.items) {
      await prisma.budgetItem.create({
        data: {
          id: item.id,
          budgetId,
          levelId: item.levelId,
          code: item.code,
          description: item.description,
          unit: item.unit,
          quantity: item.quantity as number,
          unitPrice: item.unitPrice as number,
          partial: item.partial as number,
          sortOrder: item.sortOrder,
        },
      });

      if (item.apu) {
        await prisma.apu.create({
          data: {
            id: item.apu.id,
            budgetItemId: item.id,
            name: item.apu.name,
            unit: item.apu.unit,
            performance: item.apu.performance as number,
            totalUnitCost: item.apu.totalUnitCost as number,
          },
        });

        if (item.apu.resources && item.apu.resources.length > 0) {
          for (const resource of item.apu.resources) {
            await prisma.apuResource.create({
              data: {
                id: resource.id,
                apuId: item.apu.id,
                resourceId: resource.resourceId,
                catalogPartidaId: resource.catalogPartidaId,
                resourceType: resource.resourceType,
                crew: (resource.crew as number | null) ?? null,
                quantity: resource.quantity as number,
                unitPrice: resource.unitPrice as number,
                subtotal: resource.subtotal as number,
                nestedApuRows: resource.nestedApuRows != null ? (resource.nestedApuRows as Prisma.InputJsonValue) : Prisma.JsonNull,
              },
            });
          }
        }
      }
    }
  }

  // Create the restoration version record
  const restoredVersion = await createBudgetVersionSnapshot(
    budgetId,
    userId,
    `Restaurado de v${detail.versionNumber}`,
    "Restauracion completada",
  );

  publishBudgetEvent(budgetId, "version.restored", {
    fromVersionId: versionId,
    toVersionId: restoredVersion.id,
  });

  return restoredVersion;
}

/**
 * Serializes a Prisma budget object to a plain JSON-safe object.
 * Converts Decimal fields to numbers and Date fields to ISO strings.
 */
function serializeBudgetToPlainObject(budget: Record<string, unknown>): Record<string, unknown> {
  function serialize(value: unknown): unknown {
    if (value === null || value === undefined) return value;
    if (typeof value === "object" && "constructor" in value && (value as { constructor: { name: string } }).constructor.name === "Decimal") {
      return Number((value as { toNumber: () => number }).toNumber());
    }
    if (value instanceof Date) return value.toISOString();
    if (Array.isArray(value)) return value.map(serialize);
    if (typeof value === "object" && value !== null) {
      const result: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
        result[key] = serialize(val);
      }
      return result;
    }
    return value;
  }

  return serialize(budget) as Record<string, unknown>;
}
