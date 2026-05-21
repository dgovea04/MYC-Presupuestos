import Decimal from "decimal.js";
import type {
  WorkScheduleCurvePointRecord,
  WorkScheduleLineRecord,
  WorkSchedulePeriodRecord,
  WorkScheduleResourceCalendarRow,
  WorkScheduleValuationCalendarRow,
  WorkScheduleViewRecord,
} from "@/types/work-schedule";

const HUNDRED = new Decimal(100);
const ZERO = new Decimal(0);

type WorkScheduleInputValidation = {
  startDate: string;
  endDate: string;
  durationDays: number;
  monthlyDistributions: Array<{
    year: number;
    month: number;
    percentage: number;
  }>;
};

type ValuationCalendarInput = {
  currency: string;
  lines: WorkScheduleLineRecord[];
};

type ResourceCalendarInput = {
  currency: string;
  lines: WorkScheduleLineRecord[];
};

type CurveSeriesInput = {
  periods: WorkSchedulePeriodRecord[];
  monthlyTotals: Record<string, number>;
};

type WorkScheduleViewInput = {
  budgetId: string;
  budgetName: string;
  projectName: string;
  currency: string;
  lines: WorkScheduleLineRecord[];
};

export function validateWorkScheduleInput(input: WorkScheduleInputValidation) {
  const startDate = parseIsoDate(input.startDate);
  const endDate = parseIsoDate(input.endDate);

  if (endDate.getTime() < startDate.getTime()) {
    throw new Error("La fecha de fin no puede ser menor a la fecha de inicio");
  }

  const expectedDuration = diffInDays(startDate, endDate) + 1;
  if (input.durationDays !== expectedDuration) {
    throw new Error("La duracion no coincide con el rango entre inicio y fin");
  }

  const totalPercentage = input.monthlyDistributions.reduce(
    (sum, distribution) => sum.plus(distribution.percentage),
    ZERO,
  );

  if (!totalPercentage.equals(HUNDRED)) {
    throw new Error("La distribucion mensual debe cerrar en 100.0000%");
  }
}

export function buildWorkScheduleValuationCalendar(input: ValuationCalendarInput) {
  const periods = collectPeriods(input.lines);
  const rows = input.lines.map<WorkScheduleValuationCalendarRow>((line) => {
    const periodAmounts = createEmptyPeriodMap(periods);

    for (const distribution of line.monthlyDistributions) {
      const key = toPeriodKey(distribution.year, distribution.month);
      const amount = toAmount(line.partial, distribution.percentage);
      periodAmounts[key] = roundDecimal(amount, 4);
    }

    return {
      scheduleItemId: line.scheduleItemId,
      budgetItemId: line.budgetItemId,
      itemCode: line.itemCode,
      description: line.description,
      unit: line.unit,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      partial: line.partial,
      subBudgetName: line.subBudgetName,
      rowTotal: roundDecimal(
        Object.values(periodAmounts).reduce((sum, value) => sum.plus(value), ZERO),
        4,
      ),
      periodAmounts,
    };
  });

  return {
    currency: input.currency,
    periods,
    rows,
  };
}

export function buildWorkScheduleResourceCalendar(input: ResourceCalendarInput) {
  const periods = collectPeriods(input.lines);
  const rowsByResource = new Map<string, WorkScheduleResourceCalendarRow>();

  for (const line of input.lines) {
    for (const resource of line.resources ?? []) {
      const existing = rowsByResource.get(resource.resourceId) ?? {
        resourceId: resource.resourceId,
        code: resource.code,
        description: resource.description,
        unit: resource.unit,
        quantity: 0,
        unitPrice: resource.unitPrice,
        partial: 0,
        periodQuantities: createEmptyPeriodMap(periods),
        periodAmounts: createEmptyPeriodMap(periods),
      };

      existing.quantity = roundDecimal(new Decimal(existing.quantity).plus(resource.totalQuantity), 4);
      existing.partial = roundDecimal(new Decimal(existing.partial).plus(resource.totalCost), 4);

      for (const distribution of line.monthlyDistributions) {
        const key = toPeriodKey(distribution.year, distribution.month);
        const quantity = toAmount(resource.totalQuantity, distribution.percentage);
        const amount = toAmount(resource.totalCost, distribution.percentage);
        existing.periodQuantities[key] = roundDecimal(new Decimal(existing.periodQuantities[key] ?? 0).plus(quantity), 4);
        existing.periodAmounts[key] = roundDecimal(new Decimal(existing.periodAmounts[key] ?? 0).plus(amount), 4);
      }

      rowsByResource.set(resource.resourceId, existing);
    }
  }

  return {
    currency: input.currency,
    periods,
    rows: [...rowsByResource.values()].sort((left, right) => left.description.localeCompare(right.description, "es")),
  };
}

export function buildWorkScheduleCurveSeries(input: CurveSeriesInput): WorkScheduleCurvePointRecord[] {
  const totalAmount = input.periods.reduce(
    (sum, period) => sum.plus(input.monthlyTotals[period.key] ?? 0),
    ZERO,
  );

  let accumulated = ZERO;

  return input.periods.map((period) => {
    const monthlyAmount = new Decimal(input.monthlyTotals[period.key] ?? 0);
    accumulated = accumulated.plus(monthlyAmount);

    return {
      year: period.year,
      month: period.month,
      key: period.key,
      monthlyAmount: roundDecimal(monthlyAmount, 4),
      accumulatedAmount: roundDecimal(accumulated, 4),
      accumulatedPercentage: totalAmount.equals(ZERO)
        ? 0
        : roundDecimal(accumulated.dividedBy(totalAmount).times(HUNDRED), 4),
    };
  });
}

export function buildWorkScheduleView(input: WorkScheduleViewInput): WorkScheduleViewRecord {
  const lines = [...input.lines].sort((left, right) => {
    const subBudgetComparison = left.subBudgetName.localeCompare(right.subBudgetName, "es");
    if (subBudgetComparison !== 0) {
      return subBudgetComparison;
    }

    return left.itemCode.localeCompare(right.itemCode, "es", { numeric: true });
  });

  const groupsMap = new Map<string, WorkScheduleViewRecord["groups"][number]>();
  for (const line of lines) {
    const group = groupsMap.get(line.subBudgetId) ?? {
      subBudgetId: line.subBudgetId,
      subBudgetName: line.subBudgetName,
      totalAmount: 0,
      lines: [],
      rows: [],
    };

    group.lines.push(line);
    group.rows.push({ kind: "line", rowId: line.budgetItemId, line });
    group.totalAmount = roundDecimal(new Decimal(group.totalAmount).plus(line.partial), 4);
    groupsMap.set(line.subBudgetId, group);
  }

  const periods = collectPeriods(lines);
  const monthlyTotals = createEmptyPeriodMap(periods);

  for (const line of lines) {
    for (const distribution of line.monthlyDistributions) {
      const key = toPeriodKey(distribution.year, distribution.month);
      monthlyTotals[key] = roundDecimal(
        new Decimal(monthlyTotals[key] ?? 0).plus(toAmount(line.partial, distribution.percentage)),
        4,
      );
    }
  }

  return {
    budgetId: input.budgetId,
    budgetName: input.budgetName,
    projectName: input.projectName,
    currency: input.currency,
    groups: [...groupsMap.values()].sort((left, right) => left.subBudgetName.localeCompare(right.subBudgetName, "es")),
    valuationCalendar: buildWorkScheduleValuationCalendar({
      currency: input.currency,
      lines,
    }),
    resourceCalendar: buildWorkScheduleResourceCalendar({
      currency: input.currency,
      lines,
    }),
    curveSeries: buildWorkScheduleCurveSeries({
      periods,
      monthlyTotals,
    }),
    timeline: {
      startDate: getTimelineStart(lines),
      endDate: getTimelineEnd(lines),
    },
  };
}

function collectPeriods(lines: WorkScheduleLineRecord[]) {
  const periods = new Map<string, WorkSchedulePeriodRecord>();

  for (const line of lines) {
    for (const distribution of line.monthlyDistributions) {
      const key = toPeriodKey(distribution.year, distribution.month);
      if (!periods.has(key)) {
        periods.set(key, { year: distribution.year, month: distribution.month, key });
      }
    }
  }

  return [...periods.values()].sort(comparePeriods);
}

function comparePeriods(left: WorkSchedulePeriodRecord, right: WorkSchedulePeriodRecord) {
  if (left.year !== right.year) {
    return left.year - right.year;
  }

  return left.month - right.month;
}

function createEmptyPeriodMap(periods: WorkSchedulePeriodRecord[]) {
  return Object.fromEntries(periods.map((period) => [period.key, 0])) as Record<string, number>;
}

function toPeriodKey(year: number, month: number) {
  return `${year}-${month.toString().padStart(2, "0")}`;
}

function toAmount(baseAmount: number, percentage: number) {
  return new Decimal(baseAmount).times(new Decimal(percentage).dividedBy(HUNDRED));
}

function roundDecimal(value: Decimal.Value, decimalPlaces: number) {
  return new Decimal(value).toDecimalPlaces(decimalPlaces).toNumber();
}

function parseIsoDate(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    throw new Error("Fecha invalida");
  }

  return date;
}

function diffInDays(startDate: Date, endDate: Date) {
  const millisecondsPerDay = 1000 * 60 * 60 * 24;
  return Math.round((endDate.getTime() - startDate.getTime()) / millisecondsPerDay);
}

function getTimelineStart(lines: WorkScheduleLineRecord[]) {
  let earliestScheduledDate: Date | null = null;
  let earliestDistributionDate: Date | null = null;

  for (const line of lines) {
    if (line.startDate) {
      const startDate = parseIsoDate(line.startDate);
      if (!earliestScheduledDate || startDate.getTime() < earliestScheduledDate.getTime()) {
        earliestScheduledDate = startDate;
      }
    }

    for (const distribution of line.monthlyDistributions) {
      const distributionStart = new Date(Date.UTC(distribution.year, distribution.month - 1, 1));
      if (!earliestDistributionDate || distributionStart.getTime() < earliestDistributionDate.getTime()) {
        earliestDistributionDate = distributionStart;
      }
    }
  }

  const timelineStart = earliestScheduledDate ?? earliestDistributionDate;
  return timelineStart ? timelineStart.toISOString().slice(0, 10) : null;
}

function getTimelineEnd(lines: WorkScheduleLineRecord[]) {
  let latestDate: Date | null = null;

  for (const line of lines) {
    let lineLatestDate: Date | null = line.endDate ? parseIsoDate(line.endDate) : null;

    if (!lineLatestDate) {
      for (const distribution of line.monthlyDistributions) {
        const distributionEnd = new Date(Date.UTC(distribution.year, distribution.month, 0));
        if (!lineLatestDate || distributionEnd.getTime() > lineLatestDate.getTime()) {
          lineLatestDate = distributionEnd;
        }
      }
    }

    if (!lineLatestDate) {
      continue;
    }

    if (!latestDate || lineLatestDate.getTime() > latestDate.getTime()) {
      latestDate = lineLatestDate;
    }
  }

  return latestDate ? latestDate.toISOString().slice(0, 10) : null;
}
