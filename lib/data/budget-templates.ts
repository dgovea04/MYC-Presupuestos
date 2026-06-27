import type { Prisma } from "@prisma/client";

import { getBudgetById } from "@/lib/data/budgets";
import { prisma } from "@/lib/db/prisma";
import {
  buildBudgetSnapshotTemplateLibraryItem,
  type TemplateLibraryItem,
} from "@/lib/templates/template-library";
import {
  buildBudgetTemplateSnapshot,
  type BudgetTemplateSnapshot,
  type BudgetTemplateApuResource,
  type BudgetTemplateResource,
} from "@/lib/templates/budget-template-snapshot";
import { ensureDate } from "@/lib/utils";
import type { ResourceCategory } from "@/types/resource";

type BudgetTemplateRow = {
  id: string;
  userId: string;
  sourceProjectId: string | null;
  sourceBudgetId: string | null;
  module: string;
  name: string;
  description: string;
  payload: Prisma.JsonValue;
  createdAt: Date;
  updatedAt: Date;
};

type BudgetTemplateDelegate = {
  findFirst(args: {
    where: { id: string; userId: string; module: "BUDGET" };
  }): Promise<BudgetTemplateRow | null>;
  findMany(args: {
    where: { userId: string; module: "BUDGET" };
    orderBy: { updatedAt: "desc" };
  }): Promise<BudgetTemplateRow[]>;
  create(args: {
    data: {
      userId: string;
      sourceProjectId: string;
      sourceBudgetId: string;
      module: "BUDGET";
      name: string;
      description: string;
      payload: Prisma.InputJsonValue;
    };
  }): Promise<BudgetTemplateRow>;
  update(args: {
    where: { id: string };
    data: {
      name: string;
      description: string;
      payload: Prisma.InputJsonValue;
    };
  }): Promise<BudgetTemplateRow>;
  deleteMany(args: {
    where: { id: string; userId: string; module: "BUDGET" };
  }): Promise<{ count: number }>;
};

type BudgetTemplateApplyTx = {
  project: {
    findFirst(args: {
      where: { id: string; company: { userId: string } };
      select: { id: true; companyId: true };
    }): Promise<{ id: string; companyId: string } | null>;
  };
  budget: {
    findFirst(args: {
      where: { projectId: string; kind: "GENERAL" };
      select: { id: true };
    }): Promise<{ id: string } | null>;
    create(args: {
      data: {
        projectId: string;
        parentBudgetId: string | null;
        kind: "GENERAL" | "SUB_BUDGET";
        name: string;
        currency: string;
        igvRate: number;
        generalExpensesRate: number;
        utilityRate: number;
        totalDirectCost: number;
        totalGeneralExpenses: number;
        totalUtility: number;
        totalTax: number;
        totalAmount: number;
      };
      select: { id: true };
    }): Promise<{ id: string }>;
  };
  budgetLevel: {
    create(args: {
      data: {
        budgetId: string;
        parentId: string | null;
        type: "TITLE" | "SUBTITLE" | "ITEM_GROUP" | "SUBITEM";
        code: string;
        name: string;
        sortOrder: number;
      };
      select: { id: true };
    }): Promise<{ id: string }>;
  };
  budgetItem: {
    create(args: {
      data: {
        budgetId: string;
        levelId: string | null;
        code: string;
        description: string;
        unit: string;
        quantity: number;
        unitPrice: number;
        partial: number;
        sortOrder: number;
      };
      select: { id: true };
    }): Promise<{ id: string }>;
  };
  apu: {
    create(args: {
      data: {
        budgetItemId: string;
        name: string;
        unit: string;
        performance: number;
        totalUnitCost: number;
      };
      select: { id: true };
    }): Promise<{ id: string }>;
  };
  resource: {
    findFirst(args: {
      where: {
        companyId: string;
        code: string;
        unit: string;
        category: ResourceCategory;
      };
      select: { id: true };
    }): Promise<{ id: string } | null>;
    create(args: {
      data: {
        companyId: string;
        code: string;
        description: string;
        category: ResourceCategory;
        iu: string | null;
        iuCurrent: string | null;
        subcategory: string | null;
        unit: string;
        unitPrice: number;
        currency: string;
        source: string | null;
      };
      select: { id: true };
    }): Promise<{ id: string }>;
  };
  apuResource: {
    create(args: {
      data: {
        apuId: string;
        resourceId: string;
        resourceType: string;
        crew: number | null;
        quantity: number;
        unitPrice: number;
        subtotal: number;
      };
    }): Promise<unknown>;
  };
};

export type UserBudgetTemplateRecord = {
  id: string;
  userId: string;
  sourceProjectId: string | null;
  sourceBudgetId: string | null;
  name: string;
  description: string;
  snapshot: BudgetTemplateSnapshot;
  libraryItem: TemplateLibraryItem;
  createdAt: string;
  updatedAt: string;
};

export type CreateUserBudgetTemplateInput = {
  budgetId: string;
  name?: string;
  description?: string;
  capturedAt?: Date | string;
};

export type ApplyUserBudgetTemplateInput = {
  projectId: string;
  name?: string;
};

export type AppliedUserBudgetTemplate = {
  id: string;
  projectId: string;
  name: string;
  templateName: string;
};

export type UpdateUserBudgetTemplateInput = {
  name: string;
  description?: string;
};

export type DuplicateUserBudgetTemplateInput = {
  name?: string;
  description?: string;
};

export async function listUserBudgetTemplates(userId: string): Promise<UserBudgetTemplateRecord[]> {
  const rows = await getBudgetTemplateDelegate().findMany({
    where: { userId, module: "BUDGET" },
    orderBy: { updatedAt: "desc" },
  });

  return rows.map(serializeBudgetTemplateRow);
}

export async function getUserBudgetTemplateById(id: string, userId: string): Promise<UserBudgetTemplateRecord | null> {
  const row = await getBudgetTemplateDelegate().findFirst({
    where: { id, userId, module: "BUDGET" },
  });

  return row ? serializeBudgetTemplateRow(row) : null;
}

export async function createUserBudgetTemplateFromBudget(
  userId: string,
  input: CreateUserBudgetTemplateInput,
): Promise<UserBudgetTemplateRecord> {
  const budget = await getBudgetById(input.budgetId, userId);
  if (!budget) {
    throw new Error("No se encontro el presupuesto para crear la plantilla");
  }

  const snapshot = buildBudgetTemplateSnapshot(budget, {
    name: input.name,
    description: input.description,
    capturedAt: input.capturedAt,
  });

  const row = await getBudgetTemplateDelegate().create({
    data: {
      userId,
      sourceProjectId: budget.projectId,
      sourceBudgetId: budget.id,
      module: "BUDGET",
      name: snapshot.name,
      description: snapshot.description,
      payload: toInputJson(snapshot),
    },
  });

  return serializeBudgetTemplateRow(row);
}

export async function deleteUserBudgetTemplate(id: string, userId: string): Promise<UserBudgetTemplateRecord> {
  const current = await getUserBudgetTemplateById(id, userId);
  if (!current) {
    throw new Error("No se encontro la plantilla para eliminar");
  }

  const result = await getBudgetTemplateDelegate().deleteMany({
    where: { id, userId, module: "BUDGET" },
  });

  if (result.count === 0) {
    throw new Error("No se encontro la plantilla para eliminar");
  }

  return current;
}

export async function updateUserBudgetTemplate(
  id: string,
  userId: string,
  input: UpdateUserBudgetTemplateInput,
): Promise<UserBudgetTemplateRecord> {
  const current = await getUserBudgetTemplateById(id, userId);
  if (!current) {
    throw new Error("No se encontro la plantilla para actualizar");
  }

  const name = input.name.trim();
  if (!name) {
    throw new Error("El nombre de la plantilla es obligatorio");
  }

  const description = input.description?.trim() ?? "";
  const snapshot: BudgetTemplateSnapshot = {
    ...current.snapshot,
    name,
    description,
  };

  const row = await getBudgetTemplateDelegate().update({
    where: { id },
    data: {
      name,
      description,
      payload: toInputJson(snapshot),
    },
  });

  return serializeBudgetTemplateRow(row);
}

export async function duplicateUserBudgetTemplate(
  id: string,
  userId: string,
  input: DuplicateUserBudgetTemplateInput = {},
): Promise<UserBudgetTemplateRecord> {
  const current = await getUserBudgetTemplateById(id, userId);
  if (!current) {
    throw new Error("No se encontro la plantilla para duplicar");
  }

  const name = input.name?.trim() || `${current.name} copia`;
  const description = input.description?.trim() ?? current.description;
  const snapshot: BudgetTemplateSnapshot = {
    ...current.snapshot,
    name,
    description,
  };

  const row = await getBudgetTemplateDelegate().create({
    data: {
      userId,
      sourceProjectId: current.sourceProjectId,
      sourceBudgetId: current.sourceBudgetId,
      module: "BUDGET",
      name,
      description,
      payload: toInputJson(snapshot),
    },
  });

  return serializeBudgetTemplateRow(row);
}

export async function applyUserBudgetTemplateToProject(
  templateId: string,
  userId: string,
  input: ApplyUserBudgetTemplateInput,
): Promise<AppliedUserBudgetTemplate> {
  const template = await getUserBudgetTemplateById(templateId, userId);
  if (!template) {
    throw new Error("No se encontro la plantilla");
  }

  return prisma.$transaction(async (tx) => {
    const applyTx = tx as unknown as BudgetTemplateApplyTx;
    const project = await applyTx.project.findFirst({
      where: { id: input.projectId, company: { userId } },
      select: { id: true, companyId: true },
    });

    if (!project) {
      throw new Error("No puedes aplicar plantillas en un proyecto que no te pertenece");
    }

    const parentBudget = template.snapshot.budget.kind === "SUB_BUDGET"
      ? await applyTx.budget.findFirst({
          where: { projectId: project.id, kind: "GENERAL" },
          select: { id: true },
        })
      : null;
    const budgetName = input.name?.trim() || template.snapshot.name;
    const createdBudget = await applyTx.budget.create({
      data: {
        projectId: project.id,
        parentBudgetId: parentBudget?.id ?? null,
        kind: template.snapshot.budget.kind,
        name: budgetName,
        currency: template.snapshot.budget.currency,
        igvRate: template.snapshot.budget.igvRate,
        generalExpensesRate: template.snapshot.budget.generalExpensesRate,
        utilityRate: template.snapshot.budget.utilityRate,
        totalDirectCost: template.snapshot.budget.totalDirectCost,
        totalGeneralExpenses: template.snapshot.budget.totalGeneralExpenses,
        totalUtility: template.snapshot.budget.totalUtility,
        totalTax: template.snapshot.budget.totalTax,
        totalAmount: template.snapshot.budget.totalAmount,
      },
      select: { id: true },
    });

    const levelIds = new Map<string, string>();
    for (const level of template.snapshot.levels) {
      const createdLevel = await applyTx.budgetLevel.create({
        data: {
          budgetId: createdBudget.id,
          parentId: level.parentKey ? levelIds.get(level.parentKey) ?? null : null,
          type: level.type,
          code: level.code,
          name: level.name,
          sortOrder: level.sortOrder,
        },
        select: { id: true },
      });
      levelIds.set(level.templateKey, createdLevel.id);
    }

    for (const item of template.snapshot.items) {
      const createdItem = await applyTx.budgetItem.create({
        data: {
          budgetId: createdBudget.id,
          levelId: item.levelKey ? levelIds.get(item.levelKey) ?? null : null,
          code: item.code,
          description: item.description,
          unit: item.unit,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          partial: item.partial,
          sortOrder: item.sortOrder,
        },
        select: { id: true },
      });

      if (item.apu) {
        const createdApu = await applyTx.apu.create({
          data: {
            budgetItemId: createdItem.id,
            name: item.apu.name,
            unit: item.apu.unit,
            performance: item.apu.performance,
            totalUnitCost: item.apu.totalUnitCost,
          },
          select: { id: true },
        });

        for (const resource of item.apu.resources) {
          await createApuResourceFromTemplate(applyTx, project.companyId, createdApu.id, resource);
        }
      }
    }

    return {
      id: createdBudget.id,
      projectId: project.id,
      name: budgetName,
      templateName: template.name,
    };
  });
}

function serializeBudgetTemplateRow(row: BudgetTemplateRow): UserBudgetTemplateRecord {
  const snapshot = parseBudgetTemplateSnapshot(row.payload);

  return {
    id: row.id,
    userId: row.userId,
    sourceProjectId: row.sourceProjectId,
    sourceBudgetId: row.sourceBudgetId,
    name: row.name,
    description: row.description,
    snapshot,
    libraryItem: buildBudgetSnapshotTemplateLibraryItem(snapshot, row.id, {
      createdAt: ensureDate(row.createdAt).toISOString(),
      updatedAt: ensureDate(row.updatedAt).toISOString(),
    }),
    createdAt: ensureDate(row.createdAt).toISOString(),
    updatedAt: ensureDate(row.updatedAt).toISOString(),
  };
}

function parseBudgetTemplateSnapshot(payload: Prisma.JsonValue): BudgetTemplateSnapshot {
  const value: unknown = payload;
  if (!isRecord(value) || value.schemaVersion !== 1) {
    throw new Error("La plantilla guardada no tiene un formato valido");
  }

  return value as BudgetTemplateSnapshot;
}

function toInputJson(snapshot: BudgetTemplateSnapshot): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(snapshot)) as Prisma.InputJsonValue;
}

function getBudgetTemplateDelegate() {
  const client = prisma as typeof prisma & { budgetTemplate: BudgetTemplateDelegate };
  return client.budgetTemplate;
}

async function createApuResourceFromTemplate(
  tx: BudgetTemplateApplyTx,
  companyId: string,
  apuId: string,
  resource: BudgetTemplateApuResource,
) {
  if (!resource.resource) {
    return;
  }

  const resourceId = await getOrCreateTemplateResource(tx, companyId, resource.resource);
  await tx.apuResource.create({
    data: {
      apuId,
      resourceId,
      resourceType: resource.resourceType,
      crew: resource.crew,
      quantity: resource.quantity,
      unitPrice: resource.unitPrice,
      subtotal: resource.subtotal,
    },
  });
}

async function getOrCreateTemplateResource(
  tx: BudgetTemplateApplyTx,
  companyId: string,
  resource: BudgetTemplateResource,
) {
  const existing = await tx.resource.findFirst({
    where: {
      companyId,
      code: resource.code,
      unit: resource.unit,
      category: resource.category,
    },
    select: { id: true },
  });

  if (existing) {
    return existing.id;
  }

  const created = await tx.resource.create({
    data: {
      companyId,
      code: resource.code,
      description: resource.description,
      category: resource.category,
      iu: resource.iu ?? null,
      iuCurrent: resource.iuCurrent ?? null,
      subcategory: resource.subcategory ?? null,
      unit: resource.unit,
      unitPrice: resource.unitPrice,
      currency: resource.currency,
      source: resource.source ?? "Plantilla de presupuesto",
    },
    select: { id: true },
  });

  return created.id;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
