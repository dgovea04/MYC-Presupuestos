import { Prisma } from "@prisma/client";
import { buildDisplayRows } from "@/lib/budget/structure";
import { orderSubBudgetsBySpecialty } from "@/lib/budgets/sub-budget-order";
import { buildWorkScheduleView, validateWorkScheduleInput } from "@/lib/calculations/work-schedule";
import { prisma } from "@/lib/db/prisma";
import { decimalToNumber } from "@/lib/db/serializers";
import { validateWorkSchedulePredecessors } from "@/lib/work-schedule/predecessors";
import { buildIntelligentWorkScheduleBase } from "@/lib/work-schedule/intelligent-schedule";
import {
  workScheduleGenerateBaseSchema,
  workScheduleItemSaveSchema,
  type WorkScheduleGenerateBaseInput,
  type WorkScheduleItemSaveInput,
} from "@/lib/validations/work-schedule";
import type { BudgetLevelRecord, BudgetRecord } from "@/types/budget";
import type { WorkScheduleDisplayRowRecord, WorkScheduleLineRecord, WorkScheduleViewRecord } from "@/types/work-schedule";

export async function getWorkScheduleSection(budgetId: string, userId: string): Promise<WorkScheduleViewRecord> {
  const budget = await getAccessibleGeneralBudget(budgetId, userId);
  const [schedule, subBudgets] = await Promise.all([
    prisma.workSchedule.findUnique({
      where: { budgetId },
      include: {
        items: {
          include: {
            distributions: {
              orderBy: [{ year: "asc" }, { month: "asc" }],
            },
          },
        },
      },
    }),
    prisma.budget.findMany({
      where: {
        projectId: budget.projectId,
        kind: "SUB_BUDGET",
      },
      orderBy: { createdAt: "asc" },
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
                  },
                },
              },
            },
          },
        },
      },
    }),
  ]);

  const orderedSubBudgets = orderSubBudgetsBySpecialty(subBudgets);
  const scheduleItemsByBudgetItemId = new Map(
    (schedule?.items ?? []).map((item) => [item.budgetItemId, item]),
  );

  const lines = orderedSubBudgets.flatMap<WorkScheduleLineRecord>((subBudget) =>
    subBudget.items
      .filter((item) => decimalToNumber(item.partial) > 0)
      .map((item) => {
        const persisted = scheduleItemsByBudgetItemId.get(item.id);
        const defaultCrew = item.apu?.resources.reduce((sum, resource) => sum + decimalToNumber(resource.crew), 0) ?? null;
        const quantityMultiplier = decimalToNumber(item.quantity);

        return {
          scheduleItemId: persisted?.id,
          budgetItemId: item.id,
          levelId: item.levelId,
          sortOrder: item.sortOrder,
          itemCode: item.code,
          description: item.description,
          unit: item.unit,
          quantity: quantityMultiplier,
          unitPrice: decimalToNumber(item.unitPrice),
          partial: decimalToNumber(item.partial),
          subBudgetId: subBudget.id,
          subBudgetName: subBudget.name,
          startDate: persisted?.startDate.toISOString().slice(0, 10) ?? null,
          endDate: persisted?.endDate.toISOString().slice(0, 10) ?? null,
          durationDays: persisted?.durationDays ?? null,
          predecessor: persisted?.predecessor ?? null,
          crew: persisted?.crew == null ? defaultCrew : decimalToNumber(persisted.crew),
          performance: item.apu ? decimalToNumber(item.apu.performance) : null,
          performanceLabel: item.apu ? `${decimalToNumber(item.apu.performance)} ${item.unit}/DIA` : null,
          monthlyDistributions:
            persisted?.distributions.map((distribution) => ({
              year: distribution.year,
              month: distribution.month,
              percentage: decimalToNumber(distribution.percentage),
            })) ?? [],
          resources:
            item.apu?.resources
              .flatMap((resource) =>
                resource.resourceId && resource.resource
                  ? [
                      {
                        resourceId: resource.resourceId,
                        code: resource.resource.code,
                        description: resource.resource.description,
                        unit: resource.resource.unit,
                        unitPrice: decimalToNumber(resource.unitPrice),
                        totalQuantity: decimalToNumber(resource.quantity) * quantityMultiplier,
                        totalCost: decimalToNumber(resource.subtotal) * quantityMultiplier,
                      },
                    ]
                  : [],
              ) ?? [],
        };
      }),
  );
  const view = buildWorkScheduleView({
    budgetId: budget.id,
    budgetName: budget.name,
    projectName: budget.project.name,
    currency: budget.currency,
    lines,
  });

  return {
    ...view,
    groups: orderedSubBudgets.map((subBudget) => {
      const group = view.groups.find((candidate) => candidate.subBudgetId === subBudget.id);
      const lines = group?.lines ?? [];

      return {
        subBudgetId: subBudget.id,
        subBudgetName: subBudget.name,
        totalAmount: group?.totalAmount ?? 0,
        lines,
        rows: buildWorkScheduleGroupRows(subBudget, lines),
      };
    }),
  };
}

export async function saveWorkScheduleItem(
  budgetId: string,
  userId: string,
  input: WorkScheduleItemSaveInput,
): Promise<WorkScheduleViewRecord> {
  const payload = workScheduleItemSaveSchema.parse(input);
  validateWorkScheduleInput(payload);

  const budget = await getAccessibleGeneralBudget(budgetId, userId);
  const budgetItem = await prisma.budgetItem.findFirst({
    where: {
      id: payload.budgetItemId,
      budget: {
        projectId: budget.projectId,
        kind: "SUB_BUDGET",
      },
    },
    select: {
      id: true,
      code: true,
      budget: {
        select: {
          items: {
            select: {
              code: true,
            },
          },
        },
      },
    },
  });

  if (!budgetItem) {
    throw new Error("La partida seleccionada no pertenece a este proyecto");
  }

  validateWorkSchedulePredecessors(payload.predecessor, {
    allowedCodes: new Set(budgetItem.budget.items.map((item) => item.code)),
    currentItemCode: budgetItem.code,
  });

  await prisma.$transaction(async (tx) => {
    const schedule = await tx.workSchedule.upsert({
      where: { budgetId },
      update: {},
      create: { budgetId },
      select: { id: true },
    });

    const existing = await tx.workScheduleItem.findUnique({
      where: {
        scheduleId_budgetItemId: {
          scheduleId: schedule.id,
          budgetItemId: payload.budgetItemId,
        },
      },
      select: { id: true },
    });

    if (existing) {
      await tx.workScheduleDistribution.deleteMany({
        where: { scheduleItemId: existing.id },
      });

      await tx.workScheduleItem.update({
        where: { id: existing.id },
        data: {
          startDate: new Date(`${payload.startDate}T00:00:00.000Z`),
          endDate: new Date(`${payload.endDate}T00:00:00.000Z`),
          durationDays: payload.durationDays,
          predecessor: normalizeOptionalString(payload.predecessor),
          crew: payload.crew == null ? null : new Prisma.Decimal(payload.crew),
          distributions: {
            createMany: {
              data: payload.monthlyDistributions.map((distribution) => ({
                year: distribution.year,
                month: distribution.month,
                percentage: new Prisma.Decimal(distribution.percentage),
              })),
            },
          },
        },
      });
    } else {
      await tx.workScheduleItem.create({
        data: {
          scheduleId: schedule.id,
          budgetItemId: payload.budgetItemId,
          startDate: new Date(`${payload.startDate}T00:00:00.000Z`),
          endDate: new Date(`${payload.endDate}T00:00:00.000Z`),
          durationDays: payload.durationDays,
          predecessor: normalizeOptionalString(payload.predecessor),
          crew: payload.crew == null ? null : new Prisma.Decimal(payload.crew),
          distributions: {
            createMany: {
              data: payload.monthlyDistributions.map((distribution) => ({
                year: distribution.year,
                month: distribution.month,
                percentage: new Prisma.Decimal(distribution.percentage),
              })),
            },
          },
        },
      });
    }
  });

  return getWorkScheduleSection(budgetId, userId);
}

export async function generateWorkScheduleBase(
  budgetId: string,
  userId: string,
  input: WorkScheduleGenerateBaseInput,
): Promise<WorkScheduleViewRecord> {
  const payload = workScheduleGenerateBaseSchema.parse(input);
  const budget = await getAccessibleGeneralBudget(budgetId, userId);
  const lines = await getWorkScheduleLinesForBudget(budget);
  const generation = buildIntelligentWorkScheduleBase({
    baseStartDate: payload.baseStartDate,
    lines,
  });

  await prisma.$transaction(async (tx) => {
    const schedule = await tx.workSchedule.upsert({
      where: { budgetId },
      update: {},
      create: { budgetId },
      select: { id: true },
    });

    await tx.workScheduleItem.deleteMany({
      where: { scheduleId: schedule.id },
    });

    if (generation.generatedItems.length === 0) {
      return;
    }

    for (const line of generation.generatedItems) {
      await tx.workScheduleItem.create({
        data: {
          scheduleId: schedule.id,
          budgetItemId: line.budgetItemId,
          startDate: new Date(`${line.startDate}T00:00:00.000Z`),
          endDate: new Date(`${line.endDate}T00:00:00.000Z`),
          durationDays: line.durationDays,
          predecessor: line.predecessor,
          crew: line.crew == null ? null : new Prisma.Decimal(line.crew),
          distributions: {
            createMany: {
              data: line.monthlyDistributions.map((distribution) => ({
                year: distribution.year,
                month: distribution.month,
                percentage: new Prisma.Decimal(distribution.percentage),
              })),
            },
          },
        },
      });
    }
  });

  const section = await getWorkScheduleSection(budgetId, userId);
  return {
    ...section,
    generationSummary: generation.summary,
  };
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
      project: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  if (!budget) {
    throw new Error("No tienes permisos para acceder a esta programacion de obra");
  }

  return budget;
}

async function getWorkScheduleLinesForBudget(
  budget: Awaited<ReturnType<typeof getAccessibleGeneralBudget>>,
): Promise<WorkScheduleLineRecord[]> {
  const [schedule, subBudgets] = await Promise.all([
    prisma.workSchedule.findUnique({
      where: { budgetId: budget.id },
      include: {
        items: {
          include: {
            distributions: {
              orderBy: [{ year: "asc" }, { month: "asc" }],
            },
          },
        },
      },
    }),
    prisma.budget.findMany({
      where: {
        projectId: budget.projectId,
        kind: "SUB_BUDGET",
      },
      orderBy: { createdAt: "asc" },
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
                  },
                },
              },
            },
          },
        },
      },
    }),
  ]);

  const scheduleItemsByBudgetItemId = new Map(
    (schedule?.items ?? []).map((item) => [item.budgetItemId, item]),
  );

  return subBudgets.flatMap<WorkScheduleLineRecord>((subBudget) =>
    subBudget.items
      .filter((item) => decimalToNumber(item.partial) > 0)
      .map((item) => {
        const persisted = scheduleItemsByBudgetItemId.get(item.id);
        const defaultCrew = item.apu?.resources.reduce((sum, resource) => sum + decimalToNumber(resource.crew), 0) ?? null;
        const quantityMultiplier = decimalToNumber(item.quantity);

        return {
          scheduleItemId: persisted?.id,
          budgetItemId: item.id,
          levelId: item.levelId,
          sortOrder: item.sortOrder,
          itemCode: item.code,
          description: item.description,
          unit: item.unit,
          quantity: quantityMultiplier,
          unitPrice: decimalToNumber(item.unitPrice),
          partial: decimalToNumber(item.partial),
          subBudgetId: subBudget.id,
          subBudgetName: subBudget.name,
          startDate: persisted?.startDate.toISOString().slice(0, 10) ?? null,
          endDate: persisted?.endDate.toISOString().slice(0, 10) ?? null,
          durationDays: persisted?.durationDays ?? null,
          predecessor: persisted?.predecessor ?? null,
          crew: persisted?.crew == null ? defaultCrew : decimalToNumber(persisted.crew),
          performance: item.apu ? decimalToNumber(item.apu.performance) : null,
          performanceLabel: item.apu ? `${decimalToNumber(item.apu.performance)} ${item.unit}/DIA` : null,
          monthlyDistributions:
            persisted?.distributions.map((distribution) => ({
              year: distribution.year,
              month: distribution.month,
              percentage: decimalToNumber(distribution.percentage),
            })) ?? [],
          resources:
            item.apu?.resources
              .flatMap((resource) =>
                resource.resourceId && resource.resource
                  ? [
                      {
                        resourceId: resource.resourceId,
                        code: resource.resource.code,
                        description: resource.resource.description,
                        unit: resource.resource.unit,
                        unitPrice: decimalToNumber(resource.unitPrice),
                        totalQuantity: decimalToNumber(resource.quantity) * quantityMultiplier,
                        totalCost: decimalToNumber(resource.subtotal) * quantityMultiplier,
                      },
                    ]
                  : [],
              ) ?? [],
        };
      }),
  );
}

function normalizeOptionalString(value: string | null | undefined) {
  const normalized = value?.trim() ?? "";
  return normalized.length > 0 ? normalized : null;
}

function buildWorkScheduleGroupRows(
  subBudget: {
    id: string;
    name: string;
    levels: Array<{
      id: string;
      budgetId: string;
      parentId: string | null;
      type: "TITLE" | "SUBTITLE" | "ITEM_GROUP" | "SUBITEM";
      code: string;
      name: string;
      sortOrder: number;
    }>;
    items: Array<{
      id: string;
      budgetId: string;
      levelId: string | null;
      code: string;
      description: string;
      unit: string;
      quantity: Prisma.Decimal;
      unitPrice: Prisma.Decimal;
      partial: Prisma.Decimal;
      sortOrder: number;
    }>;
  },
  lines: WorkScheduleLineRecord[],
): WorkScheduleDisplayRowRecord[] {
  const budgetRecord: BudgetRecord = {
    id: subBudget.id,
    projectId: "",
    parentBudgetId: undefined,
    kind: "SUB_BUDGET",
    name: subBudget.name,
    currency: "PEN",
    igvRate: 0,
    generalExpensesRate: 0,
    utilityRate: 0,
    totalDirectCost: 0,
    totalGeneralExpenses: 0,
    totalUtility: 0,
    totalTax: 0,
    totalAmount: 0,
    levels: subBudget.levels.map((level) => ({ ...level, parentId: level.parentId ?? undefined })),
    items: subBudget.items.map((item) => ({
      id: item.id,
      budgetId: item.budgetId,
      levelId: item.levelId ?? undefined,
      code: item.code,
      description: item.description,
      unit: item.unit,
      quantity: decimalToNumber(item.quantity),
      unitPrice: decimalToNumber(item.unitPrice),
      partial: decimalToNumber(item.partial),
      sortOrder: item.sortOrder,
      apu: null,
    })),
  };

  const displayRows = buildDisplayRows(budgetRecord);
  const linesByBudgetItemId = new Map(lines.map((line) => [line.budgetItemId, line]));
  const childLevelsByParent = new Map<string | null, BudgetLevelRecord[]>();
  const itemIdsByLevel = new Map<string, string[]>();

  for (const level of subBudget.levels) {
    const bucket = childLevelsByParent.get(level.parentId ?? null) ?? [];
    bucket.push(level);
    childLevelsByParent.set(level.parentId ?? null, bucket);
  }

  for (const line of lines) {
    if (!line.levelId) {
      continue;
    }

    const bucket = itemIdsByLevel.get(line.levelId) ?? [];
    bucket.push(line.budgetItemId);
    itemIdsByLevel.set(line.levelId, bucket);
  }

  const descendantLineIdsByLevel = new Map<string, string[]>();

  function collectDescendantLineIds(levelId: string): string[] {
    const cached = descendantLineIdsByLevel.get(levelId);
    if (cached) {
      return cached;
    }

    const ownLineIds = itemIdsByLevel.get(levelId) ?? [];
    const childLineIds = (childLevelsByParent.get(levelId) ?? []).flatMap((childLevel) => collectDescendantLineIds(childLevel.id));
    const merged = [...ownLineIds, ...childLineIds];

    descendantLineIdsByLevel.set(levelId, merged);
    return merged;
  }

  return displayRows.flatMap<WorkScheduleDisplayRowRecord>((row) => {
    if (row.kind === "item") {
      const line = linesByBudgetItemId.get(row.item.id);
      return line ? [{ kind: "line", rowId: line.budgetItemId, line }] : [];
    }

    if (row.level.type !== "TITLE" && row.level.type !== "SUBTITLE") {
      return [];
    }

    const childLineIds = collectDescendantLineIds(row.level.id);
    const childLines = childLineIds
      .map((lineId) => linesByBudgetItemId.get(lineId))
      .filter((line): line is WorkScheduleLineRecord => Boolean(line));

    if (childLines.length === 0) {
      return [];
    }

    const startDates = childLines.map((line) => line.startDate).filter((value): value is string => Boolean(value)).sort();
    const endDates = childLines.map((line) => line.endDate).filter((value): value is string => Boolean(value)).sort();

    return [
      {
        kind: "level",
        rowId: `level:${row.level.id}`,
        levelId: row.level.id,
        levelType: row.level.type,
        itemCode: row.level.code,
        description: row.level.name,
        subBudgetId: subBudget.id,
        subBudgetName: subBudget.name,
        durationDays: childLines.reduce((sum, line) => sum + (line.durationDays ?? 0), 0),
        startDate: startDates[0] ?? null,
        endDate: endDates.at(-1) ?? null,
        partial: childLines.reduce((sum, line) => sum + line.partial, 0),
        childLineIds,
      },
    ];
  });
}
