import Decimal from "decimal.js";
import type { RiskBudgetItem, RiskSimulationInput, RiskSimulationSummary, RiskVariableRecord } from "@/types/risk";
import {
  buildHistogram,
  buildSCurve,
  calculateKurtosis,
  calculateMean,
  calculateMedian,
  calculatePercentile,
  calculateSkewness,
  calculateStandardDeviation,
  calculateVariance,
  roundFinancial,
} from "@/lib/risk/statistics";

export type TriangularParameters = {
  minimum: number;
  mostLikely: number;
  maximum: number;
};

export type MonteCarloSimulationOptions = {
  random?: () => number;
  onProgress?: (completedIterations: number, totalIterations: number) => void;
  progressInterval?: number;
  histogramBinCount?: number;
  sCurvePointCount?: number;
};

export function sampleTriangular(parameters: TriangularParameters, random: () => number = Math.random): number {
  const { maximum, minimum, mostLikely } = parameters;

  if (
    !Number.isFinite(minimum) ||
    !Number.isFinite(mostLikely) ||
    !Number.isFinite(maximum) ||
    minimum < 0 ||
    mostLikely < 0 ||
    maximum < 0 ||
    minimum > mostLikely ||
    mostLikely > maximum
  ) {
    throw new Error("Invalid triangular distribution parameters.");
  }

  if (minimum === maximum) return minimum;

  const probability = random();
  if (!Number.isFinite(probability) || probability < 0 || probability > 1) {
    throw new Error("Invalid triangular random probability.");
  }

  const range = maximum - minimum;
  const modeRatio = (mostLikely - minimum) / range;

  if (probability < modeRatio) {
    return minimum + Math.sqrt(probability * range * (mostLikely - minimum));
  }

  return maximum - Math.sqrt((1 - probability) * range * (maximum - mostLikely));
}

export function runMonteCarloSimulation(
  input: RiskSimulationInput,
  options: MonteCarloSimulationOptions = {},
): RiskSimulationSummary {
  validateSimulationInput(input);

  const random = options.random ?? Math.random;
  const progressInterval = Math.max(1, Math.floor(options.progressInterval ?? Math.ceil(input.iterations / 100)));
  const itemById = new Map(input.items.map((item) => [item.itemId, item]));
  const activeVariables = input.variables.filter((variable) => variable.enabled);
  const totals: number[] = [];

  for (let iteration = 1; iteration <= input.iterations; iteration += 1) {
    let total = new Decimal(input.baseTotal);

    for (const variable of activeVariables) {
      const item = itemById.get(variable.budgetItemId);
      if (!item) continue;

      validateSupportedVariable(variable);
      validateSimulationItem(item);

      const simulatedQuantity = sampleTriangular(
        {
          minimum: variable.minimum,
          mostLikely: variable.mostLikely,
          maximum: variable.maximum,
        },
        random,
      );
      const simulatedTotal = new Decimal(simulatedQuantity).mul(item.unitPrice);
      total = total.minus(item.baseTotal).plus(simulatedTotal);
    }

    totals.push(roundFinancial(total.toNumber()));

    if (iteration % progressInterval === 0 || iteration === input.iterations) {
      options.onProgress?.(iteration, input.iterations);
    }
  }

  return buildSimulationSummary(input, totals, options);
}

function validateSimulationInput(input: RiskSimulationInput): void {
  if (!input.budgetId) {
    throw new Error("Risk simulation requires a budget id.");
  }

  if (!Number.isFinite(input.baseTotal) || input.baseTotal < 0) {
    throw new Error("Risk simulation requires a non-negative base total.");
  }

  if (!Number.isInteger(input.iterations) || input.iterations <= 0) {
    throw new Error("Risk simulation requires a positive integer iteration count.");
  }
}

function validateSimulationItem(item: RiskBudgetItem): void {
  if (!Number.isFinite(item.baseTotal) || !Number.isFinite(item.unitPrice)) {
    throw new Error("Risk simulation item totals must be finite numbers.");
  }
}

function validateSupportedVariable(variable: RiskVariableRecord): void {
  if (variable.variableType !== "QUANTITY") {
    throw new Error(`Unsupported risk variable type: ${String(variable.variableType)}.`);
  }

  if (variable.distributionType !== "TRIANGULAR") {
    throw new Error(`Unsupported risk distribution type: ${String(variable.distributionType)}.`);
  }
}

function buildSimulationSummary(
  input: RiskSimulationInput,
  totals: number[],
  options: MonteCarloSimulationOptions,
): RiskSimulationSummary {
  return {
    budgetId: input.budgetId,
    iterations: input.iterations,
    baseTotal: roundFinancial(input.baseTotal),
    mean: roundFinancial(calculateMean(totals)),
    median: roundFinancial(calculateMedian(totals)),
    variance: roundFinancial(calculateVariance(totals)),
    standardDeviation: roundFinancial(calculateStandardDeviation(totals)),
    skewness: roundFinancial(calculateSkewness(totals)),
    kurtosis: roundFinancial(calculateKurtosis(totals)),
    p10: roundFinancial(calculatePercentile(totals, 0.1)),
    p50: roundFinancial(calculatePercentile(totals, 0.5)),
    p80: roundFinancial(calculatePercentile(totals, 0.8)),
    p90: roundFinancial(calculatePercentile(totals, 0.9)),
    p95: roundFinancial(calculatePercentile(totals, 0.95)),
    histogramBins: buildHistogram(totals, options.histogramBinCount),
    sCurvePoints: buildSCurve(totals, options.sCurvePointCount),
  };
}
