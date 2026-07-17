import { recalculateDependentWorkScheduleLines } from "@/lib/calculations/work-schedule";
import type { WorkScheduleLineRecord } from "@/types/work-schedule";

export type WorkScheduleRescheduleImpact = {
  budgetItemId: string;
  itemCode: string;
  description: string;
  previousStartDate: string | null;
  previousEndDate: string | null;
  nextStartDate: string | null;
  nextEndDate: string | null;
  deltaDays: number;
  isCritical: boolean;
};

function diffInDays(start: string | null | undefined, end: string | null | undefined): number {
  if (!start || !end) return 0;
  const startDate = new Date(`${start}T00:00:00.000Z`);
  const endDate = new Date(`${end}T00:00:00.000Z`);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return 0;
  return Math.round((endDate.getTime() - startDate.getTime()) / 86400000);
}

/**
 * Build a preview of the impact of changing a work schedule line on its dependents.
 * Returns only the dependents whose dates changed.
 */
export function buildWorkScheduleReschedulePreview(args: {
  lines: WorkScheduleLineRecord[];
  changedBudgetItemId: string;
  workDaysBitmask?: number;
}): WorkScheduleRescheduleImpact[] {
  const { lines, changedBudgetItemId, workDaysBitmask } = args;

  const originalLines = new Map(lines.map((line) => [line.budgetItemId, line]));
  const recalculatedLines = recalculateDependentWorkScheduleLines(lines, changedBudgetItemId, workDaysBitmask);

  const impacts: WorkScheduleRescheduleImpact[] = [];

  for (const nextLine of recalculatedLines) {
    if (nextLine.budgetItemId === changedBudgetItemId) continue;

    const previousLine = originalLines.get(nextLine.budgetItemId);
    if (!previousLine) continue;

    const previousStartDate = previousLine.startDate ?? null;
    const previousEndDate = previousLine.endDate ?? null;
    const nextStartDate = nextLine.startDate ?? null;
    const nextEndDate = nextLine.endDate ?? null;

    const startChanged = previousStartDate !== nextStartDate;
    const endChanged = previousEndDate !== nextEndDate;

    if (!startChanged && !endChanged) continue;

    const deltaDays = diffInDays(previousStartDate, nextStartDate);

    impacts.push({
      budgetItemId: nextLine.budgetItemId,
      itemCode: nextLine.itemCode,
      description: nextLine.description,
      previousStartDate,
      previousEndDate,
      nextStartDate,
      nextEndDate,
      deltaDays,
      isCritical: nextLine.criticalPath?.isCritical ?? false,
    });
  }

  return impacts;
}
