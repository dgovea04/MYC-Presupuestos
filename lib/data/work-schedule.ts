import { Prisma } from "@prisma/client";
import { buildDisplayRows } from "@/lib/budget/structure";
import { orderSubBudgetsBySpecialty } from "@/lib/budgets/sub-budget-order";
import {
  analyzeWorkScheduleScale,
  buildWorkScheduleCurveSeries,
  buildWorkScheduleResourceCalendar,
  buildWorkScheduleMonthlyDistributionsFromRange,
  calculateWorkScheduleDurationDays,
  hasSuspiciousDefaultWorkSchedulePerformance,
  recalculateDependentWorkScheduleLines,
  recalculateWorkScheduleLineFromPredecessors,
  buildWorkScheduleValuationCalendarSlice,
  buildWorkScheduleValuationCalendar,
  buildWorkScheduleView,
  validateWorkScheduleInput,
} from "@/lib/calculations/work-schedule";
import { prisma } from "@/lib/db/prisma";
import { decimalToNumber } from "@/lib/db/serializers";
import { ensureDate } from "@/lib/utils";
import { validateWorkSchedulePredecessors } from "@/lib/work-schedule/predecessors";
import { buildIntelligentWorkScheduleBase } from "@/lib/work-schedule/intelligent-schedule";
import {
  workScheduleGenerateBaseSchema,
  workScheduleItemSaveSchema,
  type WorkScheduleGenerateBaseInput,
  type WorkScheduleItemSaveInput,
} from "@/lib/validations/work-schedule";
import type { BudgetLevelRecord, BudgetRecord } from "@/types/budget";
import type {
  WorkScheduleDisplayRowRecord,
  WorkScheduleLineRecord,
  WorkScheduleReviewSummaryRecord,
  WorkScheduleViewRecord,
} from "@/types/work-schedule";

type WorkScheduleProfileSnapshot = {
  heapUsedMb: number;
  rssMb: number;
};

const MAX_PERSISTED_WORK_SCHEDULE_DURATION_DAYS = 36525;
const MAX_PERSISTED_WORK_SCHEDULE_YEAR = 2200;

export async function getWorkScheduleSection(budgetId: string, userId: string): Promise<WorkScheduleViewRecord> {
  const budget = await getAccessibleGeneralBudget(budgetId, userId);
  const { orderedSubBudgets, lines } = await loadWorkScheduleDataset(budget, { includeResources: true });
  const reviewSummary = buildWorkScheduleReviewSummary(lines);
  const view = buildWorkScheduleView(
    {
      budgetId: budget.id,
      budgetName: budget.name,
      projectName: budget.project.name,
      currency: budget.currency,
      lines,
    },
  );

  return {
    ...withWorkScheduleGroupRows(view, orderedSubBudgets),
    reviewSummary,
  };
}

export async function getWorkScheduleOverviewSection(budgetId: string, userId: string): Promise<WorkScheduleViewRecord> {
  const budget = await getAccessibleGeneralBudget(budgetId, userId);
  const { orderedSubBudgets, lines } = await loadWorkScheduleDataset(budget, { includeResources: false });
  const reviewSummary = buildWorkScheduleReviewSummary(lines);
  const view = buildWorkScheduleView(
    {
      budgetId: budget.id,
      budgetName: budget.name,
      projectName: budget.project.name,
      currency: budget.currency,
      lines,
    },
    { includeDerivedCalendars: false },
  );

  return {
    ...withWorkScheduleGroupRows(view, orderedSubBudgets),
    reviewSummary,
  };
}

export async function profileWorkScheduleSectionLoad(
  budgetId: string,
  userId: string,
  options: {
    includeFullView?: boolean;
  } = {},
) {
  const includeFullView = options.includeFullView ?? false;
  const startedAt = performance.now();
  const initialMemory = captureWorkScheduleProfileSnapshot();

  const budgetStartedAt = performance.now();
  const budget = await getAccessibleGeneralBudget(budgetId, userId);
  const budgetLoadedAt = performance.now();

  const datasetStartedAt = performance.now();
  const { orderedSubBudgets, lines } = await loadWorkScheduleDataset(budget, { includeResources: false });
  const datasetLoadedAt = performance.now();
  const datasetMemory = captureWorkScheduleProfileSnapshot();

  const overviewBuildStartedAt = performance.now();
  const overviewBaseView = buildWorkScheduleView(
    {
      budgetId: budget.id,
      budgetName: budget.name,
      projectName: budget.project.name,
      currency: budget.currency,
      lines,
    },
    { includeDerivedCalendars: false },
  );
  const overviewBuiltAt = performance.now();
  const overviewView = withWorkScheduleGroupRows(overviewBaseView, orderedSubBudgets);
  const overviewGroupedAt = performance.now();

  let fullBuildStartedAt: number | null = null;
  let fullBuiltAt: number | null = null;
  let fullGroupedAt: number | null = null;
  let fullView: WorkScheduleViewRecord | null = null;

  if (includeFullView) {
    fullBuildStartedAt = performance.now();
    const fullBaseView = buildWorkScheduleView(
      {
        budgetId: budget.id,
        budgetName: budget.name,
        projectName: budget.project.name,
        currency: budget.currency,
        lines,
      },
    );
    fullBuiltAt = performance.now();
    fullView = withWorkScheduleGroupRows(fullBaseView, orderedSubBudgets);
    fullGroupedAt = performance.now();
  }

  const finalMemory = captureWorkScheduleProfileSnapshot();
  const scale = analyzeWorkScheduleScale(lines);
  const outliers = summarizeWorkScheduleProfileOutliers(lines);
  const timelineRange = {
    startDate: overviewView.timeline.startDate,
    endDate: overviewView.timeline.endDate,
    firstPeriodKey: scale.firstPeriodKey ?? null,
    lastPeriodKey: scale.lastPeriodKey ?? null,
    canLoadDailyTimeline: scale.canLoadDailyTimeline,
    canLoadDerivedCalendars: scale.canLoadDerivedCalendars,
  };

  return {
    budgetId,
    projectName: budget.project.name,
    measuredAt: new Date().toISOString(),
    timingsMs: {
      total: roundProfileMetric((fullGroupedAt ?? overviewGroupedAt) - startedAt),
      loadBudget: roundProfileMetric(budgetLoadedAt - budgetStartedAt),
      loadDataset: roundProfileMetric(datasetLoadedAt - datasetStartedAt),
      buildOverviewBaseView: roundProfileMetric(overviewBuiltAt - overviewBuildStartedAt),
      buildOverviewGroupRows: roundProfileMetric(overviewGroupedAt - overviewBuiltAt),
      buildFullBaseView:
        includeFullView && fullBuildStartedAt != null && fullBuiltAt != null
          ? roundProfileMetric(fullBuiltAt - fullBuildStartedAt)
          : null,
      buildFullGroupRows:
        includeFullView && fullBuiltAt != null && fullGroupedAt != null
          ? roundProfileMetric(fullGroupedAt - fullBuiltAt)
          : null,
    },
    dataset: {
      subBudgetCount: orderedSubBudgets.length,
      lineCount: lines.length,
      scheduledLineCount: lines.filter((line) => line.startDate && line.endDate && line.durationDays != null).length,
      predecessorReferenceCount: lines.reduce((sum, line) => sum + (line.predecessor ? line.predecessor.split(",").filter(Boolean).length : 0), 0),
      monthlyDistributionCount: lines.reduce((sum, line) => sum + line.monthlyDistributions.length, 0),
      resourceCount: lines.reduce((sum, line) => sum + (line.resources?.length ?? line.resourceIds?.length ?? 0), 0),
      timelineDayCount: scale.timelineDayCount,
      periodCount: scale.periodCount,
    },
    timelineRange,
    outliers,
    payloadBytes: {
      overview: Buffer.byteLength(JSON.stringify(overviewView), "utf8"),
      full: fullView ? Buffer.byteLength(JSON.stringify(fullView), "utf8") : null,
    },
    memoryMb: {
      initial: initialMemory,
      afterDataset: datasetMemory,
      final: finalMemory,
      heapDeltaDataset: roundProfileMetric(datasetMemory.heapUsedMb - initialMemory.heapUsedMb),
      heapDeltaTotal: roundProfileMetric(finalMemory.heapUsedMb - initialMemory.heapUsedMb),
    },
  };
}

export async function getWorkScheduleValuationCalendarSection(
  budgetId: string,
  userId: string,
  range?: {
    fromPeriodKey?: string;
    toPeriodKey?: string;
  },
) {
  const budget = await getAccessibleGeneralBudget(budgetId, userId);
  const lines = await getWorkScheduleLinesForBudget(budget, { includeResources: false });
  const scale = analyzeWorkScheduleScale(lines);

  if (range?.fromPeriodKey && range.toPeriodKey) {
    assertValidWorkSchedulePeriodRange(range.fromPeriodKey, range.toPeriodKey, scale);

    return buildWorkScheduleValuationCalendarSlice({
      currency: budget.currency,
      lines,
      fromPeriodKey: range.fromPeriodKey,
      toPeriodKey: range.toPeriodKey,
    });
  }

  assertWorkScheduleSupportsDerivedCalendars(lines);

  return buildWorkScheduleValuationCalendar({
    currency: budget.currency,
    lines,
  });
}

export async function getWorkScheduleResourceCalendarSection(budgetId: string, userId: string) {
  const budget = await getAccessibleGeneralBudget(budgetId, userId);
  const lines = await getWorkScheduleLinesForBudget(budget, { includeResources: true });
  assertWorkScheduleSupportsDerivedCalendars(lines);

  return buildWorkScheduleResourceCalendar({
    currency: budget.currency,
    lines,
  });
}

export async function getWorkScheduleCurveSeriesSection(budgetId: string, userId: string) {
  const valuationCalendar = await getWorkScheduleValuationCalendarSection(budgetId, userId);
  const monthlyTotals = valuationCalendar.rows.reduce<Record<string, number>>((totals, row) => {
    for (const [key, value] of Object.entries(row.periodAmounts)) {
      totals[key] = (totals[key] ?? 0) + value;
    }

    return totals;
  }, {});

  return buildWorkScheduleCurveSeries({
    periods: valuationCalendar.periods,
    monthlyTotals,
  });
}

function withWorkScheduleGroupRows(
  view: WorkScheduleViewRecord,
  orderedSubBudgets: Awaited<ReturnType<typeof getSubBudgetsForProject>>,
) {
  
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
  const normalizedPayload = normalizeWorkScheduleItemSaveInput(
    payload,
    await getWorkScheduleLinesForBudget(budget, { includeResources: false }),
  );
  validateWorkScheduleInput(normalizedPayload);

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
          budgetItemId: normalizedPayload.budgetItemId,
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
          startDate: new Date(`${normalizedPayload.startDate}T00:00:00.000Z`),
          endDate: new Date(`${normalizedPayload.endDate}T00:00:00.000Z`),
          durationDays: normalizedPayload.durationDays,
          predecessor: normalizeOptionalString(normalizedPayload.predecessor),
          crew: normalizedPayload.crew == null ? null : new Prisma.Decimal(normalizedPayload.crew),
          distributions: {
            createMany: {
              data: normalizedPayload.monthlyDistributions.map((distribution) => ({
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
          budgetItemId: normalizedPayload.budgetItemId,
          startDate: new Date(`${normalizedPayload.startDate}T00:00:00.000Z`),
          endDate: new Date(`${normalizedPayload.endDate}T00:00:00.000Z`),
          durationDays: normalizedPayload.durationDays,
          predecessor: normalizeOptionalString(normalizedPayload.predecessor),
          crew: normalizedPayload.crew == null ? null : new Prisma.Decimal(normalizedPayload.crew),
          distributions: {
            createMany: {
              data: normalizedPayload.monthlyDistributions.map((distribution) => ({
                year: distribution.year,
                month: distribution.month,
                percentage: new Prisma.Decimal(distribution.percentage),
              })),
            },
          },
        },
      });
    }

    await cascadeDependentWorkScheduleItems(tx, {
      scheduleId: schedule.id,
      changedBudgetItemId: normalizedPayload.budgetItemId,
    });
  });

  return getWorkScheduleOverviewSection(budgetId, userId);
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

  const section = await getWorkScheduleOverviewSection(budgetId, userId);
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
  options: { includeResources: boolean } = { includeResources: true },
): Promise<WorkScheduleLineRecord[]> {
  const dataset = await loadWorkScheduleDataset(budget, options);
  return dataset.lines;
}

function normalizeOptionalString(value: string | null | undefined) {
  const normalized = value?.trim() ?? "";
  return normalized.length > 0 ? normalized : null;
}

function normalizeWorkScheduleItemSaveInput(
  payload: WorkScheduleItemSaveInput,
  lines: WorkScheduleLineRecord[],
) {
  const currentLine = lines.find((line) => line.budgetItemId === payload.budgetItemId);
  if (!currentLine) {
    return payload;
  }

  const nextLine: WorkScheduleLineRecord = {
    ...currentLine,
    startDate: payload.startDate,
    endDate: payload.endDate,
    durationDays: payload.durationDays,
    predecessor: normalizeOptionalString(payload.predecessor),
    crew: payload.crew ?? currentLine.crew ?? 1,
    monthlyDistributions: payload.monthlyDistributions.map((distribution) => ({
      year: distribution.year,
      month: distribution.month,
      percentage: distribution.percentage,
    })),
  };
  const lineByCode = new Map(lines.map((line) => [line.itemCode, line]));
  lineByCode.set(nextLine.itemCode, nextLine);
  const recalculated = recalculateWorkScheduleLineFromPredecessors(nextLine, lineByCode);

  if (!recalculated?.startDate || !recalculated.endDate || recalculated.durationDays == null) {
    return payload;
  }

  return {
    ...payload,
    startDate: recalculated.startDate,
    endDate: recalculated.endDate,
    durationDays: recalculated.durationDays,
    monthlyDistributions: buildWorkScheduleMonthlyDistributionsFromRange(recalculated.startDate, recalculated.endDate),
  };
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

async function loadWorkScheduleDataset(
  budget: Awaited<ReturnType<typeof getAccessibleGeneralBudget>>,
  options: { includeResources: boolean },
) {
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
    getSubBudgetsForProject(budget.projectId),
  ]);

  const orderedSubBudgets = orderSubBudgetsBySpecialty(subBudgets);
  const scheduleItemsByBudgetItemId = new Map((schedule?.items ?? []).map((item) => [item.budgetItemId, item]));
  const lines = orderedSubBudgets.flatMap<WorkScheduleLineRecord>((subBudget) =>
    subBudget.items
      .filter((item) => decimalToNumber(item.partial) > 0)
      .map((item) => {
        const persisted = scheduleItemsByBudgetItemId.get(item.id);
        const quantityMultiplier = decimalToNumber(item.quantity);
        const persistedStartDate = persisted?.startDate ? ensureDate(persisted.startDate).toISOString().slice(0, 10) : null;
        const persistedEndDate = persisted?.endDate ? ensureDate(persisted.endDate).toISOString().slice(0, 10) : null;
        const persistedDurationDays = persisted?.durationDays ?? null;
        const persistedMonthlyDistributions =
          persisted?.distributions.map((distribution) => ({
            year: distribution.year,
            month: distribution.month,
            percentage: decimalToNumber(distribution.percentage),
          })) ?? [];
        const sanitizedPersistedSchedule = sanitizePersistedWorkScheduleLine({
          startDate: persistedStartDate,
          endDate: persistedEndDate,
          durationDays: persistedDurationDays,
          monthlyDistributions: persistedMonthlyDistributions,
          quantity: quantityMultiplier,
          performance: item.apu ? decimalToNumber(item.apu.performance) : null,
          crew: persisted?.crew == null ? 1 : decimalToNumber(persisted.crew),
          unit: item.unit,
        });

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
          startDate: sanitizedPersistedSchedule.startDate,
          endDate: sanitizedPersistedSchedule.endDate,
          durationDays: sanitizedPersistedSchedule.durationDays,
          predecessor: persisted?.predecessor ?? null,
          crew: persisted?.crew == null ? 1 : decimalToNumber(persisted.crew),
          performance: item.apu ? decimalToNumber(item.apu.performance) : null,
          performanceLabel: item.apu ? `${decimalToNumber(item.apu.performance)} ${item.unit}/DIA` : null,
          monthlyDistributions: sanitizedPersistedSchedule.monthlyDistributions,
          resourceIds:
            item.apu?.resources.flatMap((resource) =>
              resource.resourceId && resource.resource ? [resource.resourceId] : [],
            ) ?? [],
          resources: options.includeResources
            ? item.apu?.resources.flatMap((resource) =>
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
              ) ?? []
            : [],
        };
      }),
  );

  return { orderedSubBudgets, lines };
}

async function cascadeDependentWorkScheduleItems(
  tx: Prisma.TransactionClient,
  {
    scheduleId,
    changedBudgetItemId,
  }: {
    scheduleId: string;
    changedBudgetItemId: string;
  },
) {
  const scheduledItems = await tx.workScheduleItem.findMany({
    where: { scheduleId },
    include: {
      budgetItem: {
        select: {
          id: true,
          code: true,
          description: true,
          unit: true,
          quantity: true,
          unitPrice: true,
          partial: true,
          budget: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
      distributions: {
        orderBy: [{ year: "asc" }, { month: "asc" }],
      },
    },
  });

  const lines = scheduledItems.map<WorkScheduleLineRecord>((item) => ({
    scheduleItemId: item.id,
    budgetItemId: item.budgetItemId,
    itemCode: item.budgetItem.code,
    description: item.budgetItem.description,
    unit: item.budgetItem.unit,
    quantity: decimalToNumber(item.budgetItem.quantity),
    unitPrice: decimalToNumber(item.budgetItem.unitPrice),
    partial: decimalToNumber(item.budgetItem.partial),
    subBudgetId: item.budgetItem.budget.id,
    subBudgetName: item.budgetItem.budget.name,
    startDate: item.startDate ? ensureDate(item.startDate).toISOString().slice(0, 10) : null,
    endDate: item.endDate ? ensureDate(item.endDate).toISOString().slice(0, 10) : null,
    durationDays: item.durationDays,
    predecessor: item.predecessor,
    crew: item.crew == null ? null : decimalToNumber(item.crew),
    monthlyDistributions: item.distributions.map((distribution) => ({
      year: distribution.year,
      month: distribution.month,
      percentage: decimalToNumber(distribution.percentage),
    })),
  }));

  const recalculatedLines = recalculateDependentWorkScheduleLines(lines, changedBudgetItemId);
  const originalLineById = new Map(lines.map((line) => [line.budgetItemId, line]));

  for (const recalculatedLine of recalculatedLines) {
    if (recalculatedLine.budgetItemId === changedBudgetItemId) {
      continue;
    }

    const originalLine = originalLineById.get(recalculatedLine.budgetItemId);
    if (
      !originalLine ||
      recalculatedLine.startDate === originalLine.startDate &&
      recalculatedLine.endDate === originalLine.endDate &&
      recalculatedLine.durationDays === originalLine.durationDays
    ) {
      continue;
    }

    const nextStartDate = recalculatedLine.startDate;
    const nextEndDate = recalculatedLine.endDate;
    const nextDurationDays = recalculatedLine.durationDays;
    if (!recalculatedLine.scheduleItemId || !nextStartDate || !nextEndDate || nextDurationDays == null) {
      continue;
    }

    await tx.workScheduleDistribution.deleteMany({
      where: { scheduleItemId: recalculatedLine.scheduleItemId },
    });

    await tx.workScheduleItem.update({
      where: { id: recalculatedLine.scheduleItemId },
      data: {
        startDate: new Date(`${nextStartDate}T00:00:00.000Z`),
        endDate: new Date(`${nextEndDate}T00:00:00.000Z`),
        durationDays: nextDurationDays,
        distributions: {
          createMany: {
            data: recalculatedLine.monthlyDistributions.map((distribution) => ({
              year: distribution.year,
              month: distribution.month,
              percentage: new Prisma.Decimal(distribution.percentage),
            })),
          },
        },
      },
    });
  }
}

async function getSubBudgetsForProject(projectId: string) {
  return prisma.budget.findMany({
    where: {
      projectId,
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
  });
}

function assertWorkScheduleSupportsDerivedCalendars(lines: WorkScheduleLineRecord[]) {
  const scale = analyzeWorkScheduleScale(lines);
  if (scale.canLoadDerivedCalendars) {
    return;
  }

  throw new Error(
    `Este cronograma abarca ${scale.periodCount.toLocaleString("en-US")} periodos. Carga el overview o reduce el rango antes de abrir calendarios derivados.`,
  );
}

function assertValidWorkSchedulePeriodRange(
  fromPeriodKey: string,
  toPeriodKey: string,
  scale: ReturnType<typeof analyzeWorkScheduleScale>,
) {
  if (!/^\d{4}-\d{2}$/.test(fromPeriodKey) || !/^\d{4}-\d{2}$/.test(toPeriodKey)) {
    throw new Error("El rango mensual debe usar el formato YYYY-MM");
  }

  if (fromPeriodKey > toPeriodKey) {
    throw new Error("El periodo inicial no puede ser mayor al periodo final");
  }

  if (scale.firstPeriodKey && fromPeriodKey < scale.firstPeriodKey) {
    throw new Error(`El periodo inicial no puede ser anterior a ${scale.firstPeriodKey}`);
  }

  if (scale.lastPeriodKey && toPeriodKey > scale.lastPeriodKey) {
    throw new Error(`El periodo final no puede ser posterior a ${scale.lastPeriodKey}`);
  }

  if (countPeriodsInRange(fromPeriodKey, toPeriodKey) > 240) {
    throw new Error("Solicita como maximo 240 periodos por carga");
  }
}

function countPeriodsInRange(fromPeriodKey: string, toPeriodKey: string) {
  const [fromYear, fromMonth] = fromPeriodKey.split("-").map(Number);
  const [toYear, toMonth] = toPeriodKey.split("-").map(Number);
  return (toYear - fromYear) * 12 + (toMonth - fromMonth) + 1;
}

function captureWorkScheduleProfileSnapshot(): WorkScheduleProfileSnapshot {
  const usage = process.memoryUsage();

  return {
    heapUsedMb: roundProfileMetric(usage.heapUsed / (1024 * 1024)),
    rssMb: roundProfileMetric(usage.rss / (1024 * 1024)),
  };
}

function roundProfileMetric(value: number) {
  return Number(value.toFixed(2));
}

function sanitizePersistedWorkScheduleLine(input: {
  startDate: string | null;
  endDate: string | null;
  durationDays: number | null;
  monthlyDistributions: WorkScheduleLineRecord["monthlyDistributions"];
  quantity: number;
  performance: number | null;
  crew: number | null;
  unit: string;
}) {
  if (!isPersistedWorkScheduleRangeAbsurd(input) && !isPersistedWorkScheduleGeneratedFromSuspiciousDefault(input)) {
    return input;
  }

  return {
    startDate: null,
    endDate: null,
    durationDays: null,
    monthlyDistributions: [],
  };
}

function isPersistedWorkScheduleRangeAbsurd(input: {
  startDate: string | null;
  endDate: string | null;
  durationDays: number | null;
  monthlyDistributions: WorkScheduleLineRecord["monthlyDistributions"];
  quantity: number;
  performance: number | null;
  crew: number | null;
  unit: string;
}) {
  if (input.durationDays != null && input.durationDays > MAX_PERSISTED_WORK_SCHEDULE_DURATION_DAYS) {
    return true;
  }

  if (input.startDate && Number(input.startDate.slice(0, 4)) > MAX_PERSISTED_WORK_SCHEDULE_YEAR) {
    return true;
  }

  if (input.endDate && Number(input.endDate.slice(0, 4)) > MAX_PERSISTED_WORK_SCHEDULE_YEAR) {
    return true;
  }

  return input.monthlyDistributions.some((distribution) => distribution.year > MAX_PERSISTED_WORK_SCHEDULE_YEAR);
}

function isPersistedWorkScheduleGeneratedFromSuspiciousDefault(input: {
  startDate: string | null;
  endDate: string | null;
  durationDays: number | null;
  monthlyDistributions: WorkScheduleLineRecord["monthlyDistributions"];
  quantity: number;
  performance: number | null;
  crew: number | null;
  unit: string;
}) {
  if (!input.startDate || !input.endDate || input.durationDays == null || input.monthlyDistributions.length === 0) {
    return false;
  }

  if (!hasSuspiciousDefaultWorkSchedulePerformance({ performance: input.performance, unit: input.unit, quantity: input.quantity })) {
    return false;
  }

  const expectedDurationDays = calculateWorkScheduleDurationDays({
    quantity: input.quantity,
    performance: input.performance,
    crew: input.crew,
  });

  return expectedDurationDays != null && expectedDurationDays === input.durationDays;
}

function summarizeWorkScheduleProfileOutliers(lines: WorkScheduleLineRecord[]) {
  return {
    latestEndDates: [...lines]
      .filter((line) => line.endDate)
      .sort((left, right) => (right.endDate ?? "").localeCompare(left.endDate ?? ""))
      .slice(0, 5)
      .map(toProfileOutlierLine),
    longestDurations: [...lines]
      .filter((line) => line.durationDays != null)
      .sort((left, right) => (right.durationDays ?? 0) - (left.durationDays ?? 0))
      .slice(0, 5)
      .map(toProfileOutlierLine),
    mostDistributionPeriods: [...lines]
      .sort((left, right) => right.monthlyDistributions.length - left.monthlyDistributions.length)
      .slice(0, 5)
      .map(toProfileOutlierLine),
  };
}

function buildWorkScheduleReviewSummary(lines: WorkScheduleLineRecord[]): WorkScheduleReviewSummaryRecord | null {
  const linesWithDefaultPerformance = lines
    .filter((line) => line.performance != null && Number(line.performance) === 1)
    .map((line) => ({
      budgetItemId: line.budgetItemId,
      itemCode: line.itemCode,
      description: line.description,
      unit: line.unit,
      performance: line.performance ?? null,
    }));

  if (linesWithDefaultPerformance.length === 0) {
    return null;
  }

  return {
    warningCount: linesWithDefaultPerformance.length,
    warnings: [
      {
        code: "performance_default_one",
        label: "Partidas con rendimiento 1 detectadas. Esto suele indicar un posible error de importacion de Delphin.",
        count: linesWithDefaultPerformance.length,
        examples: linesWithDefaultPerformance.slice(0, 5),
      },
    ],
  };
}

function toProfileOutlierLine(line: WorkScheduleLineRecord) {
  const expectedDurationDays = calculateWorkScheduleDurationDays({
    quantity: line.quantity,
    performance: line.performance,
    crew: line.crew,
  });

  return {
    budgetItemId: line.budgetItemId,
    itemCode: line.itemCode,
    description: line.description,
    unit: line.unit,
    quantity: line.quantity,
    performance: line.performance,
    crew: line.crew,
    startDate: line.startDate,
    endDate: line.endDate,
    durationDays: line.durationDays,
    expectedDurationDays,
    predecessor: line.predecessor,
    monthlyDistributionCount: line.monthlyDistributions.length,
  };
}
