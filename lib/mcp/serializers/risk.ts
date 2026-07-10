/**
 * MCP serializer for risk analysis data.
 * Serializes risk variables, correlations, and simulation runs.
 */
import { decimalToString } from "@/lib/db/serializers";

export type McpSerializedRisk = {
  variables: Array<{
    id: string;
    budgetItemId: string;
    variableType: string;
    distributionType: string;
    minimum: string;
    mostLikely: string;
    maximum: string;
    enabled: boolean;
  }>;
  correlations: Array<{
    id: string;
    sourceVariableId: string;
    targetVariableId: string;
    coefficient: string;
  }>;
  simulationRuns: Array<{
    id: string;
    iterations: number;
    baseTotal: string;
    mean: string;
    median: string;
    standardDeviation: string;
    p10: string;
    p50: string;
    p80: string;
    p90: string;
    p95: string;
    histogramBins: unknown;
    sCurvePoints: unknown;
  }>;
};

export function serializeRiskAnalysis(data: {
  variables: Array<{
    id: string;
    budgetItemId: string;
    variableType: string;
    distributionType: string;
    minimum: string | number;
    mostLikely: string | number;
    maximum: string | number;
    enabled: boolean;
  }>;
  correlations: Array<{
    id: string;
    sourceVariableId: string;
    targetVariableId: string;
    coefficient: string | number;
  }>;
  simulationRuns: Array<{
    id: string;
    iterations: number;
    baseTotal: string | number;
    mean: string | number;
    median: string | number;
    standardDeviation: string | number;
    p10: string | number;
    p50: string | number;
    p80: string | number;
    p90: string | number;
    p95: string | number;
    histogramBins: unknown;
    sCurvePoints: unknown;
  }>;
}): McpSerializedRisk {
  return {
    variables: data.variables.map((variable) => ({
      id: variable.id,
      budgetItemId: variable.budgetItemId,
      variableType: variable.variableType,
      distributionType: variable.distributionType,
      minimum: decimalToString(variable.minimum),
      mostLikely: decimalToString(variable.mostLikely),
      maximum: decimalToString(variable.maximum),
      enabled: variable.enabled,
    })),
    correlations: data.correlations.map((correlation) => ({
      id: correlation.id,
      sourceVariableId: correlation.sourceVariableId,
      targetVariableId: correlation.targetVariableId,
      coefficient: decimalToString(correlation.coefficient),
    })),
    simulationRuns: data.simulationRuns.map((run) => ({
      id: run.id,
      iterations: run.iterations,
      baseTotal: decimalToString(run.baseTotal),
      mean: decimalToString(run.mean),
      median: decimalToString(run.median),
      standardDeviation: decimalToString(run.standardDeviation),
      p10: decimalToString(run.p10),
      p50: decimalToString(run.p50),
      p80: decimalToString(run.p80),
      p90: decimalToString(run.p90),
      p95: decimalToString(run.p95),
      histogramBins: run.histogramBins,
      sCurvePoints: run.sCurvePoints,
    })),
  };
}
