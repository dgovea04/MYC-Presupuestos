"use client";

import dynamic from "next/dynamic";
import * as Dialog from "@radix-ui/react-dialog";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type UIEvent as ReactUIEvent,
} from "react";
import { CalendarDays, ChartSpline, ChevronDown, Info, MoreHorizontal, Package2, PenLine, PenSquare, Save, WandSparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const ExportPanel = dynamic(() => import("@/components/exports/export-panel").then((mod) => mod.ExportPanel));
import { OperationalPanel } from "@/components/ui/operational-surfaces";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { useFormattingSettings } from "@/components/providers/formatting-settings-provider";
import { useAppViewMode } from "@/components/view-mode/app-view-mode-provider";
import type { DateFormatOption } from "@/types/settings";
import {
  buildWorkScheduleView,
  calculateWorkScheduleDurationDays,
  recalculateDependentWorkScheduleLines,
  recalculateWorkScheduleLineFromPredecessors,
} from "@/lib/calculations/work-schedule";
import { cn, formatCurrency, formatDate, formatNumber } from "@/lib/utils";
import { useEditSession } from "@/hooks/use-edit-session";
import { useBudgetPresenceHeartbeat } from "@/hooks/use-budget-presence-heartbeat";
import { useUndoRedo } from "@/hooks/use-undo-redo";
import { getExportDefinition } from "@/lib/exports/definitions";
import { parseWorkSchedulePredecessors, tryParseWorkSchedulePredecessors } from "@/lib/work-schedule/predecessors";
import { countWorkDays } from "@/lib/work-schedule/calendar";
import type { WorkSchedulePredecessorRelation } from "@/components/budget/gantt/use-gantt-connection-mode";
import { diffInDays, type GanttBarChangeResult } from "@/components/budget/gantt/gantt-utils";
import type {
  InterSubBudgetParallelism,
  LevelLinkageMode,
  WorkScheduleCurvePointRecord,
  WorkScheduleLineRecord,
  WorkScheduleDisplayRowRecord,
  WorkScheduleGenerationOptions,
  WorkScheduleGenerationStrategy,
  WorkScheduleMonthlyDistributionRecord,
  WorkSchedulePeriodRecord,
  WorkScheduleResourceCalendarRow,
  WorkScheduleValuationCalendarRow,
  WorkScheduleViewRecord,
} from "@/types/work-schedule";
import { WorkScheduleOverview, buildTimelineDays, formatPredecessorForDisplay, formatPredecessorToken, formatPredecessorForStorage, updateEditableLineDates, updateEditableLineCrew, updateEditableLineDuration, parseEditableCrew, isPendingWorkScheduleLine, hasIncompleteDistribution } from "./work-schedule/overview-view";
import type { EditableLine } from "./work-schedule/types";
import { WorkScheduleEditorSheet } from "./work-schedule/editor-sheet";
import { WorkScheduleGenerationDialog } from "./work-schedule/generation-dialog";
import { ScheduleDeviationPanel } from "./work-schedule/schedule-deviation-panel";
import { LookaheadView } from "./work-schedule/lookahead-view";
import { ResourceCapacityPanel } from "./work-schedule/resource-capacity-panel";
import { ReschedulePreviewDialog } from "./work-schedule/reschedule-preview-dialog";
import { createEditableLine, serializeEditableLine, createNextDistribution, parseCustomPhaseKeywords } from "./work-schedule/utils/edit-helpers";
import { detectWorkScheduleDeviations } from "@/lib/work-schedule/progress";
import { detectResourceOverallocations } from "@/lib/work-schedule/resource-capacity";
import { buildWorkScheduleReschedulePreview, type WorkScheduleRescheduleImpact } from "@/lib/work-schedule/rescheduling";
import {
  buildWorkScheduleCsvExport,
  formatPeriodLabel,
  buildWorkScheduleOverviewSummaryCsvExport,
  buildWorkScheduleOverviewMonthlySummaryCsvExport,
  buildWorkScheduleOverviewExecutivePackageCsvExport,
  buildWorkScheduleOverviewExecutivePackageWorkbook,
  buildWorkScheduleActiveViewWorkbook,
  downloadTextFile,
  downloadBinaryFile,
  formatTimelineRange,
  getWorkbookExportTargetLabel,
  getSupportedWorkbookProfiles,
  getWorkbookExportProfileLabel,
  getWorkbookExportScopeForView,
  getWorkbookExportProfileFromScope,
  getWorkbookExportScopeFromProfile,
  buildWorkbookExportPreviewBadges,
  describeWorkbookExportPreview,
} from "./work-schedule/utils/export-helpers";

type WorkSchedulePageContentProps = {
  initialData: WorkScheduleViewRecord;
};

type ActiveView = "overview" | "valuation" | "resources" | "curve";
type DerivedCalendarView = Exclude<ActiveView, "overview">;
type WorkbookExportScope = "detail_only" | "detail_and_total" | "detail_subtotals_and_total";
type WorkbookExportProfile = "minimal" | "executive" | "analytical";



type OverviewFilter = "all" | "pending" | "incomplete_distribution" | "scheduled";
type ResourceCalendarMode = "amounts" | "quantities";
type OverviewVirtualItem =
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

const dayFormatter = new Intl.DateTimeFormat("es-PE", { weekday: "short", timeZone: "UTC" });
const timelineWeekFormatter = new Intl.DateTimeFormat("es-PE", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});
const DEFAULT_OVERVIEW_TIMELINE_PANEL_WIDTH = 972;
const MIN_OVERVIEW_TIMELINE_PANEL_WIDTH = 360;
const OVERVIEW_HEADER_HEIGHT_CLASS = "h-[72px]";
const OVERVIEW_GROUP_ROW_HEIGHT_CLASS = "h-10";
const OVERVIEW_BOTTOM_FOOTER_HEIGHT_CLASS = "h-[44px]";
const OVERVIEW_TIMELINE_PANEL_WIDTH_CSS_VAR = "--work-schedule-timeline-panel-width";
const OVERVIEW_VIRTUAL_SCROLL_FALLBACK_HEIGHT = 720;
const OVERVIEW_VIRTUAL_OVERSCAN_PX = 320;
const OVERVIEW_GROUP_ROW_ESTIMATED_HEIGHT = 40;
const OVERVIEW_LINE_ROW_ESTIMATED_HEIGHT = 40;
const OVERVIEW_SYNCHRONIZED_MIN_ROW_HEIGHT = 40;
const OVERVIEW_TIMELINE_DAY_WIDTH_PX = 16;
const OVERVIEW_TIMELINE_DAY_GAP_PX = 1;
const MIN_OVERVIEW_TIMELINE_ZOOM_PERCENT = 10;
const MAX_OVERVIEW_TIMELINE_ZOOM_PERCENT = 500;
const DEFAULT_OVERVIEW_TIMELINE_ZOOM_PERCENT = 100;
const MIN_LEGIBLE_TIMELINE_DAY_WIDTH_PX = 8;
const OVERVIEW_TABLE_COLUMN_WIDTHS = {
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

type OverviewMeasuredHeightsCache = {
  groups: Record<string, number>;
  lines: Record<string, number>;
};

type PredecessorRowNumberMaps = {
  itemCodeToRowNumber: Map<string, number>;
  rowNumberToItemCode: Map<number, string>;
};

type DerivedDataLoadState = Record<DerivedCalendarView, "idle" | "loading" | "error">;
type PeriodRangeSelection = {
  fromPeriodKey: string;
  toPeriodKey: string;
};

type WorkScheduleGenerationFormState = {
  strategy: WorkScheduleGenerationStrategy;
  interSubBudgetParallelism: InterSubBudgetParallelism;
  interSubBudgetStaggerDays: string;
  maxDurationDays: string;
  similarityLagDays: string;
  levelLinkage: Record<string, LevelLinkageMode>;
  customPhaseKeywords: Record<string, string>;
};

type GenerationLevelPreviewRow = {
  levelId: string;
  levelType: "TITLE" | "SUBTITLE";
  itemCode: string;
  description: string;
};

type GenerationLevelPreviewGroup = {
  subBudgetId: string;
  subBudgetName: string;
  levels: GenerationLevelPreviewRow[];
};

export function WorkSchedulePageContent({ initialData }: WorkSchedulePageContentProps) {
  return <WorkSchedulePageContentInner key={initialData.budgetId} initialData={initialData} />;
}

/** Recalculate durationDays from startDate/endDate to match server-side
 *  validation (diffInDays + 1). Falls back to the provided default when
 *  either date is missing. */
function computeDurationFromRange(
  startDate: string | null | undefined,
  endDate: string | null | undefined,
  fallback?: number,
): number {
  if (startDate && endDate) {
    return diffInDays(startDate, endDate) + 1;
  }
  return fallback ?? 1;
}

function normalizeWorkScheduleView(data: WorkScheduleViewRecord): WorkScheduleViewRecord {
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

function WorkSchedulePageContentInner({ initialData }: WorkSchedulePageContentProps) {
  const normalizedInitialData = normalizeWorkScheduleView(initialData);
  const { currencyDecimals, dateFormat } = useFormattingSettings();
  const { isExcelMode } = useAppViewMode();
  const { state: data, setState: setData, undo, redo, canUndo, canRedo } = useUndoRedo<WorkScheduleViewRecord>(normalizedInitialData);
  const [activeView, setActiveView] = useState<ActiveView>(() => readActiveView(normalizedInitialData.budgetId));
  const [editingLine, setEditingLine] = useState<EditableLine | null>(() =>
    readEditingLine(normalizedInitialData, buildPredecessorRowNumberMaps(normalizedInitialData.groups).itemCodeToRowNumber),
  );
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>(() => readCollapsedGroups(normalizedInitialData.budgetId));
  const [collapsedLevelIds, setCollapsedLevelIds] = useState<Record<string, boolean>>(() => readCollapsedLevelIds(normalizedInitialData.budgetId));
  const [overviewFilter, setOverviewFilter] = useState<OverviewFilter>(() => readOverviewFilter(normalizedInitialData.budgetId));
  const [showCriticalPath, setShowCriticalPath] = useState(() => readCriticalPathVisibility(normalizedInitialData.budgetId));
  const [nearCriticalSlackDays, setNearCriticalSlackDays] = useState(() => readNearCriticalSlackDays(normalizedInitialData.budgetId));
  const [resourceCalendarMode, setResourceCalendarMode] = useState<ResourceCalendarMode>(() => readResourceCalendarMode(normalizedInitialData.budgetId));
  const [executiveWorkbookScope, setExecutiveWorkbookScope] = useState<WorkbookExportScope>(() =>
    readExecutiveWorkbookScope(normalizedInitialData.budgetId),
  );
  const [valuationWorkbookScope, setValuationWorkbookScope] = useState<WorkbookExportScope>(() =>
    readValuationWorkbookScope(normalizedInitialData.budgetId),
  );
  const [resourceWorkbookScope, setResourceWorkbookScope] = useState<WorkbookExportScope>(() =>
    readResourceWorkbookScope(normalizedInitialData.budgetId),
  );
  const [curveWorkbookScope, setCurveWorkbookScope] = useState<WorkbookExportScope>(() =>
    readCurveWorkbookScope(normalizedInitialData.budgetId),
  );
  const [overviewScrollRequest, setOverviewScrollRequest] = useState<number | null>(null);
  const [highlightedBudgetItemId, setHighlightedBudgetItemId] = useState<string | null>(null);
  const [hoveredItemCode, setHoveredItemCode] = useState<string | null>(null);
  const handleUnhoverBar = useCallback(() => setHoveredItemCode(null), []);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "error">("idle");
  const [error, setError] = useState("");
  const [activeInlineRowId, setActiveInlineRowId] = useState<string | null>(null);
  const [inlineDrafts, setInlineDrafts] = useState<Record<string, EditableLine>>({});
  const [inlineSaveStateById, setInlineSaveStateById] = useState<Record<string, "idle" | "saving" | "error">>({});
  const [inlineErrorsById, setInlineErrorsById] = useState<Record<string, string>>({});
  const [isGenerationDialogOpen, setIsGenerationDialogOpen] = useState(false);
  const [generationBaseDate, setGenerationBaseDate] = useState(() => normalizedInitialData.timeline.startDate ?? new Date().toISOString().slice(0, 10));
  const [generationFormState, setGenerationFormState] = useState<WorkScheduleGenerationFormState>(() =>
    readGenerationFormState(normalizedInitialData.budgetId, normalizedInitialData.groups),
  );
  const hasCustomPhaseKeywordsChangedRef = useRef(false);
  const [generationPreviewCollapsedGroups, setGenerationPreviewCollapsedGroups] = useState<Record<string, boolean>>(() =>
    readGenerationPreviewCollapsedGroups(normalizedInitialData.budgetId),
  );
  const [generationReviewedBudgetItemIds, setGenerationReviewedBudgetItemIds] = useState<string[]>(() =>
    readGenerationReviewedBudgetItemIds(normalizedInitialData.budgetId),
  );
  const [generationState, setGenerationState] = useState<"idle" | "saving" | "error">("idle");
  const [generationError, setGenerationError] = useState("");
  const [generationSettingsSaveState, setGenerationSettingsSaveState] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [generationSettingsSaveError, setGenerationSettingsSaveError] = useState("");
  const [isLoadingGenerationSettings, setIsLoadingGenerationSettings] = useState(false);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [reschedulePreview, setReschedulePreview] = useState<{
    open: boolean;
    impacts: WorkScheduleRescheduleImpact[];
    pendingLine: EditableLine | null;
  } | null>(null);
  const [derivedDataLoadState, setDerivedDataLoadState] = useState<DerivedDataLoadState>(() => ({
    valuation: normalizedInitialData.valuationCalendar ? "idle" : "idle",
    resources: normalizedInitialData.resourceCalendar ? "idle" : "idle",
    curve: normalizedInitialData.curveSeries ? "idle" : "idle",
  }));
  const [derivedDataErrors, setDerivedDataErrors] = useState<Record<DerivedCalendarView, string>>({
    valuation: "",
    resources: "",
    curve: "",
  });
  const [valuationRange, setValuationRange] = useState<PeriodRangeSelection>(() => createDefaultValuationRange(normalizedInitialData));
  const exportMenuRef = useRef<HTMLDivElement | null>(null);
  const basePredecessorMaps = useMemo(() => buildPredecessorRowNumberMaps(data.groups), [data.groups]);
  const generationLevelPreviewGroups = useMemo(() => buildGenerationLevelPreviewGroups(data.groups), [data.groups]);
  const effectiveReviewSummary = useMemo(
    () => deriveEffectiveReviewSummary(data.reviewSummary ?? null, generationReviewedBudgetItemIds),
    [data.reviewSummary, generationReviewedBudgetItemIds],
  );
  const previewData = useMemo(
    () =>
      buildPreviewWorkScheduleView({
        data,
        editingLine,
        inlineDrafts,
        rowNumberToItemCode: basePredecessorMaps.rowNumberToItemCode,
      }),
    [basePredecessorMaps.rowNumberToItemCode, data, editingLine, inlineDrafts],
  );
  const presentationData = previewData ?? data;
  const presentationLines = useMemo(() => presentationData.groups.flatMap((group) => group.lines), [presentationData.groups]);
  const presentationLinesByBudgetItemId = useMemo(
    () => new Map(presentationLines.map((line) => [line.budgetItemId, line])),
    [presentationLines],
  );
  const presentationLinesByCode = useMemo(
    () => new Map(presentationLines.map((line) => [line.itemCode, line])),
    [presentationLines],
  );

  // `cascadedInlineDrafts` proactively syncs each active draft's dates to
  // the current `presentationLinesByBudgetItemId`. Without this, the date
  // picker inside an active row only re-binds to a predecessor-driven
  // cascade once the user clicks in / out of the row (the static formatted
  // text shows the cascaded date, but `<WorkScheduleDateInput value=...>`
  // reads from `inlineDrafts` which `buildPreviewWorkScheduleView`
  // intentionally leaves alone). With this memo the picker follows the
  // cascade automatically — no re-click required.
  //
  // Trade-off: a draft the user is actively editing can be overwritten if
  // a parallel predecessor change cascades through while they type. The
  // exact overwrite trigger is: the next render where
  // `presentationLinesByBudgetItemId.get(budgetItemId).startDate !==
  // draft.startDate` AND the row hasn't been re-activated. In practice
  // users edit one row at a time so this is rare; a per-draft "touched"
  // flag set on the date-input setter specifically and cleared on
  // save/cancel would close the gap and is documented as a followup.
  //
  // This memo and the activate-side merge in `handleActivateInlineRow`
  // both reconcile dates onto `inlineDrafts`. The activate-side branch is
  // NOT dead — it is the safety net for the case where the row's `line`
  // prop was captured before the latest `previewData` recomputation (e.g.
  // `React.memo` on `WorkScheduleLineTableRow` skipped the rerender that
  // would have refreshed `line`). Keep both.
  //
  // Pure derivation (no setState) — cannot create a React render loop.
  // The `if (!changed) return inlineDrafts` short-circuit preserves
  // caller-side object identity when nothing diverges, keeping
  // `React.memo` on `WorkScheduleLineTableRow` effective.
  const cascadedInlineDrafts = useMemo(() => {
    let changed = false;
    const next: Record<string, EditableLine> = {};
    for (const [budgetItemId, draft] of Object.entries(inlineDrafts)) {
      const presentationLine = presentationLinesByBudgetItemId.get(budgetItemId);
      if (
        !presentationLine ||
        !presentationLine.startDate ||
        !presentationLine.endDate ||
        (presentationLine.startDate === draft.startDate &&
          presentationLine.endDate === draft.endDate)
      ) {
        // Either the cascade doesn't cover this row, or the draft is
        // already in sync — keep the existing reference so React.memo can
        // skip the row.
        next[budgetItemId] = draft;
        continue;
      }
      next[budgetItemId] = updateEditableLineDates(draft, {
        startDate: presentationLine.startDate,
        endDate: presentationLine.endDate,
      });
      changed = true;
    }
    if (!changed) return inlineDrafts;
    return next;
  }, [inlineDrafts, presentationLinesByBudgetItemId]);

  const timelineDays = useMemo(
    () =>
      presentationData.scale.canLoadDailyTimeline
        ? buildTimelineDays(presentationData.timeline.startDate, presentationData.timeline.endDate)
        : [],
    [presentationData.scale.canLoadDailyTimeline, presentationData.timeline.endDate, presentationData.timeline.startDate],
  );
  const timelineDayIndexByIso = useMemo(
    () => new Map(timelineDays.map((day, index) => [day.iso, index])),
    [timelineDays],
  );
  const summary = useMemo(() => summarizeView(presentationData), [presentationData]);
  const orderedLines = presentationLines;
  const visibleOrderedLines = useMemo(
    () =>
      presentationData.groups.flatMap((group) =>
        collapsedGroups[group.subBudgetId] === true ? [] : group.lines,
      ),
    [collapsedGroups, presentationData.groups],
  );
  const filteredVisibleLines = useMemo(
    () => visibleOrderedLines.filter((line) => matchesOverviewFilter(line, overviewFilter)),
    [overviewFilter, visibleOrderedLines],
  );
  const shouldPrepareValuationRows = activeView !== "resources";
  const shouldPrepareResourceRows = activeView === "resources";
  const shouldPrepareCurveSeries = activeView === "curve";
  const filteredLineIds = useMemo(
    () => (shouldPrepareValuationRows ? new Set(filteredVisibleLines.map((line) => line.budgetItemId)) : new Set<string>()),
    [filteredVisibleLines, shouldPrepareValuationRows],
  );
  const filteredResourceIds = useMemo(
    () =>
      shouldPrepareResourceRows
        ? new Set(
            filteredVisibleLines.flatMap((line) => line.resourceIds ?? (line.resources ?? []).map((resource) => resource.resourceId)),
          )
        : new Set<string>(),
    [filteredVisibleLines, shouldPrepareResourceRows],
  );
  const navigationLines = filteredVisibleLines.length > 0 ? filteredVisibleLines : visibleOrderedLines.length > 0 ? visibleOrderedLines : orderedLines;
  const editingLineIndex = editingLine ? navigationLines.findIndex((line) => line.budgetItemId === editingLine.budgetItemId) : -1;
  const canNavigateToPreviousLine = editingLineIndex > 0;
  const canNavigateToNextLine = editingLineIndex >= 0 && editingLineIndex < navigationLines.length - 1;
  const filteredValuationRows = useMemo(
    () =>
      !shouldPrepareValuationRows
        ? []
        : overviewFilter === "all"
        ? (data.valuationCalendar?.rows ?? [])
        : (data.valuationCalendar?.rows ?? []).filter((row) => filteredLineIds.has(row.budgetItemId)),
    [data.valuationCalendar, filteredLineIds, overviewFilter, shouldPrepareValuationRows],
  );
  const filteredResourceRows = useMemo(
    () =>
      !shouldPrepareResourceRows
        ? []
        : overviewFilter === "all"
        ? (data.resourceCalendar?.rows ?? [])
        : (data.resourceCalendar?.rows ?? []).filter((row) => filteredResourceIds.has(row.resourceId)),
    [data.resourceCalendar, filteredResourceIds, overviewFilter, shouldPrepareResourceRows],
  );
  const filteredCurveSeries = useMemo(
    () => {
      if (!shouldPrepareCurveSeries) {
        return [];
      }

      if (overviewFilter !== "all" && data.valuationCalendar) {
        return buildCurveSeriesFromValuationRows(filteredValuationRows, data.valuationCalendar.periods);
      }

      return data.curveSeries ?? [];
    },
    [data.curveSeries, data.valuationCalendar, filteredValuationRows, overviewFilter, shouldPrepareCurveSeries],
  );
  const {
    itemCodeToRowNumber: predecessorItemCodeToRowNumber,
    rowNumberToItemCode: predecessorRowNumberToItemCode,
  } = useMemo(() => buildPredecessorRowNumberMaps(presentationData.groups), [presentationData.groups]);

  const asOfDate = data.timeline.startDate ?? new Date().toISOString().slice(0, 10);
  const scheduleDeviations = useMemo(
    () => detectWorkScheduleDeviations({ lines: presentationLines, asOfDate }),
    [presentationLines, asOfDate],
  );
  const resourceOverallocations = useMemo(() => {
    const demands =
      data.resourceCalendar?.rows.flatMap((row) =>
        Object.entries(row.periodQuantities).map(([periodKey, quantity]) => ({
          resourceId: row.resourceId,
          resourceName: row.description,
          periodKey,
          demandQuantity: quantity,
        })),
      ) ?? [];
    const limits: { resourceId: string; periodKey: string; quantityCapacity: number }[] = [];
    return detectResourceOverallocations({ demands, limits });
  }, [data.resourceCalendar?.rows]);

  async function persistWorkScheduleLine(line: EditableLine) {
    const response = await fetch(`/api/budgets/${data.budgetId}/work-schedule`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(serializeEditableLine(line, predecessorRowNumberToItemCode)),
    });

    if (!response.ok) {
      const payload = (await response.json()) as { error?: string };
      throw new Error(payload.error ?? "No se pudo guardar la programacion");
    }

    return (await response.json()) as WorkScheduleViewRecord;
  }

  const loadDerivedViewData = useCallback(async (view: DerivedCalendarView, range?: PeriodRangeSelection) => {
    setDerivedDataLoadState((current) => ({ ...current, [view]: "loading" }));
    setDerivedDataErrors((current) => ({ ...current, [view]: "" }));

    try {
      const endpoint =
        view === "valuation"
          ? "valuation-calendar"
          : view === "resources"
          ? "resource-calendar"
          : "curve-s";
      const query =
        view === "valuation" && range
          ? `?from=${encodeURIComponent(range.fromPeriodKey)}&to=${encodeURIComponent(range.toPeriodKey)}`
          : "";
      const response = await fetch(`/api/budgets/${data.budgetId}/work-schedule/${endpoint}${query}`);

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error ?? "No se pudo cargar la vista derivada del cronograma");
      }

      const payload = await response.json();
      if (view === "valuation" && isPeriodRangeSelection(payload?.selectedRange)) {
        setValuationRange(payload.selectedRange);
      }
      setData((current) =>
        normalizeWorkScheduleView({
          ...current,
          valuationCalendar: view === "valuation" ? payload : current.valuationCalendar,
          resourceCalendar: view === "resources" ? payload : current.resourceCalendar,
          curveSeries: view === "curve" ? payload : current.curveSeries,
        }),
      );
      setDerivedDataLoadState((current) => ({ ...current, [view]: "idle" }));
    } catch (loadError) {
      setDerivedDataLoadState((current) => ({ ...current, [view]: "error" }));
      setDerivedDataErrors((current) => ({
        ...current,
        [view]: loadError instanceof Error ? loadError.message : "No se pudo cargar la vista derivada del cronograma",
      }));
    }
  }, [data.budgetId]);

  useEffect(() => {
    if (activeView === "overview") {
      return;
    }

    if (activeView === "valuation" && data.valuationCalendar == null && derivedDataLoadState.valuation === "idle") {
      if (data.scale.canLoadDerivedCalendars) {
        void loadDerivedViewData("valuation");
      } else {
        void loadDerivedViewData("valuation", valuationRange);
      }
      return;
    }

    if (!data.scale.canLoadDerivedCalendars) {
      return;
    }

    if (activeView === "resources" && data.resourceCalendar == null && derivedDataLoadState.resources === "idle") {
      void loadDerivedViewData("resources");
      return;
    }

    if (activeView === "curve" && data.curveSeries == null && derivedDataLoadState.curve === "idle") {
      void loadDerivedViewData("curve");
    }
  }, [
    activeView,
    data.curveSeries,
    data.resourceCalendar,
    data.scale.canLoadDerivedCalendars,
    data.valuationCalendar,
    derivedDataLoadState.curve,
    derivedDataLoadState.resources,
    derivedDataLoadState.valuation,
    loadDerivedViewData,
    valuationRange,
  ]);

  async function handleSave() {
    if (!editingLine) return;

    const impacts = buildWorkScheduleReschedulePreview({
      lines: presentationLines,
      changedBudgetItemId: editingLine.budgetItemId,
    });

    if (impacts.length > 0 && reschedulePreview == null) {
      setReschedulePreview({ open: true, impacts, pendingLine: editingLine });
      return;
    }

    setSaveState("saving");
    setError("");

    try {
      const nextData = await persistWorkScheduleLine(editingLine);
      writeEditingLineBudgetItemId(data.budgetId, null);
      setData(normalizeWorkScheduleView(nextData));
      setEditingLine(null);
      setSaveState("idle");
    } catch (saveError) {
      setSaveState("error");
      setError(saveError instanceof Error ? saveError.message : "No se pudo guardar la programacion");
    }
  }

  async function handleInlineRowSave(rowId: string) {
    const draft = inlineDrafts[rowId];
    if (!draft) {
      return;
    }

    if (draft.percentComplete != null && (draft.percentComplete < 0 || draft.percentComplete > 100)) {
      setInlineErrorsById((current) => ({ ...current, [rowId]: "El avance debe estar entre 0 y 100." }));
      return;
    }

    if (draft.actualStartDate && draft.actualEndDate && draft.actualStartDate > draft.actualEndDate) {
      setInlineErrorsById((current) => ({ ...current, [rowId]: "El inicio real no puede ser posterior al fin real." }));
      return;
    }

    const inlineImpacts = buildWorkScheduleReschedulePreview({
      lines: presentationLines,
      changedBudgetItemId: draft.budgetItemId,
    });

    if (inlineImpacts.length > 0 && reschedulePreview == null) {
      setReschedulePreview({ open: true, impacts: inlineImpacts, pendingLine: draft });
      return;
    }

    setInlineSaveStateById((current) => ({ ...current, [rowId]: "saving" }));
    setInlineErrorsById((current) => ({ ...current, [rowId]: "" }));

    try {
      const nextData = await persistWorkScheduleLine(draft);
      setData(normalizeWorkScheduleView(nextData));
      setInlineSaveStateById((current) => ({ ...current, [rowId]: "idle" }));
      setInlineErrorsById((current) => ({ ...current, [rowId]: "" }));
      setInlineDrafts((current) => {
        const nextDrafts = { ...current };
        delete nextDrafts[rowId];
        return nextDrafts;
      });
      setActiveInlineRowId((current) => (current === rowId ? null : current));
    } catch (saveError) {
      setInlineSaveStateById((current) => ({ ...current, [rowId]: "error" }));
      setInlineErrorsById((current) => ({
        ...current,
        [rowId]: saveError instanceof Error ? saveError.message : "No se pudo guardar la programacion",
      }));
    }
  }

  const handleGenerationFormStateChange = useCallback(
    (next: React.SetStateAction<WorkScheduleGenerationFormState>) => {
      setGenerationFormState((current) => {
        const nextState = typeof next === "function" ? next(current) : next;
        if (nextState.customPhaseKeywords !== current.customPhaseKeywords) {
          hasCustomPhaseKeywordsChangedRef.current = true;
        }
        return nextState;
      });
    },
    [],
  );

  const handleSaveGenerationSettings = useCallback(async () => {
    setGenerationSettingsSaveState("saving");
    setGenerationSettingsSaveError("");

    try {
      await saveGenerationSettings(data.budgetId, generationFormState);
      setGenerationSettingsSaveState("success");
    } catch (saveSettingsError) {
      setGenerationSettingsSaveState("error");
      setGenerationSettingsSaveError(saveSettingsError instanceof Error ? saveSettingsError.message : "No se pudo guardar la configuracion");
    }
  }, [data.budgetId, generationFormState]);

  async function handleGenerateIntelligentSchedule() {
    setGenerationState("saving");
    setGenerationError("");

    try {
      await saveGenerationSettings(data.budgetId, generationFormState);

      const response = await fetch(`/api/budgets/${data.budgetId}/work-schedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          baseStartDate: generationBaseDate,
          reviewedBudgetItemIds: generationReviewedBudgetItemIds,
          options: buildGenerationOptionsPayload(generationFormState),
        }),
      });

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error ?? "No se pudo generar el cronograma inteligente");
      }

      const nextData = (await response.json()) as WorkScheduleViewRecord;
      setData(normalizeWorkScheduleView(nextData));
      setInlineDrafts({});
      setInlineErrorsById({});
      setInlineSaveStateById({});
      setActiveInlineRowId(null);
      setGenerationState("idle");
      setIsGenerationDialogOpen(false);
    } catch (generationSaveError) {
      setGenerationState("error");
      setGenerationError(generationSaveError instanceof Error ? generationSaveError.message : "No se pudo generar el cronograma inteligente");
    }
  }

  const handleToggleCollapsedGroup = useCallback((subBudgetId: string) => {
    setCollapsedGroups((current) => ({
      ...current,
      [subBudgetId]: !current[subBudgetId],
    }));
  }, []);

  const handleToggleCollapsedLevel = useCallback((rowId: string) => {
    setCollapsedLevelIds((current) => ({
      ...current,
      [rowId]: !current[rowId],
    }));
  }, []);

  const handleCollapseAllGroups = useCallback(() => {
    setCollapsedGroups(Object.fromEntries(data.groups.map((group) => [group.subBudgetId, true])));
  }, [data.groups]);

  const handleExpandAllGroups = useCallback(() => {
    setCollapsedGroups({});
  }, []);

  const handleScrollRequestHandled = useCallback(() => {
    setOverviewScrollRequest(null);
  }, []);

  function handleEditLine(line: WorkScheduleLineRecord) {
    setEditingLine(createEditableLine(line, predecessorItemCodeToRowNumber));
  }

  function handleActivateInlineRow(line: WorkScheduleLineRecord) {
    setActiveInlineRowId(line.budgetItemId);
    setInlineDrafts((current) => {
      const existingDraft = current[line.budgetItemId];
      if (existingDraft) {
        // `buildPreviewWorkScheduleView` cascades successor dates into
        // `presentationLines` whenever a draft changes, but it intentionally
        // does NOT mutate `inlineDrafts`. If the row was previously activated,
        // the cached draft was holding the OLD dates. Sync the dates back
        // from the current (cascaded) presentation line before the user sees
        // the date picker — otherwise the picker would open at the stale
        // value even though the formatted cell text already shows the new
        // one. Non-date fields (description, crew, predecessor, etc.) are
        // preserved so any unsaved manual edits survive the cascade.
        //
        // Only merge when both dates are present on the cascaded line: a
        // partial range (one side empty) would otherwise trigger
        // `updateEditableLineDates`'s "either date missing → durationDays = 0"
        // branch and silently zero the user's existing duration. If the
        // cascade produced nothing usable, leave the draft untouched.
        if (line.startDate && line.endDate) {
          return {
            ...current,
            [line.budgetItemId]: updateEditableLineDates(existingDraft, {
              startDate: line.startDate,
              endDate: line.endDate,
            }),
          };
        }
        return current;
      }
      return {
        ...current,
        [line.budgetItemId]: createEditableLine(line, predecessorItemCodeToRowNumber),
      };
    });
  }

  const handleInlineDraftChange = useCallback((rowId: string, draft: EditableLine) => {
    setInlineDrafts((current) => ({ ...current, [rowId]: draft }));
  }, []);

  const handleEditingLineChange = useCallback((line: EditableLine | null) => {
    setEditingLine(line);
  }, []);

  const handleEditorPredecessorChange = useCallback((line: EditableLine, predecessor: string) => {
    setEditingLine(
      updateEditableLinePredecessor(line, predecessor, {
        lineByBudgetItemId: presentationLinesByBudgetItemId,
        lineByCode: presentationLinesByCode,
        rowNumberToItemCode: predecessorRowNumberToItemCode,
      }),
    );
  }, [predecessorRowNumberToItemCode, presentationLinesByBudgetItemId, presentationLinesByCode]);

  const handleInlinePredecessorChange = useCallback((rowId: string, line: EditableLine, predecessor: string) => {
    setInlineDrafts((current) => ({
      ...current,
      [rowId]: updateEditableLinePredecessor(line, predecessor, {
        lineByBudgetItemId: presentationLinesByBudgetItemId,
        lineByCode: presentationLinesByCode,
        rowNumberToItemCode: predecessorRowNumberToItemCode,
      }),
    }));
  }, [predecessorRowNumberToItemCode, presentationLinesByBudgetItemId, presentationLinesByCode]);

  function handleInlineRowSaveRequest(rowId: string) {
    void handleInlineRowSave(rowId);
  }

  const handleInlineRowCancel = useCallback((rowId: string) => {
    setInlineDrafts((current) => {
      const nextDrafts = { ...current };
      delete nextDrafts[rowId];
      return nextDrafts;
    });
    setInlineErrorsById((current) => ({ ...current, [rowId]: "" }));
    setInlineSaveStateById((current) => ({ ...current, [rowId]: "idle" }));
    setActiveInlineRowId((current) => (current === rowId ? null : current));
  }, []);

  const handleGanttBarChange = useCallback(
    (line: WorkScheduleLineRecord, result: GanttBarChangeResult) => {
      const recalculatedPredecessor = recalculateDraggedPredecessorString(
        line.predecessor ?? "",
        {
          itemCode: line.itemCode,
          startDate: result.startDate,
          endDate: result.endDate,
          durationDays: result.durationDays,
        },
        presentationLinesByCode,
      );
      const editableLine: EditableLine = {
        budgetItemId: line.budgetItemId,
        itemCode: line.itemCode,
        description: line.description,
        quantity: line.quantity,
        unit: line.unit,
        unitPrice: line.unitPrice,
        partial: line.partial,
        performance: line.performance ?? null,
        subBudgetId: line.subBudgetId,
        subBudgetName: line.subBudgetName,
        startDate: result.startDate,
        endDate: result.endDate,
        durationDays: result.durationDays,
        predecessor: recalculatedPredecessor,
        crew: line.crew?.toString() ?? "",
        monthlyDistributions: result.monthlyDistributions,
        isMilestone: line.isMilestone ?? false,
        baselineStartDate: line.baselineStartDate ?? null,
        baselineEndDate: line.baselineEndDate ?? null,
        actualStartDate: line.actualStartDate ?? null,
        actualEndDate: line.actualEndDate ?? null,
        percentComplete: line.percentComplete ?? null,
      };

      // Optimistic update: set inline draft immediately so the bar stays at the dragged position
      setInlineDrafts((current) => ({ ...current, [line.budgetItemId]: editableLine }));

      // PATCH in background
      persistWorkScheduleLine(editableLine)
        .then((nextData) => {
          setData(normalizeWorkScheduleView(nextData));
          setInlineDrafts((current) => {
            const d = { ...current };
            delete d[line.budgetItemId];
            return d;
          });
        })
        .catch((err) => {
          // eslint-disable-next-line no-console
          console.error("Failed to save Gantt bar change:", err);
          setInlineDrafts((current) => {
            const d = { ...current };
            delete d[line.budgetItemId];
            return d;
          });
        });
    },
    [persistWorkScheduleLine, presentationLinesByCode],
  );


  const handleCreateDependency = useCallback(
    (sourceItemCode: string, targetItemCode: string, relation: WorkSchedulePredecessorRelation, lagDays: number) => {
      const targetLine = presentationLinesByCode.get(targetItemCode);
      if (!targetLine) return;

      const existingPredecessors = parseWorkSchedulePredecessors(targetLine.predecessor);
      const alreadyExists = existingPredecessors.some((ref) => ref.code === sourceItemCode);
      if (alreadyExists) return;

      const newPredecessor = formatPredecessorToken(sourceItemCode, relation, lagDays);
      const mergedPredecessors = existingPredecessors.length > 0
        ? [...existingPredecessors.map((ref) => formatPredecessorToken(ref.code, ref.relation, ref.lagDays)), newPredecessor].join(",")
        : newPredecessor;

      // Recalculate durationDays from startDate/endDate to pass server-side
      // validation (diffInDays + 1).
      const startDate = targetLine.startDate ?? "";
      const endDate = targetLine.endDate ?? "";
      const durationDays = computeDurationFromRange(startDate, endDate, targetLine.durationDays ?? 1);

      const editableLine: EditableLine = {
        budgetItemId: targetLine.budgetItemId,
        itemCode: targetLine.itemCode,
        description: targetLine.description,
        quantity: targetLine.quantity,
        unit: targetLine.unit,
        unitPrice: targetLine.unitPrice,
        partial: targetLine.partial,
        performance: targetLine.performance ?? null,
        subBudgetId: targetLine.subBudgetId,
        subBudgetName: targetLine.subBudgetName,
        startDate,
        endDate,
        durationDays,
        predecessor: mergedPredecessors,
        crew: targetLine.crew?.toString() ?? "",
        monthlyDistributions: targetLine.monthlyDistributions,
        isMilestone: targetLine.isMilestone ?? false,
        baselineStartDate: targetLine.baselineStartDate ?? null,
        baselineEndDate: targetLine.baselineEndDate ?? null,
        actualStartDate: targetLine.actualStartDate ?? null,
        actualEndDate: targetLine.actualEndDate ?? null,
        percentComplete: targetLine.percentComplete ?? null,
      };

      setInlineDrafts((current) => ({ ...current, [targetLine.budgetItemId]: editableLine }));
      persistWorkScheduleLine(editableLine)
        .then((nextData) => {
          setData(normalizeWorkScheduleView(nextData));
          setInlineDrafts((current) => {
            const d = { ...current };
            delete d[targetLine.budgetItemId];
            return d;
          });
        })
        .catch((err) => {
          console.error("Failed to create dependency:", err);
          setInlineDrafts((current) => {
            const d = { ...current };
            delete d[targetLine.budgetItemId];
            return d;
          });
        });
    },
    [presentationLinesByCode],
  );

  const handleEditDependencySave = useCallback(
    (sourceCode: string, targetCode: string, relation: WorkSchedulePredecessorRelation, lagDays: number) => {
      const targetLine = presentationLinesByCode.get(targetCode);
      if (!targetLine) return;

      const predecessors = parseWorkSchedulePredecessors(targetLine.predecessor);
      const updatedPredecessors = predecessors
        .map((ref) =>
          ref.code === sourceCode
            ? formatPredecessorToken(ref.code, relation, lagDays)
            : formatPredecessorToken(ref.code, ref.relation, ref.lagDays),
        )
        .join(",");

      // Recalculate durationDays from startDate/endDate to pass server-side
      // validation (diffInDays + 1).
      const startDate = targetLine.startDate ?? "";
      const endDate = targetLine.endDate ?? "";
      const durationDays = computeDurationFromRange(startDate, endDate, targetLine.durationDays ?? 1);

      const editableLine: EditableLine = {
        budgetItemId: targetLine.budgetItemId,
        itemCode: targetLine.itemCode,
        description: targetLine.description,
        quantity: targetLine.quantity,
        unit: targetLine.unit,
        unitPrice: targetLine.unitPrice,
        partial: targetLine.partial,
        performance: targetLine.performance ?? null,
        subBudgetId: targetLine.subBudgetId,
        subBudgetName: targetLine.subBudgetName,
        startDate,
        endDate,
        durationDays,
        predecessor: updatedPredecessors,
        crew: targetLine.crew?.toString() ?? "",
        monthlyDistributions: targetLine.monthlyDistributions,
        isMilestone: targetLine.isMilestone ?? false,
        baselineStartDate: targetLine.baselineStartDate ?? null,
        baselineEndDate: targetLine.baselineEndDate ?? null,
        actualStartDate: targetLine.actualStartDate ?? null,
        actualEndDate: targetLine.actualEndDate ?? null,
        percentComplete: targetLine.percentComplete ?? null,
      };

      setInlineDrafts((current) => ({ ...current, [targetLine.budgetItemId]: editableLine }));
      persistWorkScheduleLine(editableLine)
        .then((nextData) => {
          setData(normalizeWorkScheduleView(nextData));
          setInlineDrafts((current) => {
            const d = { ...current };
            delete d[targetLine.budgetItemId];
            return d;
          });
        })
        .catch((err) => {
          console.error("Failed to edit dependency:", err);
          setInlineDrafts((current) => {
            const d = { ...current };
            delete d[targetLine.budgetItemId];
            return d;
          });
        });
    },
    [presentationLinesByCode],
  );

  const handleEditDependencyDelete = useCallback(
    (sourceCode: string, targetCode: string) => {
      const targetLine = presentationLinesByCode.get(targetCode);
      if (!targetLine) return;

      const predecessors = parseWorkSchedulePredecessors(targetLine.predecessor);
      const updatedPredecessors = predecessors
        .filter((ref) => ref.code !== sourceCode)
        .map((ref) => formatPredecessorToken(ref.code, ref.relation, ref.lagDays))
        .join(",");

      // Recalculate durationDays from startDate/endDate to pass server-side
      // validation (diffInDays + 1). Using the stored value directly can fail
      // when dates drift from their original duration, e.g. via CPM recalc.
      const startDate = targetLine.startDate ?? "";
      const endDate = targetLine.endDate ?? "";
      const durationDays = startDate && endDate
        ? Math.round((new Date(`${endDate}T00:00:00.000Z`).getTime() - new Date(`${startDate}T00:00:00.000Z`).getTime()) / 86400000) + 1
        : (targetLine.durationDays ?? 1);

      const editableLine: EditableLine = {
        budgetItemId: targetLine.budgetItemId,
        itemCode: targetLine.itemCode,
        description: targetLine.description,
        quantity: targetLine.quantity,
        unit: targetLine.unit,
        unitPrice: targetLine.unitPrice,
        partial: targetLine.partial,
        performance: targetLine.performance ?? null,
        subBudgetId: targetLine.subBudgetId,
        subBudgetName: targetLine.subBudgetName,
        startDate,
        endDate,
        durationDays,
        predecessor: updatedPredecessors,
        crew: targetLine.crew?.toString() ?? "",
        monthlyDistributions: targetLine.monthlyDistributions,
        isMilestone: targetLine.isMilestone ?? false,
        baselineStartDate: targetLine.baselineStartDate ?? null,
        baselineEndDate: targetLine.baselineEndDate ?? null,
        actualStartDate: targetLine.actualStartDate ?? null,
        actualEndDate: targetLine.actualEndDate ?? null,
        percentComplete: targetLine.percentComplete ?? null,
      };

      setInlineDrafts((current) => ({ ...current, [targetLine.budgetItemId]: editableLine }));
      persistWorkScheduleLine(editableLine)
        .then((nextData) => {
          setData(normalizeWorkScheduleView(nextData));
          setInlineDrafts((current) => {
            const d = { ...current };
            delete d[targetLine.budgetItemId];
            return d;
          });
        })
        .catch((err) => {
          console.error("Failed to delete dependency:", err);
          setInlineDrafts((current) => {
            const d = { ...current };
            delete d[targetLine.budgetItemId];
            return d;
          });
        });
    },
    [presentationLinesByCode],
  );

  useLayoutEffect(() => {
    writeActiveView(data.budgetId, activeView);
  }, [activeView, data.budgetId]);

  useEffect(() => {
    writeCollapsedGroups(data.budgetId, collapsedGroups);
  }, [collapsedGroups, data.budgetId]);

  useEffect(() => {
    writeCollapsedLevelIds(data.budgetId, collapsedLevelIds);
  }, [collapsedLevelIds, data.budgetId]);

  useEffect(() => {
    writeOverviewFilter(data.budgetId, overviewFilter);
  }, [data.budgetId, overviewFilter]);

  useEffect(() => {
    writeGenerationFormState(data.budgetId, generationFormState);
  }, [data.budgetId, generationFormState]);



  useEffect(() => {
    if (!isGenerationDialogOpen) {
      setIsLoadingGenerationSettings(false);
      setGenerationSettingsSaveState("idle");
      setGenerationSettingsSaveError("");
      return;
    }

    let cancelled = false;
    hasCustomPhaseKeywordsChangedRef.current = false;

    async function loadSettings() {
      setIsLoadingGenerationSettings(true);
      try {
        const response = await fetch(`/api/budgets/${data.budgetId}/work-schedule/generation-settings`);
        if (!response.ok) {
          return;
        }

        const payload = (await response.json()) as { customPhaseKeywords: Record<string, string[]> | null };
        if (cancelled) {
          return;
        }

        const dbKeywords = formatCustomPhaseKeywordsForForm(payload.customPhaseKeywords);
        const localKeywords = readLocalCustomPhaseKeywords(data.budgetId);
        const mergedKeywords = Object.keys(dbKeywords).length > 0 ? dbKeywords : localKeywords;

        if (!hasCustomPhaseKeywordsChangedRef.current) {
          setGenerationFormState((current) => ({
            ...current,
            customPhaseKeywords: mergedKeywords,
          }));
        }

        if (Object.keys(mergedKeywords).length > 0 && Object.keys(localKeywords).length > 0) {
          clearLocalCustomPhaseKeywords(data.budgetId);
        }
      } catch {
        // Ignore network errors and keep the current form state.
      } finally {
        if (!cancelled) {
          setIsLoadingGenerationSettings(false);
        }
      }
    }

    void loadSettings();

    return () => {
      cancelled = true;
    };
  }, [isGenerationDialogOpen, data.budgetId]);

  useEffect(() => {
    writeGenerationPreviewCollapsedGroups(data.budgetId, generationPreviewCollapsedGroups);
  }, [data.budgetId, generationPreviewCollapsedGroups]);

  useEffect(() => {
    writeGenerationReviewedBudgetItemIds(data.budgetId, generationReviewedBudgetItemIds);
  }, [data.budgetId, generationReviewedBudgetItemIds]);

  useEffect(() => {
    writeCriticalPathVisibility(data.budgetId, showCriticalPath);
  }, [data.budgetId, showCriticalPath]);

  useEffect(() => {
    writeNearCriticalSlackDays(data.budgetId, nearCriticalSlackDays);
  }, [data.budgetId, nearCriticalSlackDays]);

  useEffect(() => {
    writeResourceCalendarMode(data.budgetId, resourceCalendarMode);
  }, [data.budgetId, resourceCalendarMode]);

  useEffect(() => {
    writeExecutiveWorkbookScope(data.budgetId, executiveWorkbookScope);
  }, [data.budgetId, executiveWorkbookScope]);

  useEffect(() => {
    writeValuationWorkbookScope(data.budgetId, valuationWorkbookScope);
  }, [data.budgetId, valuationWorkbookScope]);

  useEffect(() => {
    writeResourceWorkbookScope(data.budgetId, resourceWorkbookScope);
  }, [data.budgetId, resourceWorkbookScope]);

  useEffect(() => {
    writeCurveWorkbookScope(data.budgetId, curveWorkbookScope);
  }, [data.budgetId, curveWorkbookScope]);

  useEffect(() => {
    if (!isExportMenuOpen) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Node) || exportMenuRef.current?.contains(target)) {
        return;
      }

      setIsExportMenuOpen(false);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [isExportMenuOpen]);

  useEffect(() => {
    writeEditingLineBudgetItemId(data.budgetId, editingLine?.budgetItemId ?? null);
  }, [data.budgetId, editingLine]);

  useEffect(() => {
    if (!highlightedBudgetItemId) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setHighlightedBudgetItemId((current) => (current === highlightedBudgetItemId ? null : current));
    }, 2200);

    return () => window.clearTimeout(timeoutId);
  }, [highlightedBudgetItemId]);

  // Undo/redo keyboard shortcuts
  useEffect(() => {
    function handleUndoRedoKeyboard(event: KeyboardEvent) {
      const isMod = event.ctrlKey || event.metaKey;
      if (!isMod) return;

      // Don't capture undo/redo when user is focused on a text input
      const target = event.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        (target instanceof HTMLElement && target.isContentEditable)
      ) {
        return;
      }

      if (event.key === "z" && !event.shiftKey) {
        event.preventDefault();
        undo();
      } else if ((event.key === "z" && event.shiftKey) || event.key === "y") {
        event.preventDefault();
        redo();
      }
    }

    window.addEventListener("keydown", handleUndoRedoKeyboard);
    return () => window.removeEventListener("keydown", handleUndoRedoKeyboard);
  }, [undo, redo]);

  const handleNavigateEditingLine = useCallback((direction: "previous" | "next") => {
    if (!editingLine) {
      return;
    }

    const currentIndex = navigationLines.findIndex((line) => line.budgetItemId === editingLine.budgetItemId);
    if (currentIndex < 0) {
      return;
    }

    const nextIndex = direction === "previous" ? currentIndex - 1 : currentIndex + 1;
    const targetLine = navigationLines[nextIndex];
    if (!targetLine) {
      return;
    }

    setEditingLine(createEditableLine(targetLine, predecessorItemCodeToRowNumber));
    setActiveView("overview");
    setOverviewScrollRequest(calculateOverviewScrollTarget(targetLine.startDate ?? "", timelineDays, timelineDayIndexByIso));
    setHighlightedBudgetItemId(targetLine.budgetItemId);
  }, [editingLine, navigationLines, predecessorItemCodeToRowNumber, timelineDayIndexByIso, timelineDays]);

  useEffect(() => {
    if (!editingLine) {
      return;
    }

    function handleEditingLineKeyboardNavigation(event: KeyboardEvent) {
      if (!event.altKey) {
        return;
      }

      if (event.key === "ArrowLeft" && canNavigateToPreviousLine) {
        event.preventDefault();
        handleNavigateEditingLine("previous");
      }

      if (event.key === "ArrowRight" && canNavigateToNextLine) {
        event.preventDefault();
        handleNavigateEditingLine("next");
      }
    }

    window.addEventListener("keydown", handleEditingLineKeyboardNavigation);
    return () => window.removeEventListener("keydown", handleEditingLineKeyboardNavigation);
  }, [canNavigateToNextLine, canNavigateToPreviousLine, editingLine, handleNavigateEditingLine]);

  function handleCloseEditor() {
    writeEditingLineBudgetItemId(data.budgetId, null);
    setEditingLine(null);
    setSaveState("idle");
    setError("");
  }

  function handleJumpToSchedule() {
    if (!editingLine) {
      return;
    }

    setActiveView("overview");
    setOverviewScrollRequest(calculateOverviewScrollTarget(editingLine.startDate, timelineDays, timelineDayIndexByIso));
    setHighlightedBudgetItemId(editingLine.budgetItemId);
  }

  function handleExportCsv() {
    const periods = data.valuationCalendar?.periods ?? [];
    const exportPayload = buildWorkScheduleCsvExport({
      activeView,
      overviewLines: filteredVisibleLines,
      valuationRows: filteredValuationRows,
      resourceRows: filteredResourceRows,
      curvePoints: filteredCurveSeries,
      periods,
      currency: data.currency,
      currencyDecimals,
      dateFormat,
    });

    if (!exportPayload) {
      return;
    }

    downloadTextFile(exportPayload.fileName, exportPayload.content, "text/csv;charset=utf-8;");
  }

  function handleExportOverviewSummaryCsv() {
    const exportPayload = buildWorkScheduleOverviewSummaryCsvExport({
      overviewLines: filteredVisibleLines,
      currency: data.currency,
      currencyDecimals,
      dateFormat,
    });

    downloadTextFile(exportPayload.fileName, exportPayload.content, "text/csv;charset=utf-8;");
  }

  function handleExportOverviewMonthlySummaryCsv() {
    const periods = data.valuationCalendar?.periods ?? [];
    const exportPayload = buildWorkScheduleOverviewMonthlySummaryCsvExport({
      valuationRows: filteredValuationRows,
      periods,
      currency: data.currency,
      currencyDecimals,
    });

    downloadTextFile(exportPayload.fileName, exportPayload.content, "text/csv;charset=utf-8;");
  }

  function handleExportOverviewExecutivePackageCsv() {
    const periods = data.valuationCalendar?.periods ?? [];
    const exportPayload = buildWorkScheduleOverviewExecutivePackageCsvExport({
      overviewLines: filteredVisibleLines,
      valuationRows: filteredValuationRows,
      periods,
      currency: data.currency,
      currencyDecimals,
      dateFormat,
    });

    downloadTextFile(exportPayload.fileName, exportPayload.content, "text/csv;charset=utf-8;");
  }

  async function handleExportOverviewExecutivePackageXlsx() {
    const periods = data.valuationCalendar?.periods ?? [];
    const workbookBuffer = await buildWorkScheduleOverviewExecutivePackageWorkbook({
      overviewLines: filteredVisibleLines,
      valuationRows: filteredValuationRows,
      periods,
      currency: data.currency,
      currencyDecimals,
      dateFormat,
      scope: executiveWorkbookScope,
    });

    downloadBinaryFile(
      "work-schedule-cronograma-paquete-ejecutivo.xlsx",
      workbookBuffer,
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
  }

  async function handleExportActiveViewXlsx() {
    const periods = data.valuationCalendar?.periods ?? [];
    const exportPayload = await buildWorkScheduleActiveViewWorkbook({
      activeView,
      valuationRows: filteredValuationRows,
      resourceRows: filteredResourceRows,
      curvePoints: filteredCurveSeries,
      periods,
      currency: data.currency,
      currencyDecimals,
      curveWorkbookScope,
      valuationWorkbookScope,
      resourceWorkbookScope,
    });

    if (!exportPayload) {
      return;
    }

    downloadBinaryFile(
      exportPayload.fileName,
      exportPayload.content,
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
  }

  return (
    <div className="space-y-5">
      <Card className="border-[var(--app-border)] bg-[var(--app-surface)]">
        <CardContent className="space-y-5 p-6">
          <OperationalPanel
            title="Programacion de obra"
            description="Cronograma consolidado del proyecto, valorizacion mensual derivada, calendario de insumos y curva S basica."
            metrics={
              <>
                <span className="rounded-full border border-[var(--app-border)] bg-[var(--app-surface-muted)] px-3 py-1 text-xs font-medium text-[var(--app-text-muted)]">
                  {summary.programmedItems} partidas programadas
                </span>
                {showCriticalPath && data.criticalPath ? (
                  <span className="theme-status-error rounded-full border px-3 py-1 text-xs font-medium dark:text-rose-200">
                    {data.criticalPath.criticalItemCount} partidas criticas
                  </span>
                ) : null}
                {showCriticalPath && data.criticalPath?.status === "calculated" ? (
                  <span className="rounded-full border border-[var(--app-border)] bg-[var(--app-surface-muted)] px-3 py-1 text-xs font-medium text-[var(--app-text-muted)]">
                    {data.criticalPath.projectDurationDays} dias CPM
                  </span>
                ) : null}
                <span className="rounded-full border border-[var(--app-border)] bg-[var(--app-surface-muted)] px-3 py-1 text-xs font-medium text-[var(--app-text-muted)]">
                  {summary.periods} periodos valorizados
                </span>
              </>
            }
          />

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <InfoTile label="Proyecto" value={data.projectName} />
            {(() => { const start = data.timeline.startDate; const end = data.timeline.endDate; const days = start && end ? Math.round((new Date(end).getTime() - new Date(start).getTime()) / 86400000) + 1 : null; const workDays = start && end && data.workCalendar ? countWorkDays(start, end, data.workCalendar.workDays) : null; return <InfoTile label="Ventana" value={days != null ? `${formatTimelineRange(start, end, dateFormat)} · ${days} días${workDays != null ? ` (${workDays} hábiles)` : ""}` : formatTimelineRange(start, end, dateFormat)} />; })()}
            <InfoTile label="Total programado" value={formatCurrency(summary.totalAmount, data.currency, currencyDecimals)} />
            <InfoTile label="Insumos derivados" value={`${data.resourceCalendar?.rows.length ?? 0}`} />
          </div>

          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <ViewButton active={activeView === "overview"} icon={<CalendarDays className="h-4 w-4" />} onClick={() => setActiveView("overview")}>
                Cronograma
              </ViewButton>
              <ViewButton active={activeView === "valuation"} icon={<PenSquare className="h-4 w-4" />} onClick={() => setActiveView("valuation")}>
                Calendario valorizado
              </ViewButton>
              <ViewButton active={activeView === "resources"} icon={<Package2 className="h-4 w-4" />} onClick={() => setActiveView("resources")}>
                Calendario de insumos
              </ViewButton>
              <ViewButton active={activeView === "curve"} icon={<ChartSpline className="h-4 w-4" />} onClick={() => setActiveView("curve")}>
                Curva S
              </ViewButton>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2 lg:ml-auto">
              {activeView === "overview" ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-10 rounded-full px-4 text-[11px] font-semibold tracking-[0.08em]"
                  onClick={() => {
                    setGenerationBaseDate(data.timeline.startDate ?? new Date().toISOString().slice(0, 10));
                    setGenerationError("");
                    setGenerationState("idle");
                    setIsGenerationDialogOpen(true);
                  }}
                >
                  <WandSparkles className="h-4 w-4" />
                  Generar cronograma inteligente
                </Button>
              ) : null}
              <ExportPanel
                buttonLabel="Exportar central"
                className="h-10 rounded-full px-4 text-[11px] font-semibold tracking-[0.08em]"
                contextOptions={{ currencyDecimals }}
                defaultPreset="cronograma_ejecutivo"
                definition={getExportDefinition("work_schedule")}
                targetId={data.budgetId}
              />
              <div ref={exportMenuRef} className="relative flex h-10 items-center gap-1 rounded-full border border-[var(--app-border)] bg-[var(--app-surface)] px-1 py-1 shadow-[0_12px_24px_-22px_rgba(15,23,42,0.22)] transition hover:border-[var(--app-border-strong)] hover:bg-[var(--app-surface-hover)]">
                <button
                  type="button"
                  aria-label="Abrir acciones de exportacion"
                  aria-haspopup="menu"
                  aria-expanded={isExportMenuOpen}
                  aria-controls="work-schedule-export-menu"
                  onClick={() => setIsExportMenuOpen((current) => !current)}
                  className="inline-flex h-8 items-center gap-1 rounded-full px-3 text-[11px] font-semibold tracking-[0.08em] text-[var(--app-text-muted)] transition hover:bg-[var(--app-surface-hover-strong)] hover:text-[var(--app-text-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                >
                  Exportar
                  <MoreHorizontal className="h-4 w-4" />
                </button>
                {isExportMenuOpen ? (
                  <div
                    id="work-schedule-export-menu"
                    role="menu"
                    aria-label="Acciones de exportacion del cronograma"
                    className="absolute right-0 top-[calc(100%+0.5rem)] z-30 w-64 overflow-hidden rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-1 shadow-2xl"
                    onKeyDown={(event) => {
                      if (event.key === "Escape") {
                        setIsExportMenuOpen(false);
                      }
                    }}
                  >
                    <WorkScheduleExportMenuButton
                      label="Exportar CSV"
                      onClick={() => {
                        handleExportCsv();
                        setIsExportMenuOpen(false);
                      }}
                    />
                    {activeView !== "overview" ? (
                      <WorkScheduleExportMenuButton
                        label="Exportar XLSX"
                        onClick={() => {
                          void handleExportActiveViewXlsx();
                          setIsExportMenuOpen(false);
                        }}
                      />
                    ) : null}
                    {activeView === "overview" ? (
                      <>
                        <div className="my-1 border-t border-[var(--app-border-soft)]" />
                        <WorkScheduleExportMenuButton
                          label="Exportar resumen CSV"
                          onClick={() => {
                            handleExportOverviewSummaryCsv();
                            setIsExportMenuOpen(false);
                          }}
                        />
                        <WorkScheduleExportMenuButton
                          label="Exportar resumen mensual CSV"
                          onClick={() => {
                            handleExportOverviewMonthlySummaryCsv();
                            setIsExportMenuOpen(false);
                          }}
                        />
                        <WorkScheduleExportMenuButton
                          label="Exportar paquete ejecutivo CSV"
                          onClick={() => {
                            handleExportOverviewExecutivePackageCsv();
                            setIsExportMenuOpen(false);
                          }}
                        />
                        <WorkScheduleExportMenuButton
                          label="Exportar paquete ejecutivo XLSX"
                          onClick={() => {
                            void handleExportOverviewExecutivePackageXlsx();
                            setIsExportMenuOpen(false);
                          }}
                        />
                      </>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          {activeView === "overview" || activeView === "valuation" || activeView === "resources" || activeView === "curve" ? (
            <div className="space-y-2 rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-muted)] px-3 py-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium text-[var(--app-text)]">Preferencias de exportacion XLSX:</span>
                <span className="text-xs text-[var(--app-text-muted)]">{getWorkbookExportTargetLabel(activeView)}</span>
                <span className="text-xs font-medium text-[var(--app-text-muted)]">Perfiles:</span>
                {getSupportedWorkbookProfiles(activeView).map((profile) => (
                  <ExportPreferenceButton
                    key={profile}
                    active={
                      getWorkbookExportProfileFromScope(activeView, getWorkbookExportScopeForView(activeView, {
                        executiveWorkbookScope,
                        valuationWorkbookScope,
                        resourceWorkbookScope,
                        curveWorkbookScope,
                      })) === profile
                    }
                    onClick={() => {
                      const nextScope = getWorkbookExportScopeFromProfile(activeView, profile);
                      if (activeView === "overview") {
                        setExecutiveWorkbookScope(nextScope);
                        return;
                      }

                      if (activeView === "valuation") {
                        setValuationWorkbookScope(nextScope);
                        return;
                      }

                      if (activeView === "resources") {
                        setResourceWorkbookScope(nextScope);
                        return;
                      }

                      setCurveWorkbookScope(nextScope);
                    }}
                  >
                    {getWorkbookExportProfileLabel(profile)}
                  </ExportPreferenceButton>
                ))}
                <span className="text-xs font-medium text-[var(--app-text-muted)]">Alcance:</span>
                {activeView === "overview" ? (
                  <>
                    <ExportPreferenceButton active={executiveWorkbookScope === "detail_only"} onClick={() => setExecutiveWorkbookScope("detail_only")}>
                      Solo detalle
                    </ExportPreferenceButton>
                    <ExportPreferenceButton active={executiveWorkbookScope === "detail_and_total"} onClick={() => setExecutiveWorkbookScope("detail_and_total")}>
                      Detalle + total
                    </ExportPreferenceButton>
                    <ExportPreferenceButton
                      active={executiveWorkbookScope === "detail_subtotals_and_total"}
                      onClick={() => setExecutiveWorkbookScope("detail_subtotals_and_total")}
                    >
                      Detalle + subtotales + total
                    </ExportPreferenceButton>
                  </>
                ) : null}
                {activeView === "valuation" ? (
                  <>
                    <ExportPreferenceButton active={valuationWorkbookScope === "detail_only"} onClick={() => setValuationWorkbookScope("detail_only")}>
                      Solo detalle
                    </ExportPreferenceButton>
                    <ExportPreferenceButton active={valuationWorkbookScope === "detail_and_total"} onClick={() => setValuationWorkbookScope("detail_and_total")}>
                      Detalle + total
                    </ExportPreferenceButton>
                    <ExportPreferenceButton
                      active={valuationWorkbookScope === "detail_subtotals_and_total"}
                      onClick={() => setValuationWorkbookScope("detail_subtotals_and_total")}
                    >
                      Detalle + subtotales + total
                    </ExportPreferenceButton>
                  </>
                ) : null}
                {activeView === "resources" ? (
                  <>
                    <ExportPreferenceButton active={resourceWorkbookScope === "detail_only"} onClick={() => setResourceWorkbookScope("detail_only")}>
                      Solo detalle
                    </ExportPreferenceButton>
                    <ExportPreferenceButton active={resourceWorkbookScope === "detail_and_total"} onClick={() => setResourceWorkbookScope("detail_and_total")}>
                      Detalle + total
                    </ExportPreferenceButton>
                    <ExportPreferenceButton
                      active={resourceWorkbookScope === "detail_subtotals_and_total"}
                      onClick={() => setResourceWorkbookScope("detail_subtotals_and_total")}
                    >
                      Detalle + subtotales + total
                    </ExportPreferenceButton>
                  </>
                ) : null}
                {activeView === "curve" ? (
                  <>
                    <ExportPreferenceButton active={curveWorkbookScope === "detail_only"} onClick={() => setCurveWorkbookScope("detail_only")}>
                      Solo detalle
                    </ExportPreferenceButton>
                    <ExportPreferenceButton active={curveWorkbookScope === "detail_and_total"} onClick={() => setCurveWorkbookScope("detail_and_total")}>
                      Detalle + total
                    </ExportPreferenceButton>
                  </>
                ) : null}
              </div>
              <p className="text-xs text-[var(--app-text-muted)]">
                {describeWorkbookExportPreview(activeView, {
                  executiveWorkbookScope,
                  valuationWorkbookScope,
                  resourceWorkbookScope,
                  curveWorkbookScope,
                })}
              </p>
              <div className="flex flex-wrap gap-2">
                {buildWorkbookExportPreviewBadges(
                  activeView,
                  {
                    executiveWorkbookScope,
                    valuationWorkbookScope,
                    resourceWorkbookScope,
                    curveWorkbookScope,
                  },
                ).map((badge) => (
                  <span
                    key={badge}
                    className="rounded-full border border-[var(--app-border)] bg-[var(--app-surface)] px-2.5 py-1 text-[11px] font-medium text-[var(--app-text-muted)]"
                  >
                    {badge}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          {overviewFilter !== "all" ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="theme-status-info theme-status-info-strong rounded-full border px-3 py-1 text-xs font-medium">
                {`Filtro activo: ${formatOverviewFilterLabel(overviewFilter)}`}
              </span>
              <Button variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={() => setOverviewFilter("all")}>
                Limpiar filtro
              </Button>
            </div>
          ) : null}

          {data.generationSummary ? (
            <div className="theme-status-info theme-status-info-strong space-y-2 rounded-2xl border px-4 py-3">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-semibold">Cronograma inteligente generado</span>
                <span>{data.generationSummary.generatedCount} partidas programadas</span>
                <span>{data.generationSummary.pendingCount} pendientes</span>
              </div>
              {data.generationSummary.issues.length > 0 ? (
                <div className="flex flex-wrap gap-2 text-xs">
                  {data.generationSummary.issues.slice(0, 4).map((issue) => (
                    <span key={issue.budgetItemId} className="theme-surface-panel theme-muted-text rounded-full border px-2.5 py-1">
                      {issue.itemCode}: {issue.reason}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

          {effectiveReviewSummary && effectiveReviewSummary.warnings.length > 0 ? (
            <div className="theme-status-warning theme-status-warning-strong space-y-2 rounded-2xl border px-4 py-3">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-semibold">Revision previa del cronograma</span>
                <span>{effectiveReviewSummary.warningCount} advertencias detectadas</span>
              </div>
              <div className="space-y-2 text-xs">
                {effectiveReviewSummary.warnings.map((warning) => (
                  <div key={warning.code} className="space-y-1">
                    <p className="font-medium">{warning.label}</p>
                    <p className="theme-muted-text">{warning.count} partidas afectadas.</p>
                    <div className="flex flex-wrap gap-2">
                      {warning.examples.map((example) => (
                        <span key={example.budgetItemId} className="theme-surface-panel theme-muted-text rounded-full border px-2.5 py-1">
                          {example.itemCode}: {example.description}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {activeView === "overview" ? (
        <WorkScheduleOverview
          data={presentationData}
          isExcelMode={isExcelMode}
          timelineDays={timelineDays}
          hasDailyTimeline={presentationData.scale.canLoadDailyTimeline}
          dateFormat={dateFormat}
          currencyDecimals={currencyDecimals}
          predecessorItemCodeToRowNumber={predecessorItemCodeToRowNumber}
          collapsedGroups={collapsedGroups}
          collapsedLevelIds={collapsedLevelIds}
          onToggleGroup={handleToggleCollapsedGroup}
          onToggleCollapsedLevel={handleToggleCollapsedLevel}
          onCollapseAll={handleCollapseAllGroups}
          onExpandAll={handleExpandAllGroups}
          overviewFilter={overviewFilter}
          onOverviewFilterChange={setOverviewFilter}
          showCriticalPath={showCriticalPath}
          onShowCriticalPathChange={setShowCriticalPath}
          nearCriticalSlackDays={nearCriticalSlackDays}
          onNearCriticalSlackDaysChange={setNearCriticalSlackDays}
          highlightedBudgetItemId={highlightedBudgetItemId}
          scrollRequest={overviewScrollRequest}
          onScrollRequestHandled={handleScrollRequestHandled}
          onEditLine={handleEditLine}
          activeInlineRowId={activeInlineRowId}
          inlineDrafts={cascadedInlineDrafts}
          inlineSaveStateById={inlineSaveStateById}
          inlineErrorsById={inlineErrorsById}
          onActivateInlineRow={handleActivateInlineRow}
          onInlineDraftChange={handleInlineDraftChange}
          onInlinePredecessorChange={handleInlinePredecessorChange}
          onInlineRowSave={handleInlineRowSaveRequest}
          onInlineRowCancel={handleInlineRowCancel}
          onGanttBarChange={handleGanttBarChange}
          onCreateDependency={handleCreateDependency}
          onEditDependency={handleEditDependencySave}
          onDeleteDependency={handleEditDependencyDelete}
          hoveredItemCode={hoveredItemCode}
          onHoverItemCode={setHoveredItemCode}
        />
      ) : null}

      {activeView === "overview" ? (
        <div className="grid gap-5 lg:grid-cols-2">
          <ScheduleDeviationPanel deviations={scheduleDeviations} />
          <LookaheadView lines={presentationLines} asOfDate={asOfDate} />
        </div>
      ) : null}

      {activeView === "valuation" ? (
        derivedDataLoadState.valuation === "loading" && data.valuationCalendar == null ? (
          <DerivedViewLoadingCard label="Cargando calendario valorizado" />
        ) : derivedDataLoadState.valuation === "error" && data.valuationCalendar == null ? (
          <DerivedViewUnavailableCard
            title="No se pudo cargar el calendario valorizado"
            description={derivedDataErrors.valuation || "Vuelve a intentarlo en unos segundos."}
          />
        ) : (
          <ValuationCalendarView
            rows={filteredValuationRows}
            periods={data.valuationCalendar?.periods ?? []}
            currency={data.currency}
            currencyDecimals={currencyDecimals}
            activeFilterLabel={overviewFilter !== "all" ? formatOverviewFilterLabel(overviewFilter) : null}
            periodRange={valuationRange}
            availableRange={data.valuationCalendar?.availableRange ?? getAvailableValuationRange(data)}
            isSegmented={!data.scale.canLoadDerivedCalendars}
            onPeriodRangeChange={setValuationRange}
            onApplyPeriodRange={() => {
              setData((current) => normalizeWorkScheduleView({ ...current, valuationCalendar: null }));
              void loadDerivedViewData("valuation", valuationRange);
            }}
          />
        )
      ) : null}

      {activeView === "resources" ? (
        !data.scale.canLoadDerivedCalendars ? (
          <DerivedViewUnavailableCard
            title="Calendario de insumos diferido"
            description={`Este cronograma abarca ${formatNumber(data.scale.periodCount, 0)} periodos. Reduce el rango o abre una version segmentada antes de cargar este calendario.`}
          />
        ) : derivedDataLoadState.resources === "loading" && data.resourceCalendar == null ? (
          <DerivedViewLoadingCard label="Cargando calendario de insumos" />
        ) : derivedDataLoadState.resources === "error" && data.resourceCalendar == null ? (
          <DerivedViewUnavailableCard
            title="No se pudo cargar el calendario de insumos"
            description={derivedDataErrors.resources || "Vuelve a intentarlo en unos segundos."}
          />
        ) : (
          <div className="space-y-5">
            <ResourceCapacityPanel overallocations={resourceOverallocations} />
            <ResourceCalendarView
              rows={filteredResourceRows}
              periods={data.resourceCalendar?.periods ?? []}
              currency={data.currency}
              currencyDecimals={currencyDecimals}
              mode={resourceCalendarMode}
              onModeChange={setResourceCalendarMode}
              activeFilterLabel={overviewFilter !== "all" ? formatOverviewFilterLabel(overviewFilter) : null}
            />
          </div>
        )
      ) : null}

      {activeView === "curve" ? (
        !data.scale.canLoadDerivedCalendars ? (
          <DerivedViewUnavailableCard
            title="Curva S diferida"
            description={`Este cronograma abarca ${formatNumber(data.scale.periodCount, 0)} periodos. Reduce el rango o abre una version segmentada antes de cargar esta curva.`}
          />
        ) : derivedDataLoadState.curve === "loading" && data.curveSeries == null ? (
          <DerivedViewLoadingCard label="Cargando curva S" />
        ) : derivedDataLoadState.curve === "error" && data.curveSeries == null ? (
          <DerivedViewUnavailableCard
            title="No se pudo cargar la curva S"
            description={derivedDataErrors.curve || "Vuelve a intentarlo en unos segundos."}
          />
        ) : (
          <CurveSView
            points={filteredCurveSeries}
            currency={data.currency}
            currencyDecimals={currencyDecimals}
            activeFilterLabel={overviewFilter !== "all" ? formatOverviewFilterLabel(overviewFilter) : null}
          />
        )
      ) : null}

      {editingLine ? (
        <WorkScheduleEditorSheet
          line={editingLine}
          open
          saveState={saveState}
          error={error}
          dateFormat={dateFormat}
          onClose={handleCloseEditor}
          onJumpToSchedule={handleJumpToSchedule}
          canNavigateToPreviousLine={canNavigateToPreviousLine}
          canNavigateToNextLine={canNavigateToNextLine}
          onNavigateToPreviousLine={() => handleNavigateEditingLine("previous")}
          onNavigateToNextLine={() => handleNavigateEditingLine("next")}
          onSave={handleSave}
          onChange={handleEditingLineChange}
          onPredecessorChange={handleEditorPredecessorChange}
        />
      ) : null}

      {reschedulePreview ? (
        <ReschedulePreviewDialog
          open={reschedulePreview.open}
          impacts={reschedulePreview.impacts}
          onApply={async () => {
            const line = reschedulePreview.pendingLine;
            setReschedulePreview(null);
            if (!line) return;
            try {
              const nextData = await persistWorkScheduleLine(line);
              setData(normalizeWorkScheduleView(nextData));
              if (editingLine?.budgetItemId === line.budgetItemId) {
                setEditingLine(null);
                setSaveState("idle");
              }
              if (inlineDrafts[line.budgetItemId]) {
                setInlineDrafts((current) => {
                  const next = { ...current };
                  delete next[line.budgetItemId];
                  return next;
                });
                setActiveInlineRowId((current) => (current === line.budgetItemId ? null : current));
              }
            } catch (saveError) {
              setSaveState("error");
              setError(saveError instanceof Error ? saveError.message : "No se pudo guardar la programacion");
            }
          }}
          onSaveOnlyThis={async () => {
            const line = reschedulePreview.pendingLine;
            setReschedulePreview(null);
            if (!line) return;
            try {
              const nextData = await persistWorkScheduleLine(line);
              setData(normalizeWorkScheduleView(nextData));
              if (editingLine?.budgetItemId === line.budgetItemId) {
                setEditingLine(null);
                setSaveState("idle");
              }
              if (inlineDrafts[line.budgetItemId]) {
                setInlineDrafts((current) => {
                  const next = { ...current };
                  delete next[line.budgetItemId];
                  return next;
                });
                setActiveInlineRowId((current) => (current === line.budgetItemId ? null : current));
              }
            } catch (saveError) {
              setSaveState("error");
              setError(saveError instanceof Error ? saveError.message : "No se pudo guardar la programacion");
            }
          }}
          onCancel={() => setReschedulePreview(null)}
        />
      ) : null}

      <WorkScheduleGenerationDialog
        open={isGenerationDialogOpen}
        baseStartDate={generationBaseDate}
        formState={generationFormState}
        previewGroups={generationLevelPreviewGroups}
        collapsedGroups={generationPreviewCollapsedGroups}
        reviewedBudgetItemIds={generationReviewedBudgetItemIds}
        saveState={generationState}
        error={generationError}
        settingsSaveState={generationSettingsSaveState}
        settingsSaveError={generationSettingsSaveError}
        hasExistingSchedule={orderedLines.some((line) => line.startDate && line.endDate && line.durationDays != null)}
        reviewSummary={effectiveReviewSummary}
        isLoadingCustomPhaseKeywords={isLoadingGenerationSettings}
        onBaseStartDateChange={setGenerationBaseDate}
        onSaveSettings={handleSaveGenerationSettings}
        onFormStateChange={handleGenerationFormStateChange}
        onTogglePreviewGroup={(subBudgetId) =>
          setGenerationPreviewCollapsedGroups((current) => ({
            ...current,
            [subBudgetId]: !current[subBudgetId],
          }))
        }
        onSetAllLevelLinkage={(mode) =>
          setGenerationFormState((current) => ({
            ...current,
            levelLinkage: Object.fromEntries(
              generationLevelPreviewGroups.flatMap((group) => group.levels.map((level) => [level.levelId, mode])),
            ),
          }))
        }
        onToggleReviewedBudgetItem={(budgetItemId) =>
          setGenerationReviewedBudgetItemIds((current) =>
            current.includes(budgetItemId) ? current.filter((itemId) => itemId !== budgetItemId) : [...current, budgetItemId],
          )
        }
        onMarkAllReviewed={() =>
          setGenerationReviewedBudgetItemIds((current) => {
            const allExampleIds = (
              effectiveReviewSummary?.warnings.flatMap((w) => w.examples.map((e) => e.budgetItemId)) ?? []
            );
            const newIds = allExampleIds.filter((id) => !current.includes(id));
            return newIds.length > 0 ? [...current, ...newIds] : current;
          })
        }
        onClose={() => setIsGenerationDialogOpen(false)}
        onSubmit={() => void handleGenerateIntelligentSchedule()}
      />
    </div>
  );
}


function DerivedViewLoadingCard({ label }: { label: string }) {
  return (
    <Card className="rounded-3xl border border-[var(--app-border)] shadow-[0_18px_40px_-28px_rgba(15,23,42,0.28)]">
      <CardContent className="flex min-h-40 items-center justify-center p-8 text-sm text-[var(--app-text-muted)]">
        {label}...
      </CardContent>
    </Card>
  );
}

function DerivedViewUnavailableCard({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <Card className="rounded-3xl border border-[var(--app-border)] shadow-[0_18px_40px_-28px_rgba(15,23,42,0.28)]">
      <CardContent className="space-y-3 p-8">
        <p className="text-base font-semibold text-[var(--app-text-strong)]">{title}</p>
        <p className="text-sm text-[var(--app-text-muted)]">{description}</p>
      </CardContent>
    </Card>
  );
}


type WorkScheduleLevelTableRowProps = {
  row: Extract<WorkScheduleDisplayRowRecord, { kind: "level" }>;
  rowNumber: number | null;
  dateFormat: string;
  currency: string;
  currencyDecimals: number;
  showCostColumns: boolean;
  collapsed: boolean;
  onToggleCollapsed: (rowId: string) => void;
  onRegisterRow: (rowId: string, element: HTMLElement | null) => void;
};


function ValuationCalendarView({
  rows,
  periods,
  currency,
  currencyDecimals,
  activeFilterLabel,
  periodRange,
  availableRange,
  isSegmented,
  onPeriodRangeChange,
  onApplyPeriodRange,
}: {
  rows: WorkScheduleValuationCalendarRow[];
  periods: WorkSchedulePeriodRecord[];
  currency: string;
  currencyDecimals: number;
  activeFilterLabel: string | null;
  periodRange: PeriodRangeSelection;
  availableRange: PeriodRangeSelection | null;
  isSegmented: boolean;
  onPeriodRangeChange: (range: PeriodRangeSelection) => void;
  onApplyPeriodRange: () => void;
}) {
  return (
    <DerivedTableCard
      title="Calendario valorizado"
      description="Vista mensual valorizada inspirada en el archivo Calendario_Valorizado.xlsx."
      activeFilterLabel={activeFilterLabel}
    >
      {isSegmented ? (
        <div className="mb-3 flex flex-wrap items-end gap-3 rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-muted)] p-3">
          <label className="flex min-w-40 flex-col gap-1 text-xs text-[var(--app-text-muted)]">
            Rango mensual
            <input
              type="month"
              value={periodRange.fromPeriodKey}
              min={availableRange?.fromPeriodKey ?? undefined}
              max={periodRange.toPeriodKey}
              onChange={(event) => onPeriodRangeChange({ ...periodRange, fromPeriodKey: event.target.value })}
              className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2 text-sm text-[var(--app-text-strong)]"
            />
          </label>
          <label className="flex min-w-40 flex-col gap-1 text-xs text-[var(--app-text-muted)]">
            Hasta
            <input
              type="month"
              value={periodRange.toPeriodKey}
              min={periodRange.fromPeriodKey}
              max={availableRange?.toPeriodKey ?? undefined}
              onChange={(event) => onPeriodRangeChange({ ...periodRange, toPeriodKey: event.target.value })}
              className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2 text-sm text-[var(--app-text-strong)]"
            />
          </label>
          <Button className="h-10 px-4" onClick={onApplyPeriodRange}>
            Aplicar rango
          </Button>
          {availableRange ? (
            <span className="text-xs text-[var(--app-text-muted)]">
              Disponible: {availableRange.fromPeriodKey} a {availableRange.toPeriodKey}
            </span>
          ) : null}
        </div>
      ) : null}
      <div data-testid="valuation-calendar-table-scroll" className="overflow-x-auto rounded-2xl border border-[var(--app-border)]">
        <Table
          className="min-w-max text-[11px]"
          style={{
            minWidth: `${760 + periods.length * 112}px`,
          }}
        >
          <THead className="bg-[var(--app-surface-muted)]">
            <TR className="whitespace-nowrap">
              <TH className="w-24 whitespace-nowrap px-2 py-2 text-[11px]">Item</TH>
              <TH className="w-80 whitespace-nowrap px-2 py-2 text-[11px]">Partida</TH>
              <TH className="w-16 whitespace-nowrap px-2 py-2 text-[11px]">Und.</TH>
              <TH className="w-20 whitespace-nowrap px-2 py-2 text-right text-[11px]">Metrado</TH>
              <TH className="w-24 whitespace-nowrap px-2 py-2 text-right text-[11px]">PU</TH>
              <TH className="w-28 whitespace-nowrap px-2 py-2 text-right text-[11px]">Parcial</TH>
              {periods.map((period) => (
                <TH key={period.key} className="w-28 whitespace-nowrap px-2 py-2 text-right text-[11px]">
                  {formatPeriodLabel(period)}
                </TH>
              ))}
            </TR>
          </THead>
          <TBody>
            {rows.map((row) => (
              <TR key={row.budgetItemId} className="whitespace-nowrap">
                <TD className="whitespace-nowrap px-2 py-2 text-[11px]">{row.itemCode}</TD>
                <TD className="max-w-80 whitespace-nowrap px-2 py-2 text-[11px]">
                  <span className="block truncate" title={row.description}>
                    {row.description}
                  </span>
                </TD>
                <TD className="whitespace-nowrap px-2 py-2 text-[11px]">{row.unit}</TD>
                <TD className="whitespace-nowrap px-2 py-2 text-right text-[11px]">{formatNumber(row.quantity, 2)}</TD>
                <TD className="whitespace-nowrap px-2 py-2 text-right text-[11px]">{formatCurrency(row.unitPrice, currency, currencyDecimals)}</TD>
                <TD className="whitespace-nowrap px-2 py-2 text-right text-[11px]">{formatCurrency(row.partial, currency, currencyDecimals)}</TD>
                {periods.map((period) => (
                  <TD key={period.key} className="whitespace-nowrap px-2 py-2 text-right text-[11px]">
                    {formatCurrency(row.periodAmounts[period.key] ?? 0, currency, currencyDecimals)}
                  </TD>
                ))}
              </TR>
            ))}
          </TBody>
        </Table>
      </div>
    </DerivedTableCard>
  );
}

function ResourceCalendarView({
  rows,
  periods,
  currency,
  currencyDecimals,
  mode,
  onModeChange,
  activeFilterLabel,
}: {
  rows: WorkScheduleResourceCalendarRow[];
  periods: WorkSchedulePeriodRecord[];
  currency: string;
  currencyDecimals: number;
  mode: ResourceCalendarMode;
  onModeChange: (mode: ResourceCalendarMode) => void;
  activeFilterLabel: string | null;
}) {
  return (
    <DerivedTableCard
      title="Calendario de insumos"
      description="Consumo y valorizacion mensual de materiales e insumos derivado desde la programacion de partidas."
      activeFilterLabel={activeFilterLabel}
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-muted)] p-1">
          <Button
            variant={mode === "amounts" ? "default" : "ghost"}
            size="sm"
            className="h-8 px-3 text-xs"
            onClick={() => onModeChange("amounts")}
          >
            Valorizado
          </Button>
          <Button
            variant={mode === "quantities" ? "default" : "ghost"}
            size="sm"
            className="h-8 px-3 text-xs"
            onClick={() => onModeChange("quantities")}
          >
            Cantidades
          </Button>
        </div>
        <span className="text-xs text-[var(--app-text-muted)]">
          {mode === "amounts" ? "Mostrando importes mensuales valorizados." : "Mostrando cantidades mensuales programadas."}
        </span>
      </div>
      <div data-testid="resource-calendar-table-scroll" className="overflow-x-auto rounded-2xl border border-[var(--app-border)]">
        <Table
          className="min-w-max text-[11px]"
          style={{
            minWidth: `${760 + periods.length * 132}px`,
          }}
        >
          <THead className="bg-[var(--app-surface-muted)]">
            <TR className="whitespace-nowrap">
              <TH className="w-16 whitespace-nowrap px-2 py-2 text-[11px]">Item</TH>
              <TH className="w-80 whitespace-nowrap px-2 py-2 text-[11px]">Insumo</TH>
              <TH className="w-16 whitespace-nowrap px-2 py-2 text-[11px]">Und.</TH>
              <TH className="w-24 whitespace-nowrap px-2 py-2 text-right text-[11px]">Cantidad</TH>
              <TH className="w-24 whitespace-nowrap px-2 py-2 text-right text-[11px]">PU</TH>
              <TH className="w-28 whitespace-nowrap px-2 py-2 text-right text-[11px]">Parcial</TH>
              {periods.map((period) => (
                <TH key={period.key} className="w-32 whitespace-nowrap px-2 py-2 text-right text-[11px]">
                  {formatPeriodLabel(period)}
                </TH>
              ))}
            </TR>
          </THead>
          <TBody>
            {rows.map((row, index) => (
              <TR key={row.resourceId} className="whitespace-nowrap">
                <TD className="whitespace-nowrap px-2 py-2 text-[11px]">{index + 1}</TD>
                <TD className="max-w-80 whitespace-nowrap px-2 py-2 text-[11px]">
                  <span className="block truncate" title={row.description}>
                    {row.description}
                  </span>
                </TD>
                <TD className="whitespace-nowrap px-2 py-2 text-[11px]">{row.unit}</TD>
                <TD className="whitespace-nowrap px-2 py-2 text-right text-[11px]">{formatNumber(row.quantity, 2)}</TD>
                <TD className="whitespace-nowrap px-2 py-2 text-right text-[11px]">{formatCurrency(row.unitPrice, currency, currencyDecimals)}</TD>
                <TD className="whitespace-nowrap px-2 py-2 text-right text-[11px]">{formatCurrency(row.partial, currency, currencyDecimals)}</TD>
                {periods.map((period) => (
                  <TD key={period.key} className="whitespace-nowrap px-2 py-2 text-right text-[11px]">
                    {mode === "amounts"
                      ? formatCurrency(row.periodAmounts[period.key] ?? 0, currency, currencyDecimals)
                      : formatNumber(row.periodQuantities[period.key] ?? 0, 2)}
                  </TD>
                ))}
              </TR>
            ))}
          </TBody>
        </Table>
      </div>
    </DerivedTableCard>
  );
}

function CurveSView({
  points,
  currency,
  currencyDecimals,
  activeFilterLabel,
}: {
  points: WorkScheduleCurvePointRecord[];
  currency: string;
  currencyDecimals: number;
  activeFilterLabel: string | null;
}) {
  const maxAmount = Math.max(...points.map((point) => point.accumulatedAmount), 0);
  const chartWidth = 980;
  const chartHeight = 420;
  const chartPadding = { top: 40, right: 44, bottom: 66, left: 128 };
  const plotWidth = chartWidth - chartPadding.left - chartPadding.right;
  const plotHeight = chartHeight - chartPadding.top - chartPadding.bottom;
  const yAxisMax = maxAmount > 0 ? maxAmount : 1;
  const curvePoints = points.map((point, index) => {
    const x =
      points.length <= 1
        ? chartPadding.left + plotWidth / 2
        : chartPadding.left + (plotWidth * index) / (points.length - 1);
    const y = chartPadding.top + plotHeight - (point.accumulatedAmount / yAxisMax) * plotHeight;

    return {
      point,
      x,
      y,
    };
  });
  const curvePath = curvePoints
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(" ");
  const yTicks = Array.from({ length: 5 }, (_, index) => {
    const ratio = index / 4;
    const value = yAxisMax * (1 - ratio);
    const y = chartPadding.top + plotHeight * ratio;
    return { value, y };
  });

  return (
    <Card className="border-[var(--app-border)] bg-[var(--app-surface)]">
      <CardContent className="space-y-5 p-6">
        <div>
          <p className="text-sm font-semibold text-[var(--app-text-strong)]">Curva S basica</p>
          <p className="mt-1 text-sm text-[var(--app-text-muted)]">Programado mensual y acumulado del proyecto consolidado.</p>
          {activeFilterLabel ? (
            <div className="mt-3">
              <span className="theme-status-info theme-status-info-strong rounded-full border px-3 py-1 text-xs font-medium">
                {`Filtro aplicado: ${activeFilterLabel}`}
              </span>
            </div>
          ) : null}
        </div>

        <div className="overflow-x-auto rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-muted)] p-4">
          <div data-testid="work-schedule-curve-chart" className="min-w-[980px]">
            <span data-testid="work-schedule-curve-line" data-d={curvePath} className="sr-only" />
            <span className="sr-only">Monto acumulado</span>
            <span className="sr-only">Tiempo</span>
            <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} role="img" aria-label="Curva S acumulada de montos contra tiempo" className="h-[420px] w-full">
              <rect x={chartPadding.left} y={chartPadding.top} width={plotWidth} height={plotHeight} fill="var(--app-surface)" stroke="var(--app-border-soft)" />
              {yTicks.map((tick) => (
                <g key={tick.y}>
                  <line x1={chartPadding.left} x2={chartPadding.left + plotWidth} y1={tick.y} y2={tick.y} stroke="var(--app-border-soft)" strokeDasharray="4 4" />
                  <text x={chartPadding.left - 12} y={tick.y + 3} textAnchor="end" className="fill-[var(--app-text-muted)] text-[9px]">
                    {formatCurrency(tick.value, currency, currencyDecimals)}
                  </text>
                </g>
              ))}
              {curvePoints.map(({ point, x }) => (
                <line key={`x-${point.key}`} x1={x} x2={x} y1={chartPadding.top} y2={chartPadding.top + plotHeight} stroke="var(--app-surface-hover-strong)" />
              ))}
              <line x1={chartPadding.left} x2={chartPadding.left} y1={chartPadding.top} y2={chartPadding.top + plotHeight} stroke="var(--app-text-muted)" strokeWidth="1.5" />
              <line x1={chartPadding.left} x2={chartPadding.left + plotWidth} y1={chartPadding.top + plotHeight} y2={chartPadding.top + plotHeight} stroke="var(--app-text-muted)" strokeWidth="1.5" />
              {curvePath ? (
                <path d={curvePath} fill="none" stroke="#2563eb" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              ) : null}
              {curvePoints.map(({ point, x, y }) => (
                <g key={point.key}>
                  <circle data-testid="work-schedule-curve-point" cx={x} cy={y} r="5" fill="#2563eb" stroke="#ffffff" strokeWidth="2" />
                  <text
                    data-testid="work-schedule-curve-point-label"
                    x={x}
                    y={Math.max(chartPadding.top + 12, y - 12)}
                    textAnchor="middle"
                    className="fill-slate-900 text-[10px] font-semibold"
                  >
                    {formatCurrency(point.accumulatedAmount, currency, currencyDecimals)}
                  </text>
                  <text x={x} y={chartPadding.top + plotHeight + 22} textAnchor="middle" className="fill-slate-600 text-[11px]">
                    {formatPeriodLabel(point)}
                  </text>
                </g>
              ))}
              <text
                x={chartPadding.left + plotWidth / 2}
                y={chartHeight - 8}
                textAnchor="middle"
                className="fill-slate-700 text-[12px] font-semibold"
              >
                Tiempo
              </text>
              <text
                x={22}
                y={chartPadding.top + plotHeight / 2}
                textAnchor="middle"
                transform={`rotate(-90 22 ${chartPadding.top + plotHeight / 2})`}
                className="fill-slate-700 text-[12px] font-semibold"
              >
                Monto acumulado
              </text>
            </svg>
          </div>
        </div>

        <Table>
          <THead className="bg-[var(--app-surface-muted)]">
            <TR>
              <TH>Periodo</TH>
              <TH>Programado mensual</TH>
              <TH>Acumulado</TH>
              <TH>% acumulado</TH>
            </TR>
          </THead>
          <TBody>
            {points.map((point) => (
              <TR key={point.key}>
                <TD>{formatPeriodLabel(point)}</TD>
                <TD>{formatCurrency(point.monthlyAmount, currency, currencyDecimals)}</TD>
                <TD>{formatCurrency(point.accumulatedAmount, currency, currencyDecimals)}</TD>
                <TD>{formatNumber(point.accumulatedPercentage, 2)}%</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </CardContent>
    </Card>
  );
}


function DerivedTableCard({
  title,
  description,
  activeFilterLabel,
  children,
}: {
  title: string;
  description: string;
  activeFilterLabel?: string | null;
  children: React.ReactNode;
}) {
  return (
    <Card className="border-[var(--app-border)] bg-[var(--app-surface)]">
      <CardContent className="space-y-4 p-6">
        <div>
          <p className="text-sm font-semibold text-[var(--app-text-strong)]">{title}</p>
          <p className="mt-1 text-sm text-[var(--app-text-muted)]">{description}</p>
          {activeFilterLabel ? (
            <div className="mt-3">
              <span className="theme-status-info theme-status-info-strong rounded-full border px-3 py-1 text-xs font-medium">
                {`Filtro aplicado: ${activeFilterLabel}`}
              </span>
            </div>
          ) : null}
        </div>
        <div className="overflow-x-auto">{children}</div>
      </CardContent>
    </Card>
  );
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-3">
      <p className="text-xs uppercase tracking-[0.18em] text-[var(--app-text-muted)]">{label}</p>
      <p className="mt-2 text-sm font-semibold text-[var(--app-text-strong)]">{value}</p>
    </div>
  );
}

function ViewButton({
  active,
  icon,
  children,
  onClick,
}: {
  active: boolean;
  icon: React.ReactNode;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition",
        active
          ? "theme-filter-button-active border text-[var(--app-text-strong)]"
          : "theme-filter-button-inactive border text-[var(--app-text)]",
      )}
    >
      {icon}
      {children}
    </button>
  );
}

function ExportPreferenceButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1 text-xs transition",
        active
          ? "theme-filter-button-active border text-[var(--app-text-strong)]"
          : "theme-filter-button-inactive border text-[var(--app-text)]",
      )}
    >
      {children}
    </button>
  );
}

function WorkScheduleExportMenuButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className="flex w-full items-center rounded-lg px-3 py-2 text-left text-sm text-[var(--app-text)] transition hover:bg-[var(--app-surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-1"
    >
      {label}
    </button>
  );
}

function Field({ label, children, tooltip }: { label: string; children: React.ReactNode; tooltip?: string }) {
  const [showTooltip, setShowTooltip] = useState(false);
  const wrapperRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    if (!showTooltip) return;

    function handlePointerDown(event: PointerEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setShowTooltip(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [showTooltip]);

  return (
    <label className="space-y-2 text-sm">
      <span className="inline-flex items-center gap-1.5 font-medium text-[var(--app-text)]">
        {label}
        {tooltip ? (
          <span ref={wrapperRef} className="relative inline-flex">
            <Info
              className="h-3.5 w-3.5 cursor-pointer text-[var(--app-text-muted)] transition-colors hover:text-sky-500"
              onClick={(event) => {
                event.preventDefault();
                setShowTooltip((current) => !current);
              }}
            />
            {showTooltip ? (
              <span
                className="absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2 w-72 rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-2.5 py-1.5 text-[11px] font-normal leading-snug text-[var(--app-text)] shadow-lg whitespace-normal"
              >
                {tooltip}
              </span>
            ) : null}
          </span>
        ) : null}
      </span>
      {children}
    </label>
  );
}

type TimelineDay = {
  iso: string;
  date: Date;
};

type VisibleTimelineLinePosition = {
  line: WorkScheduleLineRecord;
  top: number;
  height: number;
};


function summarizeView(data: WorkScheduleViewRecord) {
  const programmedItems = data.groups.reduce(
    (sum, group) => sum + group.lines.filter((line) => line.monthlyDistributions.length > 0).length,
    0,
  );
  const totalAmount = data.groups.reduce((sum, group) => sum + group.totalAmount, 0);

  return {
    programmedItems,
    totalAmount,
    periods: data.scale.periodCount,
  };
}


function getCollapsedGroupsStorageKey(budgetId: string) {
  return `work-schedule-collapsed-groups:${budgetId}`;
}

function getCollapsedLevelIdsStorageKey(budgetId: string) {
  return `work-schedule-collapsed-level-ids:${budgetId}`;
}

function readCollapsedLevelIds(budgetId: string): Record<string, boolean> {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const storedValue = window.localStorage.getItem(getCollapsedLevelIdsStorageKey(budgetId));
    if (!storedValue) {
      return {};
    }

    const parsed = JSON.parse(storedValue) as Record<string, boolean>;
    if (typeof parsed !== "object" || parsed === null) {
      return {};
    }

    return Object.fromEntries(Object.entries(parsed).filter((entry) => entry[1] === true));
  } catch {
    return {};
  }
}

function writeCollapsedLevelIds(budgetId: string, collapsedLevelIds: Record<string, boolean>) {
  if (typeof window === "undefined") {
    return;
  }

  const activeCollapsedIds = Object.fromEntries(Object.entries(collapsedLevelIds).filter((entry) => entry[1] === true));

  if (Object.keys(activeCollapsedIds).length === 0) {
    window.localStorage.removeItem(getCollapsedLevelIdsStorageKey(budgetId));
    return;
  }

  try {
    window.localStorage.setItem(getCollapsedLevelIdsStorageKey(budgetId), JSON.stringify(activeCollapsedIds));
  } catch {
    // quota exceeded, ignore
  }
}

function getActiveViewStorageKey(budgetId: string) {
  return `work-schedule-active-view:${budgetId}`;
}

function getEditingLineStorageKey(budgetId: string) {
  return `work-schedule-editing-line:${budgetId}`;
}


function getOverviewTimelineZoomStorageKey(budgetId: string) {
  return `work-schedule-overview-timeline-zoom:${budgetId}`;
}

function getResourceCalendarModeStorageKey(budgetId: string) {
  return `work-schedule-resource-calendar-mode:${budgetId}`;
}

function getCriticalPathVisibilityStorageKey(budgetId: string) {
  return `work-schedule-critical-path-visibility:${budgetId}`;
}

function getOverviewFilterStorageKey(budgetId: string) {
  return `work-schedule-overview-filter:${budgetId}`;
}

function getOverviewMeasuredHeightsStorageKey(budgetId: string) {
  return `work-schedule-overview-measured-heights:${budgetId}`;
}

function getExecutiveWorkbookScopeStorageKey(budgetId: string) {
  return `work-schedule-executive-workbook-scope:${budgetId}`;
}

function getValuationWorkbookScopeStorageKey(budgetId: string) {
  return `work-schedule-valuation-workbook-scope:${budgetId}`;
}

function getResourceWorkbookScopeStorageKey(budgetId: string) {
  return `work-schedule-resource-workbook-scope:${budgetId}`;
}

function getCurveWorkbookScopeStorageKey(budgetId: string) {
  return `work-schedule-curve-workbook-scope:${budgetId}`;
}

function getGenerationStrategyStorageKey(budgetId: string) {
  return `work-schedule-generation-strategy:${budgetId}`;
}

function getGenerationLevelLinkageStorageKey(budgetId: string) {
  return `work-schedule-generation-level-linkage:${budgetId}`;
}

function getGenerationParallelismStorageKey(budgetId: string) {
  return `work-schedule-generation-parallelism:${budgetId}`;
}

function getGenerationStaggerDaysStorageKey(budgetId: string) {
  return `work-schedule-generation-stagger-days:${budgetId}`;
}

function getGenerationMaxDurationStorageKey(budgetId: string) {
  return `work-schedule-generation-max-duration:${budgetId}`;
}

function getGenerationSimilarityLagStorageKey(budgetId: string) {
  return `work-schedule-generation-similarity-lag:${budgetId}`;
}

function getGenerationCustomPhaseKeywordsStorageKey(budgetId: string) {
  return `work-schedule-generation-custom-phase-keywords:${budgetId}`;
}

function readLocalCustomPhaseKeywords(budgetId: string): Record<string, string> {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const storedValue = window.localStorage.getItem(getGenerationCustomPhaseKeywordsStorageKey(budgetId));
    if (!storedValue) {
      return {};
    }

    const raw = JSON.parse(storedValue) as Record<string, unknown>;
    return Object.fromEntries(
      Object.entries(raw).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
    );
  } catch {
    return {};
  }
}

function clearLocalCustomPhaseKeywords(budgetId: string): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(getGenerationCustomPhaseKeywordsStorageKey(budgetId));
}

function getGenerationPreviewCollapsedGroupsStorageKey(budgetId: string) {
  return `work-schedule-generation-preview-collapsed:${budgetId}`;
}

function getGenerationReviewedItemsStorageKey(budgetId: string) {
  return `work-schedule-generation-reviewed-items:${budgetId}`;
}

function readCollapsedGroups(budgetId: string): Record<string, boolean> {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const storedValue = window.localStorage.getItem(getCollapsedGroupsStorageKey(budgetId));
    if (!storedValue) {
      return {};
    }

    const parsedValue = JSON.parse(storedValue) as Record<string, unknown>;
    return Object.fromEntries(
      Object.entries(parsedValue).filter((entry): entry is [string, boolean] => typeof entry[1] === "boolean"),
    );
  } catch {
    return {};
  }
}

function buildGenerationLevelPreviewGroups(groups: WorkScheduleViewRecord["groups"]): GenerationLevelPreviewGroup[] {
  return groups
    .map((group) => ({
      subBudgetId: group.subBudgetId,
      subBudgetName: group.subBudgetName,
      levels: group.rows.flatMap((row) =>
        row.kind === "level"
          ? [{
              levelId: row.levelId,
              levelType: row.levelType,
              itemCode: row.itemCode,
              description: row.description,
            }]
          : [],
      ),
    }))
    .filter((group) => group.levels.length > 0);
}

function isWorkScheduleGenerationStrategy(value: string): value is WorkScheduleGenerationStrategy {
  return value === "sequential" || value === "by_level" || value === "by_similarity" || value === "by_front";
}

function isInterSubBudgetParallelism(value: string): value is InterSubBudgetParallelism {
  return value === "independent" || value === "parallel" || value === "staggered";
}

function readGenerationFormState(
  budgetId: string,
  groups: WorkScheduleViewRecord["groups"],
): WorkScheduleGenerationFormState {
  const previewGroups = buildGenerationLevelPreviewGroups(groups);
  const defaultStrategy: WorkScheduleGenerationStrategy = previewGroups.length > 0 ? "by_level" : "sequential";

  if (typeof window === "undefined") {
    return {
      strategy: defaultStrategy,
      interSubBudgetParallelism: "independent",
      interSubBudgetStaggerDays: "7",
      maxDurationDays: "",
      similarityLagDays: "0",
      levelLinkage: Object.fromEntries(
        previewGroups.flatMap((group) => group.levels.map((level) => [level.levelId, "parallel" as const])),
      ),
      customPhaseKeywords: {},
    };
  }

  const storedStrategy = window.localStorage.getItem(getGenerationStrategyStorageKey(budgetId));
  const storedParallelism = window.localStorage.getItem(getGenerationParallelismStorageKey(budgetId));
  const baseLevelLinkage: Record<string, LevelLinkageMode> = Object.fromEntries(
    previewGroups.flatMap((group) => group.levels.map((level) => [level.levelId, "parallel" as const])),
  );

  let parsedLevelLinkage = baseLevelLinkage;
  try {
    const storedLevelLinkage = window.localStorage.getItem(getGenerationLevelLinkageStorageKey(budgetId));
    if (storedLevelLinkage) {
      const raw = JSON.parse(storedLevelLinkage) as Record<string, unknown>;
      parsedLevelLinkage = {
        ...baseLevelLinkage,
        ...Object.fromEntries(
          Object.entries(raw).filter((entry): entry is [string, LevelLinkageMode] => entry[1] === "parallel" || entry[1] === "chain"),
        ),
      };
    }
  } catch {
    parsedLevelLinkage = baseLevelLinkage;
  }

  return {
    strategy: storedStrategy && isWorkScheduleGenerationStrategy(storedStrategy) ? storedStrategy : defaultStrategy,
    interSubBudgetParallelism:
      storedParallelism && isInterSubBudgetParallelism(storedParallelism) ? storedParallelism : "independent",
    interSubBudgetStaggerDays: window.localStorage.getItem(getGenerationStaggerDaysStorageKey(budgetId)) ?? "7",
    maxDurationDays: window.localStorage.getItem(getGenerationMaxDurationStorageKey(budgetId)) ?? "",
    similarityLagDays: window.localStorage.getItem(getGenerationSimilarityLagStorageKey(budgetId)) ?? "0",
    levelLinkage: parsedLevelLinkage,
    customPhaseKeywords: {},
  };
}

function writeGenerationFormState(budgetId: string, formState: WorkScheduleGenerationFormState) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(getGenerationStrategyStorageKey(budgetId), formState.strategy);
  window.localStorage.setItem(getGenerationParallelismStorageKey(budgetId), formState.interSubBudgetParallelism);
  window.localStorage.setItem(getGenerationLevelLinkageStorageKey(budgetId), JSON.stringify(formState.levelLinkage));

  writeStringPreference(getGenerationStaggerDaysStorageKey(budgetId), formState.interSubBudgetStaggerDays, "7");
  writeStringPreference(getGenerationMaxDurationStorageKey(budgetId), formState.maxDurationDays, "");
  writeStringPreference(getGenerationSimilarityLagStorageKey(budgetId), formState.similarityLagDays, "0");
}

function readGenerationPreviewCollapsedGroups(budgetId: string): Record<string, boolean> {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const storedValue = window.localStorage.getItem(getGenerationPreviewCollapsedGroupsStorageKey(budgetId));
    if (!storedValue) {
      return {};
    }

    const parsedValue = JSON.parse(storedValue) as Record<string, unknown>;
    return Object.fromEntries(
      Object.entries(parsedValue).filter((entry): entry is [string, boolean] => typeof entry[1] === "boolean"),
    );
  } catch {
    return {};
  }
}

function writeGenerationPreviewCollapsedGroups(budgetId: string, collapsedGroups: Record<string, boolean>) {
  if (typeof window === "undefined") {
    return;
  }

  const activeCollapsedGroups = Object.fromEntries(Object.entries(collapsedGroups).filter((entry) => entry[1] === true));
  if (Object.keys(activeCollapsedGroups).length === 0) {
    window.localStorage.removeItem(getGenerationPreviewCollapsedGroupsStorageKey(budgetId));
    return;
  }

  window.localStorage.setItem(getGenerationPreviewCollapsedGroupsStorageKey(budgetId), JSON.stringify(activeCollapsedGroups));
}

function readGenerationReviewedBudgetItemIds(budgetId: string): string[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const storedValue = window.localStorage.getItem(getGenerationReviewedItemsStorageKey(budgetId));
    if (!storedValue) {
      return [];
    }

    const parsedValue = JSON.parse(storedValue) as unknown[];
    return parsedValue.filter((value): value is string => typeof value === "string" && value.trim().length > 0);
  } catch {
    return [];
  }
}

function writeGenerationReviewedBudgetItemIds(budgetId: string, reviewedBudgetItemIds: string[]) {
  if (typeof window === "undefined") {
    return;
  }

  if (reviewedBudgetItemIds.length === 0) {
    window.localStorage.removeItem(getGenerationReviewedItemsStorageKey(budgetId));
    return;
  }

  window.localStorage.setItem(getGenerationReviewedItemsStorageKey(budgetId), JSON.stringify(reviewedBudgetItemIds));
}

function deriveEffectiveReviewSummary(
  reviewSummary: WorkScheduleViewRecord["reviewSummary"],
  reviewedBudgetItemIds: string[],
) {
  if (!reviewSummary) {
    return null;
  }

  const reviewedIds = new Set(reviewedBudgetItemIds);
  const warnings = reviewSummary.warnings
    .map((warning) => {
      const reviewedExampleCount = warning.examples.filter((example) => reviewedIds.has(example.budgetItemId)).length;
      const nextCount = Math.max(0, warning.count - reviewedExampleCount);
      const nextExamples = warning.examples.filter((example) => !reviewedIds.has(example.budgetItemId));

      return {
        ...warning,
        count: nextCount,
        examples: nextExamples,
      };
    })
    .filter((warning) => warning.count > 0);

  const warningCount = warnings.reduce((sum, warning) => sum + warning.count, 0);

  return {
    ...reviewSummary,
    warningCount,
    warnings,
  };
}

function buildGenerationOptionsPayload(formState: WorkScheduleGenerationFormState): WorkScheduleGenerationOptions {
  return {
    strategy: formState.strategy,
    interSubBudgetParallelism: formState.interSubBudgetParallelism,
    interSubBudgetStaggerDays: parseOptionalPositiveInteger(formState.interSubBudgetStaggerDays),
    maxDurationDays: parseOptionalPositiveInteger(formState.maxDurationDays),
    similarityLagDays: parseOptionalNonNegativeInteger(formState.similarityLagDays) ?? 0,
    levelLinkage: Object.keys(formState.levelLinkage).length > 0 ? formState.levelLinkage : null,
    customPhaseKeywords: parseCustomPhaseKeywords(formState.customPhaseKeywords),
  };
}

function formatCustomPhaseKeywordsForForm(input: Record<string, string[]> | null): Record<string, string> {
  if (!input) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(input).map(([phase, keywords]) => [phase, keywords.join(", ")]),
  );
}

async function saveGenerationSettings(budgetId: string, formState: WorkScheduleGenerationFormState): Promise<void> {
  const customPhaseKeywords = parseCustomPhaseKeywords(formState.customPhaseKeywords);

  const response = await fetch(`/api/budgets/${budgetId}/work-schedule/generation-settings`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      settings: {
        strategy: formState.strategy,
        interSubBudgetParallelism: formState.interSubBudgetParallelism,
        interSubBudgetStaggerDays: parseOptionalPositiveInteger(formState.interSubBudgetStaggerDays),
        maxDurationDays: parseOptionalPositiveInteger(formState.maxDurationDays),
        similarityLagDays: parseOptionalNonNegativeInteger(formState.similarityLagDays),
        levelLinkage: Object.keys(formState.levelLinkage).length > 0 ? formState.levelLinkage : null,
        customPhaseKeywords,
      },
    }),
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? "No se pudo guardar la configuracion de fases");
  }
}

function parseOptionalPositiveInteger(value: string) {
  const parsedValue = Number(value);
  return Number.isFinite(parsedValue) && parsedValue > 0 ? Math.round(parsedValue) : null;
}

function parseOptionalNonNegativeInteger(value: string) {
  const parsedValue = Number(value);
  return Number.isFinite(parsedValue) && parsedValue >= 0 ? Math.round(parsedValue) : null;
}

function writeStringPreference(storageKey: string, value: string, defaultValue: string) {
  if (typeof window === "undefined") {
    return;
  }

  if (value === defaultValue) {
    window.localStorage.removeItem(storageKey);
    return;
  }

  window.localStorage.setItem(storageKey, value);
}

function writeCollapsedGroups(budgetId: string, collapsedGroups: Record<string, boolean>) {
  if (typeof window === "undefined") {
    return;
  }

  const activeCollapsedGroups = Object.fromEntries(Object.entries(collapsedGroups).filter((entry) => entry[1] === true));

  if (Object.keys(activeCollapsedGroups).length === 0) {
    window.localStorage.removeItem(getCollapsedGroupsStorageKey(budgetId));
    return;
  }

  window.localStorage.setItem(getCollapsedGroupsStorageKey(budgetId), JSON.stringify(activeCollapsedGroups));
}

function isActiveView(value: string): value is ActiveView {
  return value === "overview" || value === "valuation" || value === "resources" || value === "curve";
}

function readActiveView(budgetId: string): ActiveView {
  if (typeof window === "undefined") {
    return "overview";
  }

  const storedValue = window.localStorage.getItem(getActiveViewStorageKey(budgetId));
  return storedValue && isActiveView(storedValue) ? storedValue : "overview";
}

function writeActiveView(budgetId: string, activeView: ActiveView) {
  if (typeof window === "undefined") {
    return;
  }

  if (activeView === "overview") {
    window.localStorage.removeItem(getActiveViewStorageKey(budgetId));
    return;
  }

  window.localStorage.setItem(getActiveViewStorageKey(budgetId), activeView);
}

function readEditingLineBudgetItemId(budgetId: string) {
  if (typeof window === "undefined") {
    return null;
  }

  const storedValue = window.localStorage.getItem(getEditingLineStorageKey(budgetId));
  return storedValue && storedValue.trim() ? storedValue : null;
}

function writeEditingLineBudgetItemId(budgetId: string, budgetItemId: string | null) {
  if (typeof window === "undefined") {
    return;
  }

  if (!budgetItemId) {
    window.localStorage.removeItem(getEditingLineStorageKey(budgetId));
    return;
  }

  window.localStorage.setItem(getEditingLineStorageKey(budgetId), budgetItemId);
}

function buildPredecessorRowNumberMaps(groups: WorkScheduleViewRecord["groups"]): PredecessorRowNumberMaps {
  const itemCodeToRowNumber = new Map<string, number>();
  const rowNumberToItemCode = new Map<number, string>();
  let currentRowNumber = 1;

  for (const group of groups) {
    currentRowNumber += 1;

    for (const row of group.rows) {
      if (row.kind === "line") {
        itemCodeToRowNumber.set(row.line.itemCode, currentRowNumber);
        rowNumberToItemCode.set(currentRowNumber, row.line.itemCode);
      }

      currentRowNumber += 1;
    }
  }

  return {
    itemCodeToRowNumber,
    rowNumberToItemCode,
  };
}

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

  let nextLines: WorkScheduleLineRecord[] = data.groups.flatMap((group) => group.lines).map((line) => ({
    ...line,
    monthlyDistributions: line.monthlyDistributions.map((distribution) => ({ ...distribution })),
    resourceIds: line.resourceIds ? [...line.resourceIds] : undefined,
    resources: line.resources?.map((resource) => ({ ...resource })),
    criticalPath: line.criticalPath ? { ...line.criticalPath } : null,
  }));

  for (const draft of draftEntries.values()) {
    nextLines = nextLines.map((line) =>
      line.budgetItemId === draft.budgetItemId ? applyEditableDraftToLine(line, draft, rowNumberToItemCode) : line,
    );
  }

  for (const draft of draftEntries.values()) {
    nextLines = recalculateDependentWorkScheduleLines(nextLines, draft.budgetItemId);
  }

  const previewView = buildWorkScheduleView(
    {
      budgetId: data.budgetId,
      budgetName: data.budgetName,
      projectName: data.projectName,
      currency: data.currency,
      lines: nextLines,
    },
    { includeDerivedCalendars: false },
  );
  const previewLineByBudgetItemId = new Map(previewView.groups.flatMap((group) => group.lines).map((line) => [line.budgetItemId, line]));

  return normalizeWorkScheduleView({
    ...data,
    groups: data.groups.map((group) => {
      const lines = group.lines.map((line) => previewLineByBudgetItemId.get(line.budgetItemId) ?? line);

      return {
        ...group,
        lines,
        rows: group.rows.map((row) =>
          row.kind === "line"
            ? { ...row, line: previewLineByBudgetItemId.get(row.line.budgetItemId) ?? row.line }
            : rebuildPreviewLevelSummaryRow(row, previewLineByBudgetItemId),
        ),
      };
    }),
    timeline: previewView.timeline,
    scale: previewView.scale,
    criticalPath: previewView.criticalPath,
  });
}

function applyEditableDraftToLine(
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
    monthlyDistributions: serializedDraft.monthlyDistributions.map((distribution) => ({
      year: distribution.year,
      month: distribution.month,
      percentage: distribution.percentage,
    })),
  };
}

function rebuildPreviewLevelSummaryRow(
  row: Extract<WorkScheduleDisplayRowRecord, { kind: "level" }>,
  previewLineByBudgetItemId: Map<string, WorkScheduleLineRecord>,
): Extract<WorkScheduleDisplayRowRecord, { kind: "level" }> {
  const childLines = row.childLineIds
    .map((lineId) => previewLineByBudgetItemId.get(lineId))
    .filter((line): line is WorkScheduleLineRecord => Boolean(line));

  if (childLines.length === 0) {
    return row;
  }

  const startDates = childLines.map((line) => line.startDate).filter((value): value is string => Boolean(value)).sort();
  const endDates = childLines.map((line) => line.endDate).filter((value): value is string => Boolean(value)).sort();

  return {
    ...row,
    durationDays: childLines.reduce((sum, line) => sum + (line.durationDays ?? 0), 0),
    startDate: startDates[0] ?? null,
    endDate: endDates.at(-1) ?? null,
    partial: childLines.reduce((sum, line) => sum + line.partial, 0),
  };
}

function readEditingLine(
  data: WorkScheduleViewRecord,
  itemCodeToRowNumber: Map<string, number> = new Map<string, number>(),
): EditableLine | null {
  const budgetItemId = readEditingLineBudgetItemId(data.budgetId);
  if (!budgetItemId) {
    return null;
  }

  const matchingLine = data.groups.flatMap((group) => group.lines).find((line) => line.budgetItemId === budgetItemId);
  return matchingLine ? createEditableLine(matchingLine, itemCodeToRowNumber) : null;
}


function readCriticalPathVisibility(budgetId: string) {
  if (typeof window === "undefined") {
    return false;
  }

  return window.localStorage.getItem(getCriticalPathVisibilityStorageKey(budgetId)) === "true";
}

function writeCriticalPathVisibility(budgetId: string, visible: boolean) {
  if (typeof window === "undefined") {
    return;
  }

  if (!visible) {
    window.localStorage.removeItem(getCriticalPathVisibilityStorageKey(budgetId));
    return;
  }

  window.localStorage.setItem(getCriticalPathVisibilityStorageKey(budgetId), "true");
}

function readNearCriticalSlackDays(budgetId: string) {
  if (typeof window === "undefined") {
    return 0;
  }
  const stored = window.localStorage.getItem(getNearCriticalSlackDaysStorageKey(budgetId));
  const parsed = stored ? Number(stored) : 0;
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function writeNearCriticalSlackDays(budgetId: string, days: number) {
  if (typeof window === "undefined") {
    return;
  }
  if (days <= 0) {
    window.localStorage.removeItem(getNearCriticalSlackDaysStorageKey(budgetId));
    return;
  }
  window.localStorage.setItem(getNearCriticalSlackDaysStorageKey(budgetId), String(days));
}

function getNearCriticalSlackDaysStorageKey(budgetId: string) {
  return `work-schedule:near-critical-slack-days:${budgetId}`;
}

function isResourceCalendarMode(value: string): value is ResourceCalendarMode {
  return value === "amounts" || value === "quantities";
}

function readResourceCalendarMode(budgetId: string): ResourceCalendarMode {
  if (typeof window === "undefined") {
    return "amounts";
  }

  const storedValue = window.localStorage.getItem(getResourceCalendarModeStorageKey(budgetId));
  return storedValue && isResourceCalendarMode(storedValue) ? storedValue : "amounts";
}

function writeResourceCalendarMode(budgetId: string, mode: ResourceCalendarMode) {
  if (typeof window === "undefined") {
    return;
  }

  if (mode === "amounts") {
    window.localStorage.removeItem(getResourceCalendarModeStorageKey(budgetId));
    return;
  }

  window.localStorage.setItem(getResourceCalendarModeStorageKey(budgetId), mode);
}

function isOverviewFilter(value: string): value is OverviewFilter {
  return value === "all" || value === "pending" || value === "incomplete_distribution" || value === "scheduled";
}

function readOverviewFilter(budgetId: string): OverviewFilter {
  if (typeof window === "undefined") {
    return "all";
  }

  const storedValue = window.localStorage.getItem(getOverviewFilterStorageKey(budgetId));
  return storedValue && isOverviewFilter(storedValue) ? storedValue : "all";
}

function writeOverviewFilter(budgetId: string, overviewFilter: OverviewFilter) {
  if (typeof window === "undefined") {
    return;
  }

  if (overviewFilter === "all") {
    window.localStorage.removeItem(getOverviewFilterStorageKey(budgetId));
    return;
  }

  window.localStorage.setItem(getOverviewFilterStorageKey(budgetId), overviewFilter);
}


function sanitizeMeasuredHeightsMap(input: unknown) {
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


function readExecutiveWorkbookScope(budgetId: string): WorkbookExportScope {
  if (typeof window === "undefined") {
    return "detail_subtotals_and_total";
  }

  const storedValue = window.localStorage.getItem(getExecutiveWorkbookScopeStorageKey(budgetId));
  if (storedValue === "detail_only" || storedValue === "detail_and_total" || storedValue === "detail_subtotals_and_total") {
    return storedValue;
  }

  return "detail_subtotals_and_total";
}

function writeExecutiveWorkbookScope(budgetId: string, scope: WorkbookExportScope) {
  if (typeof window === "undefined") {
    return;
  }

  if (scope === "detail_subtotals_and_total") {
    window.localStorage.removeItem(getExecutiveWorkbookScopeStorageKey(budgetId));
    return;
  }

  window.localStorage.setItem(getExecutiveWorkbookScopeStorageKey(budgetId), scope);
}

function readValuationWorkbookScope(budgetId: string): WorkbookExportScope {
  if (typeof window === "undefined") {
    return "detail_subtotals_and_total";
  }

  const storedValue = window.localStorage.getItem(getValuationWorkbookScopeStorageKey(budgetId));
  if (storedValue === "detail_only" || storedValue === "detail_and_total" || storedValue === "detail_subtotals_and_total") {
    return storedValue;
  }

  return "detail_subtotals_and_total";
}

function writeValuationWorkbookScope(budgetId: string, scope: WorkbookExportScope) {
  if (typeof window === "undefined") {
    return;
  }

  if (scope === "detail_subtotals_and_total") {
    window.localStorage.removeItem(getValuationWorkbookScopeStorageKey(budgetId));
    return;
  }

  window.localStorage.setItem(getValuationWorkbookScopeStorageKey(budgetId), scope);
}

function readResourceWorkbookScope(budgetId: string): WorkbookExportScope {
  if (typeof window === "undefined") {
    return "detail_subtotals_and_total";
  }

  const storedValue = window.localStorage.getItem(getResourceWorkbookScopeStorageKey(budgetId));
  if (storedValue === "detail_only" || storedValue === "detail_and_total" || storedValue === "detail_subtotals_and_total") {
    return storedValue;
  }

  return "detail_subtotals_and_total";
}

function writeResourceWorkbookScope(budgetId: string, scope: WorkbookExportScope) {
  if (typeof window === "undefined") {
    return;
  }

  if (scope === "detail_subtotals_and_total") {
    window.localStorage.removeItem(getResourceWorkbookScopeStorageKey(budgetId));
    return;
  }

  window.localStorage.setItem(getResourceWorkbookScopeStorageKey(budgetId), scope);
}

function readCurveWorkbookScope(budgetId: string): WorkbookExportScope {
  if (typeof window === "undefined") {
    return "detail_and_total";
  }

  const storedValue = window.localStorage.getItem(getCurveWorkbookScopeStorageKey(budgetId));
  if (storedValue === "detail_only" || storedValue === "detail_and_total") {
    return storedValue;
  }

  return "detail_and_total";
}

function writeCurveWorkbookScope(budgetId: string, scope: WorkbookExportScope) {
  if (typeof window === "undefined") {
    return;
  }

  if (scope === "detail_and_total") {
    window.localStorage.removeItem(getCurveWorkbookScopeStorageKey(budgetId));
    return;
  }

  window.localStorage.setItem(getCurveWorkbookScopeStorageKey(budgetId), scope);
}

function calculateOverviewScrollTarget(startDate: string, timelineDays: TimelineDay[], timelineDayIndexByIso?: Map<string, number>) {
  if (!startDate) {
    return 0;
  }

  const startIndex = timelineDayIndexByIso?.get(startDate) ?? timelineDays.findIndex((day) => day.iso === startDate);
  if (startIndex < 0) {
    return 0;
  }

  const leftTableWidth = 720;
  const gridGapWidth = 16;
  const timelineDayWidth = 19;
  const leftPadding = 48;

  return Math.max(leftTableWidth + gridGapWidth + startIndex * timelineDayWidth - leftPadding, 0);
}


function matchesOverviewFilter(line: WorkScheduleLineRecord, overviewFilter: OverviewFilter) {
  if (overviewFilter === "all") {
    return true;
  }

  if (overviewFilter === "pending") {
    return isPendingWorkScheduleLine(line);
  }

  if (overviewFilter === "scheduled") {
    return isFullyScheduledWorkScheduleLine(line);
  }

  return hasIncompleteDistribution(line);
}

function isFullyScheduledWorkScheduleLine(line: WorkScheduleLineRecord) {
  return !isPendingWorkScheduleLine(line);
}

function formatOverviewFilterLabel(overviewFilter: OverviewFilter) {
  if (overviewFilter === "pending") {
    return "Solo pendientes";
  }

  if (overviewFilter === "incomplete_distribution") {
    return "Distribucion incompleta";
  }

  if (overviewFilter === "scheduled") {
    return "Solo programadas";
  }

  return "Todo";
}

function buildCurveSeriesFromValuationRows(
  rows: WorkScheduleValuationCalendarRow[],
  periods: WorkSchedulePeriodRecord[],
): WorkScheduleCurvePointRecord[] {
  const totalAmount = rows.reduce((sum, row) => sum + row.rowTotal, 0);
  let accumulatedAmount = 0;

  return periods.map((period) => {
    const monthlyAmount = rows.reduce((sum, row) => sum + (row.periodAmounts[period.key] ?? 0), 0);
    accumulatedAmount += monthlyAmount;

    return {
      year: period.year,
      month: period.month,
      key: period.key,
      monthlyAmount,
      accumulatedAmount,
      accumulatedPercentage: totalAmount > 0 ? (accumulatedAmount / totalAmount) * 100 : 0,
    };
  });
}

function createDefaultValuationRange(data: WorkScheduleViewRecord): PeriodRangeSelection {
  const availableRange = getAvailableValuationRange(data);
  if (!availableRange) {
    return { fromPeriodKey: "", toPeriodKey: "" };
  }

  const toPeriodKey = clampPeriodKey(addMonthsToPeriodKey(availableRange.fromPeriodKey, 11), availableRange.toPeriodKey);
  return {
    fromPeriodKey: availableRange.fromPeriodKey,
    toPeriodKey,
  };
}

function getAvailableValuationRange(data: WorkScheduleViewRecord): PeriodRangeSelection | null {
  if (data.valuationCalendar?.availableRange) {
    return data.valuationCalendar.availableRange;
  }

  if (data.scale.firstPeriodKey && data.scale.lastPeriodKey) {
    return {
      fromPeriodKey: data.scale.firstPeriodKey,
      toPeriodKey: data.scale.lastPeriodKey,
    };
  }

  return null;
}

function isPeriodRangeSelection(value: unknown): value is PeriodRangeSelection {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<PeriodRangeSelection>;
  return typeof candidate.fromPeriodKey === "string" && typeof candidate.toPeriodKey === "string";
}

function addMonthsToPeriodKey(periodKey: string, deltaMonths: number) {
  const [year, month] = periodKey.split("-").map(Number);
  const totalMonths = year * 12 + (month - 1) + deltaMonths;
  const nextYear = Math.floor(totalMonths / 12);
  const nextMonth = (totalMonths % 12) + 1;
  return `${nextYear}-${nextMonth.toString().padStart(2, "0")}`;
}

function clampPeriodKey(periodKey: string, maxPeriodKey: string) {
  return periodKey > maxPeriodKey ? maxPeriodKey : periodKey;
}



function getResourceWorkbookFamilyCode(resourceCode: string) {
  const [familyCode] = resourceCode.split("-");
  return familyCode?.trim() || "Sin grupo";
}


function getExcelColumnLetter(columnNumber: number) {
  let current = columnNumber;
  let result = "";

  while (current > 0) {
    const remainder = (current - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    current = Math.floor((current - 1) / 26);
  }

  return result;
}


function escapeCsvValue(value: string) {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replaceAll('"', '""')}"`;
  }

  return value;
}




function createDistributionFromStartDate(startDate: string) {
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

function buildInitialDistributionsFromRange(startDate: string, endDate: string) {
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

function updateDistribution(
  line: EditableLine,
  index: number,
  field: keyof WorkScheduleMonthlyDistributionRecord,
  value: number,
  onChange: (line: EditableLine | null) => void,
) {
  const nextDistributions = line.monthlyDistributions.map((distribution, rowIndex) =>
    rowIndex === index ? { ...distribution, [field]: value } : distribution,
  );

  onChange({
    ...line,
    monthlyDistributions: nextDistributions,
  });
}


function updateEditableLinePredecessor(
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
) {
  const nextLine = {
    ...line,
    predecessor,
  };
  const baseLine = lineByBudgetItemId.get(line.budgetItemId);

  if (!baseLine) {
    return nextLine;
  }

  const serializedDraft = serializeEditableLine(nextLine, rowNumberToItemCode);
  const draftLine: WorkScheduleLineRecord = {
    ...baseLine,
    startDate: serializedDraft.startDate,
    endDate: serializedDraft.endDate,
    durationDays: serializedDraft.durationDays,
    predecessor: serializedDraft.predecessor,
    crew: serializedDraft.crew,
    monthlyDistributions: serializedDraft.monthlyDistributions.map((distribution) => ({
      year: distribution.year,
      month: distribution.month,
      percentage: distribution.percentage,
    })),
  };
  const nextLineByCode = new Map(lineByCode);
  nextLineByCode.set(draftLine.itemCode, draftLine);
  const recalculatedLine = recalculateWorkScheduleLineFromPredecessors(draftLine, nextLineByCode);

  if (!recalculatedLine?.startDate || recalculatedLine.durationDays == null) {
    return nextLine;
  }

  return updateEditableLineDuration(
    {
      ...nextLine,
      startDate: recalculatedLine.startDate,
    },
    recalculatedLine.durationDays,
  );
}

export function recalculateDraggedPredecessorString(
  predecessor: string,
  movedLine: Pick<WorkScheduleLineRecord, "itemCode" | "startDate" | "endDate" | "durationDays">,
  lineByCode: Map<string, WorkScheduleLineRecord>,
) {
  const parsedPredecessors = tryParseWorkSchedulePredecessors(predecessor);
  if (!parsedPredecessors || parsedPredecessors.length === 0 || !movedLine.startDate || !movedLine.endDate) {
    return predecessor;
  }

  return parsedPredecessors
    .map((reference) => {
      const predecessorLine = lineByCode.get(reference.code);
      if (!predecessorLine?.startDate || !predecessorLine.endDate) {
        return formatPredecessorToken(reference.code, reference.relation, reference.lagDays);
      }

      return formatPredecessorToken(
        reference.code,
        reference.relation,
        calculateLagDaysFromMovedSuccessor(reference.relation, predecessorLine, movedLine),
      );
    })
    .join(",");
}

function calculateLagDaysFromMovedSuccessor(
  relation: "FS" | "SS" | "FF" | "SF",
  predecessorLine: Pick<WorkScheduleLineRecord, "startDate" | "endDate">,
  movedLine: Pick<WorkScheduleLineRecord, "startDate" | "endDate">,
) {
  switch (relation) {
    case "FS":
      return diffInDays(predecessorLine.endDate!, movedLine.startDate!) - 1;
    case "SS":
      return diffInDays(predecessorLine.startDate!, movedLine.startDate!);
    case "FF":
      return diffInDays(predecessorLine.endDate!, movedLine.endDate!);
    case "SF":
      return diffInDays(predecessorLine.startDate!, movedLine.endDate!);
    default:
      return 0;
  }
}


function compareIsoDates(left: string, right: string) {
  return left.localeCompare(right);
}

function shouldHydrateInitialDistribution(previousLine: EditableLine) {
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

function addIsoDays(startDate: string, days: number) {
  const date = new Date(`${startDate}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    return startDate;
  }

  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
