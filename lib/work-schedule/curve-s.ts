import Decimal from "decimal.js";
import type { WorkScheduleLineRecord, WorkScheduleMonthlyDistributionRecord } from "@/types/work-schedule";

export type WorkScheduleCurvePoint = {
  period: string;
  plannedPercent: number;
  actualPercent: number;
};

function toDecimal(value: number | null | undefined): Decimal {
  if (value == null) return new Decimal(0);
  try {
    return new Decimal(value);
  } catch {
    return new Decimal(0);
  }
}

function periodKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

function getLinePeriodKeys(line: WorkScheduleLineRecord): Array<{ year: number; month: number }> {
  if (line.monthlyDistributions.length > 0) {
    return line.monthlyDistributions.map((d) => ({ year: d.year, month: d.month }));
  }

  const startDate = line.startDate;
  const endDate = line.endDate;
  if (!startDate || !endDate) return [];

  const start = new Date(`${startDate}T00:00:00.000Z`);
  const end = new Date(`${endDate}T00:00:00.000Z`);
  const periods: Array<{ year: number; month: number }> = [];

  const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
  while (cursor.getTime() <= end.getTime()) {
    periods.push({ year: cursor.getUTCFullYear(), month: cursor.getUTCMonth() + 1 });
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }

  return periods;
}

function distributeLineAmountByPeriod(
  line: WorkScheduleLineRecord,
): Map<string, Decimal> {
  const result = new Map<string, Decimal>();
  const partial = toDecimal(line.partial);

  if (line.monthlyDistributions.length > 0) {
    for (const distribution of line.monthlyDistributions) {
      const key = periodKey(distribution.year, distribution.month);
      const amount = partial.mul(distribution.percentage).div(100);
      result.set(key, (result.get(key) ?? new Decimal(0)).add(amount));
    }
    return result;
  }

  const periods = getLinePeriodKeys(line);
  if (periods.length === 0) return result;

  const amountPerPeriod = partial.div(periods.length);
  for (const period of periods) {
    const key = periodKey(period.year, period.month);
    result.set(key, (result.get(key) ?? new Decimal(0)).add(amountPerPeriod));
  }

  return result;
}

/**
 * Build planned vs actual Curve S series.
 * Planned series uses the line partial distributed by period.
 * Actual series multiplies each period contribution by percentComplete / 100.
 */
export function buildPlannedVsActualCurveSeries(args: {
  lines: WorkScheduleLineRecord[];
  periods: { year: number; month: number }[];
}): WorkScheduleCurvePoint[] {
  const { lines, periods } = args;

  const periodKeys = periods.map((p) => periodKey(p.year, p.month));
  const plannedByPeriod = new Map<string, Decimal>();
  const actualByPeriod = new Map<string, Decimal>();
  let totalPartial = new Decimal(0);

  for (const line of lines) {
    const partial = toDecimal(line.partial);
    if (partial.lessThanOrEqualTo(0)) continue;

    totalPartial = totalPartial.add(partial);
    const linePlanned = distributeLineAmountByPeriod(line);
    const percentComplete = Math.min(100, Math.max(0, line.percentComplete ?? 0));

    for (const [key, amount] of linePlanned.entries()) {
      plannedByPeriod.set(key, (plannedByPeriod.get(key) ?? new Decimal(0)).add(amount));
      actualByPeriod.set(
        key,
        (actualByPeriod.get(key) ?? new Decimal(0)).add(amount.mul(percentComplete).div(100)),
      );
    }
  }

  let plannedAccumulated = new Decimal(0);
  let actualAccumulated = new Decimal(0);

  return periodKeys.map((key) => {
    const planned = plannedByPeriod.get(key) ?? new Decimal(0);
    const actual = actualByPeriod.get(key) ?? new Decimal(0);

    plannedAccumulated = plannedAccumulated.add(planned);
    actualAccumulated = actualAccumulated.add(actual);

    return {
      period: key,
      plannedPercent: totalPartial.greaterThan(0)
        ? plannedAccumulated.div(totalPartial).mul(100).toNumber()
        : 0,
      actualPercent: totalPartial.greaterThan(0)
        ? actualAccumulated.div(totalPartial).mul(100).toNumber()
        : 0,
    };
  });
}
