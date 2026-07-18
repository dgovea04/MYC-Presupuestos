import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { decimalToNumber } from "@/lib/db/serializers";
import { getRiskAnalysisPayload } from "@/lib/risk/data";
import { loadRiskWorkScheduleSummary } from "@/lib/risk/fallback";
import { runMonteCarloSimulation } from "@/lib/risk/monte-carlo-engine";
import {
  riskHistogramBinSchema,
  riskScheduleDurationSummarySchema,
  riskSCurvePointSchema,
} from "@/lib/validations/risk";
import {
  MONTE_CARLO_ITERATIONS,
  type RiskCorrelationRecord,
  type RiskSimulationModelSnapshot,
  type RiskSimulationRunRequest,
  type RiskSimulationSummary,
  type RiskVariableRecord,
} from "@/types/risk";

export const RISK_ENGINE_VERSION = "risk-engine-v2";

type RiskVariableModel = Prisma.RiskVariableGetPayload<Record<string, never>>;
type RiskCorrelationModel = Prisma.RiskCorrelationGetPayload<Record<string, never>>;
type RiskSimulationRunModel = Prisma.RiskSimulationRunGetPayload<Record<string, never>>;

export function buildRiskSimulationSnapshot(input: RiskSimulationModelSnapshot): RiskSimulationModelSnapshot {
  return {
    budgetId: input.budgetId,
    scenarioId: input.scenarioId,
    baseTotal: input.baseTotal,
    iterations: input.iterations,
    seed: input.seed,
    engineVersion: input.engineVersion,
    itemIds: [...input.itemIds],
    variableIds: [...input.variableIds],
    correlationIds: [...input.correlationIds],
    createdAt: input.createdAt,
  };
}

export async function runAndSaveRiskSimulation(
  budgetId: string,
  userId: string,
  request: RiskSimulationRunRequest,
): Promise<RiskSimulationSummary> {
  if (request.budgetId !== budgetId) {
    throw new Error("La simulacion no corresponde al presupuesto seleccionado.");
  }

  const scenarioId = request.scenarioId ?? null;
  if (scenarioId) {
    const scenario = await prisma.riskScenario.findFirst({
      where: { id: scenarioId, budgetId },
    });

    if (!scenario) {
      throw new Error("El escenario de riesgo no corresponde al presupuesto seleccionado.");
    }
  }

  const payload = await getRiskAnalysisPayload(budgetId, userId);
  const seed = request.seed ?? `${budgetId}:${Date.now()}`;
  const itemIds = payload.items.map((item) => item.itemId);
  const { correlations, variables } = await loadRiskModel(budgetId, scenarioId, itemIds);
  const workScheduleSummary = await loadRiskWorkScheduleSummary(budgetId, userId, payload.budget.kind);
  const workSchedule =
    workScheduleSummary && workScheduleSummary.simulationLines.length > 0
      ? { lines: workScheduleSummary.simulationLines }
      : null;

  const summary = runMonteCarloSimulation(
    {
      budgetId,
      baseTotal: payload.budget.baseTotal,
      iterations: MONTE_CARLO_ITERATIONS,
      items: payload.items,
      variables,
      correlations,
      workSchedule,
    },
    { seed },
  );

  const modelSnapshot = buildRiskSimulationSnapshot({
    budgetId,
    scenarioId,
    baseTotal: payload.budget.baseTotal,
    iterations: MONTE_CARLO_ITERATIONS,
    seed,
    engineVersion: RISK_ENGINE_VERSION,
    itemIds,
    variableIds: variables.map((variable) => variable.id),
    correlationIds: correlations.map((correlation) => correlation.id),
    createdAt: new Date().toISOString(),
  });

  const created = await prisma.riskSimulationRun.create({
    data: {
      budgetId,
      scenarioId,
      createdByUserId: userId,
      iterations: summary.iterations,
      seed,
      engineVersion: RISK_ENGINE_VERSION,
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
      histogramBins: summary.histogramBins as Prisma.InputJsonValue,
      sCurvePoints: summary.sCurvePoints as Prisma.InputJsonValue,
      scheduleSummary: summary.scheduleDuration === null
        ? Prisma.JsonNull
        : (summary.scheduleDuration as Prisma.InputJsonValue),
      modelSnapshot: modelSnapshot as Prisma.InputJsonValue,
    },
  });

  return serializeRiskSimulationRun(created);
}

async function loadRiskModel(budgetId: string, scenarioId: string | null, itemIds: string[]) {
  const rawVariables = await prisma.riskVariable.findMany({
    where: {
      budgetId,
      scenarioId,
      budgetItemId: { in: itemIds },
    },
    orderBy: { createdAt: "asc" },
  });
  const variableIds = new Set(rawVariables.map((variable) => variable.id));
  const rawCorrelations = await prisma.riskCorrelation.findMany({
    where: { budgetId, scenarioId },
    orderBy: { createdAt: "asc" },
  });

  return {
    variables: rawVariables.map(serializeRiskVariable),
    correlations: rawCorrelations
      .filter((correlation) => variableIds.has(correlation.sourceVariableId))
      .filter((correlation) => variableIds.has(correlation.targetVariableId))
      .map(serializeRiskCorrelation),
  };
}

function serializeRiskVariable(variable: RiskVariableModel): RiskVariableRecord {
  return {
    id: variable.id,
    budgetId: variable.budgetId,
    scenarioId: variable.scenarioId,
    budgetItemId: variable.budgetItemId,
    variableType: variable.variableType,
    distributionType: variable.distributionType,
    minimum: decimalToNumber(variable.minimum),
    mostLikely: decimalToNumber(variable.mostLikely),
    maximum: decimalToNumber(variable.maximum),
    enabled: variable.enabled,
    source: variable.source,
    confidence: variable.confidence ? decimalToNumber(variable.confidence) : null,
    rationale: variable.rationale,
    createdAt: variable.createdAt.toISOString(),
    updatedAt: variable.updatedAt.toISOString(),
  };
}

function serializeRiskCorrelation(correlation: RiskCorrelationModel): RiskCorrelationRecord {
  return {
    id: correlation.id,
    budgetId: correlation.budgetId,
    scenarioId: correlation.scenarioId,
    sourceVariableId: correlation.sourceVariableId,
    targetVariableId: correlation.targetVariableId,
    coefficient: decimalToNumber(correlation.coefficient),
    source: correlation.source,
    confidence: correlation.confidence ? decimalToNumber(correlation.confidence) : null,
    rationale: correlation.rationale,
    createdAt: correlation.createdAt.toISOString(),
    updatedAt: correlation.updatedAt.toISOString(),
  };
}

function serializeRiskSimulationRun(run: RiskSimulationRunModel): RiskSimulationSummary {
  return {
    id: run.id,
    budgetId: run.budgetId,
    scenarioId: run.scenarioId,
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
    seed: run.seed,
    engineVersion: run.engineVersion,
    modelSnapshot: parseModelSnapshot(run.modelSnapshot),
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

function parseModelSnapshot(value: Prisma.JsonValue | null): RiskSimulationModelSnapshot | null {
  if (!isRiskSimulationModelSnapshot(value)) {
    return null;
  }

  return buildRiskSimulationSnapshot(value);
}

function isRiskSimulationModelSnapshot(value: Prisma.JsonValue | null): value is RiskSimulationModelSnapshot {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.budgetId === "string" &&
    (typeof candidate.scenarioId === "string" || candidate.scenarioId === null) &&
    typeof candidate.baseTotal === "number" &&
    typeof candidate.iterations === "number" &&
    typeof candidate.seed === "string" &&
    typeof candidate.engineVersion === "string" &&
    Array.isArray(candidate.itemIds) &&
    candidate.itemIds.every((itemId) => typeof itemId === "string") &&
    Array.isArray(candidate.variableIds) &&
    candidate.variableIds.every((variableId) => typeof variableId === "string") &&
    Array.isArray(candidate.correlationIds) &&
    candidate.correlationIds.every((correlationId) => typeof correlationId === "string") &&
    typeof candidate.createdAt === "string"
  );
}
