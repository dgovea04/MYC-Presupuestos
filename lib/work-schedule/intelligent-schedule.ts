import Decimal from "decimal.js";
import { formatGeneratedPredecessor } from "@/lib/work-schedule/predecessors";
import type {
  WorkScheduleGenerationIssueRecord,
  WorkScheduleGenerationSummaryRecord,
  WorkScheduleLineRecord,
  WorkScheduleMonthlyDistributionRecord,
} from "@/types/work-schedule";

type GeneratedScheduleLine = {
  budgetItemId: string;
  itemCode: string;
  startDate: string;
  endDate: string;
  durationDays: number;
  predecessor: string | null;
  crew: number | null;
  monthlyDistributions: WorkScheduleMonthlyDistributionRecord[];
};

export function buildIntelligentWorkScheduleBase({
  baseStartDate,
  lines,
}: {
  baseStartDate: string;
  lines: WorkScheduleLineRecord[];
}) {
  const issues: WorkScheduleGenerationIssueRecord[] = [];
  const generatedItems: GeneratedScheduleLine[] = [];
  const linesByGroup = new Map<string, WorkScheduleLineRecord[]>();

  for (const line of lines) {
    const key = line.subBudgetId;
    const bucket = linesByGroup.get(key) ?? [];
    bucket.push(line);
    linesByGroup.set(key, bucket);
  }

  for (const groupLines of [...linesByGroup.values()]) {
    const orderedGroupLines = [...groupLines].sort((left, right) => {
      const leftSortOrder = left.sortOrder ?? Number.MAX_SAFE_INTEGER;
      const rightSortOrder = right.sortOrder ?? Number.MAX_SAFE_INTEGER;
      if (leftSortOrder !== rightSortOrder) {
        return leftSortOrder - rightSortOrder;
      }

      return left.itemCode.localeCompare(right.itemCode, "es", { numeric: true });
    });

    let groupCursor = baseStartDate;
    let previousGeneratedLine: GeneratedScheduleLine | null = null;

    for (const line of orderedGroupLines) {
      const durationDays = calculateSmartDurationDays(line);
      if (durationDays == null) {
        issues.push({
          budgetItemId: line.budgetItemId,
          itemCode: line.itemCode,
          reason: "La partida no tiene rendimiento o cuadrilla suficiente para calcular duracion",
        });
        continue;
      }

      const startDate = groupCursor;
      const endDate = addDaysInclusive(startDate, durationDays - 1);
      const generatedLine: GeneratedScheduleLine = {
        budgetItemId: line.budgetItemId,
        itemCode: line.itemCode,
        startDate,
        endDate,
        durationDays,
        predecessor: previousGeneratedLine ? formatGeneratedPredecessor(previousGeneratedLine.itemCode) : null,
        crew: line.crew ?? null,
        monthlyDistributions: buildMonthlyDistributionsFromRange(startDate, endDate),
      };

      generatedItems.push(generatedLine);
      previousGeneratedLine = generatedLine;
      groupCursor = addDaysInclusive(endDate, 1);
    }
  }

  const summary: WorkScheduleGenerationSummaryRecord = {
    generatedCount: generatedItems.length,
    pendingCount: issues.length,
    issues,
  };

  return {
    generatedItems,
    summary,
  };
}

function calculateSmartDurationDays(line: WorkScheduleLineRecord) {
  if (line.performance == null || line.crew == null) {
    return null;
  }

  const performance = new Decimal(line.performance);
  const crew = new Decimal(line.crew);
  const quantity = new Decimal(line.quantity);

  if (performance.lte(0) || crew.lte(0) || quantity.lte(0)) {
    return null;
  }

  return quantity.dividedBy(performance.times(crew)).toDecimalPlaces(0, Decimal.ROUND_CEIL).toNumber();
}

function buildMonthlyDistributionsFromRange(startDate: string, endDate: string): WorkScheduleMonthlyDistributionRecord[] {
  const months = listMonthsInRange(startDate, endDate);

  if (months.length <= 1) {
    const [year, month] = startDate.split("-").map((segment) => Number(segment));
    return [{ year, month, percentage: 100 }];
  }

  const basePercentage = Number((100 / months.length).toFixed(4));
  const distributions = months.map(({ year, month }) => ({
    year,
    month,
    percentage: basePercentage,
  }));
  const assigned = distributions.reduce((sum, distribution) => sum + distribution.percentage, 0);
  const lastIndex = distributions.length - 1;
  distributions[lastIndex] = {
    ...distributions[lastIndex],
    percentage: Number((distributions[lastIndex].percentage + (100 - assigned)).toFixed(4)),
  };

  return distributions;
}

function listMonthsInRange(startDate: string, endDate: string) {
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

function addDaysInclusive(isoDate: string, daysToAdd: number) {
  const date = new Date(`${isoDate}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + daysToAdd);
  return date.toISOString().slice(0, 10);
}
