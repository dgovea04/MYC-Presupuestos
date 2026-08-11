import Decimal from "decimal.js";
import { addWorkDays, type CalendarExceptionMap } from "@/lib/work-schedule/calendar";
import { calculateWorkScheduleCriticalPath } from "@/lib/work-schedule/critical-path";
import { parseWorkSchedulePredecessors, tryParseWorkSchedulePredecessors, type WorkSchedulePredecessorReference } from "@/lib/work-schedule/predecessors";
import type {
  WorkScheduleCurvePointRecord,
  WorkScheduleLineRecord,
  WorkSchedulePeriodRangeRecord,
  WorkSchedulePeriodRecord,
  WorkScheduleResourceCalendarRow,
  WorkScheduleScaleRecord,
  WorkScheduleValuationCalendarRecord,
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

type BuildWorkScheduleViewOptions = {
  includeDerivedCalendars?: boolean;
};

const MAX_WORK_SCHEDULE_DAILY_TIMELINE_DAYS = 3660;
const MAX_WORK_SCHEDULE_DERIVED_CALENDAR_PERIODS = 240;
const MAX_REASONABLE_DEFAULT_PERFORMANCE_DURATION_DAYS = 365;
const SUSPICIOUS_DEFAULT_WORK_SCHEDULE_PERFORMANCE_UNITS = new Set([
  "M",
  "ML",
  "M2",
  "M3",
  "KG",
  "TN",
  "TON",
  "TONELADA",
  "TONELADAS",
]);

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

export function calculateWorkScheduleDurationDays(input: {
  quantity: number;
  performance: number | null | undefined;
  crew: number | null | undefined;
}) {
  if (input.performance == null || input.crew == null) {
    return null;
  }

  const performance = new Decimal(input.performance);
  const crew = new Decimal(input.crew);
  const quantity = new Decimal(input.quantity);

  if (performance.lte(0) || crew.lte(0) || quantity.lte(0)) {
    return null;
  }

  return quantity.dividedBy(performance.times(crew)).toDecimalPlaces(0, Decimal.ROUND_CEIL).toNumber();
}

export function hasSuspiciousDefaultWorkSchedulePerformance(input: {
  performance: number | null | undefined;
  unit: string | null | undefined;
  quantity?: number | null | undefined;
}) {
  if (input.performance == null) {
    return false;
  }

  if (!new Decimal(input.performance).equals(1)) {
    return false;
  }

  if (SUSPICIOUS_DEFAULT_WORK_SCHEDULE_PERFORMANCE_UNITS.has(normalizeWorkScheduleUnit(input.unit))) {
    return true;
  }

  if (input.quantity == null) {
    return false;
  }

  return new Decimal(input.quantity).gt(MAX_REASONABLE_DEFAULT_PERFORMANCE_DURATION_DAYS);
}

export function recalculateDependentWorkScheduleLines(
  lines: WorkScheduleLineRecord[],
  changedBudgetItemId: string,
  workDaysBitmask?: number,
  exceptionMap?: CalendarExceptionMap,
) {
  const nextLines = lines.map((line) => ({
    ...line,
    monthlyDistributions: line.monthlyDistributions.map((distribution) => ({ ...distribution })),
  }));
  const lineByCode = new Map(nextLines.map((line) => [line.itemCode, line]));
  const lineByBudgetItemId = new Map(nextLines.map((line) => [line.budgetItemId, line]));
  const changedLine = lineByBudgetItemId.get(changedBudgetItemId);

  if (!changedLine) {
    return nextLines;
  }

  const successorCodesByPredecessorCode = new Map<string, Set<string>>();

  for (const line of nextLines) {
    const parsedPredecessors = tryParseWorkSchedulePredecessors(line.predecessor);
    if (!parsedPredecessors) {
      continue;
    }

    for (const predecessor of parsedPredecessors) {
      const bucket = successorCodesByPredecessorCode.get(predecessor.code) ?? new Set<string>();
      bucket.add(line.itemCode);
      successorCodesByPredecessorCode.set(predecessor.code, bucket);
    }
  }

  const queue = [changedLine.itemCode];
  let remainingIterations = nextLines.length * nextLines.length;

  while (queue.length > 0) {
    const predecessorCode = queue.shift();
    if (!predecessorCode) {
      continue;
    }

    const successorCodes = successorCodesByPredecessorCode.get(predecessorCode);
    if (!successorCodes || successorCodes.size === 0) {
      continue;
    }

    for (const successorCode of successorCodes) {
      const successorLine = lineByCode.get(successorCode);
      if (!successorLine) {
        continue;
      }

      const recalculated = recalculateWorkScheduleLineFromPredecessors(successorLine, lineByCode, workDaysBitmask);
      if (!recalculated) {
        continue;
      }

      if (
        recalculated.startDate === successorLine.startDate &&
        recalculated.endDate === successorLine.endDate &&
        recalculated.durationDays === successorLine.durationDays
      ) {
        continue;
      }

      successorLine.startDate = recalculated.startDate;
      successorLine.endDate = recalculated.endDate;
      successorLine.durationDays = recalculated.durationDays;
      successorLine.monthlyDistributions = recalculated.monthlyDistributions;
      queue.push(successorLine.itemCode);

      remainingIterations -= 1;
      if (remainingIterations <= 0) {
        throw new Error("No se pudo recalcular el cronograma por una dependencia circular o inconsistente");
      }
    }
  }

  return nextLines;
}

export function recalculateWorkScheduleLineFromPredecessors(
  line: WorkScheduleLineRecord,
  lineByCode: Map<string, WorkScheduleLineRecord>,
  workDaysBitmask?: number,
) {
  if (!line.predecessor || line.durationDays == null || line.durationDays <= 0) {
    return null;
  }

  const parsedReferences = tryParseWorkSchedulePredecessors(line.predecessor);
  if (!parsedReferences || parsedReferences.length === 0) {
    return null;
  }

  return recalculateWorkScheduleLineFromReferences(line, parsedReferences, lineByCode, workDaysBitmask);
}

/**
 * Variant that accepts pre-parsed predecessor references to avoid redundant parsing.
 * Use when the caller has already validated/parsed the predecessor string
 * (e.g., via {@link tryParseWorkSchedulePredecessors}).
 */
export function recalculateWorkScheduleLineFromReferences(
  line: WorkScheduleLineRecord,
  predecessorReferences: WorkSchedulePredecessorReference[],
  lineByCode: Map<string, WorkScheduleLineRecord>,
  workDaysBitmask?: number,
) {
  if (predecessorReferences.length === 0 || line.durationDays == null || line.durationDays <= 0) {
    return null;
  }

  const constrainedStarts = predecessorReferences.map((reference) => {
    const predecessorLine = lineByCode.get(reference.code);
    if (!predecessorLine?.startDate || !predecessorLine.endDate) {
      return null;
    }

    const addDays = workDaysBitmask != null
      ? (date: string, days: number) => addWorkDays(date, days, workDaysBitmask)
      : addIsoDays;

    switch (reference.relation) {
      case "FS":
        return addDays(predecessorLine.endDate, reference.lagDays + 1);
      case "SS":
        return addDays(predecessorLine.startDate, reference.lagDays);
      case "FF":
        return line.durationDays == null
          ? null
          : addDays(predecessorLine.endDate, reference.lagDays - line.durationDays + 1);
      case "SF":
        return line.durationDays == null
          ? null
          : addDays(predecessorLine.startDate, reference.lagDays - line.durationDays + 1);
      default:
        return null;
    }
  });

  if (constrainedStarts.some((value) => value == null)) {
    return null;
  }

  let nextStartDate = constrainedStarts[0] ?? line.startDate ?? "";
  for (const constrainedStart of constrainedStarts) {
    if (constrainedStart && constrainedStart > nextStartDate) {
      nextStartDate = constrainedStart;
    }
  }

  if (!nextStartDate) {
    return null;
  }

  const nextEndDate = addIsoDays(nextStartDate, line.durationDays - 1);

  return {
    startDate: nextStartDate,
    endDate: nextEndDate,
    durationDays: line.durationDays,
    monthlyDistributions: buildWorkScheduleMonthlyDistributionsFromRange(nextStartDate, nextEndDate),
  };
}

export function buildWorkScheduleMonthlyDistributionsFromRange(startDate: string, endDate: string) {
  const safeEndDate = endDate >= startDate ? endDate : startDate;
  const months = collectMonthsInRange(startDate, safeEndDate);

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
  const difference = Number((100 - assigned).toFixed(4));
  const lastIndex = distributions.length - 1;

  distributions[lastIndex] = {
    ...distributions[lastIndex],
    percentage: Number((distributions[lastIndex].percentage + difference).toFixed(4)),
  };

  return distributions;
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
  } satisfies { currency: string; periods: WorkSchedulePeriodRecord[]; rows: WorkScheduleValuationCalendarRow[] };
}

export function buildWorkScheduleValuationCalendarSlice(input: ValuationCalendarInput & WorkSchedulePeriodRangeRecord): WorkScheduleValuationCalendarRecord {
  const fullPeriods = collectPeriods(input.lines);
  const filteredPeriods = fullPeriods.filter((period) => period.key >= input.fromPeriodKey && period.key <= input.toPeriodKey);
  const periodKeys = new Set(filteredPeriods.map((period) => period.key));
  const filteredRows = buildWorkScheduleValuationCalendar({
    currency: input.currency,
    lines: input.lines
      .map((line) => ({
        ...line,
        monthlyDistributions: line.monthlyDistributions.filter((distribution) => {
          const key = toPeriodKey(distribution.year, distribution.month);
          return periodKeys.has(key);
        }),
      }))
      .filter((line) => line.monthlyDistributions.length > 0),
  });

  return {
    periods: filteredPeriods,
    rows: filteredRows.rows,
    availableRange: {
      fromPeriodKey: fullPeriods[0]?.key ?? input.fromPeriodKey,
      toPeriodKey: fullPeriods.at(-1)?.key ?? input.toPeriodKey,
    },
    selectedRange: {
      fromPeriodKey: input.fromPeriodKey,
      toPeriodKey: input.toPeriodKey,
    },
    isPartial: true,
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

export function analyzeWorkScheduleScale(lines: WorkScheduleLineRecord[]): WorkScheduleScaleRecord {
  const periods = collectPeriods(lines);
  const timelineStart = getTimelineStart(lines);
  const timelineEnd = getTimelineEnd(lines);

  return {
    periodCount: periods.length,
    timelineDayCount: calculateTimelineDayCount(timelineStart, timelineEnd),
    canLoadDailyTimeline:
      calculateTimelineDayCount(timelineStart, timelineEnd) <= MAX_WORK_SCHEDULE_DAILY_TIMELINE_DAYS,
    canLoadDerivedCalendars: periods.length <= MAX_WORK_SCHEDULE_DERIVED_CALENDAR_PERIODS,
    firstPeriodKey: periods[0]?.key ?? null,
    lastPeriodKey: periods.at(-1)?.key ?? null,
  };
}

export function buildWorkScheduleView(
  input: WorkScheduleViewInput,
  options: BuildWorkScheduleViewOptions = {},
): WorkScheduleViewRecord {
  const includeDerivedCalendars = options.includeDerivedCalendars ?? true;
  const criticalPathResult = calculateWorkScheduleCriticalPath(input.lines);
  const lines = input.lines.map((line) => {
    const criticalPathItem = criticalPathResult.itemsByBudgetItemId.get(line.budgetItemId);

    return {
      ...line,
      criticalPath: criticalPathItem
        ? {
            earlyStartDay: criticalPathItem.earlyStartDay,
            earlyFinishDay: criticalPathItem.earlyFinishDay,
            lateStartDay: criticalPathItem.lateStartDay,
            lateFinishDay: criticalPathItem.lateFinishDay,
            totalSlackDays: criticalPathItem.totalSlackDays,
            isCritical: criticalPathItem.isCritical,
          }
        : null,
    };
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
  const scale = analyzeWorkScheduleScale(lines);
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
    groups: [...groupsMap.values()],
    valuationCalendar: includeDerivedCalendars
      ? buildWorkScheduleValuationCalendar({
          currency: input.currency,
          lines,
        })
      : null,
    resourceCalendar: includeDerivedCalendars
      ? buildWorkScheduleResourceCalendar({
          currency: input.currency,
          lines,
        })
      : null,
    curveSeries: includeDerivedCalendars
      ? buildWorkScheduleCurveSeries({
          periods,
          monthlyTotals,
        })
      : null,
    timeline: {
      startDate: getTimelineStart(lines),
      endDate: getTimelineEnd(lines),
    },
    scale,
    criticalPath: {
      status: criticalPathResult.status,
      projectDurationDays: criticalPathResult.projectDurationDays,
      scheduledItemCount: criticalPathResult.itemsByBudgetItemId.size,
      criticalItemCount: [...criticalPathResult.itemsByBudgetItemId.values()].filter((item) => item.isCritical).length,
      issues: criticalPathResult.issues,
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

function normalizeWorkScheduleUnit(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9]/g, "")
    .toUpperCase();
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

function collectMonthsInRange(startDate: string, endDate: string) {
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

function addIsoDays(startDate: string, days: number) {
  const date = new Date(`${startDate}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
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

function calculateTimelineDayCount(startDate: string | null, endDate: string | null) {
  if (!startDate || !endDate) {
    return 0;
  }

  return diffInDays(parseIsoDate(startDate), parseIsoDate(endDate)) + 1;
}
