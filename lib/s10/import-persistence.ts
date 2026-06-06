import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";

import { assertWithinPlanLimit } from "@/lib/billing/entitlements";
import { prisma } from "@/lib/db/prisma";
import {
  createMycImportDraftFromS10,
  type MycS10ImportDraft,
  type S10ExportSnapshot,
  type S10ImportMapperOptions,
} from "@/lib/s10/import-mapper";
import type { ApuRecord, ApuResourceRecord } from "@/types/apu";
import type { BudgetRecord } from "@/types/budget";
import type { ResourceRecord } from "@/types/resource";

export type S10ImportPersistenceOptions = S10ImportMapperOptions & {
  companyId: string;
};

export type S10ImportPersistenceResult = {
  projectId: string;
  projectName: string;
  generalBudgetId: string;
  subBudgetIds: string[];
  resourceCount: number;
  budgetCount: number;
  itemCount: number;
  apuCount: number;
};

type PersistedResourceLookup = Map<string, string>;

export async function importS10SnapshotToMyc(
  userId: string,
  snapshot: S10ExportSnapshot,
  options: S10ImportPersistenceOptions,
): Promise<S10ImportPersistenceResult> {
  const company = await prisma.company.findFirst({
    where: { id: options.companyId, userId },
    select: { id: true },
  });

  if (!company) {
    throw new Error("No puedes importar S10 en una empresa que no te pertenece");
  }

  await assertWithinPlanLimit({ userId, resource: "projects" });
  await assertWithinPlanLimit({ userId, resource: "budgets" });

  const draft = createMycImportDraftFromS10(snapshot, {
    budgetCode: options.budgetCode,
    companyId: options.companyId,
  });
  assertDraftReadyForPersistence(draft);

  return prisma.$transaction(async (tx) => {
    const project = await tx.project.create({
      data: {
        companyId: options.companyId,
        name: draft.project.name,
        projectType: "Importado S10",
        status: "PLANNING",
      },
    });

    const resourceIdsByDraftId = await persistResources(tx, options.companyId, draft.resources);
    const budgetIdsByDraftId = new Map<string, string>();
    const levelIdsByDraftId = new Map<string, string>();
    const itemIdsByDraftId = new Map<string, string>();

    const generalDraftBudget = draft.budgets.find((budget) => budget.kind === "GENERAL");
    if (!generalDraftBudget) {
      throw new Error("El draft S10 no contiene presupuesto general.");
    }

    const generalBudget = await tx.budget.create({
      data: createBudgetCreateData(generalDraftBudget, project.id, null),
    });
    budgetIdsByDraftId.set(generalDraftBudget.id, generalBudget.id);

    const subBudgetIds: string[] = [];
    for (const budget of draft.budgets.filter((entry) => entry.kind === "SUB_BUDGET")) {
      const persistedBudget = await tx.budget.create({
        data: createBudgetCreateData(budget, project.id, generalBudget.id),
      });
      budgetIdsByDraftId.set(budget.id, persistedBudget.id);
      subBudgetIds.push(persistedBudget.id);

      await persistBudgetStructure(tx, budget, persistedBudget.id, resourceIdsByDraftId, levelIdsByDraftId, itemIdsByDraftId);
    }

    const itemCount = draft.budgets
      .filter((budget) => budget.kind === "SUB_BUDGET")
      .reduce((sum, budget) => sum + budget.items.length, 0);
    const apuCount = draft.budgets
      .filter((budget) => budget.kind === "SUB_BUDGET")
      .reduce((sum, budget) => sum + budget.items.filter((item) => item.apu).length, 0);

    return {
      projectId: project.id,
      projectName: project.name,
      generalBudgetId: generalBudget.id,
      subBudgetIds,
      resourceCount: draft.resources.length,
      budgetCount: 1 + subBudgetIds.length,
      itemCount,
      apuCount,
    };
  });
}

function assertDraftReadyForPersistence(draft: MycS10ImportDraft) {
  const nonOkApuCount = draft.itemMetadata.filter((metadata) => metadata.apuStatus !== "OK").length;
  if (nonOkApuCount > 0) {
    throw new Error(`El draft S10 tiene ${nonOkApuCount} partidas con APU pendiente o inconsistente.`);
  }
}

async function persistResources(
  tx: Prisma.TransactionClient,
  companyId: string,
  resources: ResourceRecord[],
): Promise<PersistedResourceLookup> {
  const existingResources = await tx.resource.findMany({
    where: {
      companyId,
      source: "S10",
    },
    select: {
      id: true,
      code: true,
      description: true,
      category: true,
      unit: true,
      iu: true,
      source: true,
      currency: true,
    },
  });
  const existingIdsByKey = new Map(existingResources.map((resource) => [createResourceKey(resource), resource.id]));
  const resourceIdsByDraftId = new Map<string, string>();

  for (const resource of resources) {
    const key = createResourceKey(resource);
    const existingId = existingIdsByKey.get(key);
    if (existingId) {
      resourceIdsByDraftId.set(resource.id, existingId);
      continue;
    }

    const created = await tx.resource.create({
      data: {
        companyId,
        code: resource.code,
        description: resource.description,
        category: resource.category,
        iu: resource.iu,
        unit: resource.unit,
        unitPrice: resource.unitPrice,
        currency: resource.currency,
        source: "S10",
      },
    });
    existingIdsByKey.set(key, created.id);
    resourceIdsByDraftId.set(resource.id, created.id);
  }

  return resourceIdsByDraftId;
}

function createBudgetCreateData(budget: BudgetRecord, projectId: string, parentBudgetId: string | null) {
  return {
    projectId,
    parentBudgetId,
    kind: budget.kind,
    name: budget.name,
    currency: budget.currency,
    igvRate: budget.igvRate,
    generalExpensesRate: budget.generalExpensesRate,
    utilityRate: budget.utilityRate,
    totalDirectCost: budget.totalDirectCost,
    totalGeneralExpenses: budget.totalGeneralExpenses,
    totalUtility: budget.totalUtility,
    totalTax: budget.totalTax,
    totalAmount: budget.totalAmount,
  };
}

async function persistBudgetStructure(
  tx: Prisma.TransactionClient,
  budget: BudgetRecord,
  persistedBudgetId: string,
  resourceIdsByDraftId: PersistedResourceLookup,
  levelIdsByDraftId: Map<string, string>,
  itemIdsByDraftId: Map<string, string>,
) {
  const levels = budget.levels.map((level) => {
    const id = randomUUID();
    levelIdsByDraftId.set(level.id, id);

    return {
      id,
      budgetId: persistedBudgetId,
      parentId: level.parentId ? levelIdsByDraftId.get(level.parentId) ?? null : null,
      type: level.type,
      code: level.code,
      name: level.name,
      sortOrder: level.sortOrder,
    };
  });

  if (levels.length > 0) {
    await tx.budgetLevel.createMany({ data: levels });
  }

  const items = budget.items.map((item) => {
    const id = randomUUID();
    itemIdsByDraftId.set(item.id, id);

    return {
      id,
      budgetId: persistedBudgetId,
      levelId: item.levelId ? levelIdsByDraftId.get(item.levelId) ?? null : null,
      code: item.code,
      description: item.description,
      unit: item.unit,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      partial: item.partial,
      sortOrder: item.sortOrder,
    };
  });

  if (items.length > 0) {
    await tx.budgetItem.createMany({ data: items });
  }

  for (const item of budget.items) {
    if (!item.apu) {
      continue;
    }

    const persistedItemId = itemIdsByDraftId.get(item.id);
    if (!persistedItemId) {
      continue;
    }

    await persistApu(tx, item.apu, persistedItemId, resourceIdsByDraftId);
  }
}

async function persistApu(
  tx: Prisma.TransactionClient,
  apu: ApuRecord,
  persistedItemId: string,
  resourceIdsByDraftId: PersistedResourceLookup,
) {
  const createdApu = await tx.apu.create({
    data: {
      budgetItemId: persistedItemId,
      name: apu.name,
      unit: apu.unit,
      performance: apu.performance,
      totalUnitCost: apu.totalUnitCost,
    },
  });

  const resources = apu.resources.map((resource) => createApuResourceCreateData(resource, createdApu.id, resourceIdsByDraftId));

  if (resources.length > 0) {
    await tx.apuResource.createMany({ data: resources });
  }
}

function createApuResourceCreateData(
  resource: ApuResourceRecord,
  apuId: string,
  resourceIdsByDraftId: PersistedResourceLookup,
) {
  return {
    id: randomUUID(),
    apuId,
    resourceId: resource.resourceId ? resourceIdsByDraftId.get(resource.resourceId) ?? null : null,
    resourceType: resource.resourceType,
    crew: resource.crew ?? null,
    quantity: resource.quantity,
    unitPrice: resource.unitPrice,
    subtotal: resource.subtotal,
    nestedApuRows: Prisma.JsonNull,
  };
}

function createResourceKey(
  resource: Pick<ResourceRecord, "code" | "description" | "category" | "unit" | "iu" | "source" | "currency">,
) {
  return [
    resource.code,
    resource.description,
    resource.category,
    resource.unit,
    resource.iu ?? "",
    resource.source ?? "",
    resource.currency,
  ]
    .map((part) => part.trim().toUpperCase())
    .join("|");
}
