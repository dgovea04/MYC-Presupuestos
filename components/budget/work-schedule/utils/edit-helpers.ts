"use client";

import {
  buildWorkScheduleView,
  recalculateDependentWorkScheduleLines,
} from "@/lib/calculations/work-schedule";
import {
  buildWorkScheduleMonthlyDistributionsFromRange,
  calculateWorkScheduleDurationDays,
} from "@/lib/calculations/work-schedule";
import { parseWorkSchedulePredecessors } from "@/lib/work-schedule/predecessors";
import type {
  WorkScheduleLineRecord,
  WorkScheduleMonthlyDistributionRecord,
  WorkScheduleViewRecord,
} from "@/types/work-schedule";
import type { EditableLine, WorkScheduleGenerationFormState } from "../types";
import type { WorkScheduleGenerationOptions } from "@/types/work-schedule";

// ─── Preview ─────────────────────────────────────────────────────────────────

export function buildPreviewWorkScheduleView({
  data,
  editingLine,
  inlineDrafts,
  rowNumberToItemCode,
}: {
  data: WorkScheduleViewRecord;
  editingLine: EditableLine | null;
  inlineDrafts: Record<string, EditableLine>;
  rowNumberToItemCode: Map<number, string>;
}) {
  const draftEntries = new Map<string, EditableLine>();

  for (const draft of Object.values(inlineDrafts)) {
    draftEntries.set(draft.budgetItemId, draft);
  }

  if (editingLine) {
    draftEntries.set(editingLine.budgetItemId, editingLine);
  }

  if (draftEntries.size === 0) {
    return null;
  }

  let nextLines = data.groups.flatMap((group) => group.lines).map((line) => ({
    ...line,
    monthlyDistributions: line.monthlyDistributions.map((d) => ({ ...d })),
    resourceIds: line.resourceIds ? [...line.resourceIds] : undefined,
    resources: line.resources?.map((r) => ({ ...r })),
    criticalPath: line.criticalPath ? { ...line.criticalPath } : null,
  }));

  for (const draft of draftEntries.values()) {
    nextLines = nextLines.map((line) =>
      line.budgetItemId === draft.budgetItemId
        ? applyEditableDraftToLine(line, draft, rowNumberToItemCode)
        : line,
    );
  }

  for (const draft of draftEntries.values()) {
    nextLines = recalculateDependentWorkScheduleLines(nextLines, draft.budgetItemId);
  }

  return buildWorkScheduleView(
    {
      budgetId: data.budgetId,
      budgetName: data.budgetName,
      projectName: data.projectName,
      currency: data.currency,
      lines: nextLines,
    },
    { includeDerivedCalendars: false },
  );
}

// ─── Editable line creation ──────────────────────────────────────────────────

export function createEditableLine(
  line: WorkScheduleLineRecord,
  itemCodeToRowNumber: Map<string, number> = new Map<string, number>(),
): EditableLine {
  const fallbackDistributions =
    line.monthlyDistributions.length > 0
      ? line.monthlyDistributions.map((d) => ({ ...d }))
      : buildInitialDistributionsFromRange(line.startDate ?? "", line.endDate ?? "");

  return updateEditableLineDates(
    {
      budgetItemId: line.budgetItemId,
      description: line.description,
      quantity: line.quantity,
      performance: line.performance ?? null,
      startDate: line.startDate ?? "",
      endDate: line.endDate ?? "",
      durationDays: line.durationDays ?? 0,
      predecessor: formatPredecessorForDisplay(line.predecessor ?? "", itemCodeToRowNumber),
      crew: line.crew != null ? String(line.crew) : "1",
      monthlyDistributions: fallbackDistributions,
      isMilestone: line.isMilestone ?? false,
      baselineStartDate: line.baselineStartDate ?? null,
      baselineEndDate: line.baselineEndDate ?? null,
      actualStartDate: line.actualStartDate ?? null,
      actualEndDate: line.actualEndDate ?? null,
      percentComplete: line.percentComplete ?? null,
    },
    {},
  );
}

export function serializeEditableLine(
  line: EditableLine,
  rowNumberToItemCode: Map<number, string> = new Map<number, string>(),
) {
  return {
    budgetItemId: line.budgetItemId,
    startDate: line.startDate,
    endDate: line.endDate,
    durationDays: Number(line.durationDays),
    predecessor: formatPredecessorForStorage(line.predecessor, rowNumberToItemCode),
    crew: parseEditableCrew(line.crew) ?? 1,
    isMilestone: line.isMilestone ?? false,
    baselineStartDate: line.baselineStartDate || null,
    baselineEndDate: line.baselineEndDate || null,
    actualStartDate: line.actualStartDate || null,
    actualEndDate: line.actualEndDate || null,
    percentComplete: line.percentComplete ?? null,
    monthlyDistributions: line.monthlyDistributions.map((d) => ({
      year: d.year,
      month: d.month,
      percentage: Number(d.percentage),
    })),
  };
}

export function applyEditableDraftToLine(
  line: WorkScheduleLineRecord,
  draft: EditableLine,
  rowNumberToItemCode: Map<number, string>,
): WorkScheduleLineRecord {
  const serializedDraft = serializeEditableLine(draft, rowNumberToItemCode);

  return {
    ...line,
    startDate: serializedDraft.startDate,
    endDate: serializedDraft.endDate,
    durationDays: serializedDraft.durationDays,
    predecessor: serializedDraft.predecessor,
    crew: serializedDraft.crew,
    monthlyDistributions: serializedDraft.monthlyDistributions.map((d) => ({
      year: d.year,
      month: d.month,
      percentage: d.percentage,
    })),
    actualStartDate: draft.actualStartDate || null,
    actualEndDate: draft.actualEndDate || null,
    percentComplete: draft.percentComplete,
  };
}

// ─── Date editing ────────────────────────────────────────────────────────────

export function updateEditableLineDates(
  line: EditableLine,
  patch: { startDate?: string; endDate?: string },
): EditableLine {
  const startDate = patch.startDate ?? line.startDate;
  const endDate = patch.endDate ?? line.endDate;

  if (!startDate || !endDate) {
    return { ...line, startDate, endDate, durationDays: 0 };
  }

  const start = new Date(`${startDate}T00:00:00.000Z`);
  const end = new Date(`${endDate}T00:00:00.000Z`);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start.getTime() > end.getTime()) {
    return { ...line, startDate, endDate, durationDays: 0 };
  }

  const durationDays = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
  const monthlyDistributions = buildWorkScheduleMonthlyDistributionsFromRange(startDate, endDate);

  return { ...line, startDate, endDate, durationDays, monthlyDistributions };
}

export function updateEditableLineCrew(line: EditableLine, crew: string) {
  const parsed = parseEditableCrew(crew);
  const performance = line.performance ?? 1;
  const durationDays =
    parsed != null && performance > 0
      ? calculateWorkScheduleDurationDays({
          quantity: line.quantity,
          performance,
          crew: parsed,
        }) ?? line.durationDays
      : line.durationDays;

  return { ...line, crew };
}

export function updateEditableLinePredecessor(
  line: EditableLine,
  predecessor: string,
  {
    lineByBudgetItemId,
    lineByCode,
    rowNumberToItemCode,
  }: {
    lineByBudgetItemId: Map<string, WorkScheduleLineRecord>;
    lineByCode: Map<string, WorkScheduleLineRecord>;
    rowNumberToItemCode: Map<number, string>;
  },
): EditableLine {
  const stored = formatPredecessorForStorage(predecessor, rowNumberToItemCode);
  return { ...line, predecessor };
}

export function updateDistribution(
  line: EditableLine,
  index: number,
  field: keyof WorkScheduleMonthlyDistributionRecord,
  value: number,
  onChange: (line: EditableLine) => void,
) {
  const monthlyDistributions = line.monthlyDistributions.map((d, i) =>
    i === index ? { ...d, [field]: value } : d,
  );
  onChange({ ...line, monthlyDistributions });
}

export function createNextDistribution(
  distributions: WorkScheduleMonthlyDistributionRecord[],
): WorkScheduleMonthlyDistributionRecord {
  const last = distributions.at(-1);
  if (!last) {
    const now = new Date();
    return { year: now.getUTCFullYear(), month: now.getUTCMonth() + 1, percentage: 100 };
  }

  const nextMonth = last.month === 12 ? 1 : last.month + 1;
  const nextYear = last.month === 12 ? last.year + 1 : last.year;
  return { year: nextYear, month: nextMonth, percentage: 0 };
}

// ─── Predecessor formatting ──────────────────────────────────────────────────

export function formatPredecessorForDisplay(
  value: string,
  itemCodeToRowNumber: Map<string, number>,
) {
  const normalizedValue = value.trim();
  if (!normalizedValue) return "";

  try {
    const refs = parseWorkSchedulePredecessors(normalizedValue);
    return refs
      .map((ref) => {
        const rowNum = itemCodeToRowNumber.get(ref.code);
        const display = rowNum != null ? `#${rowNum}` : ref.code;
        const lag = ref.lagDays !== 0 ? `${ref.lagDays > 0 ? "+" : ""}${ref.lagDays}d` : "";
        return `${display}${ref.relation}${lag}`;
      })
      .join(",");
  } catch {
    return normalizedValue;
  }
}

export function formatPredecessorForStorage(
  value: string,
  rowNumberToItemCode: Map<number, string>,
) {
  const normalizedValue = value.trim();
  if (!normalizedValue) return "";

  return normalizedValue
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const match = /^#(\d+)(FS|SS|FF|SF)?([+-]?\d+d)?$/i.exec(s);
      if (!match) return s;

      const [, rowNum, relation, lag] = match;
      const code = rowNumberToItemCode.get(Number(rowNum));
      if (!code) return s;

      return `${code}${relation ?? "FS"}${lag ?? ""}`;
    })
    .join(",");
}

export function formatPredecessorToken(
  itemCode: string,
  relation: string,
  lagDays: number,
) {
  const lag = lagDays !== 0 ? `${lagDays > 0 ? "+" : ""}${lagDays}d` : "";
  return `${itemCode}${relation}${lag}`;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function parseEditableCrew(value: string): number | null {
  const normalized = value.trim();
  if (!normalized) return null;

  const parsed = Number(normalized);
  if (Number.isNaN(parsed) || parsed <= 0) return null;

  return parsed;
}

function buildInitialDistributionsFromRange(
  startDate: string,
  endDate: string,
): WorkScheduleMonthlyDistributionRecord[] {
  if (!startDate || !endDate) return [];
  return buildWorkScheduleMonthlyDistributionsFromRange(startDate, endDate);
}

// ─── Generation helpers ──────────────────────────────────────────────────────

export function buildGenerationOptionsPayload(
  formState: WorkScheduleGenerationFormState,
): WorkScheduleGenerationOptions {
  return {
    strategy: formState.strategy,
    interSubBudgetParallelism: formState.interSubBudgetParallelism,
    interSubBudgetStaggerDays: parseOptionalPositiveInteger(formState.interSubBudgetStaggerDays),
    maxDurationDays: parseOptionalPositiveInteger(formState.maxDurationDays),
    similarityLagDays: parseOptionalNonNegativeInteger(formState.similarityLagDays),
    levelLinkage: Object.keys(formState.levelLinkage).length > 0 ? formState.levelLinkage : null,
  };
}

export function parseOptionalPositiveInteger(value: string): number | null | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;

  const num = Number(trimmed);
  return Number.isInteger(num) && num > 0 ? num : undefined;
}

export function parseOptionalNonNegativeInteger(value: string): number | null | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;

  const num = Number(trimmed);
  return Number.isInteger(num) && num >= 0 ? num : undefined;
}

// ─── Review summary ──────────────────────────────────────────────────────────

export function deriveEffectiveReviewSummary(
  reviewSummary: WorkScheduleViewRecord["reviewSummary"],
  reviewedBudgetItemIds: string[],
) {
  if (!reviewSummary) return null;

  const reviewedSet = new Set(reviewedBudgetItemIds);
  const filteredWarnings = reviewSummary.warnings
    .map((w) => ({
      ...w,
      examples: w.examples.filter((e) => !reviewedSet.has(e.budgetItemId)),
    }))
    .filter((w) => w.examples.length > 0);

  if (filteredWarnings.length === 0) return null;

  return {
    warningCount: filteredWarnings.reduce((sum, w) => sum + w.count, 0),
    warnings: filteredWarnings,
  };
}

// ─── Normalize view ──────────────────────────────────────────────────────────

export function normalizeWorkScheduleView(data: WorkScheduleViewRecord): WorkScheduleViewRecord {
  return {
    ...data,
    valuationCalendar: data.valuationCalendar ?? null,
    resourceCalendar: data.resourceCalendar ?? null,
    curveSeries: data.curveSeries ?? null,
    scale: data.scale ?? {
      periodCount: data.valuationCalendar?.periods.length ?? 0,
      timelineDayCount: 0,
      canLoadDailyTimeline: true,
      canLoadDerivedCalendars: true,
      firstPeriodKey: data.valuationCalendar?.periods[0]?.key ?? null,
      lastPeriodKey: data.valuationCalendar?.periods.at(-1)?.key ?? null,
    },
  };
}
