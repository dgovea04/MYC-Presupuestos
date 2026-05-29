import { prisma } from "@/lib/db/prisma";
import { decimalToNumber, serializeBudget } from "@/lib/db/serializers";
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
import type { BudgetFooterStructure, GeneralBudgetResourceSummaryResult, GeneralExpenseStructure } from "@/types/budget-sections";
import { calculateBudgetRecord } from "@/lib/calculations/budget";
import type { Prisma } from "@prisma/client";
import type { BudgetLiveUpdateSummary } from "@/lib/client/live-updates";
import { assertWithinPlanLimit } from "@/lib/billing/entitlements";

export async function getBudgetsByUser(userId: string) {
  return prisma.budget.findMany({
    where: {
      kind: "GENERAL",
      project: {
        company: {
          userId,
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
}

export async function getProjectSubBudgetSummaries(projectId: string, userId: string) {
  return prisma.budget.findMany({
    where: {
      projectId,
      kind: "SUB_BUDGET",
      project: {
        company: {
          userId,
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
  });
}

export async function getProjectSubBudgetDetails(projectId: string, userId: string) {
  const budgets = await prisma.budget.findMany({
    where: {
      projectId,
      kind: "SUB_BUDGET",
      project: {
        company: {
          userId,
        },
      },
    },
    include: {
      levels: {
        orderBy: { sortOrder: "asc" },
      },
      items: {
        orderBy: { sortOrder: "asc" },
      },
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  return budgets.map((budget) =>
    serializeBudget({
      ...budget,
      items: budget.items.map((item) => ({
        ...item,
        apu: null,
      })),
    }),
  );
}

export async function getBudgetById(id: string, userId: string) {
  const budget = await prisma.budget.findFirst({
    where: {
      id,
      project: {
        company: {
          userId,
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
                },
              },
            },
          },
        },
      },
    },
  });

  if (!budget) return null;

  return {
    ...serializeBudget(budget),
    project: budget.project,
  };
}

export async function getBudgetHeaderById(id: string, userId: string) {
  return prisma.budget.findFirst({
    where: {
      id,
      project: {
        company: {
          userId,
        },
      },
    },
    select: {
      id: true,
      projectId: true,
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
              resources: item.apu.resources.map((resource) => ({
                resourceId: resource.resourceId,
                quantity: decimalToNumber(resource.quantity),
                subtotal: decimalToNumber(resource.subtotal),
                unitPrice: decimalToNumber(resource.unitPrice),
                resource: resource.resource,
              })),
            }
          : null,
      })),
    })),
  );
}

export async function getBudgetGeneralExpenses(budgetId: string, userId: string): Promise<GeneralExpenseStructure> {
  const budget = await getAccessibleGeneralBudget(budgetId, userId);

  await prisma.$transaction(async (tx) => {
    await ensureBudgetGeneralExpensesTemplate(tx, budgetId);
  });

  const groups = await loadBudgetGeneralExpenseGroups(budgetId);
  return calculateGeneralExpenseStructure({
    totalDirectCost: decimalToNumber(budget.totalDirectCost),
    groups,
  });
}

export async function initializeBudgetGeneralExpenses(budgetId: string, userId: string): Promise<GeneralExpenseStructure> {
  await getAccessibleGeneralBudget(budgetId, userId);

  await prisma.$transaction(async (tx) => {
    await ensureBudgetGeneralExpensesTemplate(tx, budgetId);
  });

  return getBudgetGeneralExpenses(budgetId, userId);
}

export async function getBudgetFooterStructure(budgetId: string, userId: string): Promise<BudgetFooterStructure> {
  const budget = await getAccessibleGeneralBudget(budgetId, userId);
  const expenses = await getBudgetGeneralExpenses(budgetId, userId);

  await prisma.$transaction(async (tx) => {
    await cleanupBudgetFooterHeaderArtifacts(tx, budgetId);
    await ensureBudgetFooterTemplate(tx, budgetId, {
      totalDirectCost: decimalToNumber(budget.totalDirectCost),
      totalGeneralExpenses: expenses.total,
    });
  });

  const rows = await loadBudgetFooterRows(budgetId);
  return calculateBudgetFooterBuilder({
    rows,
    totalDirectCost: decimalToNumber(budget.totalDirectCost),
    totalGeneralExpenses: expenses.total,
  });
}

export async function saveBudgetFooterStructure(
  budgetId: string,
  userId: string,
  input: BudgetFooterStructureSaveInput,
): Promise<BudgetFooterStructure> {
  await getAccessibleGeneralBudget(budgetId, userId);
  const parsed = budgetFooterStructureSaveSchema.parse(input);

  await prisma.$transaction(async (tx) => {
    const existingRows = await tx.budgetFooterRow.findMany({
      where: {
        budgetId,
        budget: {
          project: {
            company: {
              userId,
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

  return getBudgetFooterStructure(budgetId, userId);
}

export async function saveBudgetGeneralExpensesStructure(
  budgetId: string,
  userId: string,
  input: GeneralExpenseStructureSaveInput,
): Promise<GeneralExpenseStructure> {
  const budget = await getAccessibleGeneralBudget(budgetId, userId);
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
                userId,
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
  const parsed = generalExpenseTitleSchema.parse(input);

  const group = await prisma.generalExpenseGroup.findFirst({
    where: {
      id: groupId,
      budgetId,
      budget: {
        project: {
          company: {
            userId,
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
  const parsed = generalExpenseTitleSchema.parse(input);

  const existing = await prisma.generalExpenseTitle.findFirst({
    where: {
      id: titleId,
      group: {
        budgetId,
        budget: {
          project: {
            company: {
              userId,
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

  const existing = await prisma.generalExpenseTitle.findFirst({
    where: {
      id: titleId,
      group: {
        budgetId,
        budget: {
          project: {
            company: {
              userId,
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
              userId,
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
                userId,
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

  const existing = await prisma.generalExpenseItem.findFirst({
    where: {
      id: itemId,
      title: {
        group: {
          budgetId,
          budget: {
            project: {
              company: {
                userId,
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
          userId,
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
          userId,
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
    updatedAt: item.updatedAt.toISOString(),
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

  const data = budgetSchema.parse(rawInput);

  if (userId) {
    await assertWithinPlanLimit({ userId, resource: "budgets" });

    const project = await prisma.project.findFirst({
      where: {
        id: data.projectId,
        company: {
          userId,
        },
      },
      select: { id: true },
    });

    if (!project) {
      throw new Error("No puedes crear presupuestos en un proyecto que no te pertenece");
    }
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
          userId,
        },
      },
    },
    select: { id: true },
  });

  if (!budget) {
    throw new Error("No tienes permisos para eliminar este presupuesto");
  }

  await prisma.budget.delete({
    where: { id },
  });
}

export async function saveBudgetState(id: string, userId: string, budget: BudgetRecord) {
  const normalized = calculateBudgetRecord(budget);

  return prisma.$transaction(async (tx) => {
    const existingBudget = await tx.budget.findFirst({
      where: {
        id,
        project: {
          company: {
            userId,
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
                  select: { id: true },
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
        const persistedResourceId = await resolvePersistableApuResourceId(tx, userId, resource);
        const resourceData = {
          apuId: persistedApuId,
          resourceId: persistedResourceId,
          resourceType: resource.resourceType,
          crew: resource.crew ?? null,
          quantity: resource.quantity,
          unitPrice: resource.unitPrice,
          subtotal: resource.subtotal,
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

export async function saveBudgetPatch(id: string, userId: string, patchInput: BudgetStatePatch) {
  const patch = budgetStatePatchSchema.parse(patchInput);
  const existingBudget = await getBudgetById(id, userId);

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

async function refreshGeneralBudgetTotals(
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
      totalDirectCost: totals.totalDirectCost + Number(childBudget.totalDirectCost),
      totalGeneralExpenses: totals.totalGeneralExpenses + Number(childBudget.totalGeneralExpenses),
      totalUtility: totals.totalUtility + Number(childBudget.totalUtility),
      totalTax: totals.totalTax + Number(childBudget.totalTax),
      totalAmount: totals.totalAmount + Number(childBudget.totalAmount),
    }),
    {
      totalDirectCost: 0,
      totalGeneralExpenses: 0,
      totalUtility: 0,
      totalTax: 0,
      totalAmount: 0,
    },
  );

  await tx.budget.update({
    where: { id: generalBudgetId },
    data: consolidated,
  });
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
              userId,
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
              userId,
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
    resource.resourceId.trim() ||
    "seleccionado";

  throw new Error(
    `El insumo "${resourceLabel}" ya no existe o no est\u00e1 disponible. Vuelve a seleccionarlo antes de guardar el APU.`,
  );
}

async function getAccessibleGeneralBudget(budgetId: string, userId: string) {
  const budget = await prisma.budget.findFirst({
    where: {
      id: budgetId,
      kind: "GENERAL",
      project: {
        company: {
          userId,
        },
      },
    },
    select: {
      id: true,
      projectId: true,
      name: true,
      currency: true,
      totalDirectCost: true,
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
    createdAt: group.createdAt.toISOString(),
    updatedAt: group.updatedAt.toISOString(),
    titles: group.titles.map((title) => ({
      id: title.id,
      groupId: title.groupId,
      code: title.code,
      name: title.name,
      category: title.category,
      sortOrder: title.sortOrder,
      createdAt: title.createdAt.toISOString(),
      updatedAt: title.updatedAt.toISOString(),
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
        createdAt: item.createdAt.toISOString(),
        updatedAt: item.updatedAt.toISOString(),
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
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
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
