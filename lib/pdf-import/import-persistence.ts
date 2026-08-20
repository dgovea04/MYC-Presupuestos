import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";

import { assertWithinPlanLimit } from "@/lib/billing/entitlements";
import { getUserSettings } from "@/lib/data/settings";
import { prisma } from "@/lib/db/prisma";
import { assertWorkspaceMembership } from "@/lib/workspace/access";
import type { PdfAiImportDraft, PdfImportedApu, PdfImportedResource } from "./types";

export type PdfAiImportPersistenceOptions = {
  companyId: string;
};

export type PdfAiImportPersistenceResult = {
  projectId: string;
  projectName: string;
  generalBudgetId: string;
  subBudgetIds: string[];
  resourceCount: number;
  budgetCount: number;
  itemCount: number;
  apuCount: number;
};

const importTransactionOptions = {
  maxWait: 10_000,
  timeout: 120_000,
};

export async function importPdfAiDraftToMyc(
  userId: string,
  draft: PdfAiImportDraft,
  options: PdfAiImportPersistenceOptions,
): Promise<PdfAiImportPersistenceResult> {
  const criticalValidations = draft.validations.filter((validation) => validation.severity === "error" && !isValidationApproved(draft, validation.code, validation.entityId));
  if (criticalValidations.length > 0) {
    throw new Error(`El draft PDF tiene ${criticalValidations.length} errores criticos pendientes de revision.`);
  }

  await assertWorkspaceMembership({ userId, companyId: options.companyId, minimumRole: "EDITOR" });
  await assertWithinPlanLimit({ userId, resource: "projects" });
  await assertWithinPlanLimit({ userId, resource: "budgets" });
  const settings = await getUserSettings(userId);

  return prisma.$transaction(async (tx) => {
    const project = await tx.project.create({
      data: {
        companyId: options.companyId,
        name: draft.project.name,
        projectType: "Importado PDF IA",
        status: "PLANNING",
      },
    });

    const resourceIdsByDraftId = await persistResources(tx, options.companyId, draft.resources);
    const subpartidaIdsByDraftId = await persistSubpartidas(tx, draft);
    const generalBudget = await tx.budget.create({
      data: {
        projectId: project.id,
        parentBudgetId: null,
        kind: "GENERAL",
        name: draft.project.name,
        currency: draft.project.currency,
        igvRate: settings.defaultIgvRate,
        generalExpensesRate: settings.defaultGeneralExpensesRate,
        utilityRate: settings.defaultUtilityRate,
        totalDirectCost: 0,
        totalGeneralExpenses: 0,
        totalUtility: 0,
        totalTax: 0,
        totalAmount: 0,
      },
    });

    const itemIdsByDraftId = new Map<string, string>();
    const subBudgetIds: string[] = [];

    for (const budget of draft.budgets) {
      const persistedBudget = await tx.budget.create({
        data: {
          projectId: project.id,
          parentBudgetId: generalBudget.id,
          kind: "SUB_BUDGET",
          name: budget.name,
          currency: budget.currency,
          igvRate: settings.defaultIgvRate,
          generalExpensesRate: settings.defaultGeneralExpensesRate,
          utilityRate: settings.defaultUtilityRate,
          totalDirectCost: sumBudgetPartials(budget.items.map((item) => item.partial)),
          totalGeneralExpenses: 0,
          totalUtility: 0,
          totalTax: 0,
          totalAmount: sumBudgetPartials(budget.items.map((item) => item.partial)),
        },
      });
      subBudgetIds.push(persistedBudget.id);

      if (budget.levels.length > 0) {
        await tx.budgetLevel.createMany({
          data: budget.levels.map((level) => ({
            id: randomUUID(),
            budgetId: persistedBudget.id,
            parentId: null,
            type: level.type,
            code: level.code,
            name: level.name,
            sortOrder: level.sortOrder,
          })),
        });
      }

      const items = budget.items.map((item) => {
        const id = randomUUID();
        itemIdsByDraftId.set(item.id, id);
        return {
          id,
          budgetId: persistedBudget.id,
          levelId: null,
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
    }

    for (const apu of draft.apus) {
      const itemId = findPersistedItemIdForApu(draft, itemIdsByDraftId, apu);
      if (!itemId) {
        continue;
      }

      const createdApu = await tx.apu.create({
        data: {
          budgetItemId: itemId,
          name: apu.name,
          unit: apu.unit,
          performance: apu.performance,
          totalUnitCost: apu.totalUnitCost,
        },
      });

      if (apu.rows.length > 0) {
        await tx.apuResource.createMany({
          data: apu.rows.map((row) => ({
            id: randomUUID(),
            apuId: createdApu.id,
            resourceId: findSubpartidaIdForRow(draft, subpartidaIdsByDraftId, row.id)
              ? null
              : row.resourceId ? resourceIdsByDraftId.get(row.resourceId) ?? null : findResourceIdByDescription(draft.resources, resourceIdsByDraftId, row.description),
            catalogPartidaId: findSubpartidaIdForRow(draft, subpartidaIdsByDraftId, row.id),
            resourceType: row.resourceType,
            crew: null,
            quantity: row.quantity,
            unitPrice: row.unitPrice,
            subtotal: row.subtotal,
            nestedApuRows: createNestedApuRowsForRow(draft, row.id) ?? Prisma.JsonNull,
          })),
        });
      }
    }

    return {
      projectId: project.id,
      projectName: project.name,
      generalBudgetId: generalBudget.id,
      subBudgetIds,
      resourceCount: draft.resources.length,
      budgetCount: 1 + subBudgetIds.length,
      itemCount: draft.budgets.reduce((sum, budget) => sum + budget.items.length, 0),
      apuCount: draft.apus.length,
    };
  }, importTransactionOptions);
}

function isValidationApproved(draft: PdfAiImportDraft, validationCode: string, entityId?: string | null) {
  if (!entityId) {
    return false;
  }
  return (draft.reviewApprovals ?? []).some((approval) => approval.validationCode === validationCode && approval.entityId === entityId);
}

async function persistSubpartidas(tx: Prisma.TransactionClient, draft: PdfAiImportDraft) {
  const idsByDraftId = new Map<string, string>();

  for (const subpartida of draft.subpartidas) {
    const created = await tx.catalogPartida.create({
      data: {
        description: subpartida.description,
        unit: subpartida.unit,
        unitPrice: subpartida.unitPrice,
        currency: draft.project.currency,
        source: "PDF_AI",
        performance: subpartida.performance,
        performanceUnit: subpartida.unit,
        performanceRate: null,
      },
    });
    idsByDraftId.set(subpartida.id, created.id);

    if (subpartida.rows.length > 0) {
      await tx.partidaApuRow.createMany({
        data: subpartida.rows.map((row) => ({
          id: randomUUID(),
          catalogPartidaId: created.id,
          resourceId: null,
          catalogSubpartidaId: null,
          description: row.description,
          unit: row.unit,
          crew: null,
          quantity: row.quantity,
          unitPrice: row.unitPrice,
          subtotal: row.subtotal,
          resourceType: row.resourceType,
          groupLabel: null,
          sortOrder: row.sortOrder,
        })),
      });
    }
  }

  return idsByDraftId;
}

async function persistResources(tx: Prisma.TransactionClient, companyId: string, resources: PdfImportedResource[]) {
  const existingResources = await tx.resource.findMany({
    where: {
      companyId,
      source: "PDF_AI",
    },
    select: {
      id: true,
      description: true,
      unit: true,
      category: true,
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
        category: resource.category === "OTHER" ? "MATERIAL" : resource.category,
        iu: null,
        unit: resource.unit,
        unitPrice: resource.unitPrice,
        currency: resource.currency,
        source: "PDF_AI",
      },
    });
    existingIdsByKey.set(key, created.id);
    resourceIdsByDraftId.set(resource.id, created.id);
  }

  return resourceIdsByDraftId;
}

function findPersistedItemIdForApu(draft: PdfAiImportDraft, itemIdsByDraftId: Map<string, string>, apu: PdfImportedApu) {
  const link = draft.links.find((entry) => entry.kind === "BUDGET_ITEM_APU" && entry.toId === apu.id && entry.status === "MATCHED");
  return link ? itemIdsByDraftId.get(link.fromId) ?? null : null;
}

function findResourceIdByDescription(resources: PdfImportedResource[], resourceIdsByDraftId: Map<string, string>, description: string) {
  const resource = resources.find((entry) => entry.description.trim().toLowerCase() === description.trim().toLowerCase());
  return resource ? resourceIdsByDraftId.get(resource.id) ?? null : null;
}

function findSubpartidaIdForRow(draft: PdfAiImportDraft, subpartidaIdsByDraftId: Map<string, string>, rowId: string) {
  const link = draft.links.find((entry) => entry.kind === "APU_SUBPARTIDA" && entry.fromId === rowId && entry.status === "MATCHED");
  return link?.toId ? subpartidaIdsByDraftId.get(link.toId) ?? null : null;
}

function createNestedApuRowsForRow(draft: PdfAiImportDraft, rowId: string) {
  const link = draft.links.find((entry) => entry.kind === "APU_SUBPARTIDA" && entry.fromId === rowId && entry.status === "MATCHED");
  const subpartida = link?.toId ? draft.subpartidas.find((entry) => entry.id === link.toId) : undefined;
  if (!subpartida) {
    return null;
  }

  return subpartida.rows.map((row) => ({
    description: row.description,
    unit: row.unit,
    crew: null,
    quantity: row.quantity,
    unitPrice: row.unitPrice,
    subtotal: row.subtotal,
    resourceType: row.resourceType,
    groupLabel: null,
    sortOrder: row.sortOrder,
  }));
}

function createResourceKey(resource: { description: string; unit: string; category: string; currency: string }) {
  return [resource.description, resource.unit, resource.category, resource.currency].map((part) => part.trim().toUpperCase()).join("|");
}

function sumBudgetPartials(partials: string[]) {
  return partials.reduce((sum, partial) => sum + Number(partial), 0);
}
