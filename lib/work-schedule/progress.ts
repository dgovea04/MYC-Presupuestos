import Decimal from "decimal.js";
import type { WorkScheduleLineRecord } from "@/types/work-schedule";

export type WorkScheduleProgressStatus = "ahead" | "on_track" | "behind" | "not_started";

export type WorkScheduleProgressSummary = {
  plannedPercent: number;
  actualPercent: number;
  variancePoints: number;
  status: WorkScheduleProgressStatus;
};

export type WorkScheduleDeviationKind =
  | "late"
  | "ahead"
  | "missing_actual_progress"
  | "critical_low_progress"
  | "baseline_variance";

export type WorkScheduleDeviation = {
  budgetItemId: string;
  itemCode: string;
  description: string;
  kind: WorkScheduleDeviationKind;
  message: string;
};

function toDecimal(value: number | null | undefined): Decimal {
  if (value == null) return new Decimal(0);
  try {
    return new Decimal(value);
  } catch {
    return new Decimal(0);
  }
}

function clampPercent(value: number): number {
  return Math.min(100, Math.max(0, value));
}

/**
 * Calculate weighted progress summary for a set of work schedule lines.
 * Planned percent is derived from the elapsed time between startDate and asOfDate.
 * Actual percent is derived from weighted percentComplete * partial.
 */
export function calculateWorkScheduleProgressSummary(args: {
  lines: WorkScheduleLineRecord[];
  asOfDate: string;
}): WorkScheduleProgressSummary {
  const { lines, asOfDate } = args;

  if (lines.length === 0) {
    return { plannedPercent: 0, actualPercent: 0, variancePoints: 0, status: "not_started" };
  }

  const asOf = new Date(`${asOfDate}T00:00:00.000Z`);
  let totalPartial = new Decimal(0);
  let weightedActual = new Decimal(0);
  let weightedPlanned = new Decimal(0);

  for (const line of lines) {
    const partial = toDecimal(line.partial);
    if (partial.lessThanOrEqualTo(0)) continue;

    totalPartial = totalPartial.add(partial);

    const actualPercent = clampPercent(line.percentComplete ?? 0);
    weightedActual = weightedActual.add(partial.mul(actualPercent));

    const plannedPercent = calculatePlannedPercentForLine(line, asOf);
    weightedPlanned = weightedPlanned.add(partial.mul(plannedPercent));
  }

  if (totalPartial.lessThanOrEqualTo(0)) {
    return { plannedPercent: 0, actualPercent: 0, variancePoints: 0, status: "not_started" };
  }

  const plannedPercent = weightedPlanned.div(totalPartial).toNumber();
  const actualPercent = weightedActual.div(totalPartial).div(100).toNumber() * 100;
  const variancePoints = actualPercent - plannedPercent;

  let status: WorkScheduleProgressStatus = "on_track";
  if (actualPercent <= 0) {
    status = "not_started";
  } else if (variancePoints < -5) {
    status = "behind";
  } else if (variancePoints > 5) {
    status = "ahead";
  }

  return {
    plannedPercent: clampPercent(plannedPercent),
    actualPercent: clampPercent(actualPercent),
    variancePoints,
    status,
  };
}

function calculatePlannedPercentForLine(line: WorkScheduleLineRecord, asOf: Date): number {
  const startDate = line.startDate ? new Date(`${line.startDate}T00:00:00.000Z`) : null;
  const endDate = line.endDate ? new Date(`${line.endDate}T00:00:00.000Z`) : null;

  if (!startDate || !endDate) return 0;
  if (asOf.getTime() < startDate.getTime()) return 0;
  if (asOf.getTime() >= endDate.getTime()) return 100;

  const totalDuration = endDate.getTime() - startDate.getTime();
  if (totalDuration <= 0) return 100;

  const elapsed = asOf.getTime() - startDate.getTime();
  return clampPercent((elapsed / totalDuration) * 100);
}

/**
 * Detect deviations in work schedule lines.
 */
export function detectWorkScheduleDeviations(args: {
  lines: WorkScheduleLineRecord[];
  asOfDate: string;
}): WorkScheduleDeviation[] {
  const { lines, asOfDate } = args;
  const deviations: WorkScheduleDeviation[] = [];
  const asOf = new Date(`${asOfDate}T00:00:00.000Z`);

  for (const line of lines) {
    const startDate = line.startDate ? new Date(`${line.startDate}T00:00:00.000Z`) : null;
    const endDate = line.endDate ? new Date(`${line.endDate}T00:00:00.000Z`) : null;
    const actualStartDate = line.actualStartDate ? new Date(`${line.actualStartDate}T00:00:00.000Z`) : null;
    const actualEndDate = line.actualEndDate ? new Date(`${line.actualEndDate}T00:00:00.000Z`) : null;
    const percentComplete = line.percentComplete ?? 0;

    // Missing actual progress
    if (startDate && asOf.getTime() >= startDate.getTime() && percentComplete === 0 && actualStartDate == null) {
      deviations.push({
        budgetItemId: line.budgetItemId,
        itemCode: line.itemCode,
        description: line.description,
        kind: "missing_actual_progress",
        message: "Partida programada sin avance real registrado",
      });
    }

    // Late: actual end date after planned end date
    if (endDate && actualEndDate && actualEndDate.getTime() > endDate.getTime()) {
      deviations.push({
        budgetItemId: line.budgetItemId,
        itemCode: line.itemCode,
        description: line.description,
        kind: "late",
        message: "Fin real posterior al fin programado",
      });
    }

    // Ahead: actual end date before planned end date and percent complete is 100
    if (endDate && actualEndDate && actualEndDate.getTime() < endDate.getTime() && percentComplete >= 100) {
      deviations.push({
        budgetItemId: line.budgetItemId,
        itemCode: line.itemCode,
        description: line.description,
        kind: "ahead",
        message: "Partida terminada antes del plazo programado",
      });
    }

    // Critical with low progress
    if (line.criticalPath?.isCritical && percentComplete < 100) {
      const plannedPercent = calculatePlannedPercentForLine(line, asOf);
      if (plannedPercent - percentComplete > 10) {
        deviations.push({
          budgetItemId: line.budgetItemId,
          itemCode: line.itemCode,
          description: line.description,
          kind: "critical_low_progress",
          message: "Partida critica con avance inferior al planificado",
        });
      }
    }

    // Baseline variance
    if (line.baselineStartDate && line.baselineEndDate && startDate && endDate) {
      const baselineStart = new Date(`${line.baselineStartDate}T00:00:00.000Z`);
      const baselineEnd = new Date(`${line.baselineEndDate}T00:00:00.000Z`);
      if (startDate.getTime() !== baselineStart.getTime() || endDate.getTime() !== baselineEnd.getTime()) {
        deviations.push({
          budgetItemId: line.budgetItemId,
          itemCode: line.itemCode,
          description: line.description,
          kind: "baseline_variance",
          message: "Variacion respecto a la linea base",
        });
      }
    }
  }

  return deviations;
}
