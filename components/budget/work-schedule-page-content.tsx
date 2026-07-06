"use client";

import dynamic from "next/dynamic";
import * as Dialog from "@radix-ui/react-dialog";
import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type FocusEvent as ReactFocusEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type UIEvent as ReactUIEvent,
} from "react";
import { CalendarDays, ChartSpline, MoreHorizontal, Package2, PenSquare, Save, WandSparkles, X } from "lucide-react";
import type ExcelJS from "exceljs";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const ExportPanel = dynamic(() => import("@/components/exports/export-panel").then((mod) => mod.ExportPanel));
import { OperationalPanel } from "@/components/ui/operational-surfaces";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { useFormattingSettings } from "@/components/providers/formatting-settings-provider";
import { useAppViewMode } from "@/components/view-mode/app-view-mode-provider";
import {
  buildWorkScheduleView,
  calculateWorkScheduleDurationDays,
  recalculateDependentWorkScheduleLines,
  recalculateWorkScheduleLineFromPredecessors,
} from "@/lib/calculations/work-schedule";
import { cn, formatCurrency, formatDate, formatNumber } from "@/lib/utils";
import { getExportDefinition } from "@/lib/exports/definitions";
import { parseWorkSchedulePredecessors, tryParseWorkSchedulePredecessors } from "@/lib/work-schedule/predecessors";
import { TimelineRow as GanttTimelineRow } from "@/components/budget/gantt/timeline-row";
import { GanttConnectionOverlay } from "@/components/budget/gantt/gantt-connection-overlay";
import { DependencyEditPopover } from "@/components/budget/gantt/dependency-edit-popover";
import { useGanttConnectionMode, type LinePosition, type WorkSchedulePredecessorRelation } from "@/components/budget/gantt/use-gantt-connection-mode";
import type { GanttBarChangeResult } from "@/components/budget/gantt/gantt-utils";
import type {
  WorkScheduleCurvePointRecord,
  WorkScheduleLineRecord,
  WorkScheduleDisplayRowRecord,
  WorkScheduleMonthlyDistributionRecord,
  WorkSchedulePeriodRecord,
  WorkScheduleResourceCalendarRow,
  WorkScheduleValuationCalendarRow,
  WorkScheduleViewRecord,
} from "@/types/work-schedule";

type WorkSchedulePageContentProps = {
  initialData: WorkScheduleViewRecord;
};

type ActiveView = "overview" | "valuation" | "resources" | "curve";
type DerivedCalendarView = Exclude<ActiveView, "overview">;
type WorkbookExportScope = "detail_only" | "detail_and_total" | "detail_subtotals_and_total";
type WorkbookExportProfile = "minimal" | "executive" | "analytical";
type WorkbookCell = {
  value: ExcelJS.CellValue;
  numFmt?: string;
};

type WorkbookTableData = {
  headers: string[];
  rows: WorkbookCell[][];
  subtotalRowIndexes?: number[];
  totalRow?: WorkbookCell[];
};

type EditableLine = {
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
};

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

export function WorkSchedulePageContent({ initialData }: WorkSchedulePageContentProps) {
  return <WorkSchedulePageContentInner key={initialData.budgetId} initialData={initialData} />;
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
  const [data, setData] = useState(normalizedInitialData);
  const [activeView, setActiveView] = useState<ActiveView>(() => readActiveView(normalizedInitialData.budgetId));
  const [editingLine, setEditingLine] = useState<EditableLine | null>(() =>
    readEditingLine(normalizedInitialData, buildPredecessorRowNumberMaps(normalizedInitialData.groups).itemCodeToRowNumber),
  );
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>(() => readCollapsedGroups(normalizedInitialData.budgetId));
  const [overviewFilter, setOverviewFilter] = useState<OverviewFilter>(() => readOverviewFilter(normalizedInitialData.budgetId));
  const [showCriticalPath, setShowCriticalPath] = useState(() => readCriticalPathVisibility(normalizedInitialData.budgetId));
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
  const [saveState, setSaveState] = useState<"idle" | "saving" | "error">("idle");
  const [error, setError] = useState("");
  const [activeInlineRowId, setActiveInlineRowId] = useState<string | null>(null);
  const [inlineDrafts, setInlineDrafts] = useState<Record<string, EditableLine>>({});
  const [inlineSaveStateById, setInlineSaveStateById] = useState<Record<string, "idle" | "saving" | "error">>({});
  const [inlineErrorsById, setInlineErrorsById] = useState<Record<string, string>>({});
  const [isGenerationDialogOpen, setIsGenerationDialogOpen] = useState(false);
  const [generationBaseDate, setGenerationBaseDate] = useState(() => normalizedInitialData.timeline.startDate ?? new Date().toISOString().slice(0, 10));
  const [generationState, setGenerationState] = useState<"idle" | "saving" | "error">("idle");
  const [generationError, setGenerationError] = useState("");
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
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

  async function handleGenerateIntelligentSchedule() {
    setGenerationState("saving");
    setGenerationError("");

    try {
      const response = await fetch(`/api/budgets/${data.budgetId}/work-schedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          baseStartDate: generationBaseDate,
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
    setInlineDrafts((current) =>
      current[line.budgetItemId]
        ? current
        : { ...current, [line.budgetItemId]: createEditableLine(line, predecessorItemCodeToRowNumber) },
    );
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
      const editableLine: EditableLine = {
        budgetItemId: line.budgetItemId,
        description: line.description,
        quantity: line.quantity,
        performance: line.performance ?? null,
        startDate: result.startDate,
        endDate: result.endDate,
        durationDays: result.durationDays,
        predecessor: line.predecessor ?? "",
        crew: line.crew?.toString() ?? "",
        monthlyDistributions: result.monthlyDistributions,
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
    [persistWorkScheduleLine],
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

      const editableLine: EditableLine = {
        budgetItemId: targetLine.budgetItemId,
        description: targetLine.description,
        quantity: targetLine.quantity,
        performance: targetLine.performance ?? null,
        startDate: targetLine.startDate ?? "",
        endDate: targetLine.endDate ?? "",
        durationDays: targetLine.durationDays ?? 1,
        predecessor: mergedPredecessors,
        crew: targetLine.crew?.toString() ?? "",
        monthlyDistributions: targetLine.monthlyDistributions,
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

      const editableLine: EditableLine = {
        budgetItemId: targetLine.budgetItemId,
        description: targetLine.description,
        quantity: targetLine.quantity,
        performance: targetLine.performance ?? null,
        startDate: targetLine.startDate ?? "",
        endDate: targetLine.endDate ?? "",
        durationDays: targetLine.durationDays ?? 1,
        predecessor: updatedPredecessors,
        crew: targetLine.crew?.toString() ?? "",
        monthlyDistributions: targetLine.monthlyDistributions,
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

      const editableLine: EditableLine = {
        budgetItemId: targetLine.budgetItemId,
        description: targetLine.description,
        quantity: targetLine.quantity,
        performance: targetLine.performance ?? null,
        startDate: targetLine.startDate ?? "",
        endDate: targetLine.endDate ?? "",
        durationDays: targetLine.durationDays ?? 1,
        predecessor: updatedPredecessors,
        crew: targetLine.crew?.toString() ?? "",
        monthlyDistributions: targetLine.monthlyDistributions,
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
    writeOverviewFilter(data.budgetId, overviewFilter);
  }, [data.budgetId, overviewFilter]);

  useEffect(() => {
    writeCriticalPathVisibility(data.budgetId, showCriticalPath);
  }, [data.budgetId, showCriticalPath]);

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
            <InfoTile label="Ventana" value={formatTimelineRange(data.timeline.startDate, data.timeline.endDate, dateFormat)} />
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

          {data.reviewSummary && data.reviewSummary.warnings.length > 0 ? (
            <div className="theme-status-warning theme-status-warning-strong space-y-2 rounded-2xl border px-4 py-3">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-semibold">Revision previa del cronograma</span>
                <span>{data.reviewSummary.warningCount} advertencias detectadas</span>
              </div>
              <div className="space-y-2 text-xs">
                {data.reviewSummary.warnings.map((warning) => (
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
          onToggleGroup={handleToggleCollapsedGroup}
          onCollapseAll={handleCollapseAllGroups}
          onExpandAll={handleExpandAllGroups}
          overviewFilter={overviewFilter}
          onOverviewFilterChange={setOverviewFilter}
          showCriticalPath={showCriticalPath}
          onShowCriticalPathChange={setShowCriticalPath}
          highlightedBudgetItemId={highlightedBudgetItemId}
          scrollRequest={overviewScrollRequest}
          onScrollRequestHandled={handleScrollRequestHandled}
          onEditLine={handleEditLine}
          activeInlineRowId={activeInlineRowId}
          inlineDrafts={inlineDrafts}
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
        />
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
          <ResourceCalendarView
            rows={filteredResourceRows}
            periods={data.resourceCalendar?.periods ?? []}
            currency={data.currency}
            currencyDecimals={currencyDecimals}
            mode={resourceCalendarMode}
            onModeChange={setResourceCalendarMode}
            activeFilterLabel={overviewFilter !== "all" ? formatOverviewFilterLabel(overviewFilter) : null}
          />
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

      <WorkScheduleGenerationDialog
        open={isGenerationDialogOpen}
        baseStartDate={generationBaseDate}
        saveState={generationState}
        error={generationError}
        hasExistingSchedule={orderedLines.some((line) => line.startDate && line.endDate && line.durationDays != null)}
        reviewSummary={data.reviewSummary ?? null}
        onBaseStartDateChange={setGenerationBaseDate}
        onClose={() => setIsGenerationDialogOpen(false)}
        onSubmit={() => void handleGenerateIntelligentSchedule()}
      />
    </div>
  );
}

function WorkScheduleOverview({
  data,
  isExcelMode,
  timelineDays,
  hasDailyTimeline,
  dateFormat,
  currencyDecimals,
  predecessorItemCodeToRowNumber,
  collapsedGroups,
  onToggleGroup,
  onCollapseAll,
  onExpandAll,
  overviewFilter,
  onOverviewFilterChange,
  showCriticalPath,
  onShowCriticalPathChange,
  highlightedBudgetItemId,
  scrollRequest,
  onScrollRequestHandled,
  onEditLine,
  activeInlineRowId,
  inlineDrafts,
  inlineSaveStateById,
  inlineErrorsById,
  onActivateInlineRow,
  onInlineDraftChange,
  onInlinePredecessorChange,
  onInlineRowSave,
  onInlineRowCancel,
  onGanttBarChange,
  onCreateDependency,
  onEditDependency,
  onDeleteDependency,
}: {
  data: WorkScheduleViewRecord;
  isExcelMode: boolean;
  timelineDays: TimelineDay[];
  hasDailyTimeline: boolean;
  dateFormat: string;
  currencyDecimals: number;
  predecessorItemCodeToRowNumber: Map<string, number>;
  collapsedGroups: Record<string, boolean>;
  onToggleGroup: (subBudgetId: string) => void;
  onCollapseAll: () => void;
  onExpandAll: () => void;
  overviewFilter: OverviewFilter;
  onOverviewFilterChange: (filter: OverviewFilter) => void;
  showCriticalPath: boolean;
  onShowCriticalPathChange: (visible: boolean) => void;
  highlightedBudgetItemId: string | null;
  scrollRequest: number | null;
  onScrollRequestHandled: () => void;
  onEditLine: (line: WorkScheduleLineRecord) => void;
  activeInlineRowId: string | null;
  inlineDrafts: Record<string, EditableLine>;
  inlineSaveStateById: Record<string, "idle" | "saving" | "error">;
  inlineErrorsById: Record<string, string>;
  onActivateInlineRow: (line: WorkScheduleLineRecord) => void;
  onInlineDraftChange: (rowId: string, draft: EditableLine) => void;
  onInlinePredecessorChange: (rowId: string, line: EditableLine, predecessor: string) => void;
  onInlineRowSave: (rowId: string) => void;
  onInlineRowCancel: (rowId: string) => void;
  onGanttBarChange?: (line: WorkScheduleLineRecord, result: GanttBarChangeResult) => void;
  onCreateDependency?: (sourceItemCode: string, targetItemCode: string, relation: WorkSchedulePredecessorRelation, lagDays: number) => void;
  onEditDependency?: (sourceCode: string, targetCode: string, relation: WorkSchedulePredecessorRelation, lagDays: number) => void;
  onDeleteDependency?: (sourceCode: string, targetCode: string) => void;
}) {
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const timelineBottomScrollRef = useRef<HTMLDivElement | null>(null);
  const verticalScrollContainerRef = useRef<HTMLDivElement | null>(null);
  const overviewCanvasRef = useRef<HTMLDivElement | null>(null);
  const leftPanelRef = useRef<HTMLDivElement | null>(null);
  const leftScrollViewportRef = useRef<HTMLDivElement | null>(null);
  const leftBottomScrollRef = useRef<HTMLDivElement | null>(null);
  const timelinePanelRef = useRef<HTMLDivElement | null>(null);
  const resizeSessionRef = useRef<{ startX: number; startWidth: number; leftPanelWidth: number } | null>(null);
  const pendingScrollWriteFrameRef = useRef<number | null>(null);
  const pendingVerticalScrollFrameRef = useRef<number | null>(null);
  const horizontalScrollSyncSourceRef = useRef<"timeline-main" | "timeline-bottom" | "left-main" | "left-bottom" | null>(null);
  const groupRowRefs = useRef(new Map<string, HTMLElement>());
  const lineRowRefs = useRef(new Map<string, HTMLElement>());
  const groupRowObserverRef = useRef<ResizeObserver | null>(null);
  const lineRowObserverRef = useRef<ResizeObserver | null>(null);
  const pendingGroupHeightUpdatesRef = useRef<Record<string, number>>({});
  const pendingLineHeightUpdatesRef = useRef<Record<string, number>>({});
  const pendingHeightFlushFrameRef = useRef<number | null>(null);
  const pendingMeasuredHeightsPersistTimeoutRef = useRef<number | null>(null);
  const [timelinePanelWidth, setTimelinePanelWidth] = useState(() => readOverviewTimelinePanelWidth(data.budgetId));
  const timelinePanelWidthRef = useRef(timelinePanelWidth);
  const pendingViewportMeasureFrameRef = useRef<number | null>(null);
  const [showCostColumns, setShowCostColumns] = useState(() => readOverviewCostColumnsVisibility(data.budgetId));
  const [timelineZoomPercent, setTimelineZoomPercent] = useState(() => readOverviewTimelineZoomPercent(data.budgetId));
  const [tableGroupHeights, setTableGroupHeights] = useState<Record<string, number>>(
    () => readOverviewMeasuredHeights(data.budgetId).groups,
  );
  const [tableLineHeights, setTableLineHeights] = useState<Record<string, number>>(
    () => readOverviewMeasuredHeights(data.budgetId).lines,
  );
  const [leftTableViewportWidth, setLeftTableViewportWidth] = useState<number | null>(null);
  const [verticalScrollTop, setVerticalScrollTop] = useState(0);
  const [verticalViewportHeight, setVerticalViewportHeight] = useState(0);
  const latestVerticalScrollTopRef = useRef(0);
  const leftTableViewportWidthRef = useRef<number | null>(null);
  const OVERVIEW_TIMELINE_RIGHT_OFFSET = 16;
  const hasCollapsedGroups = data.groups.some((group) => collapsedGroups[group.subBudgetId] === true);
  const hasExpandedGroups = data.groups.some((group) => collapsedGroups[group.subBudgetId] !== true);
  const allLines = useMemo(() => data.groups.flatMap((group) => group.lines), [data.groups]);
  const timelineDayIndexByIso = useMemo(
    () => new Map(timelineDays.map((day, index) => [day.iso, index])),
    [timelineDays],
  );
  const lineOverviewStats = useMemo(() => {
    const pendingLineIds = new Set<string>();
    const scheduledLineIds = new Set<string>();
    const incompleteDistributionLineIds = new Set<string>();

    for (const line of allLines) {
      if (isPendingWorkScheduleLine(line)) {
        pendingLineIds.add(line.budgetItemId);
      } else {
        scheduledLineIds.add(line.budgetItemId);
      }

      if (hasIncompleteDistribution(line)) {
        incompleteDistributionLineIds.add(line.budgetItemId);
      }
    }

    return {
      pendingCount: pendingLineIds.size,
      scheduledCount: scheduledLineIds.size,
      incompleteDistributionCount: incompleteDistributionLineIds.size,
      pendingLineIds,
      scheduledLineIds,
      incompleteDistributionLineIds,
    };
  }, [allLines]);
  const pendingCount = lineOverviewStats.pendingCount;
  const incompleteDistributionCount = lineOverviewStats.incompleteDistributionCount;
  const scheduledCount = lineOverviewStats.scheduledCount;
  const visibleGroups = useMemo(
    () => {
      const groups: typeof data.groups = [];

      for (const group of data.groups) {
        const visibleLineIds = new Set<string>();
        const visibleLines: WorkScheduleLineRecord[] = [];

        for (const line of group.lines) {
          if (!matchesOverviewFilterWithStats(line, overviewFilter, lineOverviewStats)) {
            continue;
          }

          visibleLineIds.add(line.budgetItemId);
          visibleLines.push(line);
        }

        const visibleRows = group.rows.filter((row) => isVisibleOverviewRow(row, visibleLineIds));
        const isCollapsed = collapsedGroups[group.subBudgetId] === true;

        if (overviewFilter !== "all" && !isCollapsed && visibleRows.length === 0) {
          continue;
        }

        if (overviewFilter === "all" || visibleRows.length > 0 || isCollapsed) {
          groups.push({
            ...group,
            lines: visibleLines,
            rows: visibleRows,
          });
        }
      }

      return groups;
    },
    [collapsedGroups, data, lineOverviewStats, overviewFilter],
  );
  const overviewVirtualItems = useMemo<OverviewVirtualItem[]>(() => {
    const items: OverviewVirtualItem[] = [];

    for (const group of visibleGroups) {
      const collapsed = collapsedGroups[group.subBudgetId] === true;
      items.push({
        key: `group:${group.subBudgetId}`,
        kind: "group",
        group,
        collapsed,
        estimatedHeight: tableGroupHeights[group.subBudgetId] ?? OVERVIEW_GROUP_ROW_ESTIMATED_HEIGHT,
      });

      if (collapsed) {
        continue;
      }

      for (const row of group.rows) {
        items.push({
          key: `row:${row.rowId}`,
          kind: "row",
          group,
          row,
          estimatedHeight: tableLineHeights[row.rowId] ?? OVERVIEW_LINE_ROW_ESTIMATED_HEIGHT,
        });
      }
    }

    return items;
  }, [collapsedGroups, tableGroupHeights, tableLineHeights, visibleGroups]);
  const overviewVirtualWindow = useMemo(
    () =>
      buildOverviewVirtualWindow({
        items: overviewVirtualItems,
        scrollTop: verticalScrollTop,
        viewportHeight: verticalViewportHeight || OVERVIEW_VIRTUAL_SCROLL_FALLBACK_HEIGHT,
        overscanPx: OVERVIEW_VIRTUAL_OVERSCAN_PX,
      }),
    [overviewVirtualItems, verticalScrollTop, verticalViewportHeight],
  );
  const segmentLegend = [
    { label: "1er periodo", colorClassName: "bg-sky-600" },
    { label: "2do periodo", colorClassName: "bg-cyan-500" },
    { label: "3er periodo", colorClassName: "bg-indigo-500" },
    { label: "4to periodo", colorClassName: "bg-emerald-500" },
  ];
  const leftTableColumnWidths = useMemo(
    () => [
      OVERVIEW_TABLE_COLUMN_WIDTHS.rowNumber,
      OVERVIEW_TABLE_COLUMN_WIDTHS.item,
      OVERVIEW_TABLE_COLUMN_WIDTHS.partida,
      OVERVIEW_TABLE_COLUMN_WIDTHS.duration,
      OVERVIEW_TABLE_COLUMN_WIDTHS.start,
      OVERVIEW_TABLE_COLUMN_WIDTHS.end,
      OVERVIEW_TABLE_COLUMN_WIDTHS.predecessor,
      OVERVIEW_TABLE_COLUMN_WIDTHS.crew,
      OVERVIEW_TABLE_COLUMN_WIDTHS.performance,
      OVERVIEW_TABLE_COLUMN_WIDTHS.unit,
      OVERVIEW_TABLE_COLUMN_WIDTHS.quantity,
      ...(showCostColumns
        ? [OVERVIEW_TABLE_COLUMN_WIDTHS.unitPrice, OVERVIEW_TABLE_COLUMN_WIDTHS.partial]
        : []),
      OVERVIEW_TABLE_COLUMN_WIDTHS.action,
    ],
    [showCostColumns],
  );
  const leftTableWidth = useMemo(
    () => leftTableColumnWidths.reduce((sum, width) => sum + width, 0),
    [leftTableColumnWidths],
  );
  const overviewRowNumbers = useMemo(() => {
    const rowNumbers: Record<string, number> = {};
    let currentRowNumber = 1;

    for (const group of visibleGroups) {
      rowNumbers[`group:${group.subBudgetId}`] = currentRowNumber;
      currentRowNumber += 1;

      for (const row of group.rows) {
        rowNumbers[`row:${row.rowId}`] = currentRowNumber;
        currentRowNumber += 1;
      }
    }

    return rowNumbers;
  }, [visibleGroups]);
  const timelineContentWidth = useMemo(
    () =>
      Math.max(
        480,
        timelineDays.length * getZoomedTimelineDayWidth(timelineZoomPercent) +
          Math.max(0, timelineDays.length - 1) * getZoomedTimelineDayGap(timelineZoomPercent),
      ),
    [timelineDays.length, timelineZoomPercent],
  );
  const visibleTimelineLinePositions = useMemo(() => {
    const positions = new Map<string, VisibleTimelineLinePosition>();
    let cursorTop = overviewVirtualWindow.topSpacerHeight;

    for (const item of overviewVirtualWindow.visibleItems) {
      if (item.kind === "group") {
        cursorTop += normalizeMeasuredHeight(
          tableGroupHeights[item.group.subBudgetId] ?? OVERVIEW_GROUP_ROW_ESTIMATED_HEIGHT,
          OVERVIEW_SYNCHRONIZED_MIN_ROW_HEIGHT,
        );
        continue;
      }

      const rowHeight = normalizeMeasuredHeight(
        tableLineHeights[item.row.rowId] ?? OVERVIEW_LINE_ROW_ESTIMATED_HEIGHT,
        OVERVIEW_SYNCHRONIZED_MIN_ROW_HEIGHT,
      );

      if (item.row.kind === "line") {
        positions.set(item.row.line.itemCode, {
          line: item.row.line,
          top: cursorTop,
          height: rowHeight,
        });
      }

      cursorTop += rowHeight;
    }

    return positions;
  }, [overviewVirtualWindow, tableGroupHeights, tableLineHeights]);
  const timelineDependencyPaths = useMemo(
    () =>
      buildTimelineDependencyPaths({
        visibleLinePositions: visibleTimelineLinePositions,
        timelineDayIndexByIso,
        timelineDayWidth: getZoomedTimelineDayWidth(timelineZoomPercent),
        timelineDayGap: getZoomedTimelineDayGap(timelineZoomPercent),
      }),
    [timelineDayIndexByIso, timelineZoomPercent, visibleTimelineLinePositions],
  );

  // Gantt connection mode for visual dependency creation
  const timelineLinePositions = useMemo<LinePosition[]>(
    () =>
      [...visibleTimelineLinePositions.entries()].map(([itemCode, pos]) => ({
        budgetItemId: pos.line.budgetItemId,
        itemCode,
        top: pos.top,
        height: pos.height,
      })),
    [visibleTimelineLinePositions],
  );

  const {
    connectionState,
    confirmingState,
    startConnection,
    updateConnectionPointer,
    endConnection,
    confirmConnection,
    cancelConfirmConnection,
    cancelConnection,
  } = useGanttConnectionMode({
    linePositions: timelineLinePositions,
    onConnect: (sourceItemCode, targetItemCode, relation, lagDays) => {
      onCreateDependency?.(sourceItemCode, targetItemCode, relation, lagDays);
    },
  });

  // Editing existing dependency
  const [editingDependency, setEditingDependency] = useState<{
    sourceCode: string;
    targetCode: string;
    sourceItemCode: string;
    targetItemCode: string;
    currentRelation: WorkSchedulePredecessorRelation;
    currentLagDays: number;
    x: number;
    y: number;
  } | null>(null);

  const totalTimelineHeight = useMemo(
    () => {
      const itemsHeight = overviewVirtualItems.reduce(
        (sum, item) => sum + (item.estimatedHeight ?? 40),
        0,
      );
      return itemsHeight > 0 ? itemsHeight : 120;
    },
    [overviewVirtualItems],
  );

  const setGroupRowRef = useCallback((subBudgetId: string, element: HTMLElement | null) => {
    const previousElement = groupRowRefs.current.get(subBudgetId);
    if (previousElement && groupRowObserverRef.current) {
      groupRowObserverRef.current.unobserve(previousElement);
    }

    if (element) {
      groupRowRefs.current.set(subBudgetId, element);
      if (groupRowObserverRef.current) {
        groupRowObserverRef.current.observe(element);
      }
      return;
    }

    groupRowRefs.current.delete(subBudgetId);
  }, []);
  const setLineRowRef = useCallback((rowId: string, element: HTMLElement | null) => {
    const previousElement = lineRowRefs.current.get(rowId);
    if (previousElement && lineRowObserverRef.current) {
      lineRowObserverRef.current.unobserve(previousElement);
    }

    if (element) {
      lineRowRefs.current.set(rowId, element);
      if (lineRowObserverRef.current) {
        lineRowObserverRef.current.observe(element);
      }
      return;
    }

    lineRowRefs.current.delete(rowId);
  }, []);

  const getMeasuredLeftTableViewportWidth = useCallback(() => {
    const leftPanel = leftPanelRef.current;
    const timelinePanel = timelinePanelRef.current;

    if (!leftPanel) {
      return null;
    }

    if (!timelinePanel) {
      return null;
    }

    const leftRect = leftPanel.getBoundingClientRect();
    const timelineRect = timelinePanel.getBoundingClientRect();
    const overlap = Math.max(0, Math.ceil(leftRect.right - timelineRect.left));
    return overlap > 0 ? Math.max(Math.floor(leftRect.width - overlap), 240) : Math.floor(leftRect.width);
  }, []);

  const applyLeftTableViewportWidth = useCallback((nextViewportWidth: number | null, syncState: boolean) => {
    leftTableViewportWidthRef.current = nextViewportWidth;

    const leftScrollViewport = leftScrollViewportRef.current;
    if (leftScrollViewport) {
      if (nextViewportWidth == null) {
        leftScrollViewport.style.removeProperty("width");
        leftScrollViewport.style.removeProperty("max-width");
      } else {
        leftScrollViewport.style.width = `${nextViewportWidth}px`;
        leftScrollViewport.style.maxWidth = "100%";
      }
    }

    if (syncState) {
      setLeftTableViewportWidth((currentWidth) => (currentWidth === nextViewportWidth ? currentWidth : nextViewportWidth));
    }
  }, []);

  const measureLeftTableViewportWidth = useCallback((syncState = true) => {
    applyLeftTableViewportWidth(getMeasuredLeftTableViewportWidth(), syncState);
  }, [applyLeftTableViewportWidth, getMeasuredLeftTableViewportWidth]);

  const getViewportWidthFromDragWidths = useCallback((leftPanelWidth: number, timelineWidth: number) => {
    return Math.max(Math.floor(leftPanelWidth - timelineWidth - OVERVIEW_TIMELINE_RIGHT_OFFSET), 240);
  }, []);

  useEffect(() => {
    if (!scrollContainerRef.current) {
      return;
    }

    const savedScrollLeft = readOverviewScrollPosition(data.budgetId);
    scrollContainerRef.current.scrollLeft = savedScrollLeft;
    if (timelineBottomScrollRef.current) {
      timelineBottomScrollRef.current.scrollLeft = savedScrollLeft;
    }
  }, [data.budgetId]);

  useLayoutEffect(() => {
    const scheduleViewportMeasurement = () => {
      if (pendingViewportMeasureFrameRef.current !== null) {
        return;
      }

      pendingViewportMeasureFrameRef.current = window.requestAnimationFrame(() => {
        pendingViewportMeasureFrameRef.current = null;
        measureLeftTableViewportWidth();
      });
    };

    scheduleViewportMeasurement();

    const handleResize = () => {
      scheduleViewportMeasurement();
    };

    window.addEventListener("resize", handleResize);

    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver(() => {
        scheduleViewportMeasurement();
      });

      if (leftPanelRef.current) {
        observer.observe(leftPanelRef.current);
      }

      if (timelinePanelRef.current) {
        observer.observe(timelinePanelRef.current);
      }

      return () => {
        if (pendingViewportMeasureFrameRef.current !== null) {
          window.cancelAnimationFrame(pendingViewportMeasureFrameRef.current);
          pendingViewportMeasureFrameRef.current = null;
        }
        window.removeEventListener("resize", handleResize);
        observer.disconnect();
      };
    }

    return () => {
      if (pendingViewportMeasureFrameRef.current !== null) {
        window.cancelAnimationFrame(pendingViewportMeasureFrameRef.current);
        pendingViewportMeasureFrameRef.current = null;
      }
      window.removeEventListener("resize", handleResize);
    };
  }, [measureLeftTableViewportWidth, showCostColumns, timelinePanelWidth]);

  useLayoutEffect(() => {
    const element = verticalScrollContainerRef.current;
    if (!element) {
      return;
    }

    const updateViewportHeight = () => {
      const nextHeight = element.clientHeight;
      setVerticalViewportHeight((current) => (current === nextHeight ? current : nextHeight));
    };

    updateViewportHeight();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", updateViewportHeight);
      return () => {
        window.removeEventListener("resize", updateViewportHeight);
      };
    }

    const observer = new ResizeObserver(() => {
      updateViewportHeight();
    });
    observer.observe(element);
    window.addEventListener("resize", updateViewportHeight);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateViewportHeight);
    };
  }, []);

  useEffect(() => {
    if (scrollRequest === null || !scrollContainerRef.current) {
      return;
    }

    scrollContainerRef.current.scrollLeft = scrollRequest;
    if (timelineBottomScrollRef.current) {
      timelineBottomScrollRef.current.scrollLeft = scrollRequest;
    }
    writeOverviewScrollPosition(data.budgetId, scrollRequest);
    onScrollRequestHandled();
  }, [data.budgetId, onScrollRequestHandled, scrollRequest]);

  function handleOverviewScroll() {
    if (!scrollContainerRef.current) {
      return;
    }

    if (horizontalScrollSyncSourceRef.current !== "timeline-bottom" && timelineBottomScrollRef.current) {
      horizontalScrollSyncSourceRef.current = "timeline-main";
      timelineBottomScrollRef.current.scrollLeft = scrollContainerRef.current.scrollLeft;
      horizontalScrollSyncSourceRef.current = null;
    }

    if (pendingScrollWriteFrameRef.current !== null) {
      window.cancelAnimationFrame(pendingScrollWriteFrameRef.current);
    }

    const nextScrollLeft = scrollContainerRef.current.scrollLeft;
    pendingScrollWriteFrameRef.current = window.requestAnimationFrame(() => {
      writeOverviewScrollPosition(data.budgetId, nextScrollLeft);
      pendingScrollWriteFrameRef.current = null;
    });
  }

  function handleTimelineBottomScroll() {
    if (!timelineBottomScrollRef.current) {
      return;
    }

    if (horizontalScrollSyncSourceRef.current !== "timeline-main" && scrollContainerRef.current) {
      horizontalScrollSyncSourceRef.current = "timeline-bottom";
      scrollContainerRef.current.scrollLeft = timelineBottomScrollRef.current.scrollLeft;
      horizontalScrollSyncSourceRef.current = null;
    }

    if (pendingScrollWriteFrameRef.current !== null) {
      window.cancelAnimationFrame(pendingScrollWriteFrameRef.current);
    }

    const nextScrollLeft = timelineBottomScrollRef.current.scrollLeft;
    pendingScrollWriteFrameRef.current = window.requestAnimationFrame(() => {
      writeOverviewScrollPosition(data.budgetId, nextScrollLeft);
      pendingScrollWriteFrameRef.current = null;
    });
  }

  function handleLeftTableScroll() {
    if (!leftScrollViewportRef.current) {
      return;
    }

    if (horizontalScrollSyncSourceRef.current !== "left-bottom" && leftBottomScrollRef.current) {
      horizontalScrollSyncSourceRef.current = "left-main";
      leftBottomScrollRef.current.scrollLeft = leftScrollViewportRef.current.scrollLeft;
      horizontalScrollSyncSourceRef.current = null;
    }
  }

  function handleLeftBottomScroll() {
    if (!leftBottomScrollRef.current || !leftScrollViewportRef.current) {
      return;
    }

    if (horizontalScrollSyncSourceRef.current !== "left-main") {
      horizontalScrollSyncSourceRef.current = "left-bottom";
      leftScrollViewportRef.current.scrollLeft = leftBottomScrollRef.current.scrollLeft;
      horizontalScrollSyncSourceRef.current = null;
    }
  }

  function handleVerticalOverviewScroll(event: ReactUIEvent<HTMLDivElement>) {
    latestVerticalScrollTopRef.current = event.currentTarget.scrollTop;

    if (pendingVerticalScrollFrameRef.current !== null) {
      return;
    }

    pendingVerticalScrollFrameRef.current = window.requestAnimationFrame(() => {
      pendingVerticalScrollFrameRef.current = null;
      setVerticalScrollTop((current) =>
        current === latestVerticalScrollTopRef.current ? current : latestVerticalScrollTopRef.current,
      );
    });
  }

  const flushPendingHeightUpdates = useCallback(() => {
    pendingHeightFlushFrameRef.current = null;

    const pendingGroupHeights = pendingGroupHeightUpdatesRef.current;
    const pendingLineHeights = pendingLineHeightUpdatesRef.current;
    pendingGroupHeightUpdatesRef.current = {};
    pendingLineHeightUpdatesRef.current = {};

    if (Object.keys(pendingGroupHeights).length > 0) {
      setTableGroupHeights((current) => {
        let changed = false;
        const next = { ...current };

        for (const [rowId, nextHeight] of Object.entries(pendingGroupHeights)) {
          if (nextHeight > 0 && current[rowId] !== nextHeight) {
            next[rowId] = nextHeight;
            changed = true;
          }
        }

        return changed ? next : current;
      });
    }

    if (Object.keys(pendingLineHeights).length > 0) {
      setTableLineHeights((current) => {
        let changed = false;
        const next = { ...current };

        for (const [rowId, nextHeight] of Object.entries(pendingLineHeights)) {
          if (nextHeight > 0 && current[rowId] !== nextHeight) {
            next[rowId] = nextHeight;
            changed = true;
          }
        }

        return changed ? next : current;
      });
    }
  }, []);

  const scheduleHeightFlush = useCallback(() => {
    if (pendingHeightFlushFrameRef.current !== null) {
      return;
    }

    pendingHeightFlushFrameRef.current = window.requestAnimationFrame(() => {
      flushPendingHeightUpdates();
    });
  }, [flushPendingHeightUpdates]);

  useEffect(() => {
    syncOverviewTimelinePanelWidthCssVariable(timelinePanelWidth);
    timelinePanelWidthRef.current = timelinePanelWidth;
  }, [timelinePanelWidth]);

  useEffect(() => {
    writeOverviewCostColumnsVisibility(data.budgetId, showCostColumns);
  }, [data.budgetId, showCostColumns]);

  useEffect(() => {
    writeOverviewTimelineZoomPercent(data.budgetId, timelineZoomPercent);
  }, [data.budgetId, timelineZoomPercent]);

  useEffect(() => {
    const nextCache: OverviewMeasuredHeightsCache = {
      groups: pruneMeasuredHeightsMap(
        tableGroupHeights,
        new Set(data.groups.map((group) => group.subBudgetId)),
      ),
      lines: pruneMeasuredHeightsMap(
        tableLineHeights,
        new Set(data.groups.flatMap((group) => group.rows.map((row) => row.rowId))),
      ),
    };

    if (pendingMeasuredHeightsPersistTimeoutRef.current !== null) {
      window.clearTimeout(pendingMeasuredHeightsPersistTimeoutRef.current);
    }

    pendingMeasuredHeightsPersistTimeoutRef.current = window.setTimeout(() => {
      writeOverviewMeasuredHeights(data.budgetId, nextCache);
      pendingMeasuredHeightsPersistTimeoutRef.current = null;
    }, 180);

    return () => {
      if (pendingMeasuredHeightsPersistTimeoutRef.current !== null) {
        window.clearTimeout(pendingMeasuredHeightsPersistTimeoutRef.current);
        pendingMeasuredHeightsPersistTimeoutRef.current = null;
      }
    };
  }, [data.budgetId, data.groups, tableGroupHeights, tableLineHeights]);

  useEffect(() => {
    return () => {
      if (pendingScrollWriteFrameRef.current !== null) {
        window.cancelAnimationFrame(pendingScrollWriteFrameRef.current);
      }
      if (pendingVerticalScrollFrameRef.current !== null) {
        window.cancelAnimationFrame(pendingVerticalScrollFrameRef.current);
      }
      if (pendingHeightFlushFrameRef.current !== null) {
        window.cancelAnimationFrame(pendingHeightFlushFrameRef.current);
      }
      if (pendingMeasuredHeightsPersistTimeoutRef.current !== null) {
        window.clearTimeout(pendingMeasuredHeightsPersistTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    function handlePointerMove(event: MouseEvent) {
      const session = resizeSessionRef.current;
      if (!session) {
        return;
      }

      const nextWidth = clampOverviewTimelinePanelWidth(
        session.startWidth + (session.startX - event.clientX),
        overviewCanvasRef.current?.clientWidth ?? null,
      );
      timelinePanelWidthRef.current = nextWidth;
      syncOverviewTimelinePanelWidthCssVariable(nextWidth);
      applyLeftTableViewportWidth(getViewportWidthFromDragWidths(session.leftPanelWidth, nextWidth), false);
    }

    function handlePointerUp() {
      if (!resizeSessionRef.current) {
        return;
      }

      resizeSessionRef.current = null;
      setTimelinePanelWidth(timelinePanelWidthRef.current);
      measureLeftTableViewportWidth(true);
      writeOverviewTimelinePanelWidth(data.budgetId, timelinePanelWidthRef.current);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    }

    window.addEventListener("mousemove", handlePointerMove);
    window.addEventListener("mouseup", handlePointerUp);

    return () => {
      window.removeEventListener("mousemove", handlePointerMove);
      window.removeEventListener("mouseup", handlePointerUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [applyLeftTableViewportWidth, data.budgetId, getViewportWidthFromDragWidths, measureLeftTableViewportWidth]);

  useEffect(() => {
    function measureTableHeights() {
      const nextGroupHeights: Record<string, number> = {};
      const nextLineHeights: Record<string, number> = {};

      for (const group of visibleGroups) {
        const groupRow = groupRowRefs.current.get(group.subBudgetId);
        if (groupRow instanceof HTMLElement && groupRow.offsetHeight > 0) {
          nextGroupHeights[group.subBudgetId] = normalizeMeasuredHeight(
            groupRow.offsetHeight,
            OVERVIEW_SYNCHRONIZED_MIN_ROW_HEIGHT,
          );
        }

        for (const row of group.rows) {
          const lineRow = lineRowRefs.current.get(row.rowId);
          if (lineRow instanceof HTMLElement && lineRow.offsetHeight > 0) {
            nextLineHeights[row.rowId] = normalizeMeasuredHeight(
              lineRow.offsetHeight,
              OVERVIEW_SYNCHRONIZED_MIN_ROW_HEIGHT,
            );
          }
        }
      }

      setTableGroupHeights((current) => (areHeightMapsEqual(current, nextGroupHeights) ? current : nextGroupHeights));
      setTableLineHeights((current) => (areHeightMapsEqual(current, nextLineHeights) ? current : nextLineHeights));
    }

    if (typeof ResizeObserver === "undefined") {
      measureTableHeights();
      window.addEventListener("resize", measureTableHeights);

      return () => {
        window.removeEventListener("resize", measureTableHeights);
      };
    }

    measureTableHeights();

    const handleWindowResize = () => {
      measureTableHeights();
    };
    window.addEventListener("resize", handleWindowResize);

    groupRowObserverRef.current = new ResizeObserver((entries) => {
      let hasPendingUpdates = false;

      for (const entry of entries) {
        const element = entry.target as HTMLElement;
        const rowId = element.dataset.groupRowId;
        if (!rowId) {
          continue;
        }

        const nextHeight = normalizeMeasuredHeight(
          Math.round(entry.contentRect.height),
          OVERVIEW_SYNCHRONIZED_MIN_ROW_HEIGHT,
        );
        if (nextHeight <= 0) {
          continue;
        }

        pendingGroupHeightUpdatesRef.current[rowId] = nextHeight;
        hasPendingUpdates = true;
      }

      if (hasPendingUpdates) {
        scheduleHeightFlush();
      }
    });

    lineRowObserverRef.current = new ResizeObserver((entries) => {
      let hasPendingUpdates = false;

      for (const entry of entries) {
        const element = entry.target as HTMLElement;
        const rowId = element.dataset.tableRowId;
        if (!rowId) {
          continue;
        }

        const nextHeight = normalizeMeasuredHeight(
          Math.round(entry.contentRect.height),
          OVERVIEW_SYNCHRONIZED_MIN_ROW_HEIGHT,
        );
        if (nextHeight <= 0) {
          continue;
        }

        pendingLineHeightUpdatesRef.current[rowId] = nextHeight;
        hasPendingUpdates = true;
      }

      if (hasPendingUpdates) {
        scheduleHeightFlush();
      }
    });

    for (const element of groupRowRefs.current.values()) {
      groupRowObserverRef.current.observe(element);
    }

    for (const element of lineRowRefs.current.values()) {
      lineRowObserverRef.current.observe(element);
    }

    return () => {
      window.removeEventListener("resize", handleWindowResize);
      groupRowObserverRef.current?.disconnect();
      lineRowObserverRef.current?.disconnect();
      if (pendingHeightFlushFrameRef.current !== null) {
        window.cancelAnimationFrame(pendingHeightFlushFrameRef.current);
        pendingHeightFlushFrameRef.current = null;
      }
      pendingGroupHeightUpdatesRef.current = {};
      pendingLineHeightUpdatesRef.current = {};
      groupRowObserverRef.current = null;
      lineRowObserverRef.current = null;
    };
  }, [scheduleHeightFlush, visibleGroups]);

  function handleTimelineResizeStart(event: ReactMouseEvent<HTMLDivElement>) {
    event.preventDefault();
    resizeSessionRef.current = {
      startX: event.clientX,
      startWidth: timelinePanelWidth,
      leftPanelWidth: leftPanelRef.current?.clientWidth ?? 0,
    };
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }

  return (
    <Card className="border-[var(--app-border)] bg-[var(--app-surface)]">
      <CardContent className="space-y-4 p-0">
        <div className="border-b border-[var(--app-border-soft)] px-6 py-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-[var(--app-text-strong)]">Cronograma basico</p>
              <p className="mt-1 text-sm text-[var(--app-text-muted)]">
                Referencia visual basada en la hoja de programacion: tabla valorizada a la izquierda y banda temporal semanal con detalle diario.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant={overviewFilter === "pending" ? "default" : "outline"}
                size="sm"
                onClick={() => onOverviewFilterChange(overviewFilter === "pending" ? "all" : "pending")}
              >
                {`Solo pendientes (${pendingCount})`}
              </Button>
              <Button
                variant={overviewFilter === "incomplete_distribution" ? "default" : "outline"}
                size="sm"
                onClick={() =>
                  onOverviewFilterChange(overviewFilter === "incomplete_distribution" ? "all" : "incomplete_distribution")
                }
              >
                {`Distribucion incompleta (${incompleteDistributionCount})`}
              </Button>
              <Button
                variant={overviewFilter === "scheduled" ? "default" : "outline"}
                size="sm"
                onClick={() => onOverviewFilterChange(overviewFilter === "scheduled" ? "all" : "scheduled")}
              >
                {`Solo programadas (${scheduledCount})`}
              </Button>
              <Button variant="outline" size="sm" onClick={onCollapseAll} disabled={!hasExpandedGroups}>
                Contraer todo
              </Button>
              <Button variant="outline" size="sm" onClick={onExpandAll} disabled={!hasCollapsedGroups}>
                Expandir todo
              </Button>
              <Button
                variant={showCriticalPath ? "default" : "outline"}
                size="sm"
                onClick={() => onShowCriticalPathChange(!showCriticalPath)}
              >
                {showCriticalPath ? "Ocultar ruta critica" : "Mostrar ruta critica"}
              </Button>
              <Button variant="outline" size="sm" onClick={() => setShowCostColumns((current) => !current)}>
                {showCostColumns ? "Ocultar PU y Parcial" : "Mostrar PU y Parcial"}
              </Button>
              <label className="flex h-9 items-center gap-2 rounded-md border border-[var(--app-border)] bg-[var(--app-surface)] px-2.5 text-xs font-medium text-[var(--app-text)]">
                <span>Zoom</span>
                <Input
                  type="number"
                  min={MIN_OVERVIEW_TIMELINE_ZOOM_PERCENT}
                  max={MAX_OVERVIEW_TIMELINE_ZOOM_PERCENT}
                  step="10"
                  value={timelineZoomPercent}
                  onChange={(event) => setTimelineZoomPercent(clampOverviewTimelineZoomPercent(Number(event.target.value)))}
                  className="h-7 w-20 px-2 text-xs"
                />
                <span>%</span>
              </label>
            </div>
          </div>
        </div>

        <div className="border-b border-[var(--app-border-soft)] px-6 py-4">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-semibold text-[var(--app-text-strong)]">Resumen rapido</span>
            <span className="theme-status-warning theme-status-warning-strong rounded-full border px-3 py-1 text-xs font-medium">
              {`Pendientes: ${pendingCount}`}
            </span>
            <span className="theme-status-info theme-status-info-strong rounded-full border px-3 py-1 text-xs font-medium">
              {`Distribucion incompleta: ${incompleteDistributionCount}`}
            </span>
            <span className="theme-status-success theme-status-success-strong rounded-full border px-3 py-1 text-xs font-medium">
              {`Programadas: ${scheduledCount}`}
            </span>
          </div>
        </div>

        <div
          ref={verticalScrollContainerRef}
          data-testid="work-schedule-overview-vertical-scroll"
          className="max-h-[68vh] overflow-y-auto px-4 pb-2"
          onScroll={handleVerticalOverviewScroll}
        >
          <div ref={overviewCanvasRef} className="relative">
            <div
              ref={leftPanelRef}
              data-testid="work-schedule-left-panel"
              className={cn(
                "overflow-hidden border bg-[var(--app-surface)] pt-[32px]",
                isExcelMode ? "rounded-none border-[var(--app-border-strong)]" : "rounded-2xl border-[var(--app-border)]",
              )}
            >
              <div
                ref={leftScrollViewportRef}
                data-testid="work-schedule-left-scroll"
                className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                onScroll={handleLeftTableScroll}
                style={leftTableViewportWidth ? { width: `${leftTableViewportWidth}px`, maxWidth: "100%" } : undefined}
              >
                <div style={{ width: `${leftTableWidth}px`, minWidth: `${leftTableWidth}px` }}>
                  <Table className="table-fixed [&_td]:p-2 [&_td]:text-xs [&_th]:px-2 [&_th]:text-[11px]">
                    <colgroup>
                      {leftTableColumnWidths.map((width, index) => (
                        <col key={`work-schedule-left-col-${index}`} style={{ width: `${width}px` }} />
                      ))}
                    </colgroup>
                    <THead className="bg-[var(--app-surface-muted)]">
                      <TR className={OVERVIEW_HEADER_HEIGHT_CLASS}>
                        <TH className={cn(OVERVIEW_HEADER_HEIGHT_CLASS, "bg-[var(--app-surface-strong)] px-1 py-0 text-center align-middle !text-[10px] text-[var(--app-text-muted)]")}>#</TH>
                        <TH className={cn(OVERVIEW_HEADER_HEIGHT_CLASS, "py-0 align-middle")}>Item</TH>
                        <TH className={cn(OVERVIEW_HEADER_HEIGHT_CLASS, "py-0 align-middle")}>Partida</TH>
                        <TH className={cn(OVERVIEW_HEADER_HEIGHT_CLASS, "py-0 align-middle")}>Duracion</TH>
                        <TH className={cn(OVERVIEW_HEADER_HEIGHT_CLASS, "py-0 align-middle")}>Inicio</TH>
                        <TH className={cn(OVERVIEW_HEADER_HEIGHT_CLASS, "py-0 align-middle")}>Fin</TH>
                        <TH className={cn(OVERVIEW_HEADER_HEIGHT_CLASS, "py-0 align-middle")}>Predecesora</TH>
                        <TH className={cn(OVERVIEW_HEADER_HEIGHT_CLASS, "py-0 align-middle")}>Cuadrilla</TH>
                        <TH className={cn(OVERVIEW_HEADER_HEIGHT_CLASS, "py-0 align-middle")}>Rendimiento</TH>
                        <TH className={cn(OVERVIEW_HEADER_HEIGHT_CLASS, "py-0 align-middle")}>Unidad</TH>
                        <TH className={cn(OVERVIEW_HEADER_HEIGHT_CLASS, "py-0 align-middle")}>Metrado</TH>
                        {showCostColumns ? <TH className={cn(OVERVIEW_HEADER_HEIGHT_CLASS, "py-0 align-middle")}>PU</TH> : null}
                        {showCostColumns ? <TH className={cn(OVERVIEW_HEADER_HEIGHT_CLASS, "py-0 align-middle")}>Parcial</TH> : null}
                        <TH className={cn(OVERVIEW_HEADER_HEIGHT_CLASS, "w-[88px] py-0 align-middle")}>Accion</TH>
                      </TR>
                    </THead>
                    <TBody>
                      {overviewVirtualWindow.topSpacerHeight > 0 ? (
                        <TR aria-hidden="true">
                          <TD colSpan={showCostColumns ? 14 : 12} className="p-0" style={{ height: overviewVirtualWindow.topSpacerHeight }} />
                        </TR>
                      ) : null}
                      {overviewVirtualWindow.visibleItems.map((item) =>
                        item.kind === "group" ? (
                          <TR
                            key={item.key}
                            ref={(element) => setGroupRowRef(item.group.subBudgetId, element)}
                            data-testid={`work-schedule-table-group-row-${item.group.subBudgetId}`}
                            data-group-row-id={item.group.subBudgetId}
                            className={cn("bg-[var(--app-surface-muted)] hover:bg-[var(--app-surface-muted)]", OVERVIEW_GROUP_ROW_HEIGHT_CLASS)}
                          >
                            <TD className="bg-[var(--app-surface-strong)] px-1 text-center align-middle !text-[10px] font-medium text-[var(--app-text-muted)]">
                              {overviewRowNumbers[`group:${item.group.subBudgetId}`] ?? ""}
                            </TD>
                            <TD colSpan={showCostColumns ? 11 : 10} className="align-middle font-semibold text-[var(--app-text-strong)]">
                              <div className="flex items-center justify-between gap-3">
                                <span>SP: {item.group.subBudgetName}</span>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 px-2 text-[11px]"
                                  onClick={() => onToggleGroup(item.group.subBudgetId)}
                                >
                                  {item.collapsed ? `Expandir ${item.group.subBudgetName}` : `Contraer ${item.group.subBudgetName}`}
                                </Button>
                              </div>
                            </TD>
                            {showCostColumns ? (
                              <TD className="align-middle font-semibold text-[var(--app-text-strong)]">
                                {formatCurrency(item.group.totalAmount, data.currency, currencyDecimals)}
                              </TD>
                            ) : null}
                            <TD className="bg-[var(--app-surface-muted)]" />
                          </TR>
                        ) : item.row.kind === "line" ? (
                          <WorkScheduleLineTableRow
                            key={item.key}
                            line={item.row.line}
                            dateFormat={dateFormat}
                            currency={data.currency}
                            currencyDecimals={currencyDecimals}
                            showCostColumns={showCostColumns}
                            showCriticalPath={showCriticalPath}
                            highlighted={highlightedBudgetItemId === item.row.line.budgetItemId}
                            displayPredecessor={formatPredecessorForDisplay(item.row.line.predecessor ?? "", predecessorItemCodeToRowNumber)}
                            onEditLine={onEditLine}
                            rowNumber={overviewRowNumbers[`row:${item.row.rowId}`] ?? null}
                            onRegisterRow={setLineRowRef}
                            inlineDraft={inlineDrafts[item.row.line.budgetItemId] ?? null}
                            isInlineActive={activeInlineRowId === item.row.line.budgetItemId}
                            inlineSaveState={inlineSaveStateById[item.row.line.budgetItemId] ?? "idle"}
                            inlineError={inlineErrorsById[item.row.line.budgetItemId] ?? ""}
                            onActivateInlineRow={onActivateInlineRow}
                            onInlineDraftChange={onInlineDraftChange}
                            onInlinePredecessorChange={onInlinePredecessorChange}
                            onInlineRowSave={onInlineRowSave}
                            onInlineRowCancel={onInlineRowCancel}
                          />
                        ) : (
                          <WorkScheduleLevelTableRow
                            key={item.key}
                            row={item.row}
                            dateFormat={dateFormat}
                            currency={data.currency}
                            currencyDecimals={currencyDecimals}
                            showCostColumns={showCostColumns}
                            rowNumber={overviewRowNumbers[`row:${item.row.rowId}`] ?? null}
                            onRegisterRow={setLineRowRef}
                          />
                        ),
                      )}
                      {overviewVirtualWindow.bottomSpacerHeight > 0 ? (
                        <TR aria-hidden="true">
                          <TD colSpan={showCostColumns ? 14 : 12} className="p-0" style={{ height: overviewVirtualWindow.bottomSpacerHeight }} />
                        </TR>
                      ) : null}
                    </TBody>
                  </Table>
                  <div
                    data-testid="work-schedule-left-footer-spacer"
                    className={cn(
                      "border-t bg-[var(--app-surface-muted)] px-2.5",
                      OVERVIEW_BOTTOM_FOOTER_HEIGHT_CLASS,
                      isExcelMode ? "border-[var(--app-border-strong)]" : "border-[var(--app-border)]",
                    )}
                  />
                </div>
              </div>
            </div>

            <div
              ref={timelinePanelRef}
              data-testid="work-schedule-timeline-panel"
              suppressHydrationWarning
              className={cn(
                "absolute right-0 top-0 bottom-0 z-30 overflow-hidden border bg-[var(--app-surface)]",
                isExcelMode ? "rounded-none border-[var(--app-border-strong)] shadow-none" : "rounded-2xl border-[var(--app-border)] shadow-[0_24px_60px_-28px_rgba(15,23,42,0.45)]",
              )}
              style={{ width: `var(${OVERVIEW_TIMELINE_PANEL_WIDTH_CSS_VAR}, ${timelinePanelWidth}px)` }}
            >
              <div
                data-testid="work-schedule-timeline-resize-handle"
                className={cn(
                  "absolute inset-y-0 left-0 z-40 flex cursor-col-resize items-center justify-center bg-[var(--app-surface-strong)]/80 backdrop-blur-sm transition hover:bg-[var(--app-surface-hover-strong)]/90",
                  isExcelMode ? "w-2" : "w-3",
                )}
                onMouseDown={handleTimelineResizeStart}
              >
                <span className={cn("bg-[var(--app-border-strong)]", isExcelMode ? "h-8 w-px rounded-sm" : "h-10 w-1 rounded-full")} />
              </div>

              {hasDailyTimeline ? (
                <div
                  ref={scrollContainerRef}
                  data-testid="work-schedule-overview-scroll"
                  className="h-full overflow-x-auto overflow-y-hidden pl-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                  onScroll={handleOverviewScroll}
                >
                  <div style={{ width: `${timelineContentWidth}px`, minWidth: `${timelineContentWidth}px` }} className="text-xs">
                    <TimelineHeader
                      timelineDays={timelineDays}
                      isExcelMode={isExcelMode}
                      timelineDayWidth={getZoomedTimelineDayWidth(timelineZoomPercent)}
                    />
                    <div className="relative">
                      {timelineDependencyPaths.length > 0 ? (
                        <svg
                          aria-hidden="true"
                          className="pointer-events-none absolute inset-0 z-10 overflow-visible"
                          style={{ width: `${timelineContentWidth}px`, height: "100%" }}
                        >
                          <defs>
                            <marker id="work-schedule-dependency-arrowhead" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                              <path d="M0,0 L6,3 L0,6 Z" fill="#64748b" />
                            </marker>
                          </defs>
                          {timelineDependencyPaths.map((path) => (
                            <path
                              key={path.key}
                              d={path.d}
                              fill="none"
                              stroke="#64748b"
                              strokeWidth="1.5"
                              strokeLinejoin="round"
                              markerEnd="url(#work-schedule-dependency-arrowhead)"
                              className="pointer-events-auto cursor-pointer hover:stroke-sky-500 hover:stroke-[2.5]"
                              onClick={(event) => {
                                const sourceCode = path.key.split("→")[0];
                                const targetCode = path.key.split("→")[1];
                                if (!sourceCode || !targetCode) return;
                                const targetLine = data.groups
                                  .flatMap((g) => g.lines)
                                  .find((l) => l.itemCode === targetCode);
                                if (!targetLine?.predecessor) return;
                                const parsed = tryParseWorkSchedulePredecessors(targetLine.predecessor);
                                if (!parsed) return;
                                const ref = parsed.find((r) => r.code === sourceCode);
                                if (!ref) return;
                                const svgRect = event.currentTarget.closest("svg")?.getBoundingClientRect();
                                setEditingDependency({
                                  sourceCode,
                                  targetCode,
                                  sourceItemCode: sourceCode,
                                  targetItemCode: targetCode,
                                  currentRelation: ref.relation,
                                  currentLagDays: ref.lagDays,
                                  x: svgRect ? event.clientX - svgRect.left : event.clientX,
                                  y: svgRect ? event.clientY - svgRect.top : event.clientY,
                                });
                              }}
                            />
                          ))}
                        </svg>
                      ) : null}

                        {/* Gantt connection overlay */}
                        {(connectionState || confirmingState) && (
                          <GanttConnectionOverlay
                            connectionState={connectionState}
                            confirmingState={confirmingState}
                            linePositions={timelineLinePositions}
                            timelineContentWidth={timelineContentWidth}
                            totalHeight={totalTimelineHeight}
                            onPointerMove={updateConnectionPointer}
                            onEndConnection={endConnection}
                            onConfirmConnection={confirmConnection}
                            onCancelConfirmConnection={cancelConfirmConnection}
                            onCancelConnection={cancelConnection}
                          />
                        )}

                        {/* Dependency edit popover */}
                        {editingDependency && (
                          <DependencyEditPopover
                            sourceCode={editingDependency.sourceCode}
                            targetCode={editingDependency.targetCode}
                            currentRelation={editingDependency.currentRelation}
                            currentLagDays={editingDependency.currentLagDays}
                            x={editingDependency.x}
                            y={editingDependency.y}
                            onSave={(relation, lagDays) => {
                              onEditDependency?.(editingDependency.sourceItemCode, editingDependency.targetItemCode, relation, lagDays);
                              setEditingDependency(null);
                            }}
                            onDelete={() => {
                              onDeleteDependency?.(editingDependency.sourceItemCode, editingDependency.targetItemCode);
                              setEditingDependency(null);
                            }}
                            onClose={() => setEditingDependency(null)}
                          />
                        )}

                      {overviewVirtualWindow.topSpacerHeight > 0 ? (
                        <div aria-hidden="true" style={{ height: overviewVirtualWindow.topSpacerHeight }} />
                      ) : null}
                      {overviewVirtualWindow.visibleItems.map((item) =>
                        item.kind === "group" ? (
                          <div
                            key={item.key}
                            data-testid={`work-schedule-timeline-group-row-${item.group.subBudgetId}`}
                            className={cn(
                              "flex items-center justify-between gap-2 border-b border-[var(--app-border)] bg-[var(--app-surface-muted)] px-2.5 text-xs font-semibold text-[var(--app-text-strong)]",
                              OVERVIEW_GROUP_ROW_HEIGHT_CLASS,
                            )}
                            style={{
                              height: `${normalizeMeasuredHeight(
                                tableGroupHeights[item.group.subBudgetId] ?? OVERVIEW_GROUP_ROW_ESTIMATED_HEIGHT,
                                OVERVIEW_SYNCHRONIZED_MIN_ROW_HEIGHT,
                              )}px`,
                            }}
                          >
                            <span>{item.group.subBudgetName}</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-[11px]"
                              onClick={() => onToggleGroup(item.group.subBudgetId)}
                            >
                              {item.collapsed ? `Expandir ${item.group.subBudgetName}` : `Contraer ${item.group.subBudgetName}`}
                            </Button>
                          </div>
                        ) : (
                          <GanttTimelineRow
                            key={item.key}
                            row={item.row}
                            timelineDays={timelineDays}
                            timelineDayIndexByIso={timelineDayIndexByIso}
                            currency={data.currency}
                            currencyDecimals={currencyDecimals}
                            showCriticalPath={showCriticalPath}
                            timelineDayWidth={getZoomedTimelineDayWidth(timelineZoomPercent)}
                            timelineDayGap={getZoomedTimelineDayGap(timelineZoomPercent)}
                            highlighted={item.row.kind === "line" && highlightedBudgetItemId === item.row.line.budgetItemId}
                            rowHeight={normalizeMeasuredHeight(
                              tableLineHeights[item.row.rowId] ?? OVERVIEW_LINE_ROW_ESTIMATED_HEIGHT,
                              OVERVIEW_SYNCHRONIZED_MIN_ROW_HEIGHT,
                            )}
                            timelineStartIso={data.timeline.startDate}
                            timelineEndIso={data.timeline.endDate}
                            onGanttBarChange={onGanttBarChange}
                            onStartConnection={startConnection}
                          />
                        ),
                      )}
                      {overviewVirtualWindow.bottomSpacerHeight > 0 ? (
                        <div aria-hidden="true" style={{ height: overviewVirtualWindow.bottomSpacerHeight }} />
                      ) : null}
                    </div>
                    <div className={cn("border-t bg-[var(--app-surface-muted)] px-2.5", OVERVIEW_BOTTOM_FOOTER_HEIGHT_CLASS, isExcelMode ? "border-[var(--app-border-strong)]" : "border-[var(--app-border)]")}>
                      <div className="flex h-full flex-wrap items-center gap-2 text-[11px] text-[var(--app-text-muted)]">
                        <span className="font-semibold text-[var(--app-text-strong)]">Leyenda de segmentos</span>
                        {segmentLegend.map((item) => (
                          <span key={item.label} className="inline-flex items-center gap-2 rounded-full border border-[var(--app-border)] bg-[var(--app-surface)] px-2.5 py-1">
                            <span className={cn("h-2.5 w-2.5 rounded-full", item.colorClassName)} />
                            {item.label}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex h-full items-center justify-center px-8">
                  <div className="max-w-md rounded-2xl border border-dashed border-[var(--app-border)] bg-[var(--app-surface-muted)] p-6 text-sm text-[var(--app-text-muted)]">
                    <p className="font-semibold text-[var(--app-text-strong)]">Timeline diario diferido</p>
                    <p className="mt-2">
                      Este cronograma cubre {formatNumber(data.scale.timelineDayCount, 0)} dias. Para evitar bloqueos,
                      el overview carga primero la tabla y difiere el gantt diario para rangos extremos.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="sticky bottom-0 z-40 px-4 pb-4">
          <div className="relative">
            <div
              className={cn(
                "overflow-hidden border bg-[var(--app-surface)]",
                isExcelMode ? "rounded-none border-[var(--app-border-strong)] shadow-none" : "rounded-bl-2xl border-[var(--app-border)] shadow-[0_-8px_24px_-20px_rgba(15,23,42,0.35)]",
              )}
              style={leftTableViewportWidth ? { width: `${leftTableViewportWidth}px`, maxWidth: "100%" } : undefined}
            >
              <div
                ref={leftBottomScrollRef}
                data-testid="work-schedule-left-bottom-scroll"
                className="overflow-x-auto overflow-y-hidden"
                onScroll={handleLeftBottomScroll}
              >
                <div style={{ width: `${leftTableWidth}px`, minWidth: `${leftTableWidth}px`, height: "1px" }} />
              </div>
            </div>
            <div
              className="absolute right-0 top-0"
              style={{ width: `var(${OVERVIEW_TIMELINE_PANEL_WIDTH_CSS_VAR}, ${timelinePanelWidth}px)` }}
            >
              <div
                className={cn(
                  "overflow-hidden border bg-[var(--app-surface)]",
                  isExcelMode ? "rounded-none border-[var(--app-border-strong)] shadow-none" : "rounded-br-2xl border-[var(--app-border)] shadow-[0_-8px_24px_-20px_rgba(15,23,42,0.35)]",
                )}
              >
                {hasDailyTimeline ? (
                  <div
                    ref={timelineBottomScrollRef}
                    data-testid="work-schedule-timeline-bottom-scroll"
                    className="overflow-x-auto overflow-y-hidden pl-3"
                    onScroll={handleTimelineBottomScroll}
                  >
                    <div style={{ width: `${timelineContentWidth}px`, minWidth: `${timelineContentWidth}px`, height: "1px" }} />
                  </div>
                ) : (
                  <div className="h-px" />
                )}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
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

type WorkScheduleLineTableRowProps = {
  line: WorkScheduleLineRecord;
  rowNumber: number | null;
  displayPredecessor: string;
  dateFormat: string;
  currency: string;
  currencyDecimals: number;
  showCostColumns: boolean;
  showCriticalPath: boolean;
  highlighted: boolean;
  onEditLine: (line: WorkScheduleLineRecord) => void;
  onRegisterRow: (rowId: string, element: HTMLElement | null) => void;
  inlineDraft: EditableLine | null;
  isInlineActive: boolean;
  inlineSaveState: "idle" | "saving" | "error";
  inlineError: string;
  onActivateInlineRow: (line: WorkScheduleLineRecord) => void;
  onInlineDraftChange: (rowId: string, draft: EditableLine) => void;
  onInlineRowSave: (rowId: string) => void;
  onInlineRowCancel: (rowId: string) => void;
};

const WorkScheduleLineTableRow = memo(function WorkScheduleLineTableRow({
  line,
  rowNumber,
  displayPredecessor,
  dateFormat,
  currency,
  currencyDecimals,
  showCostColumns,
  showCriticalPath,
  highlighted,
  onEditLine,
  onRegisterRow,
  inlineDraft,
  isInlineActive,
  inlineSaveState,
  inlineError,
  onActivateInlineRow,
  onInlineDraftChange,
  onInlinePredecessorChange,
  onInlineRowSave,
  onInlineRowCancel,
}: WorkScheduleLineTableRowProps) {
  const inlineRowId = line.budgetItemId;

  function handleInlineBlur(event: ReactFocusEvent<HTMLTableRowElement>) {
    const nextFocusTarget = event.relatedTarget;
    if (nextFocusTarget instanceof HTMLElement && nextFocusTarget.closest(`[data-inline-row-id="${inlineRowId}"]`)) {
      return;
    }

    if (isInlineActive && inlineDraft) {
      void onInlineRowSave(inlineRowId);
    }
  }

  function handleInlineKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      void onInlineRowSave(inlineRowId);
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      onInlineRowCancel(inlineRowId);
    }
  }

  return (
    <TR
      ref={(element) => onRegisterRow(line.budgetItemId, element)}
      data-testid={`work-schedule-table-row-${line.budgetItemId}`}
      data-table-row-id={line.budgetItemId}
      data-inline-row-id={inlineRowId}
      data-highlighted={highlighted ? "true" : "false"}
      data-critical={showCriticalPath && line.criticalPath?.isCritical ? "true" : "false"}
      className={cn(
        showCriticalPath && line.criticalPath?.isCritical ? "bg-rose-50/80 dark:bg-rose-500/10" : "",
        highlighted ? "bg-amber-50 ring-1 ring-inset ring-amber-200 dark:bg-amber-500/12 dark:ring-amber-500/30" : "",
      )}
      onBlur={handleInlineBlur}
    >
      <TD className="bg-[var(--app-surface-strong)] px-1 text-center align-middle !text-[10px] font-medium text-[var(--app-text-muted)]">{rowNumber ?? ""}</TD>
      <TD className="align-middle">{line.itemCode}</TD>
      <TD className="align-middle">
        <div className="space-y-1 overflow-hidden">
          <div className="flex min-w-0 items-center gap-1.5 whitespace-nowrap">
            <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden">
              <p className="min-w-0 truncate whitespace-nowrap text-xs font-medium text-[var(--app-text-strong)]" title={line.description}>
                {line.description}
              </p>
              {highlighted ? (
                <span
                  data-testid={`work-schedule-active-badge-${line.budgetItemId}`}
                  className="theme-status-warning theme-status-warning-strong shrink-0 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold"
                >
                  Partida activa
                </span>
              ) : null}
              {showCriticalPath && line.criticalPath?.isCritical ? (
                <span
                  data-testid={`work-schedule-critical-badge-${line.budgetItemId}`}
                  className="theme-status-error shrink-0 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold dark:text-rose-200"
                  title={`Holgura total: ${line.criticalPath.totalSlackDays} dias`}
                >
                  Critica
                </span>
              ) : null}
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-4 w-4 shrink-0 p-0 text-[var(--app-text-muted)] hover:text-[var(--app-text-strong)]"
              style={{ height: "16px", width: "16px", padding: 0 }}
              title="Editar"
              aria-label={`Editar ${line.description}`}
              onClick={() => onEditLine(line)}
            >
              <PenSquare className="h-[13px] w-[13px]" style={{ height: "13px", width: "13px" }} />
            </Button>
          </div>
          <p className="truncate whitespace-nowrap pt-0.5 text-[11px] text-[var(--app-text-muted)]">
            {line.monthlyDistributions.length || 0} periodos
          </p>
          {inlineError ? <p className="truncate whitespace-nowrap text-[11px] text-rose-600">{inlineError}</p> : null}
        </div>
      </TD>
      <TD
        className="align-middle"
        data-testid={`work-schedule-inline-cell-durationDays-${line.budgetItemId}`}
        onClick={() => onActivateInlineRow(line)}
      >
        {isInlineActive && inlineDraft ? (
          <Input
            type="number"
            min="1"
            value={String(inlineDraft.durationDays || "")}
            onKeyDown={handleInlineKeyDown}
            onChange={(event) => onInlineDraftChange(inlineRowId, updateEditableLineDuration(inlineDraft, Number(event.target.value) || 0))}
          />
        ) : (
          line.durationDays ?? "-"
        )}
      </TD>
      <TD
        className="align-middle"
        data-testid={`work-schedule-inline-cell-startDate-${line.budgetItemId}`}
        onClick={() => onActivateInlineRow(line)}
      >
        {isInlineActive && inlineDraft ? (
          <Input
            type="date"
            value={inlineDraft.startDate}
            onKeyDown={handleInlineKeyDown}
            onChange={(event) => onInlineDraftChange(inlineRowId, updateEditableLineDates(inlineDraft, { startDate: event.target.value }))}
          />
        ) : (
          line.startDate ? formatDate(line.startDate, dateFormat as never) : "Pendiente"
        )}
      </TD>
      <TD
        className="align-middle"
        data-testid={`work-schedule-inline-cell-endDate-${line.budgetItemId}`}
        onClick={() => onActivateInlineRow(line)}
      >
        {isInlineActive && inlineDraft ? (
          <Input
            type="date"
            value={inlineDraft.endDate}
            onKeyDown={handleInlineKeyDown}
            onChange={(event) => onInlineDraftChange(inlineRowId, updateEditableLineDates(inlineDraft, { endDate: event.target.value }))}
          />
        ) : (
          line.endDate ? formatDate(line.endDate, dateFormat as never) : "Pendiente"
        )}
      </TD>
      <TD
        className="align-middle"
        data-testid={`work-schedule-inline-cell-predecessor-${line.budgetItemId}`}
        onClick={() => onActivateInlineRow(line)}
      >
        {isInlineActive && inlineDraft ? (
          <Input
            value={inlineDraft.predecessor}
            onKeyDown={handleInlineKeyDown}
            onChange={(event) => onInlinePredecessorChange(inlineRowId, inlineDraft, event.target.value)}
          />
        ) : (
          displayPredecessor || "-"
        )}
      </TD>
      <TD
        className="align-middle"
        data-testid={`work-schedule-inline-cell-crew-${line.budgetItemId}`}
        onClick={() => onActivateInlineRow(line)}
      >
        {isInlineActive && inlineDraft ? (
          <Input
            type="number"
            min="0"
            step="any"
            value={inlineDraft.crew}
            onKeyDown={handleInlineKeyDown}
            onChange={(event) => onInlineDraftChange(inlineRowId, updateEditableLineCrew(inlineDraft, event.target.value))}
          />
        ) : (
          line.crew != null ? formatNumber(line.crew, 2) : "-"
        )}
      </TD>
      <TD className="align-middle">{line.performanceLabel || (line.performance != null ? `${formatNumber(line.performance, 2)} ${line.unit}/DIA` : "-")}</TD>
      <TD className="align-middle">{line.unit}</TD>
      <TD className="align-middle">{formatNumber(line.quantity, 2)}</TD>
      {showCostColumns ? <TD className="align-middle">{formatCurrency(line.unitPrice, currency, currencyDecimals)}</TD> : null}
      {showCostColumns ? <TD className="align-middle">{formatCurrency(line.partial, currency, currencyDecimals)}</TD> : null}
      <TD className="align-middle bg-[var(--app-surface)]">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-7 px-2 text-[11px]" onClick={() => onEditLine(line)}>
            Editar
          </Button>
          {inlineSaveState === "saving" ? <span className="text-[11px] text-[var(--app-text-muted)]">Guardando...</span> : null}
        </div>
      </TD>
    </TR>
  );
}, areWorkScheduleLineTableRowPropsEqual);

type WorkScheduleLevelTableRowProps = {
  row: Extract<WorkScheduleDisplayRowRecord, { kind: "level" }>;
  rowNumber: number | null;
  dateFormat: string;
  currency: string;
  currencyDecimals: number;
  showCostColumns: boolean;
  onRegisterRow: (rowId: string, element: HTMLElement | null) => void;
};

const WorkScheduleLevelTableRow = memo(function WorkScheduleLevelTableRow({
  row,
  rowNumber,
  dateFormat,
  currency,
  currencyDecimals,
  showCostColumns,
  onRegisterRow,
}: WorkScheduleLevelTableRowProps) {
  const toneClassName =
    row.levelType === "TITLE"
      ? "bg-[var(--app-surface-strong)] font-semibold text-[var(--app-text-strong)]"
      : "bg-[var(--app-surface-muted)] font-medium text-[var(--app-text)]";

  return (
    <TR ref={(element) => onRegisterRow(row.rowId, element)} data-testid={`work-schedule-table-row-${row.rowId}`} data-table-row-id={row.rowId} className={cn(toneClassName)}>
      <TD className="bg-[var(--app-surface-strong)] px-1 text-center align-middle !text-[10px] font-medium text-[var(--app-text-muted)]">{rowNumber ?? ""}</TD>
      <TD className="align-middle">{row.itemCode}</TD>
      <TD className="align-middle">
        <div className="flex min-w-0 items-center gap-2 overflow-hidden whitespace-nowrap">
          <span className="shrink-0 rounded-full border border-[var(--app-border-strong)] bg-[var(--app-surface)]/70 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-[var(--app-text-muted)]">
            {row.levelType === "TITLE" ? "Titulo" : "Subtitulo"}
          </span>
          <p className="min-w-0 truncate whitespace-nowrap text-xs" title={row.description}>
            {row.description}
          </p>
        </div>
      </TD>
      <TD className="align-middle">{row.durationDays ?? "-"}</TD>
      <TD className="align-middle">{row.startDate ? formatDate(row.startDate, dateFormat as never) : "Pendiente"}</TD>
      <TD className="align-middle">{row.endDate ? formatDate(row.endDate, dateFormat as never) : "Pendiente"}</TD>
      <TD className="align-middle">-</TD>
      <TD className="align-middle">-</TD>
      <TD className="align-middle">-</TD>
      <TD className="align-middle">-</TD>
      <TD className="align-middle">-</TD>
      {showCostColumns ? <TD className="align-middle">-</TD> : null}
      {showCostColumns ? <TD className="align-middle">{formatCurrency(row.partial, currency, currencyDecimals)}</TD> : null}
      <TD className="align-middle bg-transparent" />
    </TR>
  );
}, areWorkScheduleLevelTableRowPropsEqual);

function TimelineHeader({
  timelineDays,
  isExcelMode,
  timelineDayWidth,
}: {
  timelineDays: TimelineDay[];
  isExcelMode: boolean;
  timelineDayWidth: number;
}) {
  const months = groupTimelineMonths(timelineDays);
  const weeks = groupTimelineWeeks(timelineDays);
  const gridTemplateColumns = `repeat(${timelineDays.length || 1}, minmax(${timelineDayWidth}px, 1fr))`;

  return (
    <div className="border-b border-[var(--app-border)] bg-[var(--app-surface)]">
      <div className="grid gap-px bg-[var(--app-border)]" style={{ gridTemplateColumns }}>
        {months.map((month, index) => (
          <div
            key={month.key}
            data-testid="work-schedule-month-band"
            className={cn(
              "flex h-5 items-center justify-center px-1.5 text-center text-[11px] font-semibold",
              isExcelMode
                ? index % 2 === 0
                  ? "bg-[var(--app-surface-muted)] text-[var(--app-text)]"
                  : "bg-[var(--app-surface-strong)] text-[var(--app-text-strong)]"
                : index % 2 === 0
                  ? "bg-[var(--app-surface-inverse)] text-[var(--app-on-primary)]"
                  : "bg-[var(--app-surface-strong)] text-[var(--app-text-strong)]",
            )}
            style={{ gridColumn: `span ${month.length}` }}
          >
            {month.label}
          </div>
        ))}
      </div>
      <div className="grid gap-px bg-[var(--app-border)]" style={{ gridTemplateColumns }}>
        {weeks.map((week) => (
          <div
            key={week.key}
            className="flex h-5 items-center justify-center bg-[var(--app-surface-muted)] px-1.5 text-center text-[11px] font-semibold text-[var(--app-text-muted)]"
            style={{ gridColumn: `span ${week.length}` }}
          >
            {week.label}
          </div>
        ))}
      </div>
      <div className="grid gap-px bg-[var(--app-surface-strong)]" style={{ gridTemplateColumns }}>
        {timelineDays.map((day) => (
          <div
            key={day.iso}
            data-testid="work-schedule-timeline-day-header"
            className="flex h-8 items-center justify-center bg-[var(--app-surface)] text-[9px] uppercase tracking-wide text-[var(--app-text-muted)]"
          >
            {dayFormatter.format(day.date).slice(0, 1)}
          </div>
        ))}
      </div>
    </div>
  );
}
function areWorkScheduleLineTableRowPropsEqual(
  previousProps: WorkScheduleLineTableRowProps,
  nextProps: WorkScheduleLineTableRowProps,
) {
  return (
    previousProps.line === nextProps.line &&
    previousProps.rowNumber === nextProps.rowNumber &&
    previousProps.displayPredecessor === nextProps.displayPredecessor &&
    previousProps.dateFormat === nextProps.dateFormat &&
    previousProps.currency === nextProps.currency &&
    previousProps.currencyDecimals === nextProps.currencyDecimals &&
    previousProps.showCostColumns === nextProps.showCostColumns &&
    previousProps.showCriticalPath === nextProps.showCriticalPath &&
    previousProps.highlighted === nextProps.highlighted &&
    previousProps.onEditLine === nextProps.onEditLine &&
    previousProps.onRegisterRow === nextProps.onRegisterRow &&
    previousProps.isInlineActive === nextProps.isInlineActive &&
    previousProps.inlineSaveState === nextProps.inlineSaveState &&
    previousProps.inlineError === nextProps.inlineError &&
    previousProps.onActivateInlineRow === nextProps.onActivateInlineRow &&
    previousProps.onInlineDraftChange === nextProps.onInlineDraftChange &&
    previousProps.onInlineRowSave === nextProps.onInlineRowSave &&
    previousProps.onInlineRowCancel === nextProps.onInlineRowCancel &&
    areEditableLinesEqual(previousProps.inlineDraft, nextProps.inlineDraft)
  );
}

function areWorkScheduleLevelTableRowPropsEqual(
  previousProps: WorkScheduleLevelTableRowProps,
  nextProps: WorkScheduleLevelTableRowProps,
) {
  return (
    previousProps.row === nextProps.row &&
    previousProps.rowNumber === nextProps.rowNumber &&
    previousProps.dateFormat === nextProps.dateFormat &&
    previousProps.currency === nextProps.currency &&
    previousProps.currencyDecimals === nextProps.currencyDecimals &&
    previousProps.showCostColumns === nextProps.showCostColumns &&
    previousProps.onRegisterRow === nextProps.onRegisterRow
  );
}

function areEditableLinesEqual(previousLine: EditableLine | null, nextLine: EditableLine | null) {
  if (previousLine === nextLine) {
    return true;
  }

  if (!previousLine || !nextLine) {
    return false;
  }

  return (
    previousLine.budgetItemId === nextLine.budgetItemId &&
    previousLine.description === nextLine.description &&
    previousLine.startDate === nextLine.startDate &&
    previousLine.endDate === nextLine.endDate &&
    previousLine.durationDays === nextLine.durationDays &&
    previousLine.predecessor === nextLine.predecessor &&
    previousLine.crew === nextLine.crew &&
    areMonthlyDistributionsEqual(previousLine.monthlyDistributions, nextLine.monthlyDistributions)
  );
}

function areMonthlyDistributionsEqual(
  previousDistributions: WorkScheduleMonthlyDistributionRecord[],
  nextDistributions: WorkScheduleMonthlyDistributionRecord[],
) {
  if (previousDistributions === nextDistributions) {
    return true;
  }

  if (previousDistributions.length !== nextDistributions.length) {
    return false;
  }

  for (let index = 0; index < previousDistributions.length; index += 1) {
    const previousDistribution = previousDistributions[index];
    const nextDistribution = nextDistributions[index];

    if (
      previousDistribution?.year !== nextDistribution?.year ||
      previousDistribution?.month !== nextDistribution?.month ||
      previousDistribution?.percentage !== nextDistribution?.percentage
    ) {
      return false;
    }
  }

  return true;
}

function buildOverviewVirtualWindow({
  items,
  scrollTop,
  viewportHeight,
  overscanPx,
}: {
  items: OverviewVirtualItem[];
  scrollTop: number;
  viewportHeight: number;
  overscanPx: number;
}) {
  if (items.length === 0) {
    return {
      topSpacerHeight: 0,
      bottomSpacerHeight: 0,
      visibleItems: [] as OverviewVirtualItem[],
    };
  }

  const normalizedViewportHeight = Math.max(viewportHeight, OVERVIEW_VIRTUAL_SCROLL_FALLBACK_HEIGHT);
  const prefixHeights: number[] = new Array(items.length + 1).fill(0);
  for (let index = 0; index < items.length; index += 1) {
    prefixHeights[index + 1] = prefixHeights[index] + items[index].estimatedHeight;
  }

  const startOffset = Math.max(0, scrollTop - overscanPx);
  const endOffset = scrollTop + normalizedViewportHeight + overscanPx;
  const startIndex = findOverviewVirtualIndex(prefixHeights, startOffset);
  const endIndex = Math.min(items.length, Math.max(startIndex + 1, findOverviewVirtualIndex(prefixHeights, endOffset) + 1));

  return {
    topSpacerHeight: prefixHeights[startIndex],
    bottomSpacerHeight: Math.max(0, prefixHeights[items.length] - prefixHeights[endIndex]),
    visibleItems: items.slice(startIndex, endIndex),
  };
}

function findOverviewVirtualIndex(prefixHeights: number[], targetOffset: number) {
  let low = 0;
  let high = prefixHeights.length - 1;

  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (prefixHeights[middle] <= targetOffset) {
      low = middle + 1;
    } else {
      high = middle;
    }
  }

  return Math.max(0, low - 1);
}

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

function WorkScheduleEditorSheet({
  line,
  open,
  saveState,
  error,
  onClose,
  onJumpToSchedule,
  canNavigateToPreviousLine,
  canNavigateToNextLine,
  onNavigateToPreviousLine,
  onNavigateToNextLine,
  onSave,
  onChange,
  onPredecessorChange,
}: {
  line: EditableLine | null;
  open: boolean;
  saveState: "idle" | "saving" | "error";
  error: string;
  onClose: () => void;
  onJumpToSchedule: () => void;
  canNavigateToPreviousLine: boolean;
  canNavigateToNextLine: boolean;
  onNavigateToPreviousLine: () => void;
  onNavigateToNextLine: () => void;
  onSave: () => void;
  onChange: (line: EditableLine | null) => void;
  onPredecessorChange: (line: EditableLine, predecessor: string) => void;
}) {
  const totalPercentage = line?.monthlyDistributions.reduce((sum, distribution) => sum + Number(distribution.percentage), 0) ?? 0;
  const percentageDifference = 100 - totalPercentage;

  return (
    <Dialog.Root open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-slate-950/30 backdrop-blur-sm" />
        <Dialog.Content asChild>
          <div
            className="fixed inset-y-0 right-0 z-50 h-full w-full max-w-2xl overflow-y-auto border-l border-[var(--app-border)] bg-[var(--app-surface-muted)] p-5 shadow-2xl outline-none"
            data-testid="work-schedule-editor-panel"
          >
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <Dialog.Title asChild>
                  <h3 className="text-2xl font-semibold text-[var(--app-text-strong)]">Programar partida</h3>
                </Dialog.Title>
                <Dialog.Description asChild>
                  <div className="mt-1 space-y-2 text-sm text-[var(--app-text-muted)]">
                    <p>{line?.description ?? "Selecciona una partida para programarla."}</p>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--app-text-muted)]">
                      <span className="font-semibold text-[var(--app-text)]">Atajos</span>
                      <span className="rounded-full border border-[var(--app-border)] bg-[var(--app-surface)] px-2 py-0.5">Alt + Left: anterior</span>
                      <span className="rounded-full border border-[var(--app-border)] bg-[var(--app-surface)] px-2 py-0.5">Alt + Right: siguiente</span>
                    </div>
                  </div>
                </Dialog.Description>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={onNavigateToPreviousLine} disabled={!canNavigateToPreviousLine}>
                  Anterior
                </Button>
                <Button variant="outline" onClick={onNavigateToNextLine} disabled={!canNavigateToNextLine}>
                  Siguiente
                </Button>
                <Button variant="outline" onClick={onJumpToSchedule}>
                  Ir al cronograma
                </Button>
                <Button variant="outline" onClick={onClose}>
                  <X className="mr-2 h-4 w-4" />
                  Cerrar
                </Button>
              </div>
            </div>

            {line ? (
              <div className="space-y-5">
                <Card className="border-[var(--app-border)] bg-[var(--app-surface)]">
                  <CardContent className="grid gap-4 p-5 md:grid-cols-2">
                    <Field label="Inicio">
                      <Input
                        type="date"
                        value={line.startDate}
                        onChange={(event) => onChange(updateEditableLineDates(line, { startDate: event.target.value }))}
                      />
                    </Field>
                    <Field label="Fin">
                      <Input
                        type="date"
                        value={line.endDate}
                        onChange={(event) => onChange(updateEditableLineDates(line, { endDate: event.target.value }))}
                      />
                    </Field>
                    <Field label="Duracion">
                      <Input
                        value={String(line.durationDays)}
                        readOnly
                      />
                    </Field>
                    <Field label="Predecesora">
                      <Input value={line.predecessor} onChange={(event) => onPredecessorChange(line, event.target.value)} />
                    </Field>
                    <Field label="Cuadrilla">
                      <Input value={line.crew} onChange={(event) => onChange(updateEditableLineCrew(line, event.target.value))} />
                    </Field>
                  </CardContent>
                </Card>

                <Card className="border-[var(--app-border)] bg-[var(--app-surface)]">
                  <CardContent className="space-y-4 p-5">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-[var(--app-text-strong)]">Distribucion mensual</p>
                        <p className="mt-1 text-sm text-[var(--app-text-muted)]">La suma debe cerrar exactamente al 100%.</p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          onChange({
                            ...line,
                            monthlyDistributions: [
                              ...line.monthlyDistributions,
                              createNextDistribution(line.monthlyDistributions),
                            ],
                          })
                        }
                      >
                        Agregar periodo
                      </Button>
                    </div>

                    <div className="space-y-3">
                      {line.monthlyDistributions.map((distribution, index) => (
                        <div
                          key={`${distribution.year}-${distribution.month}-${index}`}
                          className="grid gap-3 rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4 md:grid-cols-[1fr_1fr_1fr_auto]"
                          data-testid="work-schedule-distribution-row"
                        >
                          <Field label="Ano">
                            <Input
                              value={String(distribution.year)}
                              onChange={(event) => updateDistribution(line, index, "year", Number(event.target.value) || distribution.year, onChange)}
                            />
                          </Field>
                          <Field label="Mes">
                            <Input
                              value={String(distribution.month)}
                              onChange={(event) => updateDistribution(line, index, "month", Number(event.target.value) || distribution.month, onChange)}
                            />
                          </Field>
                          <Field label="%">
                            <Input
                              value={String(distribution.percentage)}
                              onChange={(event) =>
                                updateDistribution(line, index, "percentage", Number(event.target.value) || 0, onChange)
                              }
                            />
                          </Field>
                          <div className="flex items-end">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                onChange({
                                  ...line,
                                  monthlyDistributions: line.monthlyDistributions.filter((_, rowIndex) => rowIndex !== index),
                                })
                              }
                            >
                              Quitar
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="rounded-2xl border border-dashed border-[var(--app-border-strong)] bg-[var(--app-surface-muted)] px-4 py-3 text-sm text-[var(--app-text-muted)]">
                      <span className="font-medium text-[var(--app-text-strong)]">Total:</span> {formatNumber(totalPercentage, 4)}%{" "}
                      <span className={cn("ml-2 font-medium", percentageDifference === 0 ? "text-emerald-600" : "text-amber-600")}>
                        Diferencia: {formatNumber(percentageDifference, 4)}%
                      </span>
                    </div>
                  </CardContent>
                </Card>

                {error ? <p className="text-sm font-medium text-rose-600">{error}</p> : null}

                <div className="flex justify-end gap-3">
                  <Button variant="outline" onClick={onClose}>
                    Cancelar
                  </Button>
                  <Button onClick={onSave} disabled={saveState === "saving"}>
                    <Save className="mr-2 h-4 w-4" />
                    {saveState === "saving" ? "Guardando..." : "Guardar programacion"}
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function WorkScheduleGenerationDialog({
  open,
  baseStartDate,
  saveState,
  error,
  hasExistingSchedule,
  reviewSummary,
  onBaseStartDateChange,
  onClose,
  onSubmit,
}: {
  open: boolean;
  baseStartDate: string;
  saveState: "idle" | "saving" | "error";
  error: string;
  hasExistingSchedule: boolean;
  reviewSummary: WorkScheduleViewRecord["reviewSummary"];
  onBaseStartDateChange: (value: string) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-slate-950/30 backdrop-blur-sm" />
        <Dialog.Content asChild>
          <div className="fixed inset-y-0 right-0 z-50 h-full w-full max-w-xl overflow-y-auto border-l border-[var(--app-border)] bg-[var(--app-surface-muted)] p-5 shadow-2xl outline-none">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <Dialog.Title asChild>
                  <h3 className="text-2xl font-semibold text-[var(--app-text-strong)]">Cronograma inteligente</h3>
                </Dialog.Title>
                <Dialog.Description asChild>
                  <p className="mt-1 text-sm text-[var(--app-text-muted)]">
                    Genera el gantt base usando metrado, rendimiento y cuadrilla, con secuencia por sub presupuesto.
                  </p>
                </Dialog.Description>
              </div>
              <Button variant="outline" onClick={onClose}>
                Cerrar
              </Button>
            </div>

            <div className="space-y-5">
              <Card className="border-[var(--app-border)] bg-[var(--app-surface)]">
                <CardContent className="space-y-4 p-5">
                  <Field label="Fecha base">
                    <Input type="date" value={baseStartDate} onChange={(event) => onBaseStartDateChange(event.target.value)} />
                  </Field>

                  {hasExistingSchedule ? (
                    <div className="theme-status-warning theme-status-warning-strong rounded-2xl border px-4 py-3 text-sm">
                      Se reemplazara la programacion actual de las partidas ya programadas.
                    </div>
                  ) : null}

                  {reviewSummary && reviewSummary.warnings.length > 0 ? (
                    <div className="theme-status-warning theme-status-warning-strong space-y-2 rounded-2xl border px-4 py-3 text-sm">
                      <p className="font-semibold">Revision previa recomendada</p>
                      {reviewSummary.warnings.map((warning) => (
                        <div key={warning.code} className="space-y-1">
                          <p>{warning.label}</p>
                          <p className="theme-muted-text text-xs">{warning.count} partidas afectadas.</p>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </CardContent>
              </Card>

              {error ? <p className="text-sm font-medium text-rose-600">{error}</p> : null}

              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={onClose}>
                  Cancelar
                </Button>
                <Button onClick={onSubmit} disabled={saveState === "saving" || !baseStartDate}>
                  {saveState === "saving" ? "Generando..." : "Generar base"}
                </Button>
              </div>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="space-y-2 text-sm">
      <span className="font-medium text-[var(--app-text)]">{label}</span>
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

function buildTimelineDays(startDate: string | null, endDate: string | null): TimelineDay[] {
  if (!startDate || !endDate) {
    return [];
  }

  const days: TimelineDay[] = [];
  const cursor = new Date(`${startDate}T00:00:00.000Z`);
  const end = new Date(`${endDate}T00:00:00.000Z`);
  cursor.setUTCDate(cursor.getUTCDate() - cursor.getUTCDay());
  end.setUTCDate(end.getUTCDate() + (6 - end.getUTCDay()));

  while (cursor.getTime() <= end.getTime()) {
    days.push({
      iso: cursor.toISOString().slice(0, 10),
      date: new Date(cursor),
    });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return days;
}

function buildTimelineDependencyPaths({
  visibleLinePositions,
  timelineDayIndexByIso,
  timelineDayWidth,
  timelineDayGap,
}: {
  visibleLinePositions: Map<string, VisibleTimelineLinePosition>;
  timelineDayIndexByIso: Map<string, number>;
  timelineDayWidth: number;
  timelineDayGap: number;
}) {
  const paths: Array<{ key: string; d: string }> = [];

  for (const successor of visibleLinePositions.values()) {
    const successorStartIndex =
      successor.line.startDate ? (timelineDayIndexByIso.get(successor.line.startDate) ?? -1) : -1;
    const successorEndIndex =
      successor.line.endDate ? (timelineDayIndexByIso.get(successor.line.endDate) ?? -1) : -1;

    if (successorStartIndex < 0 || successorEndIndex < successorStartIndex) {
      continue;
    }

    const parsedPredecessors = tryParseWorkSchedulePredecessors(successor.line.predecessor);
    if (!parsedPredecessors) {
      continue;
    }

    for (const predecessorReference of parsedPredecessors) {
      const predecessor = visibleLinePositions.get(predecessorReference.code);
      if (!predecessor) {
        continue;
      }

      const predecessorStartIndex =
        predecessor.line.startDate ? (timelineDayIndexByIso.get(predecessor.line.startDate) ?? -1) : -1;
      const predecessorEndIndex =
        predecessor.line.endDate ? (timelineDayIndexByIso.get(predecessor.line.endDate) ?? -1) : -1;

      if (predecessorStartIndex < 0 || predecessorEndIndex < predecessorStartIndex) {
        continue;
      }

      const connector = buildTimelineDependencyConnector({
        predecessor,
        predecessorReference,
        predecessorStartIndex,
        predecessorEndIndex,
        successor,
        successorStartIndex,
        successorEndIndex,
        timelineDayWidth,
        timelineDayGap,
      });

      if (connector) {
        paths.push({
          key: `${successor.line.budgetItemId}-${predecessorReference.code}-${predecessorReference.relation}-${predecessorReference.lagDays}`,
          d: connector,
        });
      }
    }
  }

  return paths;
}

function buildTimelineDependencyConnector({
  predecessor,
  predecessorReference,
  predecessorStartIndex,
  predecessorEndIndex,
  successor,
  successorStartIndex,
  successorEndIndex,
  timelineDayWidth,
  timelineDayGap,
}: {
  predecessor: VisibleTimelineLinePosition;
  predecessorReference: {
    relation: "FS" | "SS" | "FF" | "SF";
  };
  predecessorStartIndex: number;
  predecessorEndIndex: number;
  successor: VisibleTimelineLinePosition;
  successorStartIndex: number;
  successorEndIndex: number;
  timelineDayWidth: number;
  timelineDayGap: number;
}) {
  const predecessorStartX = getTimelineColumnStartX(predecessorStartIndex, timelineDayWidth, timelineDayGap);
  const predecessorEndX = getTimelineColumnEndX(predecessorEndIndex, timelineDayWidth, timelineDayGap);
  const successorStartX = getTimelineColumnStartX(successorStartIndex, timelineDayWidth, timelineDayGap);
  const successorEndX = getTimelineColumnEndX(successorEndIndex, timelineDayWidth, timelineDayGap);
  const predecessorY = predecessor.top + predecessor.height / 2;
  const successorY = successor.top + successor.height / 2;
  const elbowOffset = 8;
  const sourceExitOffset = 12;
  const sourceDropOffset = 15;
  const arrowOffset = 6;
  const minimumFinalSegment = 10;
  const sameDayOrNextDayDelta = (leftIndex: number, rightIndex: number) => rightIndex - leftIndex;
  const isSameDayHandoff =
    (predecessorReference.relation === "FS" &&
      sameDayOrNextDayDelta(predecessorEndIndex, successorStartIndex) >= 0 &&
      sameDayOrNextDayDelta(predecessorEndIndex, successorStartIndex) <= 1) ||
    (predecessorReference.relation === "SS" &&
      sameDayOrNextDayDelta(predecessorStartIndex, successorStartIndex) >= 0 &&
      sameDayOrNextDayDelta(predecessorStartIndex, successorStartIndex) <= 1) ||
    (predecessorReference.relation === "FF" &&
      sameDayOrNextDayDelta(predecessorEndIndex, successorEndIndex) >= 0 &&
      sameDayOrNextDayDelta(predecessorEndIndex, successorEndIndex) <= 1) ||
    (predecessorReference.relation === "SF" &&
      sameDayOrNextDayDelta(predecessorStartIndex, successorEndIndex) >= 0 &&
      sameDayOrNextDayDelta(predecessorStartIndex, successorEndIndex) <= 1);

  const sourceX =
    predecessorReference.relation === "FS" || predecessorReference.relation === "FF"
      ? predecessorEndX
      : predecessorStartX;
  const targetX =
    predecessorReference.relation === "FS" || predecessorReference.relation === "SS"
      ? successorStartX
      : successorEndX;
  const targetApproachX =
    predecessorReference.relation === "FS" || predecessorReference.relation === "SS"
      ? Math.max(0, targetX - arrowOffset)
      : targetX + arrowOffset;
  const elbowX =
    predecessorReference.relation === "FS" || predecessorReference.relation === "FF"
      ? Math.min(
          Math.max(sourceX + elbowOffset, targetApproachX - elbowOffset),
          targetApproachX - minimumFinalSegment,
        )
      : Math.max(
          Math.min(sourceX - elbowOffset, targetApproachX + elbowOffset),
          targetApproachX + minimumFinalSegment,
        );
  if (!isSameDayHandoff) {
    return `M ${sourceX} ${predecessorY} H ${elbowX} V ${successorY} H ${targetApproachX} H ${targetX}`;
  }

  const sourceExitX = Math.max(sourceX + sourceExitOffset, elbowX + elbowOffset);
  const breakY = predecessorY + sourceDropOffset;

  return `M ${sourceX} ${predecessorY} H ${sourceExitX} V ${breakY} H ${elbowX} V ${successorY} H ${targetApproachX} H ${targetX}`;
}

function getTimelineColumnStartX(index: number, timelineDayWidth: number, timelineDayGap: number) {
  return index * (timelineDayWidth + timelineDayGap);
}

function getTimelineColumnEndX(index: number, timelineDayWidth: number, timelineDayGap: number) {
  return getTimelineColumnStartX(index, timelineDayWidth, timelineDayGap) + timelineDayWidth;
}

function groupTimelineWeeks(days: TimelineDay[]) {
  const groups: Array<{ key: string; label: string; length: number }> = [];
  let currentKey = "";

  for (const day of days) {
    const weekStart = new Date(day.date);
    weekStart.setUTCDate(day.date.getUTCDate() - day.date.getUTCDay());
    const key = weekStart.toISOString().slice(0, 10);

    const current = groups[groups.length - 1];
    if (!current || currentKey !== key) {
      currentKey = key;
      groups.push({
        key,
        label: timelineWeekFormatter.format(weekStart),
        length: 1,
      });
      continue;
    }

    current.length += 1;
  }

  return groups;
}

function groupTimelineMonths(days: TimelineDay[]) {
  const groups: Array<{ key: string; label: string; length: number }> = [];
  let currentKey = "";

  for (const day of days) {
    const key = `${day.date.getUTCFullYear()}-${String(day.date.getUTCMonth() + 1).padStart(2, "0")}`;
    const current = groups[groups.length - 1];

    if (!current || currentKey !== key) {
      currentKey = key;
      groups.push({
        key,
        label: `${String(day.date.getUTCMonth() + 1).padStart(2, "0")}/${day.date.getUTCFullYear()}`,
        length: 1,
      });
      continue;
    }

    current.length += 1;
  }

  return groups;
}

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

function formatPeriodLabel(period: { year: number; month: number }) {
  return `${period.month.toString().padStart(2, "0")}/${period.year}`;
}

function formatDistributionLabel(distribution: WorkScheduleMonthlyDistributionRecord) {
  return `${formatPeriodLabel(distribution)} · ${distribution.percentage.toFixed(4)}%`;
}

function formatDistributionTooltip(
  distribution: WorkScheduleMonthlyDistributionRecord,
  partial: number,
  currency: string,
  currencyDecimals: number,
) {
  const amount = partial * (distribution.percentage / 100);
  return `${formatDistributionLabel(distribution)} · ${formatCurrency(amount, currency, currencyDecimals)}`;
}

function describeWorkbookExportPreview(
  activeView: ActiveView,
  scopes: {
    executiveWorkbookScope: WorkbookExportScope;
    valuationWorkbookScope: WorkbookExportScope;
    resourceWorkbookScope: WorkbookExportScope;
    curveWorkbookScope: WorkbookExportScope;
  },
) {
  if (activeView === "overview") {
    return buildWorkbookScopePreview("paquete ejecutivo", scopes.executiveWorkbookScope, "partida y resumen");
  }

  if (activeView === "valuation") {
    return buildWorkbookScopePreview("calendario valorizado", scopes.valuationWorkbookScope, "partida");
  }

  if (activeView === "resources") {
    return buildWorkbookScopePreview("calendario de insumos", scopes.resourceWorkbookScope, "insumo");
  }

  return buildWorkbookScopePreview("curva S", scopes.curveWorkbookScope, "periodo");
}

function getWorkbookExportTargetLabel(activeView: ActiveView) {
  if (activeView === "overview") {
    return "Paquete ejecutivo";
  }

  if (activeView === "valuation") {
    return "Calendario valorizado";
  }

  if (activeView === "resources") {
    return "Calendario de insumos";
  }

  return "Curva S";
}

function getSupportedWorkbookProfiles(activeView: ActiveView): WorkbookExportProfile[] {
  if (activeView === "curve") {
    return ["minimal", "executive"];
  }

  return ["minimal", "executive", "analytical"];
}

function getWorkbookExportProfileLabel(profile: WorkbookExportProfile) {
  if (profile === "minimal") {
    return "Minimo";
  }

  if (profile === "executive") {
    return "Ejecutivo";
  }

  return "Analitico";
}

function getWorkbookExportScopeForView(
  activeView: ActiveView,
  scopes: {
    executiveWorkbookScope: WorkbookExportScope;
    valuationWorkbookScope: WorkbookExportScope;
    resourceWorkbookScope: WorkbookExportScope;
    curveWorkbookScope: WorkbookExportScope;
  },
) {
  if (activeView === "overview") {
    return scopes.executiveWorkbookScope;
  }

  if (activeView === "valuation") {
    return scopes.valuationWorkbookScope;
  }

  if (activeView === "resources") {
    return scopes.resourceWorkbookScope;
  }

  return scopes.curveWorkbookScope;
}

function getWorkbookExportProfileFromScope(activeView: ActiveView, scope: WorkbookExportScope): WorkbookExportProfile {
  if (scope === "detail_only") {
    return "minimal";
  }

  if (scope === "detail_and_total") {
    return "executive";
  }

  return activeView === "curve" ? "executive" : "analytical";
}

function getWorkbookExportScopeFromProfile(activeView: ActiveView, profile: WorkbookExportProfile): WorkbookExportScope {
  if (profile === "minimal") {
    return "detail_only";
  }

  if (profile === "executive") {
    return "detail_and_total";
  }

  return activeView === "curve" ? "detail_and_total" : "detail_subtotals_and_total";
}

function buildWorkbookScopePreview(target: string, scope: WorkbookExportScope, detailUnit: string) {
  if (scope === "detail_only") {
    return `Se exportara ${target} con solo detalle por ${detailUnit}.`;
  }

  if (scope === "detail_and_total") {
    return `Se exportara ${target} con detalle por ${detailUnit} y total general.`;
  }

  return `Se exportara ${target} con detalle por ${detailUnit}, subtotales y total general.`;
}

function buildWorkbookExportPreviewBadges(
  activeView: ActiveView,
  scopes: {
    executiveWorkbookScope: WorkbookExportScope;
    valuationWorkbookScope: WorkbookExportScope;
    resourceWorkbookScope: WorkbookExportScope;
    curveWorkbookScope: WorkbookExportScope;
  },
) {
  const scope =
    activeView === "overview"
      ? scopes.executiveWorkbookScope
      : activeView === "valuation"
        ? scopes.valuationWorkbookScope
        : activeView === "resources"
          ? scopes.resourceWorkbookScope
          : scopes.curveWorkbookScope;

  const badges = ["Detalle"];

  if (scope === "detail_only") {
    badges.push("Solo detalle");
    return badges;
  }

  badges.push("Incluye total");

  if (scope === "detail_subtotals_and_total") {
    badges.push("Incluye subtotales");
  }

  return badges;
}

function getCollapsedGroupsStorageKey(budgetId: string) {
  return `work-schedule-collapsed-groups:${budgetId}`;
}

function getActiveViewStorageKey(budgetId: string) {
  return `work-schedule-active-view:${budgetId}`;
}

function getEditingLineStorageKey(budgetId: string) {
  return `work-schedule-editing-line:${budgetId}`;
}

function getOverviewScrollStorageKey(budgetId: string) {
  return `work-schedule-overview-scroll:${budgetId}`;
}

function getOverviewTimelinePanelWidthStorageKey(budgetId: string) {
  return `work-schedule-overview-timeline-panel-width:${budgetId}`;
}

function getOverviewCostColumnsVisibilityStorageKey(budgetId: string) {
  return `work-schedule-overview-cost-columns:${budgetId}`;
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

function buildPreviewWorkScheduleView({
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
    monthlyDistributions: line.monthlyDistributions.map((distribution) => ({ ...distribution })),
    resourceIds: line.resourceIds ? [...line.resourceIds] : undefined,
    resources: line.resources?.map((resource) => ({ ...resource })),
    criticalPath: line.criticalPath ? { ...line.criticalPath } : null,
  }));

  for (const draft of draftEntries.values()) {
    nextLines = nextLines.map((line) =>
      line.budgetItemId === draft.budgetItemId ? applyEditableDraftToLine(line, draft, rowNumberToItemCode) : line,
    );
    const nextLinesByCode = new Map(nextLines.map((line) => [line.itemCode, line]));
    nextLines = nextLines.map((line) =>
      line.budgetItemId === draft.budgetItemId
        ? (() => {
            const recalculatedLine = recalculateWorkScheduleLineFromPredecessors(line, nextLinesByCode);
            return recalculatedLine ? { ...line, ...recalculatedLine } : line;
          })()
        : line,
    );
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

function readOverviewScrollPosition(budgetId: string) {
  if (typeof window === "undefined") {
    return 0;
  }

  const storedValue = window.localStorage.getItem(getOverviewScrollStorageKey(budgetId));
  if (!storedValue) {
    return 0;
  }

  const parsedValue = Number(storedValue);
  return Number.isFinite(parsedValue) && parsedValue >= 0 ? parsedValue : 0;
}

function writeOverviewScrollPosition(budgetId: string, scrollLeft: number) {
  if (typeof window === "undefined") {
    return;
  }

  if (scrollLeft <= 0) {
    window.localStorage.removeItem(getOverviewScrollStorageKey(budgetId));
    return;
  }

  window.localStorage.setItem(getOverviewScrollStorageKey(budgetId), String(Math.round(scrollLeft)));
}

function clampOverviewTimelinePanelWidth(width: number, availableWidth: number | null) {
  const fallbackViewportWidth = typeof window === "undefined" ? 1200 : window.innerWidth;
  const maxWidth = Math.max(
    MIN_OVERVIEW_TIMELINE_PANEL_WIDTH,
    (availableWidth && availableWidth > 0 ? availableWidth : fallbackViewportWidth) - 48,
  );

  return Math.min(Math.max(Math.round(width), MIN_OVERVIEW_TIMELINE_PANEL_WIDTH), maxWidth);
}

function areHeightMapsEqual(left: Record<string, number>, right: Record<string, number>) {
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);

  if (leftKeys.length !== rightKeys.length) {
    return false;
  }

  return leftKeys.every((key) => left[key] === right[key]);
}

function readOverviewTimelinePanelWidth(budgetId: string) {
  if (typeof window === "undefined") {
    return DEFAULT_OVERVIEW_TIMELINE_PANEL_WIDTH;
  }

  const storedValue = window.localStorage.getItem(getOverviewTimelinePanelWidthStorageKey(budgetId));
  if (!storedValue) {
    return DEFAULT_OVERVIEW_TIMELINE_PANEL_WIDTH;
  }

  const parsedValue = Number(storedValue);
  if (!Number.isFinite(parsedValue)) {
    return DEFAULT_OVERVIEW_TIMELINE_PANEL_WIDTH;
  }

  return clampOverviewTimelinePanelWidth(parsedValue, null);
}

function writeOverviewTimelinePanelWidth(budgetId: string, width: number) {
  if (typeof window === "undefined") {
    return;
  }

  const normalizedWidth = clampOverviewTimelinePanelWidth(width, null);
  if (normalizedWidth === DEFAULT_OVERVIEW_TIMELINE_PANEL_WIDTH) {
    window.localStorage.removeItem(getOverviewTimelinePanelWidthStorageKey(budgetId));
    return;
  }

  window.localStorage.setItem(getOverviewTimelinePanelWidthStorageKey(budgetId), String(normalizedWidth));
}

function syncOverviewTimelinePanelWidthCssVariable(width: number) {
  if (typeof document === "undefined") {
    return;
  }

  document.documentElement.style.setProperty(
    OVERVIEW_TIMELINE_PANEL_WIDTH_CSS_VAR,
    `${clampOverviewTimelinePanelWidth(width, null)}px`,
  );
}

function readOverviewCostColumnsVisibility(budgetId: string) {
  if (typeof window === "undefined") {
    return false;
  }

  return window.localStorage.getItem(getOverviewCostColumnsVisibilityStorageKey(budgetId)) === "true";
}

function writeOverviewCostColumnsVisibility(budgetId: string, visible: boolean) {
  if (typeof window === "undefined") {
    return;
  }

  if (!visible) {
    window.localStorage.removeItem(getOverviewCostColumnsVisibilityStorageKey(budgetId));
    return;
  }

  window.localStorage.setItem(getOverviewCostColumnsVisibilityStorageKey(budgetId), "true");
}

function readOverviewTimelineZoomPercent(budgetId: string) {
  if (typeof window === "undefined") {
    return DEFAULT_OVERVIEW_TIMELINE_ZOOM_PERCENT;
  }

  const storedValue = Number(window.localStorage.getItem(getOverviewTimelineZoomStorageKey(budgetId)));
  return clampOverviewTimelineZoomPercent(storedValue || DEFAULT_OVERVIEW_TIMELINE_ZOOM_PERCENT);
}

function writeOverviewTimelineZoomPercent(budgetId: string, zoomPercent: number) {
  if (typeof window === "undefined") {
    return;
  }

  const normalizedZoom = clampOverviewTimelineZoomPercent(zoomPercent);
  if (normalizedZoom === DEFAULT_OVERVIEW_TIMELINE_ZOOM_PERCENT) {
    window.localStorage.removeItem(getOverviewTimelineZoomStorageKey(budgetId));
    return;
  }

  window.localStorage.setItem(getOverviewTimelineZoomStorageKey(budgetId), String(normalizedZoom));
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

function readOverviewMeasuredHeights(budgetId: string): OverviewMeasuredHeightsCache {
  if (typeof window === "undefined") {
    return { groups: {}, lines: {} };
  }

  const storedValue = window.localStorage.getItem(getOverviewMeasuredHeightsStorageKey(budgetId));
  if (!storedValue) {
    return { groups: {}, lines: {} };
  }

  try {
    const parsedValue = JSON.parse(storedValue) as Partial<OverviewMeasuredHeightsCache>;
    return {
      groups: sanitizeMeasuredHeightsMap(parsedValue.groups),
      lines: sanitizeMeasuredHeightsMap(parsedValue.lines),
    };
  } catch {
    return { groups: {}, lines: {} };
  }
}

function writeOverviewMeasuredHeights(budgetId: string, cache: OverviewMeasuredHeightsCache) {
  if (typeof window === "undefined") {
    return;
  }

  if (Object.keys(cache.groups).length === 0 && Object.keys(cache.lines).length === 0) {
    window.localStorage.removeItem(getOverviewMeasuredHeightsStorageKey(budgetId));
    return;
  }

  window.localStorage.setItem(getOverviewMeasuredHeightsStorageKey(budgetId), JSON.stringify(cache));
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

function pruneMeasuredHeightsMap(input: Record<string, number>, validKeys: Set<string>) {
  const next: Record<string, number> = {};

  for (const [key, value] of Object.entries(input)) {
    if (!validKeys.has(key)) {
      continue;
    }

    next[key] = value;
  }

  return next;
}

function normalizeMeasuredHeight(height: number, minimumHeight: number) {
  return Math.max(Math.round(height), minimumHeight);
}

function clampOverviewTimelineZoomPercent(value: number) {
  if (!Number.isFinite(value)) {
    return DEFAULT_OVERVIEW_TIMELINE_ZOOM_PERCENT;
  }

  return Math.min(
    Math.max(Math.round(value), MIN_OVERVIEW_TIMELINE_ZOOM_PERCENT),
    MAX_OVERVIEW_TIMELINE_ZOOM_PERCENT,
  );
}

function getZoomedTimelineDayWidth(zoomPercent: number) {
  return Math.max(1, Math.round((OVERVIEW_TIMELINE_DAY_WIDTH_PX * zoomPercent) / 100));
}

function getZoomedTimelineDayGap(zoomPercent: number) {
  return Math.max(1, Math.round((OVERVIEW_TIMELINE_DAY_GAP_PX * zoomPercent) / 100));
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

function isPendingWorkScheduleLine(line: WorkScheduleLineRecord) {
  if (!line.startDate || !line.endDate || line.durationDays == null) {
    return true;
  }

  if (line.monthlyDistributions.length === 0) {
    return true;
  }

  return hasIncompleteDistribution(line);
}

function hasIncompleteDistribution(line: WorkScheduleLineRecord) {
  const totalPercentage = line.monthlyDistributions.reduce((sum, distribution) => sum + Number(distribution.percentage), 0);
  return Math.abs(totalPercentage - 100) > 0.0001;
}

function isFullyScheduledWorkScheduleLine(line: WorkScheduleLineRecord) {
  return !isPendingWorkScheduleLine(line);
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

function matchesOverviewFilterWithStats(
  line: WorkScheduleLineRecord,
  overviewFilter: OverviewFilter,
  lineOverviewStats: {
    pendingLineIds: Set<string>;
    scheduledLineIds: Set<string>;
    incompleteDistributionLineIds: Set<string>;
  },
) {
  if (overviewFilter === "all") {
    return true;
  }

  if (overviewFilter === "pending") {
    return lineOverviewStats.pendingLineIds.has(line.budgetItemId);
  }

  if (overviewFilter === "scheduled") {
    return lineOverviewStats.scheduledLineIds.has(line.budgetItemId);
  }

  return lineOverviewStats.incompleteDistributionLineIds.has(line.budgetItemId);
}

function isVisibleOverviewRow(row: WorkScheduleDisplayRowRecord, visibleLineIds: Set<string>) {
  if (row.kind === "line") {
    return visibleLineIds.has(row.line.budgetItemId);
  }

  return row.childLineIds.some((lineId) => visibleLineIds.has(lineId));
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

function buildWorkScheduleCsvExport({
  activeView,
  overviewLines,
  valuationRows,
  resourceRows,
  curvePoints,
  periods,
  currency,
  currencyDecimals,
  dateFormat,
}: {
  activeView: ActiveView;
  overviewLines: WorkScheduleLineRecord[];
  valuationRows: WorkScheduleValuationCalendarRow[];
  resourceRows: WorkScheduleResourceCalendarRow[];
  curvePoints: WorkScheduleCurvePointRecord[];
  periods: WorkSchedulePeriodRecord[];
  currency: string;
  currencyDecimals: number;
  dateFormat: string;
}) {
  if (activeView === "overview") {
    const headers = ["Item", "Partida", "Duracion", "Inicio", "Fin", "Predecesora", "Cuadrilla", "Unidad", "Metrado", "PU", "Parcial"];
    const rows = overviewLines.map((line) => [
      line.itemCode,
      line.description,
      line.durationDays != null ? String(line.durationDays) : "-",
      line.startDate ? formatDate(line.startDate, dateFormat as never) : "Pendiente",
      line.endDate ? formatDate(line.endDate, dateFormat as never) : "Pendiente",
      line.predecessor || "-",
      line.crew != null ? formatNumber(line.crew, 2) : "-",
      line.unit,
      formatNumber(line.quantity, 2),
      formatCurrency(line.unitPrice, currency, currencyDecimals),
      formatCurrency(line.partial, currency, currencyDecimals),
    ]);

    return {
      fileName: "work-schedule-cronograma.csv",
      content: buildCsvContent(headers, rows),
    };
  }

  if (activeView === "valuation") {
    const headers = ["Item", "Partida", "Unidad", "Metrado", "PU", "Parcial", ...periods.map((period) => formatPeriodLabel(period))];
    const rows = valuationRows.map((row) => [
      row.itemCode,
      row.description,
      row.unit,
      formatNumber(row.quantity, 2),
      formatCurrency(row.unitPrice, currency, currencyDecimals),
      formatCurrency(row.partial, currency, currencyDecimals),
      ...periods.map((period) => formatCurrency(row.periodAmounts[period.key] ?? 0, currency, currencyDecimals)),
    ]);

    return {
      fileName: "work-schedule-calendario-valorizado.csv",
      content: buildCsvContent(headers, rows),
    };
  }

  if (activeView === "resources") {
    const periodHeaders = periods.flatMap((period) => [`${formatPeriodLabel(period)} Cantidad`, `${formatPeriodLabel(period)} Monto`]);
    const headers = ["Item", "Insumo", "Unidad", "Cantidad", "PU", "Parcial", ...periodHeaders];
    const rows = resourceRows.map((row, index) => [
      String(index + 1),
      row.description,
      row.unit,
      formatNumber(row.quantity, 2),
      formatCurrency(row.unitPrice, currency, currencyDecimals),
      formatCurrency(row.partial, currency, currencyDecimals),
      ...periods.flatMap((period) => [
        formatNumber(row.periodQuantities[period.key] ?? 0, 2),
        formatCurrency(row.periodAmounts[period.key] ?? 0, currency, currencyDecimals),
      ]),
    ]);

    return {
      fileName: "work-schedule-calendario-insumos.csv",
      content: buildCsvContent(headers, rows),
    };
  }

  const headers = ["Periodo", "Programado mensual", "Acumulado", "% acumulado"];
  const rows = curvePoints.map((point) => [
    formatPeriodLabel(point),
    formatCurrency(point.monthlyAmount, currency, currencyDecimals),
    formatCurrency(point.accumulatedAmount, currency, currencyDecimals),
    `${formatNumber(point.accumulatedPercentage, 2)}%`,
  ]);

  return {
    fileName: "work-schedule-curva-s.csv",
    content: buildCsvContent(headers, rows),
  };
}

function buildWorkScheduleValuationWorkbookTableData({
  valuationRows,
  periods,
  currency,
  currencyDecimals,
  scope,
}: {
  valuationRows: WorkScheduleValuationCalendarRow[];
  periods: WorkSchedulePeriodRecord[];
  currency: string;
  currencyDecimals: number;
  scope: WorkbookExportScope;
}): WorkbookTableData {
  const currencyFormat = createWorkbookCurrencyNumberFormat(currency, currencyDecimals);
  const decimalFormat = buildWorkbookDecimalFormat(2);
  const rows: WorkbookCell[][] = [];
  const subtotalRowIndexes: number[] = [];
  let currentSubBudgetName = "";
  let currentGroupRows: WorkScheduleValuationCalendarRow[] = [];

  function pushCurrentGroupSubtotal() {
    if (currentGroupRows.length === 0) {
      return;
    }

    rows.push([
      { value: "" },
      { value: `Subtotal ${currentSubBudgetName}` },
      { value: "" },
      { value: currentGroupRows.reduce((sum, row) => sum + row.quantity, 0), numFmt: decimalFormat },
      { value: "" },
      { value: currentGroupRows.reduce((sum, row) => sum + row.partial, 0), numFmt: currencyFormat },
      ...periods.map((period) => ({
        value: currentGroupRows.reduce((sum, row) => sum + (row.periodAmounts[period.key] ?? 0), 0),
        numFmt: currencyFormat,
      })),
    ]);
    subtotalRowIndexes.push(rows.length - 1);
  }

  for (const row of valuationRows) {
    if (scope === "detail_subtotals_and_total" && currentGroupRows.length > 0 && row.subBudgetName !== currentSubBudgetName) {
      pushCurrentGroupSubtotal();
      currentGroupRows = [];
    }

    currentSubBudgetName = row.subBudgetName;
    currentGroupRows.push(row);
    rows.push([
      { value: row.itemCode },
      { value: row.description },
      { value: row.unit },
      { value: row.quantity, numFmt: decimalFormat },
      { value: row.unitPrice, numFmt: currencyFormat },
      { value: row.partial, numFmt: currencyFormat },
      ...periods.map((period) => ({ value: row.periodAmounts[period.key] ?? 0, numFmt: currencyFormat })),
    ]);
  }

  if (scope === "detail_subtotals_and_total") {
    pushCurrentGroupSubtotal();
  }

  return {
    headers: ["Item", "Partida", "Unidad", "Metrado", "PU", "Parcial", ...periods.map((period) => formatPeriodLabel(period))],
    rows,
    subtotalRowIndexes: scope === "detail_subtotals_and_total" ? subtotalRowIndexes : [],
    totalRow:
      scope === "detail_only"
        ? undefined
        : [
            { value: "" },
            { value: "Total" },
            { value: "" },
            { value: valuationRows.reduce((sum, row) => sum + row.quantity, 0), numFmt: decimalFormat },
            { value: "" },
            { value: valuationRows.reduce((sum, row) => sum + row.partial, 0), numFmt: currencyFormat },
            ...periods.map((period) => ({
              value: valuationRows.reduce((sum, row) => sum + (row.periodAmounts[period.key] ?? 0), 0),
              numFmt: currencyFormat,
            })),
          ],
  };
}

function buildWorkScheduleResourceWorkbookTableData({
  resourceRows,
  periods,
  currency,
  currencyDecimals,
  scope,
}: {
  resourceRows: WorkScheduleResourceCalendarRow[];
  periods: WorkSchedulePeriodRecord[];
  currency: string;
  currencyDecimals: number;
  scope: WorkbookExportScope;
}): WorkbookTableData {
  const currencyFormat = createWorkbookCurrencyNumberFormat(currency, currencyDecimals);
  const decimalFormat = buildWorkbookDecimalFormat(2);
  const rows: WorkbookCell[][] = [];
  const subtotalRowIndexes: number[] = [];
  let currentFamilyCode = "";
  let currentGroupRows: WorkScheduleResourceCalendarRow[] = [];

  function pushCurrentFamilySubtotal() {
    if (currentGroupRows.length === 0) {
      return;
    }

    rows.push([
      { value: "" },
      { value: `Subtotal ${currentFamilyCode}` },
      { value: "" },
      { value: currentGroupRows.reduce((sum, row) => sum + row.quantity, 0), numFmt: decimalFormat },
      { value: "" },
      { value: currentGroupRows.reduce((sum, row) => sum + row.partial, 0), numFmt: currencyFormat },
      ...periods.flatMap((period) => [
        {
          value: currentGroupRows.reduce((sum, row) => sum + (row.periodQuantities[period.key] ?? 0), 0),
          numFmt: decimalFormat,
        },
        {
          value: currentGroupRows.reduce((sum, row) => sum + (row.periodAmounts[period.key] ?? 0), 0),
          numFmt: currencyFormat,
        },
      ]),
    ]);
    subtotalRowIndexes.push(rows.length - 1);
  }

  for (const [index, row] of resourceRows.entries()) {
    const familyCode = scope === "detail_subtotals_and_total" ? getResourceWorkbookFamilyCode(row.code) : "Sin subtotales";
    if (scope === "detail_subtotals_and_total" && currentGroupRows.length > 0 && familyCode !== currentFamilyCode) {
      pushCurrentFamilySubtotal();
      currentGroupRows = [];
    }

    currentFamilyCode = familyCode;
    currentGroupRows.push(row);
    rows.push([
      { value: index + 1 },
      { value: row.description },
      { value: row.unit },
      { value: row.quantity, numFmt: decimalFormat },
      { value: row.unitPrice, numFmt: currencyFormat },
      { value: row.partial, numFmt: currencyFormat },
      ...periods.flatMap((period) => [
        { value: row.periodQuantities[period.key] ?? 0, numFmt: decimalFormat },
        { value: row.periodAmounts[period.key] ?? 0, numFmt: currencyFormat },
      ]),
    ]);
  }

  if (scope === "detail_subtotals_and_total") {
    pushCurrentFamilySubtotal();
  }

  return {
    headers: ["Item", "Insumo", "Unidad", "Cantidad", "PU", "Parcial", ...periods.flatMap((period) => [`${formatPeriodLabel(period)} Cantidad`, `${formatPeriodLabel(period)} Monto`])],
    rows,
    subtotalRowIndexes: scope === "detail_subtotals_and_total" ? subtotalRowIndexes : [],
    totalRow:
      scope === "detail_only"
        ? undefined
        : [
            { value: "" },
            { value: "Total" },
            { value: "" },
            { value: resourceRows.reduce((sum, row) => sum + row.quantity, 0), numFmt: decimalFormat },
            { value: "" },
            { value: resourceRows.reduce((sum, row) => sum + row.partial, 0), numFmt: currencyFormat },
            ...periods.flatMap((period) => [
              {
                value: resourceRows.reduce((sum, row) => sum + (row.periodQuantities[period.key] ?? 0), 0),
                numFmt: decimalFormat,
              },
              {
                value: resourceRows.reduce((sum, row) => sum + (row.periodAmounts[period.key] ?? 0), 0),
                numFmt: currencyFormat,
              },
            ]),
          ],
  };
}

function buildWorkScheduleCurveWorkbookTableData({
  curvePoints,
  currency,
  currencyDecimals,
  scope,
}: {
  curvePoints: WorkScheduleCurvePointRecord[];
  currency: string;
  currencyDecimals: number;
  scope: WorkbookExportScope;
}): WorkbookTableData {
  const currencyFormat = createWorkbookCurrencyNumberFormat(currency, currencyDecimals);
  const percentageFormat = "0.00%";

  return {
    headers: ["Periodo", "Programado mensual", "Acumulado", "% acumulado"],
    rows: curvePoints.map((point) => [
      { value: formatPeriodLabel(point) },
      { value: point.monthlyAmount, numFmt: currencyFormat },
      { value: point.accumulatedAmount, numFmt: currencyFormat },
      { value: point.accumulatedPercentage / 100, numFmt: percentageFormat },
    ]),
    totalRow:
      scope === "detail_only"
        ? undefined
        : [
            { value: "Total" },
            { value: curvePoints.reduce((sum, point) => sum + point.monthlyAmount, 0), numFmt: currencyFormat },
            { value: curvePoints.at(-1)?.accumulatedAmount ?? 0, numFmt: currencyFormat },
            { value: (curvePoints.at(-1)?.accumulatedPercentage ?? 0) / 100, numFmt: percentageFormat },
          ],
  };
}

function buildWorkScheduleOverviewSummaryCsvExport({
  overviewLines,
  currency,
  currencyDecimals,
  dateFormat,
}: {
  overviewLines: WorkScheduleLineRecord[];
  currency: string;
  currencyDecimals: number;
  dateFormat: string;
}) {
  const tableData = buildWorkScheduleOverviewSummaryTableData({
    overviewLines,
    currency,
    currencyDecimals,
    dateFormat,
  });

  return {
    fileName: "work-schedule-cronograma-resumen.csv",
    content: buildCsvContent(tableData.headers, tableData.rows),
  };
}

function buildWorkScheduleOverviewWorkbookTableData({
  overviewLines,
  currency,
  currencyDecimals,
  dateFormat,
}: {
  overviewLines: WorkScheduleLineRecord[];
  currency: string;
  currencyDecimals: number;
  dateFormat: string;
}): WorkbookTableData {
  const currencyFormat = createWorkbookCurrencyNumberFormat(currency, currencyDecimals);
  const decimalFormat = buildWorkbookDecimalFormat(2);
  const rows: WorkbookCell[][] = [];
  const subtotalRowIndexes: number[] = [];
  let currentSubBudgetId = "";
  let currentSubBudgetName = "";
  let currentGroupLines: WorkScheduleLineRecord[] = [];

  function pushCurrentGroupSubtotal() {
    if (currentGroupLines.length === 0) {
      return;
    }

    rows.push([
      { value: "" },
      { value: `Subtotal ${currentSubBudgetName}` },
      { value: "" },
      { value: "" },
      { value: "" },
      { value: "" },
      { value: "" },
      { value: "" },
      { value: currentGroupLines.reduce((sum, line) => sum + line.quantity, 0), numFmt: decimalFormat },
      { value: "" },
      { value: currentGroupLines.reduce((sum, line) => sum + line.partial, 0), numFmt: currencyFormat },
    ]);
    subtotalRowIndexes.push(rows.length - 1);
  }

  for (const line of overviewLines) {
    if (currentGroupLines.length > 0 && line.subBudgetId !== currentSubBudgetId) {
      pushCurrentGroupSubtotal();
      currentGroupLines = [];
    }

    currentSubBudgetId = line.subBudgetId;
    currentSubBudgetName = line.subBudgetName;
    currentGroupLines.push(line);
    rows.push([
      { value: line.itemCode },
      { value: line.description },
      { value: line.durationDays ?? "-" },
      { value: line.startDate ? formatDate(line.startDate, dateFormat as never) : "Pendiente" },
      { value: line.endDate ? formatDate(line.endDate, dateFormat as never) : "Pendiente" },
      { value: line.predecessor || "-" },
      { value: line.crew ?? "-" },
      { value: line.unit },
      { value: line.quantity, numFmt: decimalFormat },
      { value: line.unitPrice, numFmt: currencyFormat },
      { value: line.partial, numFmt: currencyFormat },
    ]);
  }

  pushCurrentGroupSubtotal();

  return {
    headers: ["Item", "Partida", "Duracion", "Inicio", "Fin", "Predecesora", "Cuadrilla", "Unidad", "Metrado", "PU", "Parcial"],
    rows,
    subtotalRowIndexes,
    totalRow: [
      { value: "" },
      { value: "Total" },
      { value: "" },
      { value: "" },
      { value: "" },
      { value: "" },
      { value: "" },
      { value: "" },
      { value: overviewLines.reduce((sum, line) => sum + line.quantity, 0), numFmt: decimalFormat },
      { value: "" },
      { value: overviewLines.reduce((sum, line) => sum + line.partial, 0), numFmt: currencyFormat },
    ],
  };
}

function buildWorkScheduleOverviewMonthlySummaryCsvExport({
  valuationRows,
  periods,
  currency,
  currencyDecimals,
}: {
  valuationRows: WorkScheduleValuationCalendarRow[];
  periods: WorkSchedulePeriodRecord[];
  currency: string;
  currencyDecimals: number;
}) {
  const tableData = buildWorkScheduleOverviewMonthlySummaryTableData({
    valuationRows,
    periods,
    currency,
    currencyDecimals,
  });

  return {
    fileName: "work-schedule-cronograma-resumen-mensual.csv",
    content: buildCsvContent(tableData.headers, tableData.rows),
  };
}

function buildWorkScheduleOverviewExecutivePackageCsvExport({
  overviewLines,
  valuationRows,
  periods,
  currency,
  currencyDecimals,
  dateFormat,
}: {
  overviewLines: WorkScheduleLineRecord[];
  valuationRows: WorkScheduleValuationCalendarRow[];
  periods: WorkSchedulePeriodRecord[];
  currency: string;
  currencyDecimals: number;
  dateFormat: string;
}) {
  const summaryExport = buildWorkScheduleOverviewSummaryCsvExport({
    overviewLines,
    currency,
    currencyDecimals,
    dateFormat,
  });
  const monthlySummaryExport = buildWorkScheduleOverviewMonthlySummaryCsvExport({
    valuationRows,
    periods,
    currency,
    currencyDecimals,
  });

  const content = [
    "Paquete ejecutivo - Resumen por subpresupuesto",
    summaryExport.content,
    "",
    "Paquete ejecutivo - Resumen mensual",
    monthlySummaryExport.content,
  ].join("\n");

  return {
    fileName: "work-schedule-cronograma-paquete-ejecutivo.csv",
    content,
  };
}

function buildWorkScheduleOverviewSummaryTableData({
  overviewLines,
  currency,
  currencyDecimals,
  dateFormat,
}: {
  overviewLines: WorkScheduleLineRecord[];
  currency: string;
  currencyDecimals: number;
  dateFormat: string;
}) {
  const groupedLines = new Map<
    string,
    {
      subBudgetName: string;
      lines: WorkScheduleLineRecord[];
    }
  >();

  for (const line of overviewLines) {
    const currentGroup = groupedLines.get(line.subBudgetId);
    if (currentGroup) {
      currentGroup.lines.push(line);
      continue;
    }

    groupedLines.set(line.subBudgetId, {
      subBudgetName: line.subBudgetName,
      lines: [line],
    });
  }

  const headers = ["Subpresupuesto", "Partidas", "Programadas", "Pendientes", "Distribucion incompleta", "Inicio", "Fin", "Total parcial"];
  const rows = [...groupedLines.values()].map((group) => {
    const groupStartDates = group.lines
      .map((line) => line.startDate)
      .filter((value): value is string => typeof value === "string" && value.length > 0)
      .sort();
    const groupEndDates = group.lines
      .map((line) => line.endDate)
      .filter((value): value is string => typeof value === "string" && value.length > 0)
      .sort();
    const totalPartial = group.lines.reduce((accumulator, line) => accumulator + line.partial, 0);

    return [
      group.subBudgetName,
      String(group.lines.length),
      String(group.lines.filter(isFullyScheduledWorkScheduleLine).length),
      String(group.lines.filter(isPendingWorkScheduleLine).length),
      String(group.lines.filter(hasIncompleteDistribution).length),
      groupStartDates[0] ? formatDate(groupStartDates[0], dateFormat as never) : "-",
      groupEndDates.at(-1) ? formatDate(groupEndDates.at(-1) as string, dateFormat as never) : "-",
      formatCurrency(totalPartial, currency, currencyDecimals),
    ];
  });

  return { headers, rows };
}

function buildWorkScheduleOverviewSummaryWorkbookTableData({
  overviewLines,
  currency,
  currencyDecimals,
  dateFormat,
}: {
  overviewLines: WorkScheduleLineRecord[];
  currency: string;
  currencyDecimals: number;
  dateFormat: string;
}): WorkbookTableData {
  const groupedLines = new Map<
    string,
    {
      subBudgetName: string;
      lines: WorkScheduleLineRecord[];
    }
  >();
  const currencyFormat = createWorkbookCurrencyNumberFormat(currency, currencyDecimals);

  for (const line of overviewLines) {
    const currentGroup = groupedLines.get(line.subBudgetId);
    if (currentGroup) {
      currentGroup.lines.push(line);
      continue;
    }

    groupedLines.set(line.subBudgetId, {
      subBudgetName: line.subBudgetName,
      lines: [line],
    });
  }

  return {
    headers: ["Subpresupuesto", "Partidas", "Programadas", "Pendientes", "Distribucion incompleta", "Inicio", "Fin", "Total parcial"],
    rows: [...groupedLines.values()].map((group) => {
      const groupStartDates = group.lines
        .map((line) => line.startDate)
        .filter((value): value is string => typeof value === "string" && value.length > 0)
        .sort();
      const groupEndDates = group.lines
        .map((line) => line.endDate)
        .filter((value): value is string => typeof value === "string" && value.length > 0)
        .sort();
      const totalPartial = group.lines.reduce((accumulator, line) => accumulator + line.partial, 0);

      return [
        { value: group.subBudgetName },
        { value: group.lines.length },
        { value: group.lines.filter(isFullyScheduledWorkScheduleLine).length },
        { value: group.lines.filter(isPendingWorkScheduleLine).length },
        { value: group.lines.filter(hasIncompleteDistribution).length },
        { value: groupStartDates[0] ? formatDate(groupStartDates[0], dateFormat as never) : "-" },
        { value: groupEndDates.at(-1) ? formatDate(groupEndDates.at(-1) as string, dateFormat as never) : "-" },
        { value: totalPartial, numFmt: currencyFormat },
      ];
    }),
    totalRow: [
      { value: "Total" },
      { value: [...groupedLines.values()].reduce((sum, group) => sum + group.lines.length, 0) },
      { value: [...groupedLines.values()].reduce((sum, group) => sum + group.lines.filter(isFullyScheduledWorkScheduleLine).length, 0) },
      { value: [...groupedLines.values()].reduce((sum, group) => sum + group.lines.filter(isPendingWorkScheduleLine).length, 0) },
      { value: [...groupedLines.values()].reduce((sum, group) => sum + group.lines.filter(hasIncompleteDistribution).length, 0) },
      { value: "" },
      { value: "" },
      { value: [...groupedLines.values()].reduce((sum, group) => sum + group.lines.reduce((subtotal, line) => subtotal + line.partial, 0), 0), numFmt: currencyFormat },
    ],
  };
}

function buildWorkScheduleOverviewMonthlySummaryTableData({
  valuationRows,
  periods,
  currency,
  currencyDecimals,
}: {
  valuationRows: WorkScheduleValuationCalendarRow[];
  periods: WorkSchedulePeriodRecord[];
  currency: string;
  currencyDecimals: number;
}) {
  const totalAmount = periods.reduce(
    (accumulator, period) =>
      accumulator +
      valuationRows.reduce((periodAccumulator, row) => periodAccumulator + (row.periodAmounts[period.key] ?? 0), 0),
    0,
  );

  let accumulatedAmount = 0;
  const headers = ["Periodo", "Partidas con monto", "Programado mensual", "Acumulado", "% acumulado"];
  const rows = periods.map((period) => {
    const monthlyRows = valuationRows.filter((row) => (row.periodAmounts[period.key] ?? 0) > 0);
    const monthlyAmount = monthlyRows.reduce((accumulator, row) => accumulator + (row.periodAmounts[period.key] ?? 0), 0);
    accumulatedAmount += monthlyAmount;

    return [
      formatPeriodLabel(period),
      String(monthlyRows.length),
      formatCurrency(monthlyAmount, currency, currencyDecimals),
      formatCurrency(accumulatedAmount, currency, currencyDecimals),
      `${formatNumber(totalAmount > 0 ? (accumulatedAmount / totalAmount) * 100 : 0, 2)}%`,
    ];
  });

  return { headers, rows };
}

function buildWorkScheduleOverviewMonthlySummaryWorkbookTableData({
  valuationRows,
  periods,
  currency,
  currencyDecimals,
}: {
  valuationRows: WorkScheduleValuationCalendarRow[];
  periods: WorkSchedulePeriodRecord[];
  currency: string;
  currencyDecimals: number;
}): WorkbookTableData {
  const totalAmount = periods.reduce(
    (accumulator, period) =>
      accumulator +
      valuationRows.reduce((periodAccumulator, row) => periodAccumulator + (row.periodAmounts[period.key] ?? 0), 0),
    0,
  );
  const currencyFormat = createWorkbookCurrencyNumberFormat(currency, currencyDecimals);
  const percentageFormat = "0.00%";
  let accumulatedAmount = 0;

  return {
    headers: ["Periodo", "Partidas con monto", "Programado mensual", "Acumulado", "% acumulado"],
    rows: periods.map((period) => {
      const monthlyRows = valuationRows.filter((row) => (row.periodAmounts[period.key] ?? 0) > 0);
      const monthlyAmount = monthlyRows.reduce((accumulator, row) => accumulator + (row.periodAmounts[period.key] ?? 0), 0);
      accumulatedAmount += monthlyAmount;

      return [
        { value: formatPeriodLabel(period) },
        { value: monthlyRows.length },
        { value: monthlyAmount, numFmt: currencyFormat },
        { value: accumulatedAmount, numFmt: currencyFormat },
        { value: totalAmount > 0 ? accumulatedAmount / totalAmount : 0, numFmt: percentageFormat },
      ];
    }),
    totalRow: [
      { value: "Total" },
      { value: periods.reduce((sum, period) => sum + valuationRows.filter((row) => (row.periodAmounts[period.key] ?? 0) > 0).length, 0) },
      { value: totalAmount, numFmt: currencyFormat },
      { value: accumulatedAmount, numFmt: currencyFormat },
      { value: totalAmount > 0 ? accumulatedAmount / totalAmount : 0, numFmt: percentageFormat },
    ],
  };
}

async function buildWorkScheduleOverviewExecutivePackageWorkbook({
  overviewLines,
  valuationRows,
  periods,
  currency,
  currencyDecimals,
  dateFormat,
  scope,
}: {
  overviewLines: WorkScheduleLineRecord[];
  valuationRows: WorkScheduleValuationCalendarRow[];
  periods: WorkSchedulePeriodRecord[];
  currency: string;
  currencyDecimals: number;
  dateFormat: string;
  scope: WorkbookExportScope;
}) {
  const { default: ExcelJS } = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "MYC Presupuestos";
  const summaryTable = buildWorkScheduleOverviewSummaryWorkbookTableData({
    overviewLines,
    currency,
    currencyDecimals,
    dateFormat,
  });
  const monthlyTable = buildWorkScheduleOverviewMonthlySummaryWorkbookTableData({
    valuationRows,
    periods,
    currency,
    currencyDecimals,
  });
  const overviewTable = buildWorkScheduleOverviewWorkbookTableData({
    overviewLines,
    currency,
    currencyDecimals,
    dateFormat,
  });
  const scopedSummaryTable = {
    ...summaryTable,
    totalRow: scope === "detail_only" ? undefined : summaryTable.totalRow,
  };
  const scopedMonthlyTable = {
    ...monthlyTable,
    totalRow: scope === "detail_only" ? undefined : monthlyTable.totalRow,
  };
  const scopedOverviewTable = {
    ...overviewTable,
    subtotalRowIndexes: scope === "detail_subtotals_and_total" ? overviewTable.subtotalRowIndexes : [],
    totalRow: scope === "detail_only" ? undefined : overviewTable.totalRow,
  };

  appendWorkbookSheet(workbook, {
    sheetName: "Resumen subpresupuesto",
    title: "PROGRAMACION DE OBRA - RESUMEN POR SUBPRESUPUESTO",
    subtitle: "Vista ejecutiva consolidada por subpresupuesto sobre las partidas visibles y filtradas.",
    headers: scopedSummaryTable.headers,
    rows: scopedSummaryTable.rows,
    totalRow: scopedSummaryTable.totalRow,
  });
  appendWorkbookSheet(workbook, {
    sheetName: "Resumen mensual",
    title: "PROGRAMACION DE OBRA - RESUMEN MENSUAL",
    subtitle: "Programado mensual y acumulado derivado de la valorizacion filtrada.",
    headers: scopedMonthlyTable.headers,
    rows: scopedMonthlyTable.rows,
    totalRow: scopedMonthlyTable.totalRow,
  });
  appendWorkbookSheet(workbook, {
    sheetName: "Cronograma partidas",
    title: "PROGRAMACION DE OBRA - CRONOGRAMA DE PARTIDAS",
    subtitle: "Detalle resumido de partidas programadas visibles en el cronograma.",
    headers: scopedOverviewTable.headers,
    rows: scopedOverviewTable.rows,
    subtotalRowIndexes: scopedOverviewTable.subtotalRowIndexes,
    totalRow: scopedOverviewTable.totalRow,
  });

  return workbook.xlsx.writeBuffer();
}

async function buildWorkScheduleActiveViewWorkbook({
  activeView,
  valuationRows,
  resourceRows,
  curvePoints,
  periods,
  currency,
  currencyDecimals,
  curveWorkbookScope,
  valuationWorkbookScope,
  resourceWorkbookScope,
}: {
  activeView: ActiveView;
  valuationRows: WorkScheduleValuationCalendarRow[];
  resourceRows: WorkScheduleResourceCalendarRow[];
  curvePoints: WorkScheduleCurvePointRecord[];
  periods: WorkSchedulePeriodRecord[];
  currency: string;
  currencyDecimals: number;
  curveWorkbookScope: WorkbookExportScope;
  valuationWorkbookScope: WorkbookExportScope;
  resourceWorkbookScope: WorkbookExportScope;
}) {
  if (activeView === "overview") {
    return null;
  }

  const { default: ExcelJS } = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "MYC Presupuestos";

  if (activeView === "valuation") {
    const tableData = buildWorkScheduleValuationWorkbookTableData({
      valuationRows,
      periods,
      currency,
      currencyDecimals,
      scope: valuationWorkbookScope,
    });

    appendWorkbookSheet(workbook, {
      sheetName: "Calendario valorizado",
      title: "PROGRAMACION DE OBRA - CALENDARIO VALORIZADO",
      subtitle: "Vista valorizada por partida sobre el conjunto filtrado y visible.",
      headers: tableData.headers,
      rows: tableData.rows,
      totalRow: tableData.totalRow,
    });

    return {
      fileName: "work-schedule-calendario-valorizado.xlsx",
      content: await workbook.xlsx.writeBuffer(),
    };
  }

  if (activeView === "resources") {
    const tableData = buildWorkScheduleResourceWorkbookTableData({
      resourceRows,
      periods,
      currency,
      currencyDecimals,
      scope: resourceWorkbookScope,
    });

    appendWorkbookSheet(workbook, {
      sheetName: "Calendario de insumos",
      title: "PROGRAMACION DE OBRA - CALENDARIO DE INSUMOS",
      subtitle: "Consumo y monto por periodo para los insumos derivados de las partidas filtradas.",
      headers: tableData.headers,
      rows: tableData.rows,
      totalRow: tableData.totalRow,
    });

    return {
      fileName: "work-schedule-calendario-insumos.xlsx",
      content: await workbook.xlsx.writeBuffer(),
    };
  }

  const tableData = buildWorkScheduleCurveWorkbookTableData({
    curvePoints,
    currency,
    currencyDecimals,
    scope: curveWorkbookScope,
  });

  appendWorkbookSheet(workbook, {
    sheetName: "Curva S",
    title: "PROGRAMACION DE OBRA - CURVA S",
    subtitle: "Serie programada mensual y acumulada para el conjunto filtrado.",
    headers: tableData.headers,
    rows: tableData.rows,
    totalRow: tableData.totalRow,
  });

  return {
    fileName: "work-schedule-curva-s.xlsx",
    content: await workbook.xlsx.writeBuffer(),
  };
}

function appendWorkbookSheet(
  workbook: ExcelJS.Workbook,
  {
    sheetName,
    title,
    subtitle,
    headers,
    rows,
    subtotalRowIndexes,
    totalRow,
  }: {
    sheetName: string;
    title: string;
    subtitle: string;
    headers: string[];
    rows: WorkbookCell[][];
    subtotalRowIndexes?: number[];
    totalRow?: WorkbookCell[];
  },
) {
  const worksheet = workbook.addWorksheet(sheetName);
  const lastColumnLetter = getExcelColumnLetter(headers.length);
  worksheet.mergeCells(`A1:${lastColumnLetter}1`);
  worksheet.mergeCells(`A2:${lastColumnLetter}2`);
  worksheet.getCell("A1").value = title;
  worksheet.getCell("A1").font = { bold: true, size: 15, color: { argb: "FF0F172A" } };
  worksheet.getCell("A1").alignment = { horizontal: "center", vertical: "middle" };
  worksheet.getCell("A2").value = subtitle;
  worksheet.getCell("A2").font = { size: 11, color: { argb: "FF475569" } };
  worksheet.getCell("A2").alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  worksheet.addRow(headers);
  for (const row of rows) {
    const worksheetRow = worksheet.addRow(row.map((cell) => cell.value));
    row.forEach((cell, index) => {
      if (cell.numFmt) {
        worksheetRow.getCell(index + 1).numFmt = cell.numFmt;
      }
    });
  }

  const worksheetTotalRow = totalRow ? worksheet.addRow(totalRow.map((cell) => cell.value)) : null;
  if (worksheetTotalRow && totalRow) {
    totalRow.forEach((cell, index) => {
      if (cell.numFmt) {
        worksheetTotalRow.getCell(index + 1).numFmt = cell.numFmt;
      }
    });
  }

  worksheet.getRow(3).font = { bold: true, color: { argb: "FFFFFFFF" } };
  worksheet.getRow(3).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F172A" } };
  worksheet.getRow(3).alignment = { horizontal: "center", vertical: "middle" };
  worksheet.views = [{ state: "frozen", ySplit: 3 }];
  worksheet.autoFilter = `A3:${lastColumnLetter}3`;
  worksheet.columns = headers.map((header, columnIndex) => ({
    width: Math.max(header.length + 4, ...rows.map((row) => getWorkbookCellDisplayWidth(row[columnIndex])), 14),
  }));
  worksheet.eachRow((row) => {
    row.eachCell((cell) => {
      cell.border = {
        top: { style: "thin", color: { argb: "FFE2E8F0" } },
        left: { style: "thin", color: { argb: "FFE2E8F0" } },
        bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
        right: { style: "thin", color: { argb: "FFE2E8F0" } },
      };
    });
  });

  const firstDataRowNumber = 4;
  const lastDataRowNumber = firstDataRowNumber + rows.length - 1;
  for (let rowNumber = firstDataRowNumber; rowNumber <= lastDataRowNumber; rowNumber += 1) {
    const row = worksheet.getRow(rowNumber);
    if ((rowNumber - firstDataRowNumber) % 2 === 0) {
      row.eachCell((cell) => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } };
      });
    }
  }

  const subtotalRowNumbers = new Set((subtotalRowIndexes ?? []).map((index) => firstDataRowNumber + index));
  for (const rowNumber of subtotalRowNumbers) {
    const row = worksheet.getRow(rowNumber);
    row.font = { bold: true, color: { argb: "FF0F172A" } };
    row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE0F2FE" } };
    row.eachCell((cell) => {
      cell.border = {
        top: { style: "thin", color: { argb: "FF0EA5E9" } },
        left: { style: "thin", color: { argb: "FFE2E8F0" } },
        bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
        right: { style: "thin", color: { argb: "FFE2E8F0" } },
      };
    });
  }

  if (worksheetTotalRow) {
    worksheetTotalRow.font = { bold: true, color: { argb: "FF0F172A" } };
    worksheetTotalRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD1FAE5" } };
    worksheetTotalRow.alignment = { vertical: "middle" };
    worksheetTotalRow.eachCell((cell) => {
      cell.border = {
        top: { style: "medium", color: { argb: "FF10B981" } },
        left: { style: "thin", color: { argb: "FFE2E8F0" } },
        bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
        right: { style: "thin", color: { argb: "FFE2E8F0" } },
      };
    });
  }
}

function getWorkbookCellDisplayWidth(cell: WorkbookCell | undefined) {
  if (!cell) {
    return 14;
  }

  return String(cell.value).length + 2;
}

function getResourceWorkbookFamilyCode(resourceCode: string) {
  const [familyCode] = resourceCode.split("-");
  return familyCode?.trim() || "Sin grupo";
}

function buildWorkbookDecimalFormat(decimalPlaces: number) {
  if (decimalPlaces <= 0) {
    return "#,##0";
  }

  return `#,##0.${"0".repeat(decimalPlaces)}`;
}

function createWorkbookCurrencyNumberFormat(currency: string, decimalPlaces: number) {
  return `${resolveWorkbookCurrencySymbol(currency)} ${buildWorkbookDecimalFormat(decimalPlaces)}`;
}

function resolveWorkbookCurrencySymbol(currency: string) {
  if (currency === "USD") return "$";
  if (currency === "PEN") return "S/";
  if (currency === "EUR") return "EUR";
  return currency;
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

function buildCsvContent(headers: string[], rows: string[][]) {
  return [headers, ...rows].map((row) => row.map(escapeCsvValue).join(",")).join("\n");
}

function escapeCsvValue(value: string) {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replaceAll('"', '""')}"`;
  }

  return value;
}

function downloadTextFile(fileName: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  downloadBlob(fileName, blob);
}

function downloadBinaryFile(fileName: string, content: BlobPart, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  downloadBlob(fileName, blob);
}

function downloadBlob(fileName: string, blob: Blob) {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(objectUrl);
}

function formatTimelineRange(startDate: string | null, endDate: string | null, dateFormat: string) {
  if (!startDate || !endDate) {
    return "Pendiente";
  }

  return `${formatDate(startDate, dateFormat as never)} - ${formatDate(endDate, dateFormat as never)}`;
}

function createEditableLine(
  line: WorkScheduleLineRecord,
  itemCodeToRowNumber: Map<string, number> = new Map<string, number>(),
): EditableLine {
  const fallbackDistributions =
    line.monthlyDistributions.length > 0
      ? line.monthlyDistributions.map((distribution) => ({ ...distribution }))
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
    },
    {},
  );
}

function serializeEditableLine(line: EditableLine, rowNumberToItemCode: Map<number, string> = new Map<number, string>()) {
  return {
    budgetItemId: line.budgetItemId,
    startDate: line.startDate,
    endDate: line.endDate,
    durationDays: Number(line.durationDays),
    predecessor: formatPredecessorForStorage(line.predecessor, rowNumberToItemCode),
    crew: parseEditableCrew(line.crew) ?? 1,
    monthlyDistributions: line.monthlyDistributions.map((distribution) => ({
      year: distribution.year,
      month: distribution.month,
      percentage: Number(distribution.percentage),
    })),
  };
}

function formatPredecessorForDisplay(value: string, itemCodeToRowNumber: Map<string, number>) {
  const normalizedValue = value.trim();
  if (!normalizedValue) {
    return "";
  }

  try {
    return parseWorkSchedulePredecessors(normalizedValue)
      .map((reference) => {
        const rowNumber = itemCodeToRowNumber.get(reference.code);
        return formatPredecessorReference(rowNumber ? String(rowNumber) : reference.code, reference.relation, reference.lagDays);
      })
      .join(",");
  } catch {
    return normalizedValue;
  }
}

function formatPredecessorForStorage(value: string, rowNumberToItemCode: Map<number, string>) {
  const normalizedValue = value.trim();
  if (!normalizedValue) {
    return "";
  }

  try {
    return parseWorkSchedulePredecessors(normalizedValue)
      .map((reference) => {
        const parsedRowNumber = Number(reference.code);
        const itemCode =
          Number.isInteger(parsedRowNumber) && String(parsedRowNumber) === reference.code
            ? rowNumberToItemCode.get(parsedRowNumber) ?? reference.code
            : reference.code;

        return formatPredecessorReference(itemCode, reference.relation, reference.lagDays);
      })
      .join(",");
  } catch {
    return normalizedValue;
  }
}

function formatPredecessorReference(code: string, relation: string, lagDays: number) {
  const lagLabel = lagDays === 0 ? "" : `${lagDays > 0 ? "+" : "-"}${Math.abs(lagDays)}d`;
  return `${code}${relation}${lagLabel}`;
}

function formatPredecessorToken(code: string, relation: string, lagDays: number) {
  if (lagDays === 0) {
    return `${code}${relation}`;
  }

  const sign = lagDays > 0 ? "+" : "";
  return `${code}${relation}${sign}${lagDays}d`;
}

function createNextDistribution(distributions: WorkScheduleMonthlyDistributionRecord[]) {
  const lastDistribution = distributions[distributions.length - 1];
  if (!lastDistribution) {
    const currentDate = new Date();
    return {
      year: currentDate.getUTCFullYear(),
      month: currentDate.getUTCMonth() + 1,
      percentage: 100,
    };
  }

  const nextMonth = lastDistribution.month === 12 ? 1 : lastDistribution.month + 1;
  const nextYear = lastDistribution.month === 12 ? lastDistribution.year + 1 : lastDistribution.year;

  return {
    year: nextYear,
    month: nextMonth,
    percentage: 0,
  };
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

function updateEditableLineDates(
  line: EditableLine,
  changes: Partial<Pick<EditableLine, "startDate" | "endDate">>,
) {
  const nextLine = {
    ...line,
    ...changes,
  };

  if (nextLine.startDate) {
    if (!nextLine.endDate || compareIsoDates(nextLine.endDate, nextLine.startDate) < 0) {
      nextLine.endDate = nextLine.startDate;
    }

    if (shouldHydrateInitialDistribution(line)) {
      nextLine.monthlyDistributions = buildInitialDistributionsFromRange(nextLine.startDate, nextLine.endDate);
    }
  }

  if (!nextLine.startDate || !nextLine.endDate) {
    return {
      ...nextLine,
      durationDays: 0,
    };
  }

  const durationDays = calculateInclusiveDurationDays(nextLine.startDate, nextLine.endDate);

  return {
    ...nextLine,
    durationDays,
  };
}

function updateEditableLineDuration(line: EditableLine, durationDays: number) {
  const normalizedDuration = Number.isFinite(durationDays) ? Math.max(0, Math.trunc(durationDays)) : 0;
  if (!line.startDate || normalizedDuration <= 0) {
    return {
      ...line,
      durationDays: normalizedDuration,
    };
  }

  const endDate = addIsoDays(line.startDate, normalizedDuration - 1);

  return {
    ...line,
    endDate,
    durationDays: normalizedDuration,
    monthlyDistributions: shouldHydrateInitialDistribution(line)
      ? buildInitialDistributionsFromRange(line.startDate, endDate)
      : line.monthlyDistributions,
  };
}

function updateEditableLineCrew(line: EditableLine, crew: string) {
  const nextLine = {
    ...line,
    crew,
  };
  const parsedCrew = parseEditableCrew(crew);
  const durationDays =
    parsedCrew == null
      ? null
      : calculateWorkScheduleDurationDays({
          quantity: line.quantity,
          performance: line.performance,
          crew: parsedCrew,
        });

  if (durationDays == null) {
    return nextLine;
  }

  return updateEditableLineDuration(nextLine, durationDays);
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

function parseEditableCrew(value: string) {
  const normalizedValue = value.trim();

  if (!normalizedValue) {
    return null;
  }

  const parsedValue = Number(normalizedValue);
  return Number.isFinite(parsedValue) ? parsedValue : null;
}

function calculateInclusiveDurationDays(startDate: string, endDate: string) {
  const start = new Date(`${startDate}T00:00:00.000Z`);
  const end = new Date(`${endDate}T00:00:00.000Z`);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return 0;
  }

  const millisecondsPerDay = 1000 * 60 * 60 * 24;
  const diff = Math.round((end.getTime() - start.getTime()) / millisecondsPerDay);
  return diff >= 0 ? diff + 1 : 0;
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
