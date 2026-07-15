import type ExcelJS from "exceljs";
import type {
  InterSubBudgetParallelism,
  LevelLinkageMode,
  WorkScheduleDisplayRowRecord,
  WorkScheduleGenerationStrategy,
  WorkScheduleLineRecord,
  WorkScheduleMonthlyDistributionRecord,
  WorkScheduleViewRecord,
} from "@/types/work-schedule";

export type WorkSchedulePageContentProps = {
  initialData: WorkScheduleViewRecord;
};

export type ActiveView = "overview" | "valuation" | "resources" | "curve";
export type DerivedCalendarView = Exclude<ActiveView, "overview">;
export type WorkbookExportScope = "detail_only" | "detail_and_total" | "detail_subtotals_and_total";
export type WorkbookExportProfile = "minimal" | "executive" | "analytical";
export type WorkbookCell = {
  value: ExcelJS.CellValue;
  numFmt?: string;
};

export type WorkbookTableData = {
  headers: string[];
  rows: WorkbookCell[][];
  subtotalRowIndexes?: number[];
  totalRow?: WorkbookCell[];
};

export type EditableLine = {
  budgetItemId: string;
  description: string;
  quantity: number;
  performance: number | null;
  startDate: string;
  endDate: string;
  durationDays: number;
  predecessor: string;
  crew: string;
  monthlyDistributions: WorkScheduleMonthlyDistributionRecord[];
  isMilestone: boolean;
  baselineStartDate: string | null;
  baselineEndDate: string | null;
  actualStartDate?: string | null;
  actualEndDate?: string | null;
  percentComplete?: number | null;
};

export type OverviewFilter = "all" | "pending" | "incomplete_distribution" | "scheduled";
export type ResourceCalendarMode = "amounts" | "quantities";
export type OverviewVirtualItem =
  | {
      key: string;
      kind: "group";
      group: WorkScheduleViewRecord["groups"][number];
      collapsed: boolean;
      estimatedHeight: number;
    }
  | {
      key: string;
      kind: "row";
      group: WorkScheduleViewRecord["groups"][number];
      row: WorkScheduleDisplayRowRecord;
      estimatedHeight: number;
    };

export const dayFormatter = new Intl.DateTimeFormat("es-PE", { weekday: "short", timeZone: "UTC" });
export const timelineWeekFormatter = new Intl.DateTimeFormat("es-PE", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});
export const DEFAULT_OVERVIEW_TIMELINE_PANEL_WIDTH = 972;
export const MIN_OVERVIEW_TIMELINE_PANEL_WIDTH = 360;
export const OVERVIEW_HEADER_HEIGHT_CLASS = "h-[72px]";
export const OVERVIEW_GROUP_ROW_HEIGHT_CLASS = "h-10";
export const OVERVIEW_BOTTOM_FOOTER_HEIGHT_CLASS = "h-[44px]";
export const OVERVIEW_TIMELINE_PANEL_WIDTH_CSS_VAR = "--work-schedule-timeline-panel-width";
export const OVERVIEW_VIRTUAL_SCROLL_FALLBACK_HEIGHT = 720;
export const OVERVIEW_VIRTUAL_OVERSCAN_PX = 320;
export const OVERVIEW_GROUP_ROW_ESTIMATED_HEIGHT = 40;
export const OVERVIEW_LINE_ROW_ESTIMATED_HEIGHT = 40;
export const OVERVIEW_SYNCHRONIZED_MIN_ROW_HEIGHT = 40;
export const OVERVIEW_TIMELINE_DAY_WIDTH_PX = 16;
export const OVERVIEW_TIMELINE_DAY_GAP_PX = 1;
export const MIN_OVERVIEW_TIMELINE_ZOOM_PERCENT = 10;
export const MAX_OVERVIEW_TIMELINE_ZOOM_PERCENT = 500;
export const DEFAULT_OVERVIEW_TIMELINE_ZOOM_PERCENT = 100;
export const MIN_LEGIBLE_TIMELINE_DAY_WIDTH_PX = 8;
export const OVERVIEW_TABLE_COLUMN_WIDTHS = {
  rowNumber: 36,
  item: 96,
  partida: 360,
  duration: 88,
  start: 118,
  end: 118,
  predecessor: 100,
  crew: 92,
  performance: 118,
  unit: 84,
  quantity: 88,
  unitPrice: 98,
  partial: 110,
  action: 88,
} as const;

export type OverviewMeasuredHeightsCache = {
  groups: Record<string, number>;
  lines: Record<string, number>;
};

export type PredecessorRowNumberMaps = {
  itemCodeToRowNumber: Map<string, number>;
  rowNumberToItemCode: Map<number, string>;
};

export type DerivedDataLoadState = Record<DerivedCalendarView, "idle" | "loading" | "error">;
export type PeriodRangeSelection = {
  fromPeriodKey: string;
  toPeriodKey: string;
};

export type WorkScheduleGenerationFormState = {
  strategy: WorkScheduleGenerationStrategy;
  interSubBudgetParallelism: InterSubBudgetParallelism;
  interSubBudgetStaggerDays: string;
  maxDurationDays: string;
  similarityLagDays: string;
  levelLinkage: Record<string, LevelLinkageMode>;
};

export type GenerationLevelPreviewRow = {
  levelId: string;
  levelType: "TITLE" | "SUBTITLE";
  itemCode: string;
  description: string;
};

export type GenerationLevelPreviewGroup = {
  subBudgetId: string;
  subBudgetName: string;
  levels: GenerationLevelPreviewRow[];
};

export type TimelineDay = {
  iso: string;
  date: Date;
};

export type VisibleTimelineLinePosition = {
  line: WorkScheduleLineRecord;
  top: number;
  height: number;
};
