"use client";

import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type FocusEvent as ReactFocusEvent, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent, type UIEvent as ReactUIEvent } from "react";
import { CalendarDays, ChartSpline, ChevronDown, Diamond, Info, MoreHorizontal, Package2, PenLine, PenSquare, Save, WandSparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { cn, formatCurrency, formatDate, formatNumber } from "@/lib/utils";
import { calculateWorkScheduleDurationDays } from "@/lib/calculations/work-schedule";
import { countWorkDays } from "@/lib/work-schedule/calendar";
import { parseWorkSchedulePredecessors, tryParseWorkSchedulePredecessors } from "@/lib/work-schedule/predecessors";
import { TimelineRow as GanttTimelineRow } from "@/components/budget/gantt/timeline-row";
import { GanttConnectionOverlay } from "@/components/budget/gantt/gantt-connection-overlay";
import { DependencyEditPopover } from "@/components/budget/gantt/dependency-edit-popover";
import { GanttMiniMap } from "@/components/budget/gantt/gantt-minimap";
import { useGanttConnectionMode, type LinePosition, type WorkSchedulePredecessorRelation } from "@/components/budget/gantt/use-gantt-connection-mode";
import type { GanttBarChangeResult } from "@/components/budget/gantt/gantt-utils";
import { useFormattingSettings } from "@/components/providers/formatting-settings-provider";
import { useAppViewMode } from "@/components/view-mode/app-view-mode-provider";
import type { DateFormatOption } from "@/types/settings";
import {
  clampWorkScheduleTimelinePanelWidth,
  DEFAULT_WORK_SCHEDULE_TIMELINE_PANEL_WIDTH,
  WORK_SCHEDULE_TIMELINE_PANEL_WIDTH_COOKIE_NAME,
} from "@/lib/work-schedule/overview-panel-width";
import type { EditableLine, VisibleTimelineLinePosition } from "./types";
import { getOverviewMeasuredHeightsStorageKey, sanitizeMeasuredHeightsMap, compareIsoDates, shouldHydrateInitialDistribution, buildInitialDistributionsFromRange, addIsoDays } from "./utils/overview-helpers";
import type {
  WorkScheduleLineRecord,
  WorkScheduleDisplayRowRecord,
  WorkScheduleMonthlyDistributionRecord,
  WorkScheduleViewRecord,
} from "@/types/work-schedule";

// ─── Local types & constants ────────────────────────────────────────────────

export type OverviewFilter = "all" | "pending" | "incomplete_distribution" | "scheduled";

export const dayFormatter = new Intl.DateTimeFormat("es-PE", { weekday: "short", timeZone: "UTC" });
export const timelineWeekFormatter = new Intl.DateTimeFormat("es-PE", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

export const DEFAULT_OVERVIEW_TIMELINE_PANEL_WIDTH = DEFAULT_WORK_SCHEDULE_TIMELINE_PANEL_WIDTH;
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
  actualStart: 118,
  actualEnd: 118,
  progress: 80,
  predecessor: 100,
  crew: 92,
  performance: 118,
  unit: 84,
  quantity: 88,
  unitPrice: 98,
  partial: 110,
  action: 168,
} as const;

export type TimelineDay = {
  iso: string;
  date: Date;
};



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

type OverviewMeasuredHeightsCache = {
  groups: Record<string, number>;
  lines: Record<string, number>;
};

// ─── Extracted functions ───────────────────────────────────────────────────



export function WorkScheduleOverview({
  data,
  isExcelMode,
  timelineDays,
  hasDailyTimeline,
  dateFormat,
  currencyDecimals,
  predecessorItemCodeToRowNumber,
  collapsedGroups,
  collapsedLevelIds,
  onToggleGroup,
  onToggleCollapsedLevel,
  onCollapseAll,
  onExpandAll,
  overviewFilter,
  onOverviewFilterChange,
  showCriticalPath,
  onShowCriticalPathChange,
  nearCriticalSlackDays,
  onNearCriticalSlackDaysChange,
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
  hoveredItemCode,
  onHoverItemCode,
}: {
  data: WorkScheduleViewRecord;
  isExcelMode: boolean;
  timelineDays: TimelineDay[];
  hasDailyTimeline: boolean;
  dateFormat: DateFormatOption;
  currencyDecimals: number;
  predecessorItemCodeToRowNumber: Map<string, number>;
  collapsedGroups: Record<string, boolean>;
  collapsedLevelIds: Record<string, boolean>;
  onToggleGroup: (subBudgetId: string) => void;
  onToggleCollapsedLevel: (rowId: string) => void;
  onCollapseAll: () => void;
  onExpandAll: () => void;
  overviewFilter: OverviewFilter;
  onOverviewFilterChange: (filter: OverviewFilter) => void;
  showCriticalPath: boolean;
  onShowCriticalPathChange: (visible: boolean) => void;
  nearCriticalSlackDays: number;
  onNearCriticalSlackDaysChange: (days: number) => void;
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
  hoveredItemCode?: string | null;
  onHoverItemCode?: (itemCode: string | null) => void;
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
  // Live width of the horizontal scroll container, observed through a
  // ResizeObserver so the GanttMiniMap viewport indicator stays in sync
  // with the actual layout (padding, resize-handle width, runtime
  // resizing) instead of a static timelinePanelWidth - 24 calculation.
  const [scrollContainerWidth, setScrollContainerWidth] = useState(0);

  useEffect(() => {
    const node = scrollContainerRef.current;
    if (!node || typeof ResizeObserver === "undefined") {
      return;
    }
    const update = () => {
      setScrollContainerWidth(node.clientWidth);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => {
      observer.disconnect();
    };
  }, []);
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
  const [scrollLeft, setScrollLeft] = useState(0);
  const latestVerticalScrollTopRef = useRef(0);
  const leftTableViewportWidthRef = useRef<number | null>(null);
  const OVERVIEW_TIMELINE_RIGHT_OFFSET = 16;
  const leftTableViewportStyle = useMemo(
    () =>
      leftTableViewportWidth
        ? { width: `${leftTableViewportWidth}px`, maxWidth: "100%" }
        : {
            width: `max(calc(100% - var(${OVERVIEW_TIMELINE_PANEL_WIDTH_CSS_VAR}, ${timelinePanelWidth}px) - ${OVERVIEW_TIMELINE_RIGHT_OFFSET}px), 240px)`,
            maxWidth: "100%",
          },
    [leftTableViewportWidth, timelinePanelWidth],
  );
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
  const handleUnhoverBar = useCallback(() => {
    onHoverItemCode?.(null);
  }, [onHoverItemCode]);
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

    // Build set of line IDs hidden by collapsed levels
    const hiddenLineIds = new Set<string>();
    for (const group of visibleGroups) {
      for (const row of group.rows) {
        if (row.kind === "level" && collapsedLevelIds[row.rowId] === true) {
          for (const id of row.childLineIds) {
            hiddenLineIds.add(id);
          }
        }
      }
    }

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
        if (row.kind === "level") {
          // Skip level rows that are inside a collapsed parent level
          const isNestedInCollapsedParent =
            row.childLineIds.length > 0 &&
            collapsedLevelIds[row.rowId] !== true &&
            row.childLineIds.some((id) => hiddenLineIds.has(id));
          if (isNestedInCollapsedParent) {
            continue;
          }
        } else if (row.kind === "line") {
          // Skip line rows hidden by a collapsed level
          if (hiddenLineIds.has(row.line.budgetItemId)) {
            continue;
          }
        }
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
  }, [collapsedGroups, collapsedLevelIds, tableGroupHeights, tableLineHeights, visibleGroups]);
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
      OVERVIEW_TABLE_COLUMN_WIDTHS.actualStart,
      OVERVIEW_TABLE_COLUMN_WIDTHS.actualEnd,
      OVERVIEW_TABLE_COLUMN_WIDTHS.progress,
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

  // Pre-compute path key → predecessor/successor code mapping for hover highlighting
  const dependencyPathCodeMap = useMemo(() => {
    const budgetIdToCode = new Map(allLines.map((l) => [l.budgetItemId, l.itemCode]));
    const result = new Map<string, { predecessorCode: string; successorCode: string }>();
    for (const path of timelineDependencyPaths) {
      const key = path.key;
      const parts = key.split("-");
      if (parts.length >= 4) {
        const predCode = parts[parts.length - 3];
        const budgetId = parts.slice(0, parts.length - 3).join("-");
        const succCode = budgetIdToCode.get(budgetId) ?? "";
        result.set(key, { predecessorCode: predCode, successorCode: succCode });
      }
    }
    return result;
  }, [allLines, timelineDependencyPaths]);

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

    const currentScrollLeft = scrollContainerRef.current.scrollLeft;

    if (pendingScrollWriteFrameRef.current !== null) {
      window.cancelAnimationFrame(pendingScrollWriteFrameRef.current);
    }

    pendingScrollWriteFrameRef.current = window.requestAnimationFrame(() => {
      setScrollLeft(currentScrollLeft);
      writeOverviewScrollPosition(data.budgetId, currentScrollLeft);
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

  useLayoutEffect(() => {
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
              {showCriticalPath ? (
                <label className="flex h-9 items-center gap-1.5 rounded-md border border-[var(--app-border)] bg-[var(--app-surface)] px-2.5 text-xs font-medium text-[var(--app-text)]">
                  <span>Holgura ≤</span>
                  <input
                    type="number"
                    min={0}
                    max={999}
                    value={nearCriticalSlackDays || ""}
                    placeholder="0"
                    onChange={(e) => onNearCriticalSlackDaysChange?.(Number(e.target.value) || 0)}
                    className="w-12 rounded border border-[var(--app-border)] bg-[var(--app-surface-muted)] px-1.5 py-0.5 text-center text-xs font-medium text-[var(--app-text)] [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  />
                  <span>días</span>
                </label>
              ) : null}
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
          className="max-h-[85vh] overflow-y-auto px-4 pb-2"
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
                style={leftTableViewportStyle}
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
                        <TH className={cn(OVERVIEW_HEADER_HEIGHT_CLASS, "py-0 align-middle")}>Inicio real</TH>
                        <TH className={cn(OVERVIEW_HEADER_HEIGHT_CLASS, "py-0 align-middle")}>Fin real</TH>
                        <TH className={cn(OVERVIEW_HEADER_HEIGHT_CLASS, "py-0 align-middle")}>% Avance</TH>
                        <TH className={cn(OVERVIEW_HEADER_HEIGHT_CLASS, "py-0 align-middle")}>Predecesora</TH>
                        <TH className={cn(OVERVIEW_HEADER_HEIGHT_CLASS, "py-0 align-middle")}>Cuadrilla</TH>
                        <TH className={cn(OVERVIEW_HEADER_HEIGHT_CLASS, "py-0 align-middle")}>Rendimiento</TH>
                        <TH className={cn(OVERVIEW_HEADER_HEIGHT_CLASS, "py-0 align-middle")}>Unidad</TH>
                        <TH className={cn(OVERVIEW_HEADER_HEIGHT_CLASS, "py-0 align-middle")}>Metrado</TH>
                        {showCostColumns ? <TH className={cn(OVERVIEW_HEADER_HEIGHT_CLASS, "py-0 align-middle")}>PU</TH> : null}
                        {showCostColumns ? <TH className={cn(OVERVIEW_HEADER_HEIGHT_CLASS, "py-0 align-middle")}>Parcial</TH> : null}
                        <TH className={cn(OVERVIEW_HEADER_HEIGHT_CLASS, "w-[168px] py-0 text-right align-middle")}>Accion</TH>
                      </TR>
                    </THead>
                    <TBody>
                      {overviewVirtualWindow.topSpacerHeight > 0 ? (
                        <TR aria-hidden="true">
                          <TD colSpan={showCostColumns ? 17 : 15} className="p-0" style={{ height: overviewVirtualWindow.topSpacerHeight }} />
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
                            nearCriticalSlackDays={nearCriticalSlackDays}
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
                            itemCodeToRowNumber={predecessorItemCodeToRowNumber}
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
                            collapsed={collapsedLevelIds[item.row.rowId] === true}
                            onToggleCollapsed={onToggleCollapsedLevel}
                            onRegisterRow={setLineRowRef}
                          />
                        ),
                      )}
                      {overviewVirtualWindow.bottomSpacerHeight > 0 ? (
                        <TR aria-hidden="true">
                          <TD colSpan={showCostColumns ? 17 : 15} className="p-0" style={{ height: overviewVirtualWindow.bottomSpacerHeight }} />
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
                "absolute right-0 top-0 bottom-0 z-30 flex flex-col overflow-hidden border bg-[var(--app-surface)]",
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
                <>
                <div
                  ref={scrollContainerRef}
                  data-testid="work-schedule-overview-scroll"
                  className="min-h-0 flex-1 overflow-x-auto overflow-y-hidden pl-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
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
                          {timelineDependencyPaths.map((path) => {
                            const pathKey = path.key;
                            const codes = dependencyPathCodeMap.get(pathKey);
                            const isRelated = codes != null && hoveredItemCode != null && (
                              hoveredItemCode === codes.predecessorCode || hoveredItemCode === codes.successorCode
                            );
                            const isDimmed = hoveredItemCode != null && !isRelated;                              return (
                                <g key={pathKey}>
                                  <path
                                    d={path.d}
                                    fill="none"
                                    stroke="transparent"
                                    strokeWidth={12}
                                    strokeLinejoin="round"
                                    className="pointer-events-auto cursor-pointer"
                                    onClick={(event) => {
                                const codes = dependencyPathCodeMap.get(path.key);
                                if (!codes) return;
                                const sourceCode = codes.predecessorCode;
                                const targetCode = codes.successorCode;
                                const parts = path.key.split("-");
                                if (parts.length < 4) return;
                                const relation = parts[parts.length - 2] as WorkSchedulePredecessorRelation;
                                const lagDays = Number(parts[parts.length - 1]) || 0;
                                const svgRect = event.currentTarget.closest("svg")?.getBoundingClientRect();
                                setEditingDependency({
                                  sourceCode,
                                  targetCode,
                                  sourceItemCode: sourceCode,
                                  targetItemCode: targetCode,
                                  currentRelation: relation,
                                  currentLagDays: lagDays,
                                  x: svgRect ? event.clientX - svgRect.left : event.clientX,
                                  y: svgRect ? event.clientY - svgRect.top : event.clientY,
                                });
                              }}
                            />
                            <path
                              d={path.d}
                              fill="none"
                              stroke={isRelated ? "#2563EB" : "#64748b"}
                              strokeWidth={isRelated ? 2.5 : 1.5}
                              strokeLinejoin="round"
                              markerEnd="url(#work-schedule-dependency-arrowhead)"
                              className={cn(
                                "pointer-events-auto transition-all duration-150",
                                isRelated ? "opacity-100" : isDimmed ? "opacity-20" : "hover:stroke-sky-500 hover:stroke-[2.5] opacity-60",
                              )}
                            />
                                </g>
                          );
                        }
                      )}
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
                            nearCriticalSlackDays={nearCriticalSlackDays}
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
                            onHoverBar={onHoverItemCode}
                            onUnhoverBar={handleUnhoverBar}
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
                <div
                  data-testid="gantt-minimap-wrapper"
                  className={cn(
                    "shrink-0 border-t border-[var(--app-border-soft)] bg-[var(--app-surface-muted)] px-3 py-2",
                    isExcelMode ? "border-[var(--app-border-strong)]" : "border-[var(--app-border-soft)]",
                  )}
                >
                  <div className="mb-1 flex items-center justify-between gap-3 text-[var(--app-text-muted)]">
                    <span className="text-[10px] font-semibold uppercase tracking-wide">Mini-mapa del cronograma</span>
                    <span className="text-[10px] font-normal tracking-normal">Arrastra o haz clic para navegar</span>
                  </div>
                  <GanttMiniMap
                    allLines={allLines}
                    timelineDayIndexByIso={timelineDayIndexByIso}
                    timelineContentWidth={timelineContentWidth}
                    timelineDayCount={timelineDays.length}
                    scrollLeft={scrollLeft}                          viewportWidth={scrollContainerWidth || Math.max(120, timelinePanelWidth - 24)}
                          // Fallback (constant subtraction) only fires before the ResizeObserver
                          // commits the first measurement; afterwards the live clientWidth wins.
                    showCriticalPath={showCriticalPath}
                    nearCriticalSlackDays={nearCriticalSlackDays}                          onScrollTo={(targetScrollLeft) => {
                            if (scrollContainerRef.current) {
                              scrollContainerRef.current.scrollLeft = targetScrollLeft;
                            }
                            if (timelineBottomScrollRef.current) {
                              timelineBottomScrollRef.current.scrollLeft = targetScrollLeft;
                            }
                            // Update React state synchronously so the GanttMiniMap
                            // viewport indicator tracks the drag in real time.
                            // The DOM-level scrollLeft assignment alone updates the
                            // gantt content, but the React state would otherwise
                            // only commit on the next rAF committed by the browser-
                            // fired `scroll` event in handleOverviewScroll, and a
                            // continuous drag cancels that rAF on every pointermove
                            // before it can fire — leaving the indicator stuck.
                            setScrollLeft(targetScrollLeft);
                          }}
                  />
                </div>
                </>
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
              style={leftTableViewportStyle}
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


type WorkScheduleLineTableRowProps = {
  line: WorkScheduleLineRecord;
  rowNumber: number | null;
  displayPredecessor: string;
  dateFormat: string;
  currency: string;
  currencyDecimals: number;
  showCostColumns: boolean;
  showCriticalPath: boolean;
  nearCriticalSlackDays: number;
  highlighted: boolean;
  onEditLine: (line: WorkScheduleLineRecord) => void;
  onRegisterRow: (rowId: string, element: HTMLElement | null) => void;
  inlineDraft: EditableLine | null;
  isInlineActive: boolean;
  inlineSaveState: "idle" | "saving" | "error";
  inlineError: string;
  onActivateInlineRow: (line: WorkScheduleLineRecord) => void;
  onInlineDraftChange: (rowId: string, draft: EditableLine) => void;
  onInlinePredecessorChange: (rowId: string, line: EditableLine, predecessor: string) => void;
  onInlineRowSave: (rowId: string) => void;
  onInlineRowCancel: (rowId: string) => void;
  itemCodeToRowNumber: Map<string, number>;
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
  nearCriticalSlackDays,
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
  itemCodeToRowNumber,
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
      data-critical={showCriticalPath && line.criticalPath?.isCritical ? "true" : (showCriticalPath && line.criticalPath && line.criticalPath.totalSlackDays > 0 && line.criticalPath.totalSlackDays <= nearCriticalSlackDays ? "near" : "false")}
      className={cn(
        showCriticalPath && line.criticalPath?.isCritical ? "bg-rose-50/80 dark:bg-rose-500/10" : (showCriticalPath && line.criticalPath && line.criticalPath.totalSlackDays > 0 && line.criticalPath.totalSlackDays <= nearCriticalSlackDays ? "bg-amber-50/80 dark:bg-amber-500/10" : ""),
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
              {showCriticalPath && line.criticalPath ? (() => {
                const ncDays = line.criticalPath.totalSlackDays;
                const isNearCritical = ncDays > 0 && ncDays <= nearCriticalSlackDays;
                if (line.criticalPath.isCritical) {
                  return (
                    <span
                      data-testid={`work-schedule-critical-badge-${line.budgetItemId}`}
                      className="theme-status-error shrink-0 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold dark:text-rose-200"
                      title={`Holgura total: ${ncDays} dias`}
                    >
                      Critica
                    </span>
                  );
                }
                if (isNearCritical) {
                  return (
                    <span
                      data-testid={`work-schedule-near-critical-badge-${line.budgetItemId}`}
                      className="theme-status-warning shrink-0 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold dark:text-amber-200"
                      title={`Casi critica · Holgura: ${ncDays} dias`}
                    >
                      ±{ncDays}d
                    </span>
                  );
                }
                return null;
              })() : null}
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
          <WorkScheduleDateInput
            label="Inicio"
            value={inlineDraft.startDate}
            dateFormat={dateFormat as DateFormatOption}
            compact
            onKeyDown={handleInlineKeyDown}
            onChange={(value) => onInlineDraftChange(inlineRowId, updateEditableLineDates(inlineDraft, { startDate: value }))}
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
          <WorkScheduleDateInput
            label="Fin"
            value={inlineDraft.endDate}
            dateFormat={dateFormat as DateFormatOption}
            compact
            onKeyDown={handleInlineKeyDown}
            onChange={(value) => onInlineDraftChange(inlineRowId, updateEditableLineDates(inlineDraft, { endDate: value }))}
          />
        ) : (
          line.endDate ? formatDate(line.endDate, dateFormat as never) : "Pendiente"
        )}
      </TD>
      <TD
        className="align-middle"
        data-testid={`work-schedule-inline-cell-actualStartDate-${line.budgetItemId}`}
        onClick={() => onActivateInlineRow(line)}
      >
        {isInlineActive && inlineDraft ? (
          <WorkScheduleDateInput
            label="Inicio real"
            value={inlineDraft.actualStartDate ?? ""}
            dateFormat={dateFormat as DateFormatOption}
            compact
            onKeyDown={handleInlineKeyDown}
            onChange={(value) => onInlineDraftChange(inlineRowId, { ...inlineDraft, actualStartDate: value || null })}
          />
        ) : (
          line.actualStartDate ? formatDate(line.actualStartDate, dateFormat as never) : "-"
        )}
      </TD>
      <TD
        className="align-middle"
        data-testid={`work-schedule-inline-cell-actualEndDate-${line.budgetItemId}`}
        onClick={() => onActivateInlineRow(line)}
      >
        {isInlineActive && inlineDraft ? (
          <WorkScheduleDateInput
            label="Fin real"
            value={inlineDraft.actualEndDate ?? ""}
            dateFormat={dateFormat as DateFormatOption}
            compact
            onKeyDown={handleInlineKeyDown}
            onChange={(value) => onInlineDraftChange(inlineRowId, { ...inlineDraft, actualEndDate: value || null })}
          />
        ) : (
          line.actualEndDate ? formatDate(line.actualEndDate, dateFormat as never) : "-"
        )}
      </TD>
      <TD
        className="align-middle"
        data-testid={`work-schedule-inline-cell-percentComplete-${line.budgetItemId}`}
        onClick={() => onActivateInlineRow(line)}
      >
        {isInlineActive && inlineDraft ? (
          <Input
            type="number"
            min="0"
            max="100"
            value={inlineDraft.percentComplete ?? ""}
            onKeyDown={handleInlineKeyDown}
            onChange={(event) => {
              const value = event.target.value === "" ? null : Math.min(100, Math.max(0, Number(event.target.value)));
              onInlineDraftChange(inlineRowId, { ...inlineDraft, percentComplete: value });
            }}
          />
        ) : (
          line.percentComplete != null ? `${formatNumber(line.percentComplete, 0)}%` : "-"
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
        <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
          <Button
            variant="outline"
            size="sm"
            className={cn(
              "h-7 px-2 text-[11px]",
              (isInlineActive && inlineDraft ? inlineDraft.isMilestone : line.isMilestone) &&
                "border-violet-300 bg-violet-100 text-violet-700 hover:bg-violet-200 dark:border-violet-700 dark:bg-violet-500/10 dark:text-violet-300",
            )}
            onClick={() => {
              if (isInlineActive && inlineDraft) {
                onInlineDraftChange(inlineRowId, { ...inlineDraft, isMilestone: !inlineDraft.isMilestone });
              } else {
                const draft = createQuickToggleDraft(line, itemCodeToRowNumber);
                draft.isMilestone = !(line.isMilestone ?? false);
                onInlineDraftChange(inlineRowId, draft);
              }
            }}
            title={line.isMilestone ? "Desmarcar como hito" : "Marcar como hito"}
          >
            <Diamond className="mr-1 h-3 w-3" aria-hidden="true" />
            Hito
          </Button>
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
  collapsed: boolean;
  onToggleCollapsed: (rowId: string) => void;
  onRegisterRow: (rowId: string, element: HTMLElement | null) => void;
};

const WorkScheduleLevelTableRow = memo(function WorkScheduleLevelTableRow({
  row,
  rowNumber,
  dateFormat,
  currency,
  currencyDecimals,
  showCostColumns,
  collapsed,
  onToggleCollapsed,
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
        <div className="flex min-w-0 items-center gap-1 overflow-hidden whitespace-nowrap">
          <button
            type="button"
            onClick={() => onToggleCollapsed(row.rowId)}
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[var(--app-text-muted)] transition hover:bg-[var(--app-surface-hover-strong)] hover:text-[var(--app-text-strong)] focus-visible:outline-none"
            aria-label={collapsed ? "Expandir" : "Contraer"}
          >
            <ChevronDown
              className={cn(
                "h-3.5 w-3.5 transition-transform",
                collapsed ? "-rotate-90" : "rotate-0",
              )}
            />
          </button>
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
              "flex items-center justify-center px-1.5 text-center text-[11px] font-semibold",
              timelineDayWidth >= MIN_LEGIBLE_TIMELINE_DAY_WIDTH_PX ? "h-5 text-[11px]" : "h-[72px] text-sm",
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
      {timelineDayWidth >= MIN_LEGIBLE_TIMELINE_DAY_WIDTH_PX ? (
        <>
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
        </>
      ) : null}
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
    previousProps.nearCriticalSlackDays === nextProps.nearCriticalSlackDays &&
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
    previousProps.itemCodeToRowNumber === nextProps.itemCodeToRowNumber &&
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
    previousProps.collapsed === nextProps.collapsed &&
    previousProps.onToggleCollapsed === nextProps.onToggleCollapsed &&
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


export function WorkScheduleDateInput({
  label,
  value,
  dateFormat,
  onChange,
  onKeyDown,
  compact = false,
}: {
  label: string;
  value: string;
  dateFormat: DateFormatOption;
  onChange: (value: string) => void;
  onKeyDown?: (event: ReactKeyboardEvent<HTMLInputElement>) => void;
  compact?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  const openPicker = useCallback(() => {
    const input = inputRef.current;
    if (!input) {
      return;
    }

    if ("showPicker" in input && typeof input.showPicker === "function") {
      input.showPicker();
      return;
    }

    input.focus();
    input.click();
  }, []);

  return (
    <div className="relative">
      <Input
        ref={inputRef}
        type="date"
        value={value}
        aria-label={label}
        tabIndex={-1}
        onKeyDown={onKeyDown}
        onChange={(event) => onChange(event.target.value)}
        className="sr-only"
      />
      <Button
        type="button"
        variant="outline"
        onClick={openPicker}
        className={cn(
          "w-full justify-start gap-2 text-left font-normal",
          compact ? "h-9 rounded-lg px-2.5 text-xs" : "h-10 rounded-xl px-3 text-sm",
          !value && "text-[var(--app-text-muted)]",
        )}
      >
        <CalendarDays className={cn("shrink-0", compact ? "h-3.5 w-3.5" : "h-4 w-4")} />
        <span className="truncate">{value ? formatDate(value, dateFormat) : "Seleccionar fecha"}</span>
      </Button>
    </div>
  );
}


export function buildTimelineDays(startDate: string | null, endDate: string | null): TimelineDay[] {
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


export function buildTimelineDependencyConnector({
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
  const sourceUsesEnd = predecessorReference.relation === "FS" || predecessorReference.relation === "FF";
  const targetUsesStart = predecessorReference.relation === "FS" || predecessorReference.relation === "SS";
  const sameDayOrNextDayDelta = (leftIndex: number, rightIndex: number) => rightIndex - leftIndex;
  const isSameDayHandoff =
    (predecessorReference.relation === "FS" &&
      sameDayOrNextDayDelta(predecessorEndIndex, successorStartIndex) <= 1) ||
    (predecessorReference.relation === "SS" &&
      sameDayOrNextDayDelta(predecessorStartIndex, successorStartIndex) <= 1) ||
    (predecessorReference.relation === "FF" &&
      sameDayOrNextDayDelta(predecessorEndIndex, successorEndIndex) <= 1) ||
    (predecessorReference.relation === "SF" &&
      sameDayOrNextDayDelta(predecessorStartIndex, successorEndIndex) <= 1);

  const sourceX = sourceUsesEnd ? predecessorEndX : predecessorStartX;
  const targetX = targetUsesStart ? successorStartX : successorEndX;
  const targetApproachX = targetUsesStart ? Math.max(0, targetX - arrowOffset) : targetX + arrowOffset;
  const preferredSourceElbowX = sourceUsesEnd ? sourceX + elbowOffset : sourceX - elbowOffset;
  const elbowX = targetUsesStart
    ? Math.min(preferredSourceElbowX, targetApproachX - minimumFinalSegment)
    : Math.max(preferredSourceElbowX, targetApproachX + minimumFinalSegment);

  if (!isSameDayHandoff) {
    return `M ${sourceX} ${predecessorY} H ${elbowX} V ${successorY} H ${targetApproachX} H ${targetX}`;
  }

  const sourceExitX = sourceUsesEnd
    ? Math.max(sourceX + sourceExitOffset, elbowX + elbowOffset)
    : Math.min(sourceX - sourceExitOffset, elbowX - elbowOffset);
  const breakY = predecessorY + (successorY >= predecessorY ? sourceDropOffset : -sourceDropOffset);

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


function getOverviewScrollStorageKey(budgetId: string) {
  return `work-schedule-overview-scroll:${budgetId}`;
}


function getOverviewTimelinePanelWidthStorageKey(budgetId: string) {
  return `work-schedule-overview-timeline-panel-width:${budgetId}`;
}


function getOverviewCostColumnsVisibilityStorageKey(budgetId: string) {
  return `work-schedule-overview-cost-columns:${budgetId}`;
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

  return Math.min(clampWorkScheduleTimelinePanelWidth(width), maxWidth);
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

  const bootstrappedCssWidth = readOverviewTimelinePanelWidthCssVariable();
  if (bootstrappedCssWidth !== null) {
    return bootstrappedCssWidth;
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
  if (typeof document !== "undefined") {
    try {
      document.cookie = `${WORK_SCHEDULE_TIMELINE_PANEL_WIDTH_COOKIE_NAME}=${normalizedWidth}; path=/; max-age=31536000; samesite=lax`;
    } catch {
      // Ignore cookie persistence failures and keep localStorage as the source of truth fallback.
    }
  }
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


function readOverviewTimelinePanelWidthCssVariable() {
  if (typeof document === "undefined") {
    return null;
  }

  const rawValue = document.documentElement.style.getPropertyValue(OVERVIEW_TIMELINE_PANEL_WIDTH_CSS_VAR).trim();
  if (!rawValue) {
    return null;
  }

  const parsedValue = Number.parseFloat(rawValue.replace("px", ""));
  if (!Number.isFinite(parsedValue)) {
    return null;
  }

  return clampOverviewTimelinePanelWidth(parsedValue, null);
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


export function isPendingWorkScheduleLine(line: WorkScheduleLineRecord) {
  if (!line.startDate || !line.endDate || line.durationDays == null) {
    return true;
  }

  if (line.monthlyDistributions.length === 0) {
    return true;
  }

  return hasIncompleteDistribution(line);
}


export function hasIncompleteDistribution(line: WorkScheduleLineRecord) {
  const totalPercentage = line.monthlyDistributions.reduce((sum, distribution) => sum + Number(distribution.percentage), 0);
  return Math.abs(totalPercentage - 100) > 0.0001;
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


function getOverviewTimelineZoomStorageKey(budgetId: string) {
  return `work-schedule-overview-timeline-zoom:${budgetId}`;
}

function isVisibleOverviewRow(row: WorkScheduleDisplayRowRecord, visibleLineIds: Set<string>) {
  if (row.kind === "line") {
    return visibleLineIds.has(row.line.budgetItemId);
  }

  return row.childLineIds.some((lineId) => visibleLineIds.has(lineId));
}


export function formatPredecessorForDisplay(value: string, itemCodeToRowNumber: Map<string, number>) {
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


export function formatPredecessorForStorage(value: string, rowNumberToItemCode: Map<number, string>) {
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


export function formatPredecessorToken(code: string, relation: string, lagDays: number) {
  if (lagDays === 0) {
    return `${code}${relation}`;
  }

  const sign = lagDays > 0 ? "+" : "";
  return `${code}${relation}${sign}${lagDays}d`;
}


export function updateEditableLineDates(
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


export function updateEditableLineDuration(line: EditableLine, durationDays: number) {
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


function createQuickToggleDraft(line: WorkScheduleLineRecord, itemCodeToRowNumber: Map<string, number>): EditableLine {
  return {
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
    startDate: line.startDate ?? "",
    endDate: line.endDate ?? "",
    durationDays: line.durationDays ?? 1,
    predecessor: formatPredecessorForDisplay(line.predecessor ?? "", itemCodeToRowNumber),
    crew: line.crew != null ? String(line.crew) : "1",
    monthlyDistributions: line.monthlyDistributions.length > 0 ? line.monthlyDistributions.map(d => ({ ...d })) : [],
    isMilestone: line.isMilestone ?? false,
    baselineStartDate: line.baselineStartDate ?? null,
    baselineEndDate: line.baselineEndDate ?? null,
    actualStartDate: line.actualStartDate ?? null,
    actualEndDate: line.actualEndDate ?? null,
    percentComplete: line.percentComplete ?? null,
  };
}


export function updateEditableLineCrew(line: EditableLine, crew: string) {
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


export function parseEditableCrew(value: string) {
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
