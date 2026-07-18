import Decimal from "decimal.js";
import type {
  RiskBudgetItem,
  RiskCorrelationRecord,
  RiskDistributionType,
  RiskScheduleDurationSummary,
  RiskSimulationInput,
  RiskSimulationSummary,
  RiskVariableRecord,
  RiskWorkScheduleSimulationLine,
} from "@/types/risk";
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
import { calculateWorkScheduleCriticalPath } from "@/lib/work-schedule/critical-path";

export type TriangularParameters = {
  minimum: number;
  mostLikely: number;
  maximum: number;
};

const PERT_WEIGHT = 4;

export type MonteCarloSimulationOptions = {
  seed?: string;
  random?: () => number;
  onProgress?: (completedIterations: number, totalIterations: number) => void;
  progressInterval?: number;
  histogramBinCount?: number;
  sCurvePointCount?: number;
};

type PreparedSimulationVariable = {
  variable: RiskVariableRecord;
  item: RiskBudgetItem;
};

type PreparedScheduleSimulation = {
  baseProjectDurationDays: number;
  criticalItemCount: number;
  durationVariableIdsByItemId: Map<string, string>;
  lines: RiskWorkScheduleSimulationLine[];
};

export function sampleTriangular(parameters: TriangularParameters, random: () => number = Math.random): number {
  const { maximum, minimum, mostLikely } = validateDistributionParameters(parameters);

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

export function samplePert(parameters: TriangularParameters, random: () => number = Math.random): number {
  const { maximum, minimum, mostLikely } = validateDistributionParameters(parameters);

  if (minimum === maximum) return minimum;

  const range = maximum - minimum;
  const alpha = 1 + PERT_WEIGHT * ((mostLikely - minimum) / range);
  const beta = 1 + PERT_WEIGHT * ((maximum - mostLikely) / range);
  const betaSample = sampleBeta(alpha, beta, random);

  return minimum + betaSample * range;
}

export function sampleUniform(parameters: TriangularParameters, random: () => number = Math.random): number {
  const { maximum, minimum } = validateDistributionParameters(parameters);
  if (minimum === maximum) return minimum;

  const probability = random();
  if (!Number.isFinite(probability) || probability < 0 || probability > 1) {
    throw new Error("Invalid uniform random probability.");
  }

  return minimum + probability * (maximum - minimum);
}

export function sampleNormal(parameters: TriangularParameters, random: () => number = Math.random): number {
  const { maximum, minimum, mostLikely } = validateDistributionParameters(parameters);
  if (minimum === maximum) return minimum;

  const sigma = Math.max((maximum - minimum) / 6, Number.EPSILON);
  const probability = clampOpenUnit(random());
  const sampled = mostLikely + inverseStandardNormal(probability) * sigma;

  return Math.min(maximum, Math.max(minimum, sampled));
}

export function runMonteCarloSimulation(
  input: RiskSimulationInput,
  options: MonteCarloSimulationOptions = {},
): RiskSimulationSummary {
  validateSimulationInput(input);

  const random = options.random ?? (options.seed ? createSeededRandom(options.seed) : Math.random);
  const progressInterval = Math.max(1, Math.floor(options.progressInterval ?? Math.ceil(input.iterations / 100)));
  const preparedVariables = prepareSimulationVariables(input.items, input.variables);
  const preparedSchedule = prepareScheduleSimulation(input.workSchedule?.lines ?? null, preparedVariables, input.iterations);
  const correlatedUniformSampler = buildCorrelatedUniformSampler(
    preparedVariables.map(({ variable }) => variable),
    input.correlations,
    random,
  );
  const totals: number[] = [];
  const projectDurationDays: number[] = [];

  for (let iteration = 1; iteration <= input.iterations; iteration += 1) {
    let total = new Decimal(input.baseTotal);
    const correlatedUniforms = correlatedUniformSampler();
    const sampledValuesByVariableId = new Map<string, number>();

    for (const [index, prepared] of preparedVariables.entries()) {
      sampledValuesByVariableId.set(
        prepared.variable.id,
        sampleDistribution(
          prepared.variable.distributionType,
          {
            minimum: prepared.variable.minimum,
            mostLikely: prepared.variable.mostLikely,
            maximum: prepared.variable.maximum,
          },
          () => correlatedUniforms[index] ?? random(),
        ),
      );
    }

    for (const { item, variable } of preparedVariables) {
      if (variable.variableType === "DURATION") {
        continue;
      }

      const simulatedTotal = calculateSimulatedItemTotal(
        item,
        variable,
        sampledValuesByVariableId.get(variable.id) ?? item.baseQuantity,
      );
      total = total.minus(item.baseTotal).plus(simulatedTotal);
    }

    totals.push(roundFinancial(total.toNumber()));
    if (preparedSchedule) {
      projectDurationDays.push(runScheduleIteration(preparedSchedule, sampledValuesByVariableId));
    }

    if (iteration % progressInterval === 0 || iteration === input.iterations) {
      options.onProgress?.(iteration, input.iterations);
    }
  }

  return buildSimulationSummary(input, totals, options, projectDurationDays, preparedSchedule);
}

export function createSeededRandom(seed: string): () => number {
  let state = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    state ^= seed.charCodeAt(index);
    state = Math.imul(state, 16777619);
  }

  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
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
  if (
    variable.variableType !== "QUANTITY" &&
    variable.variableType !== "UNIT_PRICE" &&
    variable.variableType !== "DURATION"
  ) {
    throw new Error(`Unsupported risk variable type: ${String(variable.variableType)}.`);
  }

  if (
    variable.distributionType !== "TRIANGULAR" &&
    variable.distributionType !== "PERT" &&
    variable.distributionType !== "NORMAL" &&
    variable.distributionType !== "UNIFORM"
  ) {
    throw new Error(`Unsupported risk distribution type: ${String(variable.distributionType)}.`);
  }
}

function prepareSimulationVariables(items: RiskBudgetItem[], variables: RiskVariableRecord[]): PreparedSimulationVariable[] {
  const itemById = new Map(items.map((item) => [item.itemId, item]));

  return variables
    .filter((variable) => variable.enabled)
    .flatMap((variable) => {
      const item = itemById.get(variable.budgetItemId);
      if (!item) {
        return [];
      }

      validateSupportedVariable(variable);
      validateSimulationItem(item);

      return [{ item, variable }];
    });
}

function calculateSimulatedItemTotal(item: RiskBudgetItem, variable: RiskVariableRecord, simulatedValue: number): Decimal {
  if (variable.variableType === "UNIT_PRICE") {
    return new Decimal(item.baseQuantity).mul(simulatedValue);
  }

  return new Decimal(simulatedValue).mul(item.unitPrice);
}

export function buildCorrelatedUniformSampler(
  variables: RiskVariableRecord[],
  correlations: RiskCorrelationRecord[],
  random: () => number = Math.random,
): () => number[] {
  if (variables.length === 0) {
    return () => [];
  }

  if (correlations.length === 0) {
    return () => variables.map(() => {
      const probability = random();
      if (!Number.isFinite(probability) || probability < 0 || probability > 1) {
        throw new Error("Invalid random probability.");
      }
      return probability;
    });
  }

  const matrix = buildCorrelationMatrix(variables, correlations);
  const cholesky = decomposeCorrelationMatrix(matrix);

  return () => {
    const independent = variables.map(() => sampleStandardNormal(random));
    const correlated = cholesky.map((row) =>
      row.reduce((sum, value, columnIndex) => sum + value * (independent[columnIndex] ?? 0), 0),
    );

    return correlated.map((value) => normalCdf(value));
  };
}

export function buildCorrelationMatrix(
  variables: RiskVariableRecord[],
  correlations: RiskCorrelationRecord[],
): number[][] {
  const matrix: number[][] = variables.map((_, rowIndex) =>
    variables.map((__, columnIndex) => (rowIndex === columnIndex ? 1 : 0)),
  );
  const indexById = new Map(variables.map((variable, index) => [variable.id, index]));
  const seenPairs = new Set<string>();

  for (const correlation of correlations) {
    const sourceIndex = indexById.get(correlation.sourceVariableId);
    const targetIndex = indexById.get(correlation.targetVariableId);

    if (sourceIndex === undefined || targetIndex === undefined) {
      continue;
    }

    if (sourceIndex === targetIndex) {
      throw new Error("Correlation pairs must reference different variables.");
    }

    if (!Number.isFinite(correlation.coefficient) || correlation.coefficient < -1 || correlation.coefficient > 1) {
      throw new Error("Correlation coefficients must stay between -1 and 1.");
    }

    const pairKey = [Math.min(sourceIndex, targetIndex), Math.max(sourceIndex, targetIndex)].join(":");
    if (seenPairs.has(pairKey)) {
      throw new Error("Duplicate correlation pair detected.");
    }

    seenPairs.add(pairKey);
    matrix[sourceIndex]![targetIndex] = correlation.coefficient;
    matrix[targetIndex]![sourceIndex] = correlation.coefficient;
  }

  return matrix;
}

function sampleDistribution(
  distributionType: RiskDistributionType,
  parameters: TriangularParameters,
  random: () => number,
): number {
  if (distributionType === "PERT") {
    return samplePert(parameters, random);
  }

  if (distributionType === "NORMAL") {
    return sampleNormal(parameters, random);
  }

  if (distributionType === "UNIFORM") {
    return sampleUniform(parameters, random);
  }

  return sampleTriangular(parameters, random);
}

function validateDistributionParameters(parameters: TriangularParameters): TriangularParameters {
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

  return parameters;
}

function sampleBeta(alpha: number, beta: number, random: () => number): number {
  const left = sampleGamma(alpha, random);
  const right = sampleGamma(beta, random);

  return left / (left + right);
}

function sampleGamma(shape: number, random: () => number): number {
  if (!Number.isFinite(shape) || shape <= 0) {
    throw new Error("Invalid gamma distribution shape.");
  }

  if (shape < 1) {
    const probability = clampOpenUnit(random());
    return sampleGamma(shape + 1, random) * Math.pow(probability, 1 / shape);
  }

  const d = shape - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);

  while (true) {
    const x = sampleStandardNormal(random);
    const v = Math.pow(1 + c * x, 3);

    if (v <= 0) {
      continue;
    }

    const probability = clampOpenUnit(random());
    if (probability < 1 - 0.0331 * Math.pow(x, 4)) {
      return d * v;
    }

    if (Math.log(probability) < 0.5 * x * x + d * (1 - v + Math.log(v))) {
      return d * v;
    }
  }
}

function sampleStandardNormal(random: () => number): number {
  const first = clampOpenUnit(random());
  const second = clampOpenUnit(random());

  return Math.sqrt(-2 * Math.log(first)) * Math.cos(2 * Math.PI * second);
}

function clampOpenUnit(probability: number): number {
  if (!Number.isFinite(probability) || probability < 0 || probability > 1) {
    throw new Error("Invalid random probability.");
  }

  return Math.min(1 - Number.EPSILON, Math.max(Number.MIN_VALUE, probability));
}

function decomposeCorrelationMatrix(matrix: number[][]): number[][] {
  const size = matrix.length;
  const lower = Array.from({ length: size }, () => Array.from({ length: size }, () => 0));

  for (let row = 0; row < size; row += 1) {
    for (let column = 0; column <= row; column += 1) {
      let sum = 0;
      for (let inner = 0; inner < column; inner += 1) {
        sum += (lower[row]?.[inner] ?? 0) * (lower[column]?.[inner] ?? 0);
      }

      if (row === column) {
        const diagonal = (matrix[row]?.[row] ?? 0) - sum;
        if (diagonal <= 1e-10) {
          throw new Error("The correlation matrix is not positive definite.");
        }
        lower[row]![column] = Math.sqrt(diagonal);
        continue;
      }

      lower[row]![column] = ((matrix[row]?.[column] ?? 0) - sum) / (lower[column]?.[column] ?? 1);
    }
  }

  return lower;
}

function normalCdf(value: number): number {
  const sign = value < 0 ? -1 : 1;
  const normalized = Math.abs(value) / Math.sqrt(2);
  const approximation =
    1 -
    (((((1.061405429 * t(normalized) - 1.453152027) * t(normalized) + 1.421413741) * t(normalized) - 0.284496736) *
      t(normalized) +
      0.254829592) *
      t(normalized) *
      Math.exp(-normalized * normalized));

  return 0.5 * (1 + sign * approximation);
}

function inverseStandardNormal(probability: number): number {
  const clamped = clampOpenUnit(probability);
  const a = [
    -39.69683028665376,
    220.9460984245205,
    -275.9285104469687,
    138.357751867269,
    -30.66479806614716,
    2.506628277459239,
  ];
  const b = [
    -54.47609879822406,
    161.5858368580409,
    -155.6989798598866,
    66.80131188771972,
    -13.28068155288572,
  ];
  const c = [
    -0.007784894002430293,
    -0.3223964580411365,
    -2.400758277161838,
    -2.549732539343734,
    4.374664141464968,
    2.938163982698783,
  ];
  const d = [
    0.007784695709041462,
    0.3224671290700398,
    2.445134137142996,
    3.754408661907416,
  ];
  const low = 0.02425;
  const high = 1 - low;

  if (clamped < low) {
    const q = Math.sqrt(-2 * Math.log(clamped));
    return (
      (((((c[0]! * q + c[1]!) * q + c[2]!) * q + c[3]!) * q + c[4]!) * q + c[5]!) /
      ((((d[0]! * q + d[1]!) * q + d[2]!) * q + d[3]!) * q + 1)
    );
  }

  if (clamped > high) {
    const q = Math.sqrt(-2 * Math.log(1 - clamped));
    return -(
      (((((c[0]! * q + c[1]!) * q + c[2]!) * q + c[3]!) * q + c[4]!) * q + c[5]!) /
      ((((d[0]! * q + d[1]!) * q + d[2]!) * q + d[3]!) * q + 1)
    );
  }

  const q = clamped - 0.5;
  const r = q * q;
  return (
    (((((a[0]! * r + a[1]!) * r + a[2]!) * r + a[3]!) * r + a[4]!) * r + a[5]!) * q /
    (((((b[0]! * r + b[1]!) * r + b[2]!) * r + b[3]!) * r + b[4]!) * r + 1)
  );
}

function t(value: number) {
  return 1 / (1 + 0.3275911 * value);
}

function buildSimulationSummary(
  input: RiskSimulationInput,
  totals: number[],
  options: MonteCarloSimulationOptions,
  projectDurationDays: number[],
  preparedSchedule: PreparedScheduleSimulation | null,
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
    scheduleDuration: buildScheduleDurationSummary(projectDurationDays, preparedSchedule),
  };
}

function prepareScheduleSimulation(
  lines: RiskWorkScheduleSimulationLine[] | null,
  preparedVariables: PreparedSimulationVariable[],
  iterations: number,
): PreparedScheduleSimulation | null {
  if (!lines || lines.length === 0 || iterations <= 0) {
    return null;
  }

  const durationVariables = preparedVariables.filter((prepared) => prepared.variable.variableType === "DURATION");
  if (durationVariables.length === 0) {
    return null;
  }

  const eligibleLines = lines.filter((line) => Number.isFinite(line.durationDays) && line.durationDays > 0);
  if (eligibleLines.length === 0) {
    return null;
  }

  const criticalPath = calculateWorkScheduleCriticalPath(
    eligibleLines.map((line) => ({
      budgetItemId: line.budgetItemId,
      itemCode: line.itemCode,
      description: line.description,
      unit: "dia",
      quantity: 1,
      unitPrice: 0,
      partial: 0,
      subBudgetId: line.subBudgetName,
      subBudgetName: line.subBudgetName,
      durationDays: line.durationDays,
      predecessor: line.predecessor,
      monthlyDistributions: [],
    })),
  );

  if (criticalPath.status !== "calculated") {
    return null;
  }

  return {
    baseProjectDurationDays: criticalPath.projectDurationDays,
    criticalItemCount: [...criticalPath.itemsByBudgetItemId.values()].filter((item) => item.isCritical).length,
    durationVariableIdsByItemId: new Map(
      durationVariables.map((prepared) => [prepared.variable.budgetItemId, prepared.variable.id]),
    ),
    lines: eligibleLines,
  };
}

function runScheduleIteration(
  preparedSchedule: PreparedScheduleSimulation,
  sampledValuesByVariableId: Map<string, number>,
) {
  const simulatedLines = preparedSchedule.lines.map((line) => {
    const variableId = preparedSchedule.durationVariableIdsByItemId.get(line.budgetItemId);
    const sampledDuration = variableId ? sampledValuesByVariableId.get(variableId) : null;

    return {
      budgetItemId: line.budgetItemId,
      itemCode: line.itemCode,
      description: line.description,
      unit: "dia",
      quantity: 1,
      unitPrice: 0,
      partial: 0,
      subBudgetId: line.subBudgetName,
      subBudgetName: line.subBudgetName,
      durationDays: sampledDuration == null ? line.durationDays : Math.max(1, Math.round(sampledDuration)),
      predecessor: line.predecessor,
      monthlyDistributions: [],
    };
  });

  const result = calculateWorkScheduleCriticalPath(simulatedLines);
  return result.status === "calculated" ? result.projectDurationDays : preparedSchedule.baseProjectDurationDays;
}

function buildScheduleDurationSummary(
  projectDurationDays: number[],
  preparedSchedule: PreparedScheduleSimulation | null,
): RiskScheduleDurationSummary | null {
  if (!preparedSchedule || projectDurationDays.length === 0) {
    return null;
  }

  return {
    iterations: projectDurationDays.length,
    baseProjectDurationDays: preparedSchedule.baseProjectDurationDays,
    meanDurationDays: roundFinancial(calculateMean(projectDurationDays)),
    medianDurationDays: roundFinancial(calculateMedian(projectDurationDays)),
    p80DurationDays: roundFinancial(calculatePercentile(projectDurationDays, 0.8)),
    p90DurationDays: roundFinancial(calculatePercentile(projectDurationDays, 0.9)),
    p95DurationDays: roundFinancial(calculatePercentile(projectDurationDays, 0.95)),
    minimumDurationDays: roundFinancial(Math.min(...projectDurationDays)),
    maximumDurationDays: roundFinancial(Math.max(...projectDurationDays)),
    criticalItemCount: preparedSchedule.criticalItemCount,
    histogramBins: buildHistogram(projectDurationDays),
    sCurvePoints: buildSCurve(projectDurationDays),
  };
}
