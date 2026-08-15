import { prisma } from "@/lib/db/prisma";
import {
  getUserBudgetTemplateById,
  type AppliedUserBudgetTemplate,
} from "@/lib/data/budget-templates";
import type {
  BudgetTemplateSnapshot,
  BudgetTemplateApuResource,
  BudgetTemplateResource,
} from "@/lib/templates/budget-template-snapshot";
import type { ResourceCategory } from "@/types/resource";

// ─── Types ──────────────────────────────────────────────────────────────────

export type ApplyTemplateToExistingBudgetInput = {
  templateId: string;
  projectId: string;
  targetSubBudgetName: string;
  userId: string;
};

export type ApplyTemplateResult = AppliedUserBudgetTemplate & {
  itemsAdded: number;
  apusCreated: number;
  errors: string[];
};

// ─── Transaction types ──────────────────────────────────────────────────────

type ApplyTx = {
  budget: {
    findFirst(args: {
      where: {
        projectId: string;
        kind: "SUB_BUDGET";
        name: string;
        project: {
          company: {
            memberships: { some: { userId: string; status: "ACTIVE" } };
          };
        };
      };
      select: {
        id: true;
        generalExpensesRate: true;
        utilityRate: true;
        igvRate: true;
      };
    }): Promise<{ id: string; generalExpensesRate: unknown; utilityRate: unknown; igvRate: unknown } | null>;
    update(args: {
      where: { id: string };
      data: Record<string, number>;
    }): Promise<unknown>;
  };
  budgetLevel: {
    findFirst(args: {
      where: { budgetId: string; code: string };
      select: { id: true };
    }): Promise<{ id: string } | null>;
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

// ─── Main function ──────────────────────────────────────────────────────────

export async function applyTemplateToSubBudget(
  input: ApplyTemplateToExistingBudgetInput,
): Promise<ApplyTemplateResult> {
  const errors: string[] = [];

  const template = await getUserBudgetTemplateById(input.templateId, input.userId);
  if (!template) {
    throw new Error("No se encontró la plantilla");
  }

  return prisma.$transaction(async (tx) => {
    const applyTx = tx as unknown as ApplyTx;

    // 1. Find target sub-budget by name
    const targetBudget = await applyTx.budget.findFirst({
      where: {
        projectId: input.projectId,
        kind: "SUB_BUDGET",
        name: input.targetSubBudgetName,
        project: {
          company: {
            memberships: {
              some: {
                userId: input.userId,
                status: "ACTIVE",
              },
            },
          },
        },
      },
      select: {
        id: true,
        generalExpensesRate: true,
        utilityRate: true,
        igvRate: true,
      },
    });

    if (!targetBudget) {
      throw new Error(
        `No se encontró el sub-presupuesto "${input.targetSubBudgetName}" en el proyecto. ` +
        `Crea primero la estructura de presupuestos (Presupuesto General + sub-presupuestos).`,
      );
    }

    // 2. Get project companyId for resource creation
    const project = await (tx as unknown as {
      project: {
        findFirst(args: {
          where: { id: string };
          select: { companyId: true };
        }): Promise<{ companyId: string } | null>;
      };
    }).project.findFirst({
      where: { id: input.projectId },
      select: { companyId: true },
    });

    if (!project) {
      throw new Error("Proyecto no encontrado");
    }

    // 3. Map template levels to existing or new levels in the target budget
    const { levelIdMap } = await mapTemplateLevels(
      applyTx,
      template.snapshot,
      targetBudget.id,
    );

    // 4. Create items from template into the target budget
    let itemsAdded = 0;
    let apusCreated = 0;

    for (const item of template.snapshot.items) {
      const levelId = item.levelKey ? levelIdMap.get(item.levelKey) ?? null : null;

      // Generate a new unique code for the item
      const itemCode = `TPL-${String(itemsAdded + 1).padStart(3, "0")}`;

      const createdItem = await applyTx.budgetItem.create({
        data: {
          budgetId: targetBudget.id,
          levelId,
          code: itemCode,
          description: item.description,
          unit: item.unit,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          partial: item.partial,
          sortOrder: 1000 + itemsAdded, // put template items after existing
        },
        select: { id: true },
      });

      itemsAdded++;
      // Create APU if present
      if (item.apu) {
        try {
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
            await createApuResourceFromTemplate(
              applyTx,
              project.companyId,
              createdApu.id,
              resource,
            );
          }

          apusCreated++;
        } catch (err) {
          errors.push(
            `Error al crear APU para "${item.description}": ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }
    }

    // 5. Recalculate target sub-budget totals
    const allItems = await (tx as unknown as {
      budgetItem: {
        aggregate(args: {
          where: { budgetId: string };
          _sum: { partial: true };
        }): Promise<{ _sum: { partial: number | null } }>;
      };
    }).budgetItem.aggregate({
      where: { budgetId: targetBudget.id },
      _sum: { partial: true },
    });

    const newTotalDirectCost = allItems._sum.partial ?? 0;
    const genExpenses = newTotalDirectCost * Number(targetBudget.generalExpensesRate);
    const utility = newTotalDirectCost * Number(targetBudget.utilityRate);
    const subtotal = newTotalDirectCost + genExpenses + utility;
    const tax = subtotal * Number(targetBudget.igvRate);
    const totalAmount = subtotal + tax;

    await applyTx.budget.update({
      where: { id: targetBudget.id },
      data: {
        totalDirectCost: newTotalDirectCost,
        totalGeneralExpenses: genExpenses,
        totalUtility: utility,
        totalTax: tax,
        totalAmount,
      },
    });

    // 6. Recalculate parent general budget
    await refreshParentBudgetTotals(tx, input.projectId);

    return {
      id: targetBudget.id,
      projectId: input.projectId,
      name: input.targetSubBudgetName,
      templateName: template.name,
      itemsAdded,
      apusCreated,
      errors,
    };
  });
}

// ─── Helpers ────────────────────────────────────────────────────────────────

async function mapTemplateLevels(
  tx: ApplyTx,
  snapshot: BudgetTemplateSnapshot,
  targetBudgetId: string,
): Promise<{ levelIdMap: Map<string, string>; newLevels: number }> {
  const levelIdMap = new Map<string, string>();
  let newLevels = 0;

  // Sort levels so parents come before children
  const sortedLevels = [...snapshot.levels].sort(
    (a, b) => a.sortOrder - b.sortOrder,
  );

  // Resolve levels iteratively to handle parent-child ordering
  let pendingLevels = [...sortedLevels];
  const maxIterations = sortedLevels.length * 2;
  let iterations = 0;

  while (pendingLevels.length > 0 && iterations < maxIterations) {
    const nextPending: typeof pendingLevels = [];
    iterations++;

    for (const level of pendingLevels) {
      // If level has a parent that's not yet mapped, defer it
      if (level.parentKey && !levelIdMap.has(level.parentKey)) {
        nextPending.push(level);
        continue;
      }

      // Try to find existing level with same code in target budget
      const existing = await tx.budgetLevel.findFirst({
        where: { budgetId: targetBudgetId, code: level.code },
        select: { id: true },
      });

      if (existing) {
        levelIdMap.set(level.templateKey, existing.id);
      } else {
        const created = await tx.budgetLevel.create({
          data: {
            budgetId: targetBudgetId,
            parentId: level.parentKey ? levelIdMap.get(level.parentKey) ?? null : null,
            type: level.type,
            code: `TPL-${level.code}`,
            name: level.name,
            sortOrder: 1000 + sortedLevels.indexOf(level),
          },
          select: { id: true },
        });
        levelIdMap.set(level.templateKey, created.id);
        newLevels++;
      }
    }

    if (nextPending.length === pendingLevels.length) {
      // Stuck - force-create remaining levels
      for (const level of nextPending) {
        const created = await tx.budgetLevel.create({
          data: {
            budgetId: targetBudgetId,
            parentId: null, // force no parent to break cycle
            type: level.type,
            code: `TPL-${level.code}`,
            name: level.name,
            sortOrder: 1000 + sortedLevels.indexOf(level),
          },
          select: { id: true },
        });
        levelIdMap.set(level.templateKey, created.id);
        newLevels++;
      }
      break;
    }

    pendingLevels = nextPending;
  }

  return { levelIdMap, newLevels };
}

async function createApuResourceFromTemplate(
  tx: ApplyTx,
  companyId: string,
  apuId: string,
  templateResource: BudgetTemplateApuResource,
): Promise<void> {
  if (!templateResource.resource) return;

  const resourceId = await getOrCreateTemplateResource(
    tx,
    companyId,
    templateResource.resource,
  );

  await tx.apuResource.create({
    data: {
      apuId,
      resourceId,
      resourceType: templateResource.resourceType,
      crew: templateResource.crew,
      quantity: templateResource.quantity,
      unitPrice: templateResource.unitPrice,
      subtotal: templateResource.subtotal,
    },
  });
}

async function getOrCreateTemplateResource(
  tx: ApplyTx,
  companyId: string,
  resource: BudgetTemplateResource,
): Promise<string> {
  const existing = await tx.resource.findFirst({
    where: {
      companyId,
      code: resource.code,
      unit: resource.unit,
      category: resource.category,
    },
    select: { id: true },
  });

  if (existing) return existing.id;

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

async function refreshParentBudgetTotals(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  projectId: string,
): Promise<void> {
  const parentBudget = await tx.budget.findFirst({
    where: { projectId, kind: "GENERAL" },
    select: { id: true },
  });

  if (!parentBudget) return;

  const childBudgets = await tx.budget.findMany({
    where: { parentBudgetId: parentBudget.id },
    select: {
      totalDirectCost: true,
      totalGeneralExpenses: true,
      totalUtility: true,
      totalTax: true,
      totalAmount: true,
    },
  });

  const consolidated = childBudgets.reduce(
    (acc, child) => ({
      totalDirectCost: acc.totalDirectCost + Number(child.totalDirectCost),
      totalGeneralExpenses: acc.totalGeneralExpenses + Number(child.totalGeneralExpenses),
      totalUtility: acc.totalUtility + Number(child.totalUtility),
      totalTax: acc.totalTax + Number(child.totalTax),
      totalAmount: acc.totalAmount + Number(child.totalAmount),
    }),
    { totalDirectCost: 0, totalGeneralExpenses: 0, totalUtility: 0, totalTax: 0, totalAmount: 0 },
  );

  await tx.budget.update({
    where: { id: parentBudget.id },
    data: consolidated,
  });
}
