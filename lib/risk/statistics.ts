import type { RiskHistogramBin, RiskSCurvePoint } from "@/types/risk";

export function sortNumeric(values: number[]): number[] {
  return [...values].sort((left, right) => left - right);
}

export function roundFinancial(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round((value + Number.EPSILON) * 10000) / 10000;
}

export function calculateMean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function calculatePercentile(values: number[], percentile: number): number {
  if (values.length === 0) return 0;

  const sorted = sortNumeric(values);
  if (percentile <= 0) return sorted[0] ?? 0;
  if (percentile >= 1) return sorted.at(-1) ?? 0;

  const index = (sorted.length - 1) * percentile;
  const lowerIndex = Math.floor(index);
  const upperIndex = Math.ceil(index);
  const lower = sorted[lowerIndex] ?? 0;
  const upper = sorted[upperIndex] ?? lower;
  const weight = index - lowerIndex;

  return lower + (upper - lower) * weight;
}

export function calculateMedian(values: number[]): number {
  return calculatePercentile(values, 0.5);
}

export function calculateVariance(values: number[]): number {
  if (values.length === 0) return 0;

  const mean = calculateMean(values);
  return values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
}

export function calculateStandardDeviation(values: number[]): number {
  return Math.sqrt(calculateVariance(values));
}

export function calculateSkewness(values: number[]): number {
  if (values.length === 0) return 0;

  const mean = calculateMean(values);
  const standardDeviation = calculateStandardDeviation(values);
  if (standardDeviation === 0) return 0;

  return values.reduce((sum, value) => sum + ((value - mean) / standardDeviation) ** 3, 0) / values.length;
}

export function calculateKurtosis(values: number[]): number {
  if (values.length === 0) return 0;

  const mean = calculateMean(values);
  const standardDeviation = calculateStandardDeviation(values);
  if (standardDeviation === 0) return 0;

  const fourthMoment =
    values.reduce((sum, value) => sum + ((value - mean) / standardDeviation) ** 4, 0) / values.length;
  return fourthMoment - 3;
}

export function buildHistogram(values: number[], requestedBinCount = 30): RiskHistogramBin[] {
  if (values.length === 0) return [];

  const sorted = sortNumeric(values);
  const min = sorted[0] ?? 0;
  const max = sorted.at(-1) ?? min;
  const binCount = Math.max(1, Math.floor(requestedBinCount));

  if (min === max) {
    return [
      {
        min: roundFinancial(min),
        max: roundFinancial(max),
        midpoint: roundFinancial(min),
        frequency: values.length,
        probability: 1,
      },
    ];
  }

  const width = (max - min) / binCount;
  const bins: RiskHistogramBin[] = Array.from({ length: binCount }, (_, index) => {
    const binMin = min + width * index;
    const binMax = index === binCount - 1 ? max : binMin + width;

    return {
      min: roundFinancial(binMin),
      max: roundFinancial(binMax),
      midpoint: roundFinancial((binMin + binMax) / 2),
      frequency: 0,
      probability: 0,
    };
  });

  for (const value of values) {
    const rawIndex = Math.floor((value - min) / width);
    const index = Math.min(Math.max(rawIndex, 0), binCount - 1);
    const bin = bins[index];
    if (bin) {
      bin.frequency += 1;
    }
  }

  return bins.map((bin) => ({
    ...bin,
    probability: bin.frequency / values.length,
  }));
}

export function buildSCurve(values: number[], requestedPointCount = 100): RiskSCurvePoint[] {
  if (values.length === 0) return [];

  const sorted = sortNumeric(values);
  const pointCount = Math.min(Math.max(1, Math.floor(requestedPointCount)), sorted.length);

  if (pointCount === 1) {
    return [{ cost: roundFinancial(sorted[0] ?? 0), cumulativeProbability: 1 }];
  }

  return Array.from({ length: pointCount }, (_, index) => {
    const sortedIndex = Math.round((index / (pointCount - 1)) * (sorted.length - 1));

    return {
      cost: roundFinancial(sorted[sortedIndex] ?? 0),
      cumulativeProbability: (sortedIndex + 1) / sorted.length,
    };
  });
}
