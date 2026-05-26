import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { decimalToNumber } from "@/lib/db/serializers";
import {
  riskHistogramBinSchema,
  riskSCurvePointSchema,
  riskSimulationRunInputSchema,
  riskVariablesSaveSchema,
  type RiskSimulationRunInput,
  type RiskVariablesSaveInput,
} from "@/lib/validations/risk";
import type {
  RiskAnalysisPayload,
  RiskBudgetItem,
  RiskSimulationSummary,
  RiskVariableRecord,
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
type RiskSimulationRunModel = Prisma.RiskSimulationRunGetPayload<Record<string, never>>;

export async function getRiskAnalysisPayload(
  budgetId: string,
  userId: string,
): Promise<RiskAnalysisPayload> {
  const budget = await findAccessibleBudgetWithItems(budgetId, userId);

  if (!budget) {
    throw new Error("No tienes permisos para acceder a este presupuesto.");
  }

  const items = normalizeRiskBudgetItems(budget);
  const scopedItemIds = items.map((item) => item.itemId);
  const [variables, latestRun] = await Promise.all([
    prisma.riskVariable.findMany({
      where: {
        budgetId,
        budgetItemId: { in: scopedItemIds },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.riskSimulationRun.findFirst({
      where: { budgetId },
      orderBy: { createdAt: "desc" },
    }),
  ]);

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
    latestRun: latestRun ? serializeRiskSimulationRun(latestRun) : null,
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

  const created = await prisma.riskSimulationRun.create({
    data: {
      budgetId,
      iterations: parsed.iterations,
      baseTotal: parsed.baseTotal,
      mean: parsed.mean,
      median: parsed.median,
      variance: parsed.variance,
      standardDeviation: parsed.standardDeviation,
      skewness: parsed.skewness,
      kurtosis: parsed.kurtosis,
      p10: parsed.p10,
      p50: parsed.p50,
      p80: parsed.p80,
      p90: parsed.p90,
      p95: parsed.p95,
      histogramBins: parsed.histogramBins,
      sCurvePoints: parsed.sCurvePoints,
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

function roundBaseTotal(value: number) {
  return Math.round((value + Number.EPSILON) * 10_000) / 10_000;
}
