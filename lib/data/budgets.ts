import { cache } from "react";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import Decimal from "decimal.js";
import { decimalToNumber, serializeBudget, serializeCatalogPartida } from "@/lib/db/serializers";
import { ensureDate } from "@/lib/utils";
import { budgetSchema, budgetStatePatchSchema, type BudgetInput } from "@/lib/validations/budget";
import { aggregateGeneralBudgetResources } from "@/lib/calculations/general-budget-sections";
import { calculateBudgetFooterBuilder } from "@/lib/calculations/budget-footer-builder";
import { calculateGeneralExpenseStructure } from "@/lib/calculations/general-expense-structure";
import { ensureBudgetFooterTemplate } from "@/lib/budget-footer/template-seed";
import {
  getNextGeneralExpenseItemCode,
  getNextGeneralExpenseTitleCode,
} from "@/lib/general-expenses/code-generation";
import { ensureBudgetGeneralExpensesTemplate } from "@/lib/general-expenses/template-seed";
import {
  generalExpenseItemSchema,
  generalExpenseStructureSaveSchema,
  generalExpenseTitleSchema,
  type GeneralExpenseItemInput,
  type GeneralExpenseStructureSaveInput,
  type GeneralExpenseTitleInput,
} from "@/lib/validations/general-expense";
import {
  budgetFooterStructureSaveSchema,
  type BudgetFooterStructureSaveInput,
} from "@/lib/validations/budget-footer";
import type { BudgetRecord, BudgetStatePatch } from "@/types/budget";
import type { ApuRecord } from "@/types/apu";
import type { PartidaApuRowRecord } from "@/types/partida";
import type { BudgetFooterStructure, GeneralBudgetResourceSummaryResult, GeneralExpenseStructure } from "@/types/budget-sections";
import { calculateBudgetRecord, synchronizeApuResourcePrice } from "@/lib/calculations/budget";
import { isSubpartidaResourceType } from "@/lib/apu/subpartidas";
import { Prisma } from "@prisma/client";
import type { BudgetLiveUpdateSummary } from "@/lib/client/live-updates";
import { assertWithinPlanLimit } from "@/lib/billing/entitlements";
import { requireProjectCapability } from "@/lib/workspace/project-access";
import { getUserSettings } from "@/lib/data/settings";
import { measureAsync } from "@/lib/platform/performance";

export const BUDGETS_LIST_CACHE_TAG = "budgets-list";
export const BUDGET_DETAIL_CACHE_TAG = "budget-detail";
export function getBudgetDetailCacheTag(budgetId: string) {
  return `${BUDGET_DETAIL_CACHE_TAG}:${budgetId}`;
}

const shouldBypassPersistentCache = process.env.NODE_ENV !== "production" || process.env.VITEST === "true";

type BudgetListEntry = Prisma.BudgetGetPayload<{ include: { project: true } }>;

function normalizeBudgetListEntry<T extends BudgetListEntry>(budget: T): T {
  return {
    ...budget,
    createdAt: ensureDate(budget.createdAt),
    updatedAt: ensureDate(budget.updatedAt),
    project: {
      ...budget.project,
      createdAt: ensureDate(budget.project.createdAt),
      updatedAt: ensureDate(budget.project.updatedAt),
    },
  };
}

const _getBudgetsByUser = async (userId: string, activeCompanyId?: string | null) => {
  const budgets = await prisma.budget.findMany({
    where: {
      kind: "GENERAL",
      project: {
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
    },
    include: {
      project: true,
    },
    orderBy: {
      updatedAt: "desc",
    },
  });

  return budgets.map(normalizeBudgetListEntry);
};

export const getBudgetsByUser = cache(
  async (userId: string, activeCompanyId?: string | null) => {
    if (shouldBypassPersistentCache) {
      return _getBudgetsByUser(userId, activeCompanyId);
    }

    return unstable_cache(
      async (uid: string) => _getBudgetsByUser(uid, activeCompanyId),
      activeCompanyId
        ? [BUDGETS_LIST_CACHE_TAG, userId, activeCompanyId]
        : [BUDGETS_LIST_CACHE_TAG, userId],
      { tags: [BUDGETS_LIST_CACHE_TAG] },
    )(userId);
  },
);

export async function getProjectSubBudgetSummaries(projectId: string, userId: string) {
  return measureAsync("data.budgets.subBudgetSummaries", () => prisma.budget.findMany({
    where: {
      projectId,
      kind: "SUB_BUDGET",
      project: {
        company: {
          memberships: {
            some: {
              userId,
              status: "ACTIVE",
            },
          },
        },
      },
    },
    select: {
      id: true,
      projectId: true,
      parentBudgetId: true,
      name: true,
      currency: true,
      totalDirectCost: true,
      totalGeneralExpenses: true,
      totalUtility: true,
      totalTax: true,
      totalAmount: true,
      updatedAt: true,
      _count: {
        select: {
          levels: true,
          items: true,
        },
      },
    },
    orderBy: {
      createdAt: "asc",
    },
  }), { projectId });
}

export async function getProjectSubBudgetDetails(projectId: string, userId: string) {
  const budgets = await measureAsync("data.budgets.subBudgetDetails.query", () => prisma.budget.findMany({
    where: {
      projectId,
      kind: "SUB_BUDGET",
      project: {
        company: {
          memberships: {
            some: {
              userId,
              status: "ACTIVE",
            },
          },
        },
      },
    },
    include: {
      levels: {
        orderBy: { sortOrder: "asc" },
      },
      items: {
        orderBy: { sortOrder: "asc" },
        include: {
          apu: {
            include: {
              resources: {
                include: {
                  resource: true,
                  catalogPartida: {
                    include: {
                      apuRows: {
                        orderBy: { sortOrder: "asc" },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    orderBy: {
      createdAt: "asc",
    },
  }), { projectId });

  return measureAsync(
    "data.budgets.subBudgetDetails.serialize",
    () => Promise.all(budgets.map((budget) => enrichBudgetSubpartidaCatalogLinks(serializeBudget(budget)))),
    { projectId, budgets: budgets.length },
  );
}

const _getBudgetById = async (id: string, userId: string) => {
  const budget = await measureAsync("data.budgets.detail.query", () => prisma.budget.findFirst({
    where: {
      id,
      project: {
        company: {
          memberships: {
            some: {
              userId,
              status: "ACTIVE",
            },
          },
        },
      },
    },
    include: {
      project: true,
      levels: {
        orderBy: { sortOrder: "asc" },
      },
      items: {
        orderBy: { sortOrder: "asc" },
        include: {
          apu: {
            include: {
              resources: {
                include: {
                  resource: true,
                  catalogPartida: {
                    include: {
                      apuRows: {
                        orderBy: { sortOrder: "asc" },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  }), { budgetId: id });

  if (!budget) return null;

  return measureAsync(
    "data.budgets.detail.serialize",
    async () => ({
      ...(await enrichBudgetSubpartidaCatalogLinks(serializeBudget(budget))),
      project: budget.project,
    }),
    { budgetId: id, items: budget.items.length, levels: budget.levels.length },
  );
}

export const getBudgetById = cache(
  async (id: string, userId: string) => {
    if (shouldBypassPersistentCache) {
      return _getBudgetById(id, userId);
    }

    return unstable_cache(
      async (budgetId: string, uid: string) => _getBudgetById(budgetId, uid),
      [BUDGET_DETAIL_CACHE_TAG, id, userId],
      { tags: [BUDGET_DETAIL_CACHE_TAG, getBudgetDetailCacheTag(id)] },
    )(id, userId);
  },
);

export async function getBudgetHeaderById(id: string, userId: string) {
  return prisma.budget.findFirst({
    where: {
      id,
      project: {
        company: {
          memberships: {
            some: {
              userId,
              status: "ACTIVE",
            },
          },
        },
      },
    },
    select: {
      id: true,
      projectId: true,
      parentBudgetId: true,
      kind: true,
      name: true,
      currency: true,
      igvRate: true,
      generalExpensesRate: true,
      utilityRate: true,
      totalDirectCost: true,
      totalGeneralExpenses: true,
      totalUtility: true,
      totalTax: true,
      totalAmount: true,
    },
  });
}

export async function getBudgetCatalogScopeById(id: string, userId: string) {
  return measureAsync("data.budgets.catalogScope", () => prisma.budget.findFirst({
    where: {
      id,
      project: {
        company: {
          memberships: {
            some: {
              userId,
              status: "ACTIVE",
            },
          },
        },
      },
    },
    select: {
      id: true,
      projectId: true,
      project: {
        select: {
          companyId: true,
        },
      },
    },
  }), { budgetId: id });
}

export async function getGeneralBudgetResourceSummary(budgetId: string, userId: string): Promise<GeneralBudgetResourceSummaryResult> {
  const budget = await getAccessibleGeneralBudget(budgetId, userId);

  const subBudgets = await prisma.budget.findMany({
    where: {
      projectId: budget.projectId,
      kind: "SUB_BUDGET",
    },
    select: {
      name: true,
      items: {
        orderBy: { sortOrder: "asc" },
        select: {
          apu: {
            select: {
              resources: {
                select: {
                  resourceId: true,
                  quantity: true,
                  subtotal: true,
                  unitPrice: true,
                  resource: {
                    select: {
                      id: true,
                      code: true,
                      description: true,
                      unit: true,
                      category: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  return aggregateGeneralBudgetResources(
    subBudgets.map((subBudget) => ({
      name: subBudget.name,
      items: subBudget.items.map((item) => ({
        apu: item.apu
          ? {
              resources: item.apu.resources.flatMap((resource) =>
                resource.resource
                  ? [
                      {
                        resourceId: resource.resourceId ?? resource.resource.id,
                        quantity: decimalToNumber(resource.quantity),
                        subtotal: decimalToNumber(resource.subtotal),
                        unitPrice: decimalToNumber(resource.unitPrice),
                        resource: resource.resource,
                      },
                    ]
                  : [],
              ),
            }
          : null,
      })),
    })),
  );
}

export async function getBudgetGeneralExpenses(budgetId: string, userId: string): Promise<GeneralExpenseStructure> {
  const budget = await getAccessibleGeneralBudget(budgetId, userId);

  const groups = await loadBudgetGeneralExpenseGroups(budgetId);
  const expenses = calculateGeneralExpenseStructure({
    totalDirectCost: decimalToNumber(budget.totalDirectCost),
    groups,
  });

  if (groups.length > 0) {
    await prisma.$transaction(async (tx) => {
      await syncGeneralExpensesRateFromStructure(tx, budget.id, expenses.total);
    });
  }

  return expenses;
}

export async function initializeBudgetGeneralExpenses(budgetId: string, userId: string): Promise<GeneralExpenseStructure> {
  await getAccessibleGeneralBudget(budgetId, userId);

  await prisma.$transaction(async (tx) => {
    await ensureBudgetGeneralExpensesTemplate(tx, budgetId);
  });

  return getBudgetGeneralExpenses(budgetId, userId);
}

export async function getBudgetFooterStructure(
  budgetId: string,
  userId: string,
  currencyDecimals = 2,
): Promise<BudgetFooterStructure> {
  const budget = await getAccessibleGeneralBudget(budgetId, userId);
  const expenses = await getBudgetGeneralExpenses(budgetId, userId);
  const footerGeneralExpensesTotal =
    expenses.groups.length > 0 ? expenses.total : decimalToNumber(budget.totalGeneralExpenses);

  await prisma.$transaction(async (tx) => {
    await cleanupBudgetFooterHeaderArtifacts(tx, budgetId);
    await ensureBudgetFooterTemplate(tx, budgetId, {
      totalDirectCost: decimalToNumber(budget.totalDirectCost),
      totalGeneralExpenses: footerGeneralExpensesTotal,
    });
  });

  const rows = await loadBudgetFooterRows(budgetId);
  return calculateBudgetFooterBuilder({
    rows,
    totalDirectCost: decimalToNumber(budget.totalDirectCost),
    totalGeneralExpenses: footerGeneralExpensesTotal,
    totalUtility: decimalToNumber(budget.totalUtility),
    subtotal: decimalToNumber(budget.totalDirectCost) + footerGeneralExpensesTotal + decimalToNumber(budget.totalUtility),
    totalTax: decimalToNumber(budget.totalTax),
    totalAmount: decimalToNumber(budget.totalAmount),
    currencyDecimals,
  });
}

export async function saveBudgetFooterStructure(
  budgetId: string,
  userId: string,
  input: BudgetFooterStructureSaveInput,
  currencyDecimals = 2,
): Promise<BudgetFooterStructure> {
  await getAccessibleGeneralBudget(budgetId, userId);
  await requireBudgetMutationCapability({ budgetId, userId, capability: "budgets.update", minimumProjectRole: "EDITOR" });
  const parsed = budgetFooterStructureSaveSchema.parse(input);

  await prisma.$transaction(async (tx) => {
    const existingRows = await tx.budgetFooterRow.findMany({
      where: {
        budgetId,
        budget: {
          project: {
            company: {
              memberships: {
                some: {
                  userId,
                  status: "ACTIVE",
                },
              },
            },
          },
        },
      },
      select: { id: true },
    });

    const existingIds = new Set(existingRows.map((row) => row.id));
    const nextIds = new Set(parsed.rows.map((row) => row.id));
    const idsToDelete = existingRows.map((row) => row.id).filter((id) => !nextIds.has(id));

    for (const row of parsed.rows) {
      if (existingIds.has(row.id)) {
        await tx.budgetFooterRow.update({
          where: { id: row.id },
          data: {
            variable: row.variable.trim().toUpperCase(),
            description: row.description.trim(),
            formula: row.formula?.trim() || null,
            manualValue: row.manualValue,
            iu: row.iu?.trim() || null,
            highlight: row.highlight,
            sortOrder: row.sortOrder,
          },
        });
      } else {
        await tx.budgetFooterRow.create({
          data: {
            id: row.id,
            budgetId,
            variable: row.variable.trim().toUpperCase(),
            description: row.description.trim(),
            formula: row.formula?.trim() || null,
            manualValue: row.manualValue,
            iu: row.iu?.trim() || null,
            highlight: row.highlight,
            sortOrder: row.sortOrder,
          },
        });
      }
    }

    if (idsToDelete.length > 0) {
      await tx.budgetFooterRow.deleteMany({
        where: { id: { in: idsToDelete } },
      });
    }
  });

  return getBudgetFooterStructure(budgetId, userId, currencyDecimals);
}

export async function saveBudgetGeneralExpensesStructure(
  budgetId: string,
  userId: string,
  input: GeneralExpenseStructureSaveInput,
): Promise<GeneralExpenseStructure> {
  const budget = await getAccessibleGeneralBudget(budgetId, userId);
  await requireBudgetMutationCapability({ budgetId, userId, capability: "budgets.update", minimumProjectRole: "EDITOR" });
  const parsed = generalExpenseStructureSaveSchema.parse(input);
  const currentDirectCost = decimalToNumber(budget.totalDirectCost);

  await prisma.$transaction(async (tx) => {
    for (const group of parsed.groups) {
      const existingGroup = await tx.generalExpenseGroup.findFirst({
        where: {
          id: group.id,
          budgetId,
          budget: {
            project: {
              company: {
                memberships: {
                  some: {
                    userId,
                    status: "ACTIVE",
                  },
                },
              },
            },
          },
        },
        select: { id: true },
      });

      if (!existingGroup) {
        throw new Error("No tienes permisos para editar este grupo de gastos generales");
      }

      await tx.generalExpenseGroup.update({
        where: { id: group.id },
        data: {
          sortOrder: group.sortOrder,
        },
      });

      for (const title of group.titles) {
        const existingTitle = await tx.generalExpenseTitle.findFirst({
          where: {
            id: title.id,
            groupId: group.id,
          },
          select: { id: true },
        });

        if (!existingTitle) {
          throw new Error("No tienes permisos para editar este titulo");
        }

        await tx.generalExpenseTitle.update({
          where: { id: title.id },
          data: {
            code: title.code.trim(),
            name: title.name.trim(),
            category: title.category,
            sortOrder: title.sortOrder,
            items: {
              updateMany: {
                where: {},
                data: {
                  category: title.category,
                },
              },
            },
          },
        });

        for (const item of title.items) {
          const existingItem = await tx.generalExpenseItem.findFirst({
            where: {
              id: item.id,
              titleId: title.id,
            },
            select: { id: true },
          });

          if (!existingItem) {
            throw new Error("No tienes permisos para editar este item");
          }

          await tx.generalExpenseItem.update({
            where: { id: item.id },
            data: {
              code: item.code.trim(),
              description: item.description.trim(),
              category: title.category,
              unit: item.unit.trim(),
              quantityDescription: item.quantityDescription?.trim() || null,
              quantity: item.quantity,
              participationPercentage: item.participationPercentage,
              unitPrice: title.category === "DIRECT_COST_BASED" ? currentDirectCost : item.unitPrice,
              sortOrder: item.sortOrder,
            },
          });
        }
      }
    }
  });

  return getBudgetGeneralExpenses(budgetId, userId);
}

export async function createBudgetGeneralExpenseTitle(
  budgetId: string,
  groupId: string,
  userId: string,
  input: GeneralExpenseTitleInput,
): Promise<GeneralExpenseStructure> {
  await getAccessibleGeneralBudget(budgetId, userId);
  await requireBudgetMutationCapability({ budgetId, userId, capability: "budgets.update", minimumProjectRole: "EDITOR" });
  const parsed = generalExpenseTitleSchema.parse(input);

  const group = await prisma.generalExpenseGroup.findFirst({
    where: {
      id: groupId,
      budgetId,
      budget: {
        project: {
          company: {
            memberships: {
              some: {
                userId,
                status: "ACTIVE",
              },
            },
          },
        },
      },
    },
    include: {
      titles: {
        orderBy: { sortOrder: "desc" },
        take: 1,
      },
    },
  });

  if (!group) {
    throw new Error("No tienes permisos para editar este grupo de gastos generales");
  }

  await prisma.generalExpenseTitle.create({
    data: {
      groupId: group.id,
      code:
        parsed.code?.trim() ||
        getNextGeneralExpenseTitleCode(
          group.kind === "FIXED" ? "1" : "2",
          group.titles.map((title) => title.code),
        ),
      name: parsed.name.trim(),
      category: parsed.category,
      sortOrder: (group.titles[0]?.sortOrder ?? -1) + 1,
    },
  });

  return getBudgetGeneralExpenses(budgetId, userId);
}

export async function updateBudgetGeneralExpenseTitle(
  budgetId: string,
  titleId: string,
  userId: string,
  input: GeneralExpenseTitleInput,
): Promise<GeneralExpenseStructure> {
  await getAccessibleGeneralBudget(budgetId, userId);
  await requireBudgetMutationCapability({ budgetId, userId, capability: "budgets.update", minimumProjectRole: "EDITOR" });
  const parsed = generalExpenseTitleSchema.parse(input);

  const existing = await prisma.generalExpenseTitle.findFirst({
    where: {
      id: titleId,
      group: {
        budgetId,
        budget: {
          project: {
            company: {
              memberships: {
                some: {
                  userId,
                  status: "ACTIVE",
                },
              },
            },
          },
        },
      },
    },
    select: { id: true },
  });

  if (!existing) {
    throw new Error("No tienes permisos para editar este titulo");
  }

  await prisma.generalExpenseTitle.update({
    where: { id: titleId },
    data: {
      code: parsed.code?.trim() || undefined,
      name: parsed.name.trim(),
      category: parsed.category,
      items: {
        updateMany: {
          where: {},
          data: {
            category: parsed.category,
          },
        },
      },
    },
  });

  return getBudgetGeneralExpenses(budgetId, userId);
}

export async function deleteBudgetGeneralExpenseTitle(
  budgetId: string,
  titleId: string,
  userId: string,
): Promise<GeneralExpenseStructure> {
  await getAccessibleGeneralBudget(budgetId, userId);
  await requireBudgetMutationCapability({ budgetId, userId, capability: "budgets.update", minimumProjectRole: "EDITOR" });

  const existing = await prisma.generalExpenseTitle.findFirst({
    where: {
      id: titleId,
      group: {
        budgetId,
        budget: {
          project: {
            company: {
              memberships: {
                some: {
                  userId,
                  status: "ACTIVE",
                },
              },
            },
          },
        },
      },
    },
    select: { id: true },
  });

  if (!existing) {
    throw new Error("No tienes permisos para eliminar este titulo");
  }

  await prisma.generalExpenseTitle.delete({
    where: { id: titleId },
  });

  return getBudgetGeneralExpenses(budgetId, userId);
}

export async function createBudgetGeneralExpenseItem(
  budgetId: string,
  titleId: string,
  userId: string,
  input: GeneralExpenseItemInput,
): Promise<GeneralExpenseStructure> {
  const budget = await getAccessibleGeneralBudget(budgetId, userId);
  await requireBudgetMutationCapability({ budgetId, userId, capability: "budgets.update", minimumProjectRole: "EDITOR" });
  const parsed = generalExpenseItemSchema.parse(input);
  const currentDirectCost = decimalToNumber(budget.totalDirectCost);

  const title = await prisma.generalExpenseTitle.findFirst({
    where: {
      id: titleId,
      group: {
        budgetId,
        budget: {
          project: {
            company: {
              memberships: {
                some: {
                  userId,
                  status: "ACTIVE",
                },
              },
            },
          },
        },
      },
    },
    include: {
      items: {
        orderBy: { sortOrder: "desc" },
        take: 1,
      },
    },
  });

  if (!title) {
    throw new Error("No tienes permisos para editar este titulo");
  }

  await prisma.generalExpenseItem.create({
    data: {
      titleId,
      code: parsed.code?.trim() || getNextGeneralExpenseItemCode(title.code, title.items.map((item) => item.code)),
      description: parsed.description.trim(),
      category: title.category,
      unit: parsed.unit.trim(),
      quantityDescription: parsed.quantityDescription?.trim() || null,
      quantity: parsed.quantity,
      participationPercentage: parsed.participationPercentage,
      unitPrice: title.category === "DIRECT_COST_BASED" ? currentDirectCost : parsed.unitPrice,
      sortOrder: (title.items[0]?.sortOrder ?? -1) + 1,
    },
  });

  return getBudgetGeneralExpenses(budgetId, userId);
}

export async function updateBudgetGeneralExpenseItem(
  budgetId: string,
  itemId: string,
  userId: string,
  input: GeneralExpenseItemInput,
): Promise<GeneralExpenseStructure> {
  const budget = await getAccessibleGeneralBudget(budgetId, userId);
  await requireBudgetMutationCapability({ budgetId, userId, capability: "budgets.update", minimumProjectRole: "EDITOR" });
  const parsed = generalExpenseItemSchema.parse(input);
  const currentDirectCost = decimalToNumber(budget.totalDirectCost);

  const existing = await prisma.generalExpenseItem.findFirst({
    where: {
      id: itemId,
      title: {
        group: {
          budgetId,
          budget: {
            project: {
              company: {
                memberships: {
                  some: {
                    userId,
                    status: "ACTIVE",
                  },
                },
              },
            },
          },
        },
      },
    },
    select: { id: true, title: { select: { category: true } } },
  });

  if (!existing) {
    throw new Error("No tienes permisos para editar este item");
  }

  await prisma.generalExpenseItem.update({
    where: { id: itemId },
    data: {
      code: parsed.code?.trim() || undefined,
      description: parsed.description.trim(),
      unit: parsed.unit.trim(),
      quantityDescription: parsed.quantityDescription?.trim() || null,
      quantity: parsed.quantity,
      participationPercentage: parsed.participationPercentage,
      unitPrice: existing.title.category === "DIRECT_COST_BASED" ? currentDirectCost : parsed.unitPrice,
    },
  });

  return getBudgetGeneralExpenses(budgetId, userId);
}

export async function deleteBudgetGeneralExpenseItem(
  budgetId: string,
  itemId: string,
  userId: string,
): Promise<GeneralExpenseStructure> {
  await getAccessibleGeneralBudget(budgetId, userId);
  await requireBudgetMutationCapability({ budgetId, userId, capability: "budgets.update", minimumProjectRole: "EDITOR" });

  const existing = await prisma.generalExpenseItem.findFirst({
    where: {
      id: itemId,
      title: {
        group: {
          budgetId,
          budget: {
            project: {
              company: {
                memberships: {
                  some: {
                    userId,
                    status: "ACTIVE",
                  },
                },
              },
            },
          },
        },
      },
    },
    select: { id: true },
  });

  if (!existing) {
    throw new Error("No tienes permisos para eliminar este item");
  }

  await prisma.generalExpenseItem.delete({
    where: { id: itemId },
  });

  return getBudgetGeneralExpenses(budgetId, userId);
}

export async function getBudgetLiveUpdateSummaries(id: string, userId: string): Promise<BudgetLiveUpdateSummary[]> {
  const budget = await prisma.budget.findFirst({
    where: {
      id,
      project: {
        company: {
          memberships: {
            some: {
              userId,
              status: "ACTIVE",
            },
          },
        },
      },
    },
    select: {
      id: true,
      projectId: true,
      parentBudgetId: true,
    },
  });

  if (!budget) return [];

  const ids = [budget.id, budget.parentBudgetId].filter((value): value is string => Boolean(value));
  const budgets = await prisma.budget.findMany({
    where: {
      id: { in: ids },
      project: {
        company: {
          memberships: {
            some: {
              userId,
              status: "ACTIVE",
            },
          },
        },
      },
    },
    select: {
      id: true,
      projectId: true,
      parentBudgetId: true,
      name: true,
      kind: true,
      currency: true,
      totalAmount: true,
      updatedAt: true,
    },
  });

  return budgets.map((item) => ({
    id: item.id,
    projectId: item.projectId,
    parentBudgetId: item.parentBudgetId ?? undefined,
    name: item.name,
    kind: item.kind,
    currency: item.currency,
    totalAmount: Number(item.totalAmount),
    updatedAt: ensureDate(item.updatedAt).toISOString(),
  }));
}

export async function createBudget(userId: string, input: BudgetInput): Promise<Awaited<ReturnType<typeof prisma.budget.create>>>;
export async function createBudget(input: BudgetInput): Promise<Awaited<ReturnType<typeof prisma.budget.create>>>;
export async function createBudget(userIdOrInput: string | BudgetInput, input?: BudgetInput) {
  const userId = typeof userIdOrInput === "string" ? userIdOrInput : null;
  const rawInput = typeof userIdOrInput === "string" ? input : userIdOrInput;

  if (!rawInput) {
    throw new Error("No se recibieron datos para crear el presupuesto");
  }

  const data = budgetSchema.parse(await applyBudgetSettingsDefaults(rawInput, userId));

  if (userId) {
    await assertWithinPlanLimit({ userId, resource: "budgets" });

    const project = await prisma.project.findFirst({
      where: {
        id: data.projectId,
        company: {
          memberships: {
            some: {
              userId,
              status: "ACTIVE",
            },
          },
        },
      },
      select: { id: true, companyId: true },
    });

    if (!project) {
      throw new Error("No puedes crear presupuestos en un proyecto que no te pertenece");
    }

    await requireProjectCapability({ userId, companyId: project.companyId, projectId: project.id, capability: "budgets.create", minimumProjectRole: "EDITOR" });
  }

  if (data.parentBudgetId) {
    const parentBudget = await prisma.budget.findFirst({
      where: {
        id: data.parentBudgetId,
        projectId: data.projectId,
      },
      select: { id: true },
    });

    if (!parentBudget) {
      throw new Error("El presupuesto padre no pertenece al proyecto seleccionado");
    }
  }

  return prisma.budget.create({
    data: {
      ...data,
      parentBudgetId: data.parentBudgetId ?? null,
      totalDirectCost: 0,
      totalGeneralExpenses: 0,
      totalUtility: 0,
      totalTax: 0,
      totalAmount: 0,
    },
  });
}

export async function deleteBudget(id: string, userId: string) {
  const budget = await prisma.budget.findFirst({
    where: {
      id,
      project: {
        company: {
          memberships: {
            some: {
              userId,
              status: "ACTIVE",
            },
          },
        },
      },
    },
    select: { id: true, parentBudgetId: true, projectId: true, project: { select: { companyId: true } } },
  });

  if (!budget) {
    throw new Error("No tienes permisos para eliminar este presupuesto");
  }

  await requireProjectCapability({ userId, companyId: budget.project.companyId, projectId: budget.projectId, capability: "budgets.delete", minimumProjectRole: "EDITOR" });

  await prisma.$transaction(async (tx) => {
    await tx.budget.delete({
      where: { id },
    });

    if (budget.parentBudgetId) {
      await refreshGeneralBudgetTotals(tx, budget.parentBudgetId);
    }
  });
}

async function applyBudgetSettingsDefaults(input: BudgetInput, userId: string | null) {
  if (!userId) {
    return input;
  }

  const inputRecord = input as Record<string, unknown>;
  const needsRateDefaults =
    inputRecord.igvRate === undefined ||
    inputRecord.generalExpensesRate === undefined ||
    inputRecord.utilityRate === undefined;
  const needsCurrencyDefault = inputRecord.currency === undefined;

  if (!needsRateDefaults && !needsCurrencyDefault) {
    return input;
  }

  const settings = await getUserSettings(userId);

  return {
    ...inputRecord,
    currency: inputRecord.currency ?? settings.defaultCurrency,
    igvRate: inputRecord.igvRate ?? settings.defaultIgvRate,
    generalExpensesRate: inputRecord.generalExpensesRate ?? settings.defaultGeneralExpensesRate,
    utilityRate: inputRecord.utilityRate ?? settings.defaultUtilityRate,
  };
}

export async function saveBudgetState(id: string, userId: string, budget: BudgetRecord) {
  const normalized = calculateBudgetRecord(budget);
  await requireBudgetMutationCapability({ budgetId: id, userId, capability: "budgets.update", minimumProjectRole: "EDITOR" });

  return prisma.$transaction(async (tx) => {
    const existingBudget = await tx.budget.findFirst({
      where: {
        id,
        project: {
          company: {
            memberships: {
              some: {
                userId,
                status: "ACTIVE",
              },
            },
          },
        },
      },
      include: {
        parentBudget: {
          select: { id: true },
        },
        levels: {
          select: { id: true, parentId: true },
        },
        items: {
          select: {
            id: true,
            apu: {
              select: {
                id: true,
                resources: {
                  select: { id: true, resourceId: true, unitPrice: true },
                },
              },
            },
          },
        },
      },
    });

    if (!existingBudget) {
      throw new Error("No tienes permisos para modificar este presupuesto");
    }

    await tx.budget.update({
      where: { id: existingBudget.id },
      data: {
        name: normalized.name,
        currency: normalized.currency,
        igvRate: normalized.igvRate,
        generalExpensesRate: normalized.generalExpensesRate,
        utilityRate: normalized.utilityRate,
        totalDirectCost: normalized.totalDirectCost,
        totalGeneralExpenses: normalized.totalGeneralExpenses,
        totalUtility: normalized.totalUtility,
        totalTax: normalized.totalTax,
        totalAmount: normalized.totalAmount,
      },
    });

    const linkedResourcePrices = new Map<string, number>();
    const existingLevelIds = new Set(existingBudget.levels.map((level) => level.id));
    const desiredLevelIds = new Set(normalized.levels.map((level) => level.id));
    const levelIdsToDelete = existingBudget.levels
      .map((level) => level.id)
      .filter((levelId) => !desiredLevelIds.has(levelId));

    const levelsByDepth = [...normalized.levels].sort(
      (left, right) => getLevelDepth(normalized.levels, left.id) - getLevelDepth(normalized.levels, right.id),
    );

    for (const level of levelsByDepth) {
      const levelData = {
        budgetId: existingBudget.id,
        parentId: level.parentId ?? null,
        type: level.type,
        code: level.code,
        name: level.name,
        sortOrder: level.sortOrder,
      };

      if (existingLevelIds.has(level.id)) {
        await tx.budgetLevel.update({
          where: { id: level.id },
          data: levelData,
        });
      } else {
        await tx.budgetLevel.create({
          data: {
            id: level.id,
            ...levelData,
          },
        });
      }
    }

    const existingItemsById = new Map(existingBudget.items.map((item) => [item.id, item]));
    const desiredItemIds = new Set(normalized.items.map((item) => item.id));
    const itemIdsToDelete = existingBudget.items.map((item) => item.id).filter((itemId) => !desiredItemIds.has(itemId));

    for (const item of normalized.items) {
      const itemData = {
        budgetId: existingBudget.id,
        levelId: item.levelId ?? null,
        code: item.code,
        description: item.description,
        unit: item.unit,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        partial: item.partial,
        sortOrder: item.sortOrder,
      };

      if (existingItemsById.has(item.id)) {
        await tx.budgetItem.update({
          where: { id: item.id },
          data: itemData,
        });
      } else {
        await tx.budgetItem.create({
          data: {
            id: item.id,
            ...itemData,
          },
        });
      }

      const existingItem = existingItemsById.get(item.id);

      for (const resource of item.apu?.resources ?? []) {
        if (!resource.resourceId) continue;

        const previousResource = existingItem?.apu?.resources.find((candidate) => candidate.id === resource.id);
        if (previousResource && decimalToNumber(previousResource.unitPrice) !== resource.unitPrice) {
          linkedResourcePrices.set(resource.resourceId, resource.unitPrice);
        }
      }

      if (!item.apu) {
        if (existingItem?.apu) {
          await tx.apu.delete({
            where: { budgetItemId: item.id },
          });
        }
        continue;
      }

      await tx.apu.upsert({
        where: { budgetItemId: item.id },
        update: {
          name: item.apu.name,
          unit: item.apu.unit,
          performance: item.apu.performance,
          totalUnitCost: item.unitPrice,
        },
        create: {
          id: item.apu.id,
          budgetItemId: item.id,
          name: item.apu.name,
          unit: item.apu.unit,
          performance: item.apu.performance,
          totalUnitCost: item.unitPrice,
        },
      });

      const persistedApuId = existingItem?.apu?.id ?? item.apu.id;

      const existingResourceIds = new Set(existingItem?.apu?.resources.map((resource) => resource.id) ?? []);
      const desiredResourceIds = new Set(item.apu.resources.map((resource) => resource.id));
      const resourceIdsToDelete = (existingItem?.apu?.resources ?? [])
        .map((resource) => resource.id)
        .filter((resourceId) => !desiredResourceIds.has(resourceId));

      for (const resource of item.apu.resources) {
        const isSubpartida = isSubpartidaResourceType(resource.resourceType);
        const persistedResourceId = isSubpartida ? null : await resolvePersistableApuResourceId(tx, userId, resource);
        const resourceData = {
          apuId: persistedApuId,
          resourceId: persistedResourceId,
          catalogPartidaId: isSubpartida ? resource.catalogPartidaId ?? null : null,
          resourceType: resource.resourceType,
          crew: resource.crew ?? null,
          quantity: resource.quantity,
          unitPrice: resource.unitPrice,
          subtotal: resource.subtotal,
          nestedApuRows: isSubpartida ? buildNestedApuRowsJson(resource.nestedApuRows) : Prisma.JsonNull,
        };

        if (existingResourceIds.has(resource.id)) {
          await tx.apuResource.update({
            where: { id: resource.id },
            data: resourceData,
          });
        } else {
          await tx.apuResource.create({
            data: {
              id: resource.id,
              ...resourceData,
            },
          });
        }
      }

      if (resourceIdsToDelete.length) {
        await tx.apuResource.deleteMany({
          where: {
            id: { in: resourceIdsToDelete },
          },
        });
      }
    }

    await synchronizeLinkedBudgetResourcePrices(tx, existingBudget.id, linkedResourcePrices);

    if (itemIdsToDelete.length) {
      await tx.budgetItem.deleteMany({
        where: {
          id: { in: itemIdsToDelete },
        },
      });
    }

    if (levelIdsToDelete.length) {
      await tx.budgetLevel.deleteMany({
        where: {
          id: { in: levelIdsToDelete },
        },
      });
    }

    if (existingBudget.parentBudget?.id) {
      await refreshGeneralBudgetTotals(tx, existingBudget.parentBudget.id);
    }

    return normalized;
  });
}

async function synchronizeLinkedBudgetResourcePrices(
  tx: Prisma.TransactionClient,
  budgetId: string,
  linkedResourcePrices: Map<string, number>,
) {
  if (linkedResourcePrices.size === 0) return;

  const apus = await tx.apu.findMany({
    where: {
      budgetItem: { budgetId },
      resources: { some: { resourceId: { in: [...linkedResourcePrices.keys()] } } },
    },
    select: {
      id: true,
      budgetItemId: true,
      name: true,
      unit: true,
      performance: true,
      totalUnitCost: true,
      budgetItem: { select: { quantity: true } },
      resources: {
        select: {
          id: true,
          apuId: true,
          resourceId: true,
          resourceType: true,
          crew: true,
          quantity: true,
          unitPrice: true,
          subtotal: true,
          resource: {
            select: {
              id: true,
              code: true,
              description: true,
              category: true,
              unit: true,
              currency: true,
              unitPrice: true,
            },
          },
        },
      },
    },
  });

  for (const apu of apus) {
    let synchronizedApu: ApuRecord = {
      id: apu.id,
      budgetItemId: apu.budgetItemId,
      name: apu.name,
      unit: apu.unit,
      performance: decimalToNumber(apu.performance),
      totalUnitCost: decimalToNumber(apu.totalUnitCost),
      resources: apu.resources.map((resource) => ({
        ...resource,
        crew: resource.crew === null || resource.crew === undefined ? null : decimalToNumber(resource.crew),
        quantity: decimalToNumber(resource.quantity),
        unitPrice: decimalToNumber(resource.unitPrice),
        subtotal: decimalToNumber(resource.subtotal),
        resource: resource.resource
          ? {
              ...resource.resource,
              unitPrice: decimalToNumber(resource.resource.unitPrice),
            }
          : undefined,
      })),
    };

    for (const [resourceId, unitPrice] of linkedResourcePrices) {
      if (synchronizedApu.resources.some((resource) => resource.resourceId === resourceId)) {
        synchronizedApu = synchronizeApuResourcePrice(synchronizedApu, resourceId, unitPrice);
      }
    }

    for (const resource of synchronizedApu.resources) {
      await tx.apuResource.update({
        where: { id: resource.id },
        data: {
          quantity: resource.quantity,
          unitPrice: resource.unitPrice,
          subtotal: resource.subtotal,
        },
      });
    }

    await tx.apu.update({
      where: { id: apu.id },
      data: { totalUnitCost: synchronizedApu.totalUnitCost },
    });

    const partial = new Decimal(decimalToNumber(apu.budgetItem.quantity)).times(synchronizedApu.totalUnitCost).toDecimalPlaces(4, Decimal.ROUND_HALF_UP).toNumber();
    await tx.budgetItem.update({
      where: { id: apu.budgetItemId },
      data: {
        unitPrice: synchronizedApu.totalUnitCost,
        partial,
      },
    });
  }
}

export async function saveBudgetPatch(id: string, userId: string, patchInput: BudgetStatePatch) {
  const patch = budgetStatePatchSchema.parse(patchInput);
  const existingBudget = await _getBudgetById(id, userId);

  if (!existingBudget) {
    throw new Error("No tienes permisos para modificar este presupuesto");
  }

  const nextBudget = applyBudgetPatch(existingBudget, patch);
  return saveBudgetState(id, userId, nextBudget);
}

function getLevelDepth(levels: BudgetRecord["levels"], levelId: string) {
  let depth = 0;
  let current = levels.find((level) => level.id === levelId);

  while (current?.parentId) {
    depth += 1;
    current = levels.find((level) => level.id === current?.parentId);
  }

  return depth;
}

function applyBudgetPatch(budget: BudgetRecord, patch: BudgetStatePatch) {
  const levelsById = new Map(budget.levels.map((level) => [level.id, level]));
  const itemsById = new Map(budget.items.map((item) => [item.id, item]));

  for (const levelId of patch.levels.delete) {
    levelsById.delete(levelId);
  }

  for (const itemId of patch.items.delete) {
    itemsById.delete(itemId);
  }

  for (const level of patch.levels.create) {
    levelsById.set(level.id, {
      ...level,
      parentId: level.parentId ?? undefined,
    });
  }

  for (const levelPatch of patch.levels.update) {
    const existingLevel = levelsById.get(levelPatch.id);
    if (!existingLevel) continue;

    levelsById.set(levelPatch.id, {
      ...existingLevel,
      ...levelPatch.changes,
      parentId: levelPatch.changes.parentId ?? existingLevel.parentId,
    });
  }

  for (const item of patch.items.create) {
    itemsById.set(item.id, {
      ...item,
      levelId: item.levelId ?? undefined,
      apu: item.apu ?? null,
    });
  }

  for (const itemPatch of patch.items.update) {
    const existingItem = itemsById.get(itemPatch.id);
    if (!existingItem) continue;

    itemsById.set(itemPatch.id, {
      ...existingItem,
      ...itemPatch.changes,
      levelId: itemPatch.changes.levelId ?? existingItem.levelId,
      apu: itemPatch.changes.apu === undefined ? existingItem.apu : itemPatch.changes.apu,
    });
  }

  return calculateBudgetRecord({
    ...budget,
    ...patch.budget,
    levels: [...levelsById.values()].sort((left, right) => left.sortOrder - right.sortOrder),
    items: [...itemsById.values()].sort((left, right) => left.sortOrder - right.sortOrder),
  });
}

export async function refreshGeneralBudgetTotals(
  tx: Prisma.TransactionClient,
  generalBudgetId: string,
) {
  const generalBudget = await tx.budget.findUnique({
    where: { id: generalBudgetId },
    include: {
      childBudgets: {
        select: {
          totalDirectCost: true,
          totalGeneralExpenses: true,
          totalUtility: true,
          totalTax: true,
          totalAmount: true,
        },
      },
    },
  });

  if (!generalBudget) return;

  const consolidated = generalBudget.childBudgets.reduce(
    (totals, childBudget) => ({
      totalDirectCost: totals.totalDirectCost.plus(childBudget.totalDirectCost),
      totalGeneralExpenses: totals.totalGeneralExpenses.plus(childBudget.totalGeneralExpenses),
      totalUtility: totals.totalUtility.plus(childBudget.totalUtility),
      totalTax: totals.totalTax.plus(childBudget.totalTax),
      totalAmount: totals.totalAmount.plus(childBudget.totalAmount),
    }),
    {
      totalDirectCost: new Prisma.Decimal(0),
      totalGeneralExpenses: new Prisma.Decimal(0),
      totalUtility: new Prisma.Decimal(0),
      totalTax: new Prisma.Decimal(0),
      totalAmount: new Prisma.Decimal(0),
    },
  );

  await tx.budget.update({
    where: { id: generalBudgetId },
    data: consolidated,
  });
}

async function syncGeneralExpensesRateFromStructure(
  tx: Prisma.TransactionClient,
  generalBudgetId: string,
  detailedGeneralExpensesTotal: number,
) {
  const generalBudget = await tx.budget.findUnique({
    where: { id: generalBudgetId },
    select: {
      id: true,
      totalDirectCost: true,
    },
  });

  if (!generalBudget) return;

  const totalDirectCost = decimalToNumber(generalBudget.totalDirectCost);
  const generalExpensesRate = totalDirectCost > 0
    ? new Decimal(detailedGeneralExpensesTotal).dividedBy(totalDirectCost).toDecimalPlaces(10, Decimal.ROUND_HALF_UP).toNumber()
    : 0;

  const childBudgets = await tx.budget.findMany({
    where: { parentBudgetId: generalBudgetId },
    select: {
      id: true,
      totalDirectCost: true,
      utilityRate: true,
      igvRate: true,
    },
  });

  for (const childBudget of childBudgets) {
    const totals = calculateBudgetTotalsFromDirectCost({
      totalDirectCost: decimalToNumber(childBudget.totalDirectCost),
      generalExpensesRate,
      utilityRate: decimalToNumber(childBudget.utilityRate),
      igvRate: decimalToNumber(childBudget.igvRate),
    });

    await tx.budget.update({
      where: { id: childBudget.id },
      data: {
        generalExpensesRate,
        ...totals,
      },
    });
  }

  await tx.budget.update({
    where: { id: generalBudgetId },
    data: {
      generalExpensesRate,
      totalGeneralExpenses: detailedGeneralExpensesTotal,
    },
  });

  await refreshGeneralBudgetTotals(tx, generalBudgetId);

  await tx.budget.update({
    where: { id: generalBudgetId },
    data: { generalExpensesRate },
  });
}

function calculateBudgetTotalsFromDirectCost(input: {
  totalDirectCost: number;
  generalExpensesRate: number;
  utilityRate: number;
  igvRate: number;
}) {
  const totalDirectCost = new Decimal(input.totalDirectCost);
  const totalGeneralExpenses = totalDirectCost.times(input.generalExpensesRate);
  const totalUtility = totalDirectCost.times(input.utilityRate);
  const subtotal = totalDirectCost.plus(totalGeneralExpenses).plus(totalUtility);
  const totalTax = subtotal.times(input.igvRate);
  const totalAmount = subtotal.plus(totalTax);

  return {
    totalDirectCost: roundMoney(totalDirectCost),
    totalGeneralExpenses: roundMoney(totalGeneralExpenses),
    totalUtility: roundMoney(totalUtility),
    totalTax: roundMoney(totalTax),
    totalAmount: roundMoney(totalAmount),
  };
}

function roundMoney(value: Decimal.Value) {
  return new Decimal(value).toDecimalPlaces(4, Decimal.ROUND_HALF_UP).toNumber();
}

function buildNestedApuRowsJson(rows: PartidaApuRowRecord[] | undefined): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  if (!rows?.length) return Prisma.JsonNull;

  return rows.map((row) => ({
    id: row.id,
    catalogPartidaId: row.catalogPartidaId,
    resourceId: row.resourceId ?? null,
    catalogSubpartidaId: row.catalogSubpartidaId ?? null,
    description: row.description,
    unit: row.unit,
    crew: row.crew ?? null,
    quantity: row.quantity,
    unitPrice: row.unitPrice,
    subtotal: row.subtotal,
    resourceType: row.resourceType ?? null,
    groupLabel: row.groupLabel ?? null,
    sortOrder: row.sortOrder,
  }));
}

async function enrichBudgetSubpartidaCatalogLinks(budget: BudgetRecord): Promise<BudgetRecord> {
  const hasUnlinkedSubpartidas = budget.items.some((item) =>
    item.apu?.resources.some((resource) => isSubpartidaResourceType(resource.resourceType) && !resource.catalogPartida && !resource.description),
  );

  if (!hasUnlinkedSubpartidas) return budget;

  const catalogPartidas = (await prisma.catalogPartida.findMany({
    include: {
      apuRows: {
        orderBy: { sortOrder: "asc" },
        include: {
          catalogSubpartida: {
            include: {
              apuRows: {
                orderBy: { sortOrder: "asc" },
              },
            },
          },
        },
      },
    },
  })).map((partida) => serializeCatalogPartida(partida));

  const catalogByDescriptionUnit = new Map(
    catalogPartidas.map((partida) => [buildBudgetPartidaMatchKey(partida.description, partida.unit), partida] as const),
  );

  return {
    ...budget,
    items: budget.items.map((item) => {
      if (!item.apu) return item;

      const sourceCatalogPartida = catalogByDescriptionUnit.get(buildBudgetPartidaMatchKey(item.description, item.unit));
      if (!sourceCatalogPartida) return item;

      const subpartidaRows = sourceCatalogPartida.apuRows.filter((row) => isSubpartidaResourceType(row.resourceType ?? row.groupLabel));
      const usedRowIds = new Set<string>();

      return {
        ...item,
        apu: {
          ...item.apu,
          resources: item.apu.resources.map((resource) => {
            if (!isSubpartidaResourceType(resource.resourceType) || resource.catalogPartida) return resource;

            const matchingRow = subpartidaRows.find((row) => {
              if (usedRowIds.has(row.id)) return false;
              return Math.abs(row.unitPrice - resource.unitPrice) < 0.005;
            });

            if (!matchingRow) return resource;
            usedRowIds.add(matchingRow.id);

            const linkedPartida =
              matchingRow.catalogSubpartida ??
              catalogByDescriptionUnit.get(buildBudgetPartidaMatchKey(matchingRow.description, matchingRow.unit)) ??
              null;

            if (!linkedPartida) {
              return {
                ...resource,
                description: matchingRow.description,
                unit: matchingRow.unit,
              };
            }

            return {
              ...resource,
              catalogPartidaId: linkedPartida.id,
              catalogPartida: linkedPartida,
              description: matchingRow.description,
              unit: matchingRow.unit,
              nestedApuRows: resource.nestedApuRows?.length ? resource.nestedApuRows : cloneBudgetNestedApuRows(linkedPartida.apuRows),
            };
          }),
        },
      };
    }),
  };
}

function cloneBudgetNestedApuRows(rows: PartidaApuRowRecord[]) {
  return rows.map((row, index) => ({
    ...row,
    id: `${row.id}-budget-preview-${index}`,
    sortOrder: index,
  }));
}

function buildBudgetPartidaMatchKey(description: string, unit: string) {
  return `${normalizeBudgetPartidaMatchText(description)}|${normalizeBudgetPartidaMatchText(unit)}`;
}

function normalizeBudgetPartidaMatchText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

async function resolvePersistableApuResourceId(
  tx: Prisma.TransactionClient,
  userId: string,
  resource: BudgetRecord["items"][number]["apu"] extends infer TApu
    ? TApu extends { resources: infer TResources }
      ? TResources extends Array<infer TResource>
        ? TResource
        : never
      : never
    : never,
) {
  const candidateIds = [resource.resourceId, resource.resource?.id].filter(
    (value, index, values): value is string =>
      typeof value === "string" && value.trim().length > 0 && values.indexOf(value) === index,
  );

  for (const candidateId of candidateIds) {
    const existingResource = await tx.resource.findFirst({
      where: {
        id: candidateId,
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
      select: { id: true },
    });

    if (existingResource) {
      return existingResource.id;
    }
  }

  if (resource.resource) {
    const fallbackResource = await tx.resource.findFirst({
      where: {
        description: resource.resource.description,
        unit: resource.resource.unit,
        category: resource.resource.category,
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
      select: { id: true },
    });

    if (fallbackResource) {
      return fallbackResource.id;
    }
  }

  const resourceLabel =
    resource.resource?.description?.trim() ||
    resource.resourceId?.trim() ||
    "seleccionado";

  throw new Error(
    `El insumo "${resourceLabel}" ya no existe o no est\u00e1 disponible. Vuelve a seleccionarlo antes de guardar el APU.`,
  );
}

async function requireBudgetMutationCapability(options: {
  budgetId: string;
  userId: string;
  capability: "budgets.create" | "budgets.update" | "budgets.delete";
  minimumProjectRole: "VIEWER" | "EDITOR" | "ADMIN";
}) {
  const budget = await prisma.budget.findFirst({
    where: {
      id: options.budgetId,
      project: {
        company: {
          memberships: {
            some: {
              userId: options.userId,
              status: "ACTIVE",
            },
          },
        },
      },
    },
    select: {
      projectId: true,
      project: { select: { companyId: true } },
    },
  });

  if (!budget) {
    throw new Error("No tienes permisos para modificar este presupuesto");
  }

  await requireProjectCapability({
    userId: options.userId,
    companyId: budget.project.companyId,
    projectId: budget.projectId,
    capability: options.capability,
    minimumProjectRole: options.minimumProjectRole,
  });
}

async function getAccessibleGeneralBudget(budgetId: string, userId: string) {
  const budget = await prisma.budget.findFirst({
    where: {
      id: budgetId,
      kind: "GENERAL",
      project: {
        company: {
          memberships: {
            some: {
              userId,
              status: "ACTIVE",
            },
          },
        },
      },
    },
    select: {
      id: true,
      projectId: true,
      name: true,
      currency: true,
      totalDirectCost: true,
      totalGeneralExpenses: true,
      totalUtility: true,
      totalTax: true,
      totalAmount: true,
    },
  });

  if (!budget) {
    throw new Error("No tienes permisos para acceder a este presupuesto general");
  }

  return budget;
}

async function loadBudgetGeneralExpenseGroups(budgetId: string) {
  const groups = await prisma.generalExpenseGroup.findMany({
    where: { budgetId },
    include: {
      titles: {
        orderBy: { sortOrder: "asc" },
        include: {
          items: {
            orderBy: { sortOrder: "asc" },
          },
        },
      },
    },
    orderBy: { sortOrder: "asc" },
  });

  return groups.map((group) => ({
    id: group.id,
    budgetId: group.budgetId,
    name: group.name,
    kind: group.kind,
    sortOrder: group.sortOrder,
    createdAt: ensureDate(group.createdAt).toISOString(),
    updatedAt: ensureDate(group.updatedAt).toISOString(),
    titles: group.titles.map((title) => ({
      id: title.id,
      groupId: title.groupId,
      code: title.code,
      name: title.name,
      category: title.category,
      sortOrder: title.sortOrder,
      createdAt: ensureDate(title.createdAt).toISOString(),
      updatedAt: ensureDate(title.updatedAt).toISOString(),
      items: title.items.map((item) => ({
        id: item.id,
        titleId: item.titleId,
        code: item.code,
        description: item.description,
        category: item.category,
        unit: item.unit,
        quantityDescription: item.quantityDescription ?? "",
        quantity: decimalToNumber(item.quantity),
        participationPercentage: decimalToNumber(item.participationPercentage),
        unitPrice: decimalToNumber(item.unitPrice),
        sortOrder: item.sortOrder,
        createdAt: ensureDate(item.createdAt).toISOString(),
        updatedAt: ensureDate(item.updatedAt).toISOString(),
      })),
    })),
  }));
}

async function loadBudgetFooterRows(budgetId: string) {
  const rows = await prisma.budgetFooterRow.findMany({
    where: { budgetId },
    orderBy: { sortOrder: "asc" },
  });

  return rows.map((row) => ({
    id: row.id,
    budgetId: row.budgetId,
    variable: row.variable,
    description: row.description,
    formula: row.formula,
    manualValue: decimalToNumber(row.manualValue),
    iu: row.iu,
    highlight: row.highlight,
    sortOrder: row.sortOrder,
    createdAt: ensureDate(row.createdAt).toISOString(),
    updatedAt: ensureDate(row.updatedAt).toISOString(),
  }));
}

async function cleanupBudgetFooterHeaderArtifacts(tx: Prisma.TransactionClient, budgetId: string) {
  await tx.budgetFooterRow.deleteMany({
    where: {
      budgetId,
      variable: "VARIABLE",
      description: "DESCRIPCION",
    },
  });
}
