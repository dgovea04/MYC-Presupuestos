import type { EditableLine } from "../types";

export function getOverviewMeasuredHeightsStorageKey(budgetId: string) {
  return `work-schedule-overview-measured-heights:${budgetId}`;
}

export function sanitizeMeasuredHeightsMap(input: unknown) {
  if (!input || typeof input !== "object") {
    return {};
  }

  const next: Record<string, number> = {};
  for (const [key, value] of Object.entries(input)) {
    if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
      continue;
    }

    next[key] = Math.round(value);
  }

  return next;
}

export function compareIsoDates(left: string, right: string) {
  return left.localeCompare(right);
}

export function createDistributionFromStartDate(startDate: string) {
  if (startDate) {
    const [year, month] = startDate.split("-").map((segment) => Number(segment));
    if (Number.isFinite(year) && Number.isFinite(month)) {
      return {
        year,
        month,
        percentage: 100,
      };
    }
  }

  const currentDate = new Date();
  return {
    year: currentDate.getUTCFullYear(),
    month: currentDate.getUTCMonth() + 1,
    percentage: 100,
  };
}

export function buildInitialDistributionsFromRange(startDate: string, endDate: string) {
  if (!startDate) {
    return [createDistributionFromStartDate("")];
  }

  const safeEndDate = endDate && compareIsoDates(endDate, startDate) >= 0 ? endDate : startDate;
  const months = listMonthsInRange(startDate, safeEndDate);

  if (months.length <= 1) {
    return [createDistributionFromStartDate(startDate)];
  }

  const basePercentage = 100 / months.length;
  const roundedBase = Number(basePercentage.toFixed(4));
  const distributions = months.map((month) => ({
    year: month.year,
    month: month.month,
    percentage: roundedBase,
  }));

  const assigned = distributions.reduce((sum, distribution) => sum + distribution.percentage, 0);
  const difference = Number((100 - assigned).toFixed(4));
  const lastIndex = distributions.length - 1;

  if (lastIndex >= 0 && difference !== 0) {
    distributions[lastIndex] = {
      ...distributions[lastIndex],
      percentage: Number((distributions[lastIndex].percentage + difference).toFixed(4)),
    };
  }

  return distributions;
}

export function shouldHydrateInitialDistribution(previousLine: EditableLine) {
  if (!previousLine.startDate) {
    return previousLine.monthlyDistributions.length === 1 && Number(previousLine.monthlyDistributions[0]?.percentage) === 100;
  }

  const expected = buildInitialDistributionsFromRange(previousLine.startDate, previousLine.endDate);
  if (expected.length !== previousLine.monthlyDistributions.length) {
    return false;
  }

  return expected.every((distribution, index) => {
    const current = previousLine.monthlyDistributions[index];
    return (
      current?.year === distribution.year &&
      current?.month === distribution.month &&
      Number(current?.percentage) === distribution.percentage
    );
  });
}

export function listMonthsInRange(startDate: string, endDate: string) {
  const months: Array<{ year: number; month: number }> = [];
  const cursor = new Date(`${startDate}T00:00:00.000Z`);
  const end = new Date(`${endDate}T00:00:00.000Z`);

  cursor.setUTCDate(1);
  end.setUTCDate(1);

  while (cursor.getTime() <= end.getTime()) {
    months.push({
      year: cursor.getUTCFullYear(),
      month: cursor.getUTCMonth() + 1,
    });
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }

  return months;
}

export function addIsoDays(startDate: string, days: number) {
  const date = new Date(`${startDate}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    return startDate;
  }

  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
