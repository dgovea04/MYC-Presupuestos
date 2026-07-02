import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { decimalToNumber } from "@/lib/db/serializers";
import { runMonteCarloSimulation } from "@/lib/risk/monte-carlo-engine";
import {
  riskCorrelationsSaveSchema,
  riskHistogramBinSchema,
  riskScheduleDurationSummarySchema,
  riskSCurvePointSchema,
  riskSimulationRunInputSchema,
  riskVariablesSaveSchema,
  type RiskCorrelationsSaveInput,
  type RiskSimulationRunInput,
  type RiskVariablesSaveInput,
} from "@/lib/validations/risk";
import { getWorkScheduleSection } from "@/lib/data/work-schedule";
import type {
  RiskAnalysisPayload,
  RiskBudgetItem,
  RiskCorrelationRecord,
  RiskSimulationSummary,
  RiskVariableRecord,
  RiskWorkScheduleSimulationLine,
} from "@/types/risk";

const riskBudgetItemSelect = {
  id: true,
  budgetId: true,
  code: true,
  description: true,
  unit: true,
  quantity: true,
  unitPrice: true,
  sortOrder: true,
  updatedAt: true,
} satisfies Prisma.BudgetItemSelect;

type RiskBudgetItemRow = Prisma.BudgetItemGetPayload<{
  select: typeof riskBudgetItemSelect;
}>;

type BudgetWithRiskScope = {
  id: string;
  projectId: string;
  kind: "GENERAL" | "SUB_BUDGET";
  name: string;
  currency: string;
  items: RiskBudgetItemRow[];
  childBudgets: Array<{
    id: string;
    projectId: string;
    kind: "GENERAL" | "SUB_BUDGET";
    name: string;
    items: RiskBudgetItemRow[];
  }>;
};

type RiskVariableModel = Prisma.RiskVariableGetPayload<Record<string, never>>;
type RiskCorrelationModel = Prisma.RiskCorrelationGetPayload<Record<string, never>>;
type RiskSimulationRunModel = Prisma.RiskSimulationRunGetPayload<Record<string, never>>;

export class RiskBudgetAccessError extends Error {
  constructor() {
    super("No tienes permisos para acceder a este presupuesto.");
    this.name = "RiskBudgetAccessError";
  }
}

export async function getRiskAnalysisPayload(
  budgetId: string,
  userId: string,
): Promise<RiskAnalysisPayload> {
  const budget = await findAccessibleBudgetWithItems(budgetId, userId);

  if (!budget) {
    throw new RiskBudgetAccessError();
  }

  const items = normalizeRiskBudgetItems(budget);
  const scopedItemIds = items.map((item) => item.itemId);
  const [variables, correlations, latestRun] = await Promise.all([
    prisma.riskVariable.findMany({
      where: {
        budgetId,
        budgetItemId: { in: scopedItemIds },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.riskCorrelation.findMany({
      where: { budgetId },
      orderBy: { createdAt: "asc" },
    }),
    prisma.riskSimulationRun.findFirst({
      where: { budgetId },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const modelChangedAt = getRiskModelChangedAt(items, variables, correlations);
  const currentLatestRun = latestRun && latestRun.createdAt >= modelChangedAt ? latestRun : null;

  return {
    budget: {
      id: budget.id,
      projectId: budget.projectId,
      name: budget.name,
      kind: budget.kind,
      currency: budget.currency,
      baseTotal: roundBaseTotal(items.reduce((total, item) => total + item.baseTotal, 0)),
    },
    items,
    variables: variables
      .filter((variable) => scopedItemIds.includes(variable.budgetItemId))
      .map(serializeRiskVariable),
    correlations: correlations
      .filter((correlation) => variables.some((variable) => variable.id === correlation.sourceVariableId))
      .filter((correlation) => variables.some((variable) => variable.id === correlation.targetVariableId))
      .map(serializeRiskCorrelation),
    latestRun: currentLatestRun ? serializeRiskSimulationRun(currentLatestRun) : null,
  };
}

export async function saveRiskVariables(
  budgetId: string,
  userId: string,
  input: RiskVariablesSaveInput,
): Promise<RiskAnalysisPayload> {
  const parsed = riskVariablesSaveSchema.parse(input);
  const budget = await findAccessibleBudgetWithItems(budgetId, userId);

  if (!budget) {
    throw new Error("No tienes permisos para modificar este presupuesto.");
  }

  const scopedItemIds = new Set(normalizeRiskBudgetItems(budget).map((item) => item.itemId));

  await prisma.$transaction(async (tx) => {
    for (const variable of parsed.variables) {
      if (!scopedItemIds.has(variable.budgetItemId)) {
        throw new Error("La partida seleccionada no pertenece al alcance del presupuesto.");
      }

      if (variable.delete) {
        await tx.riskVariable.deleteMany({
          where: {
            budgetId,
            budgetItemId: variable.budgetItemId,
            variableType: variable.variableType,
          },
        });
        continue;
      }

      await tx.riskVariable.upsert({
        where: {
          budgetId_budgetItemId_variableType: {
            budgetId,
            budgetItemId: variable.budgetItemId,
            variableType: variable.variableType,
          },
        },
        update: {
          distributionType: variable.distributionType,
          minimum: variable.minimum,
          mostLikely: variable.mostLikely,
          maximum: variable.maximum,
          enabled: variable.enabled,
        },
        create: {
          budgetId,
          budgetItemId: variable.budgetItemId,
          variableType: variable.variableType,
          distributionType: variable.distributionType,
          minimum: variable.minimum,
          mostLikely: variable.mostLikely,
          maximum: variable.maximum,
          enabled: variable.enabled,
        },
      });
    }
  });

  return getRiskAnalysisPayload(budgetId, userId);
}

export async function saveRiskCorrelations(
  budgetId: string,
  userId: string,
  input: RiskCorrelationsSaveInput,
): Promise<RiskAnalysisPayload> {
  const parsed = riskCorrelationsSaveSchema.parse(input);
  const budget = await findAccessibleBudgetWithItems(budgetId, userId);

  if (!budget) {
    throw new Error("No tienes permisos para modificar este presupuesto.");
  }

  const scopedItemIds = new Set(normalizeRiskBudgetItems(budget).map((item) => item.itemId));
  const variables = await prisma.riskVariable.findMany({
    where: {
      budgetId,
      budgetItemId: { in: [...scopedItemIds] },
    },
  });
  const variableIds = new Set(variables.map((variable) => variable.id));

  await prisma.$transaction(async (tx) => {
    for (const correlation of parsed.correlations) {
      const normalized = normalizeCorrelationPair(correlation.sourceVariableId, correlation.targetVariableId);

      if (!variableIds.has(normalized.sourceVariableId) || !variableIds.has(normalized.targetVariableId)) {
        throw new Error("La correlacion usa variables fuera del alcance actual.");
      }

      if (correlation.delete || correlation.coefficient === 0) {
        await tx.riskCorrelation.deleteMany({
          where: {
            budgetId,
            sourceVariableId: normalized.sourceVariableId,
            targetVariableId: normalized.targetVariableId,
          },
        });
        continue;
      }

      await tx.riskCorrelation.upsert({
        where: {
          budgetId_sourceVariableId_targetVariableId: {
            budgetId,
            sourceVariableId: normalized.sourceVariableId,
            targetVariableId: normalized.targetVariableId,
          },
        },
        update: {
          coefficient: correlation.coefficient,
        },
        create: {
          budgetId,
          sourceVariableId: normalized.sourceVariableId,
          targetVariableId: normalized.targetVariableId,
          coefficient: correlation.coefficient,
        },
      });
    }
  });

  return getRiskAnalysisPayload(budgetId, userId);
}

export async function saveRiskSimulationRun(
  budgetId: string,
  userId: string,
  input: RiskSimulationRunInput,
): Promise<RiskSimulationSummary> {
  const parsed = riskSimulationRunInputSchema.parse(input);
  const budget = await findAccessibleBudgetWithItems(budgetId, userId);

  if (!budget) {
    throw new Error("No tienes permisos para guardar esta simulacion.");
  }

  const items = normalizeRiskBudgetItems(budget);
  const scopedItemIds = items.map((item) => item.itemId);
  const variables = await prisma.riskVariable.findMany({
    where: {
      budgetId,
      budgetItemId: { in: scopedItemIds },
    },
    orderBy: { createdAt: "asc" },
  });
  const correlations = await prisma.riskCorrelation.findMany({
    where: { budgetId },
    orderBy: { createdAt: "asc" },
  });
  const summary = runMonteCarloSimulation({
    budgetId,
    baseTotal: roundBaseTotal(items.reduce((total, item) => total + item.baseTotal, 0)),
    iterations: parsed.iterations,
    items,
    variables: variables.map(serializeRiskVariable),
    correlations: correlations.map(serializeRiskCorrelation),
    workSchedule: await buildRiskWorkScheduleSimulationInput(budget.kind, budgetId, userId),
  });

  const created = await prisma.riskSimulationRun.create({
    data: {
      budgetId,
      iterations: summary.iterations,
      baseTotal: summary.baseTotal,
      mean: summary.mean,
      median: summary.median,
      variance: summary.variance,
      standardDeviation: summary.standardDeviation,
      skewness: summary.skewness,
      kurtosis: summary.kurtosis,
      p10: summary.p10,
      p50: summary.p50,
      p80: summary.p80,
      p90: summary.p90,
      p95: summary.p95,
      histogramBins: summary.histogramBins,
      sCurvePoints: summary.sCurvePoints,
      scheduleSummary: summary.scheduleDuration,
    },
  });

  return serializeRiskSimulationRun(created);
}

async function findAccessibleBudgetWithItems(budgetId: string, userId: string) {
  const budget = await prisma.budget.findFirst({
    where: {
      id: budgetId,
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
      items: {
        orderBy: { sortOrder: "asc" },
        select: riskBudgetItemSelect,
      },
    },
  });

  if (!budget) {
    return null;
  }

  if (budget.kind !== "GENERAL") {
    return {
      ...budget,
      childBudgets: [],
    } satisfies BudgetWithRiskScope;
  }

  const childBudgets = await prisma.budget.findMany({
    where: {
      parentBudgetId: budget.id,
      kind: "SUB_BUDGET",
      projectId: budget.projectId,
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
      items: {
        orderBy: { sortOrder: "asc" },
        select: riskBudgetItemSelect,
      },
    },
    orderBy: { createdAt: "asc" },
  });

  return {
    ...budget,
    childBudgets,
  } satisfies BudgetWithRiskScope;
}

export function normalizeRiskBudgetItems(budget: BudgetWithRiskScope): RiskBudgetItem[] {
  if (budget.kind === "GENERAL") {
    return budget.childBudgets
      .filter((childBudget) => childBudget.kind === "SUB_BUDGET" && childBudget.projectId === budget.projectId)
      .flatMap((childBudget) =>
        normalizeSingleBudgetItems(childBudget.name, childBudget.id, childBudget.items),
      );
  }

  return normalizeSingleBudgetItems(budget.name, budget.id, budget.items);
}

function normalizeSingleBudgetItems(
  sourceBudgetName: string,
  budgetId: string,
  items: BudgetWithRiskScope["items"],
): RiskBudgetItem[] {
  return items.map((item) => {
    const baseQuantity = decimalToNumber(item.quantity);
    const unitPrice = decimalToNumber(item.unitPrice);

    return {
      itemId: item.id,
      budgetId,
      sourceBudgetName,
      code: item.code,
      description: item.description,
      unit: item.unit,
      baseQuantity,
      unitPrice,
      baseTotal: roundBaseTotal(baseQuantity * unitPrice),
      updatedAt: item.updatedAt.toISOString(),
    };
  });
}

function serializeRiskVariable(variable: RiskVariableModel): RiskVariableRecord {
  return {
    id: variable.id,
    budgetId: variable.budgetId,
    budgetItemId: variable.budgetItemId,
    variableType: variable.variableType,
    distributionType: variable.distributionType,
    minimum: decimalToNumber(variable.minimum),
    mostLikely: decimalToNumber(variable.mostLikely),
    maximum: decimalToNumber(variable.maximum),
    enabled: variable.enabled,
    createdAt: variable.createdAt.toISOString(),
    updatedAt: variable.updatedAt.toISOString(),
  };
}

function serializeRiskCorrelation(correlation: RiskCorrelationModel): RiskCorrelationRecord {
  return {
    id: correlation.id,
    budgetId: correlation.budgetId,
    sourceVariableId: correlation.sourceVariableId,
    targetVariableId: correlation.targetVariableId,
    coefficient: decimalToNumber(correlation.coefficient),
    createdAt: correlation.createdAt.toISOString(),
    updatedAt: correlation.updatedAt.toISOString(),
  };
}

function serializeRiskSimulationRun(run: RiskSimulationRunModel): RiskSimulationSummary {
  return {
    id: run.id,
    budgetId: run.budgetId,
    iterations: run.iterations,
    baseTotal: decimalToNumber(run.baseTotal),
    mean: decimalToNumber(run.mean),
    median: decimalToNumber(run.median),
    variance: decimalToNumber(run.variance),
    standardDeviation: decimalToNumber(run.standardDeviation),
    skewness: decimalToNumber(run.skewness),
    kurtosis: decimalToNumber(run.kurtosis),
    p10: decimalToNumber(run.p10),
    p50: decimalToNumber(run.p50),
    p80: decimalToNumber(run.p80),
    p90: decimalToNumber(run.p90),
    p95: decimalToNumber(run.p95),
    histogramBins: parseHistogramBins(run.histogramBins),
    sCurvePoints: parseSCurvePoints(run.sCurvePoints),
    scheduleDuration: parseScheduleSummary(run.scheduleSummary),
    createdAt: run.createdAt.toISOString(),
  };
}

function parseHistogramBins(value: Prisma.JsonValue) {
  const parsed = riskHistogramBinSchema.array().safeParse(value);
  return parsed.success ? parsed.data : [];
}

function parseSCurvePoints(value: Prisma.JsonValue) {
  const parsed = riskSCurvePointSchema.array().safeParse(value);
  return parsed.success ? parsed.data : [];
}

function parseScheduleSummary(value: Prisma.JsonValue | null) {
  const parsed = riskScheduleDurationSummarySchema.nullable().safeParse(value);
  return parsed.success ? parsed.data : null;
}

function getRiskModelChangedAt(
  items: RiskBudgetItem[],
  variables: RiskVariableModel[],
  correlations: RiskCorrelationModel[],
) {
  const timestamps = [
    ...items.map((item) => Date.parse(item.updatedAt)),
    ...variables.map((variable) => variable.updatedAt.getTime()),
    ...correlations.map((correlation) => correlation.updatedAt.getTime()),
  ].filter((timestamp) => Number.isFinite(timestamp));

  return new Date(timestamps.length > 0 ? Math.max(...timestamps) : 0);
}

function roundBaseTotal(value: number) {
  return Math.round((value + Number.EPSILON) * 10_000) / 10_000;
}

function normalizeCorrelationPair(sourceVariableId: string, targetVariableId: string) {
  return sourceVariableId < targetVariableId
    ? { sourceVariableId, targetVariableId }
    : { sourceVariableId: targetVariableId, targetVariableId: sourceVariableId };
}

async function buildRiskWorkScheduleSimulationInput(
  budgetKind: BudgetWithRiskScope["kind"],
  budgetId: string,
  userId: string,
): Promise<{ lines: RiskWorkScheduleSimulationLine[] } | null> {
  if (budgetKind !== "GENERAL") {
    return null;
  }

  try {
    const section = await getWorkScheduleSection(budgetId, userId);
    const lines = section.groups.flatMap((group) =>
      group.lines.flatMap((line) =>
        line.durationDays && line.durationDays > 0
          ? [
              {
                budgetItemId: line.budgetItemId,
                itemCode: line.itemCode,
                description: line.description,
                durationDays: line.durationDays,
                predecessor: line.predecessor ?? null,
                subBudgetName: line.subBudgetName,
              },
            ]
          : [],
      ),
    );

    return lines.length > 0 ? { lines } : null;
  } catch {
    return null;
  }
}
