export type WorkScheduleMonthlyDistributionRecord = {
  year: number;
  month: number;
  percentage: number;
};

export type WorkScheduleResourceRecord = {
  resourceId: string;
  code: string;
  description: string;
  unit: string;
  unitPrice: number;
  totalQuantity: number;
  totalCost: number;
};

export type WorkScheduleLineRecord = {
  scheduleItemId?: string;
  budgetItemId: string;
  levelId?: string | null;
  sortOrder?: number;
  itemCode: string;
  description: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  partial: number;
  subBudgetId: string;
  subBudgetName: string;
  startDate?: string | null;
  endDate?: string | null;
  durationDays?: number | null;
  predecessor?: string | null;
  crew?: number | null;
  performance?: number | null;
  performanceLabel?: string | null;
  monthlyDistributions: WorkScheduleMonthlyDistributionRecord[];
  resourceIds?: string[];
  resources?: WorkScheduleResourceRecord[];
  criticalPath?: WorkScheduleCriticalPathLineRecord | null;
};

export type WorkScheduleCriticalPathLineRecord = {
  earlyStartDay: number;
  earlyFinishDay: number;
  lateStartDay: number;
  lateFinishDay: number;
  totalSlackDays: number;
  isCritical: boolean;
};

export type WorkScheduleLevelSummaryRecord = {
  kind: "level";
  rowId: string;
  levelId: string;
  levelType: "TITLE" | "SUBTITLE";
  itemCode: string;
  description: string;
  subBudgetId: string;
  subBudgetName: string;
  durationDays: number | null;
  startDate: string | null;
  endDate: string | null;
  partial: number;
  childLineIds: string[];
};

export type WorkScheduleDisplayRowRecord =
  | {
      kind: "line";
      rowId: string;
      line: WorkScheduleLineRecord;
    }
  | WorkScheduleLevelSummaryRecord;

export type WorkSchedulePeriodRecord = {
  year: number;
  month: number;
  key: string;
};

export type WorkSchedulePeriodRangeRecord = {
  fromPeriodKey: string;
  toPeriodKey: string;
};

export type WorkScheduleValuationCalendarRow = {
  scheduleItemId?: string;
  budgetItemId: string;
  itemCode: string;
  description: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  partial: number;
  subBudgetName: string;
  rowTotal: number;
  periodAmounts: Record<string, number>;
};

export type WorkScheduleResourceCalendarRow = {
  resourceId: string;
  code: string;
  description: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  partial: number;
  periodQuantities: Record<string, number>;
  periodAmounts: Record<string, number>;
};

export type WorkScheduleCurvePointRecord = {
  year: number;
  month: number;
  key: string;
  monthlyAmount: number;
  accumulatedAmount: number;
  accumulatedPercentage: number;
};

export type WorkScheduleGenerationStrategy = "sequential" | "by_level" | "by_similarity";

export type InterSubBudgetParallelism = "independent" | "staggered" | "parallel";

export type LevelLinkageMode = "chain" | "parallel";

export type WorkScheduleGenerationOptions = {
  strategy: WorkScheduleGenerationStrategy;
  maxDurationDays?: number | null;
  similarityLagDays?: number | null;
  interSubBudgetParallelism?: InterSubBudgetParallelism | null;
  interSubBudgetStaggerDays?: number | null;
  levelLinkage?: Record<string, LevelLinkageMode> | null;
};

export type WorkScheduleGenerationIssueRecord = {
  budgetItemId: string;
  itemCode: string;
  reason: string;
};

export type WorkScheduleGenerationSummaryRecord = {
  generatedCount: number;
  pendingCount: number;
  issues: WorkScheduleGenerationIssueRecord[];
  appliedOptions: WorkScheduleGenerationOptions;
  highlights: string[];
};

export type WorkScheduleReviewWarningCode = "performance_default_one" | "long_duration";

export type WorkScheduleReviewWarningRecord = {
  code: WorkScheduleReviewWarningCode;
  label: string;
  count: number;
  examples: Array<{
    budgetItemId: string;
    itemCode: string;
    description: string;
    unit: string;
    performance: number | null;
    durationDays?: number | null;
  }>;
};

export type WorkScheduleReviewSummaryRecord = {
  warningCount: number;
  warnings: WorkScheduleReviewWarningRecord[];
};

export type WorkScheduleGroupRecord = {
  subBudgetId: string;
  subBudgetName: string;
  totalAmount: number;
  lines: WorkScheduleLineRecord[];
  rows: WorkScheduleDisplayRowRecord[];
};

export type WorkScheduleScaleRecord = {
  periodCount: number;
  timelineDayCount: number;
  canLoadDailyTimeline: boolean;
  canLoadDerivedCalendars: boolean;
  firstPeriodKey: string | null;
  lastPeriodKey: string | null;
};

export type WorkScheduleCalendarExceptionRecord = {
  id: string;
  date: string;
  type: "HOLIDAY" | "WORK_DAY";
  description: string | null;
};

export type WorkScheduleCalendarInfoRecord = {
  id: string;
  name: string;
  workDays: number;
  workHoursPerDay: number;
  exceptions?: WorkScheduleCalendarExceptionRecord[];
};

export type WorkScheduleViewRecord = {
  budgetId: string;
  budgetName: string;
  projectName: string;
  currency: string;
  groups: WorkScheduleGroupRecord[];
  valuationCalendar: WorkScheduleValuationCalendarRecord | null;
  resourceCalendar: {
    periods: WorkSchedulePeriodRecord[];
    rows: WorkScheduleResourceCalendarRow[];
  } | null;
  curveSeries: WorkScheduleCurvePointRecord[] | null;
  timeline: {
    startDate: string | null;
    endDate: string | null;
  };
  scale: WorkScheduleScaleRecord;
  criticalPath?: WorkScheduleCriticalPathSummaryRecord | null;
  generationSummary?: WorkScheduleGenerationSummaryRecord | null;
  reviewSummary?: WorkScheduleReviewSummaryRecord | null;
  workCalendar?: WorkScheduleCalendarInfoRecord | null;
};

export type WorkScheduleCriticalPathSummaryRecord = {
  status: "calculated" | "cycle";
  projectDurationDays: number;
  scheduledItemCount: number;
  criticalItemCount: number;
  issues: string[];
};

export type WorkScheduleValuationCalendarRecord = {
  periods: WorkSchedulePeriodRecord[];
  rows: WorkScheduleValuationCalendarRow[];
  availableRange?: WorkSchedulePeriodRangeRecord;
  selectedRange?: WorkSchedulePeriodRangeRecord;
  isPartial?: boolean;
};
