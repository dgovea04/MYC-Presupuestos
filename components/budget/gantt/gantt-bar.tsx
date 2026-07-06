"use client";

import { memo, useCallback } from "react";
import { cn } from "@/lib/utils";
import type { WorkScheduleLineRecord } from "@/types/work-schedule";
import {
  computeDraggedBarDates,
  computeResizedBarDates,
  formatDateLabel,
  type GanttBarChangeResult,
} from "./gantt-utils";
import { useGanttBarInteractions } from "./use-gantt-bar-interactions";

const segmentColors = [
  "bg-sky-600",
  "bg-cyan-500",
  "bg-indigo-500",
  "bg-emerald-500",
];

export type GanttBarProps = {
  line: WorkScheduleLineRecord;
  startIndex: number;
  endIndex: number;
  span: number;
  timelineDayWidth: number;
  timelineDayGap: number;
  timelineColumnWidth: number;
  showCriticalPath: boolean;
  highlighted: boolean;
  timelineStartIso: string | null;
  timelineEndIso: string | null;
  onChange: (result: GanttBarChangeResult) => void;
  onStartConnection?: (itemCode: string, budgetItemId: string, barRightEdgeX: number, barCenterY: number) => void;
};

export const GanttBar = memo(function GanttBar({
  line,
  startIndex,
  endIndex,
  span,
  timelineDayWidth,
  timelineDayGap,
  timelineColumnWidth,
  showCriticalPath,
  highlighted,
  timelineStartIso,
  timelineEndIso,
  onChange,
  onStartConnection,
}: GanttBarProps) {
  const originalStartDate = line.startDate ?? "";
  const originalEndDate = line.endDate ?? "";
  const originalDurationDays = line.durationDays ?? 1;

  const getTooltipLabel = useCallback(
    (deltaPx: number, mode: ReturnType<typeof useGanttBarInteractions>["state"]["mode"]) => {
      if (mode === "idle") return "";

      let result: GanttBarChangeResult;
      if (mode === "dragging") {
        result = computeDraggedBarDates(
          originalStartDate,
          originalEndDate,
          originalDurationDays,
          deltaPx,
          timelineColumnWidth,
          timelineStartIso,
          timelineEndIso,
        );
      } else {
        result = computeResizedBarDates(
          originalStartDate,
          originalEndDate,
          originalDurationDays,
          deltaPx,
          timelineColumnWidth,
          mode,
          timelineStartIso,
          timelineEndIso,
        );
      }

      return `${formatDateLabel(result.startDate)} → ${formatDateLabel(result.endDate)} (${result.durationDays}d)`;
    },
    [originalStartDate, originalEndDate, originalDurationDays, timelineColumnWidth, timelineStartIso, timelineEndIso],
  );

  const onDragChange = useCallback(
    (deltaPx: number) => {
      const result = computeDraggedBarDates(
        originalStartDate,
        originalEndDate,
        originalDurationDays,
        deltaPx,
        timelineColumnWidth,
        timelineStartIso,
        timelineEndIso,
      );
      return { isValid: !result.error, label: "" };
    },
    [originalStartDate, originalEndDate, originalDurationDays, timelineColumnWidth, timelineStartIso, timelineEndIso],
  );

  const onResizeLeftChange = useCallback(
    (deltaPx: number) => {
      const result = computeResizedBarDates(
        originalStartDate,
        originalEndDate,
        originalDurationDays,
        deltaPx,
        timelineColumnWidth,
        "resizing-left",
        timelineStartIso,
        timelineEndIso,
      );
      return { isValid: !result.error, label: "" };
    },
    [originalStartDate, originalEndDate, originalDurationDays, timelineColumnWidth, timelineStartIso, timelineEndIso],
  );

  const onResizeRightChange = useCallback(
    (deltaPx: number) => {
      const result = computeResizedBarDates(
        originalStartDate,
        originalEndDate,
        originalDurationDays,
        deltaPx,
        timelineColumnWidth,
        "resizing-right",
        timelineStartIso,
        timelineEndIso,
      );
      return { isValid: !result.error, label: "" };
    },
    [originalStartDate, originalEndDate, originalDurationDays, timelineColumnWidth, timelineStartIso, timelineEndIso],
  );

  const onDragEnd = useCallback(
    (deltaPx: number) => {
      const result = computeDraggedBarDates(
        originalStartDate,
        originalEndDate,
        originalDurationDays,
        deltaPx,
        timelineColumnWidth,
        timelineStartIso,
        timelineEndIso,
      );
      onChange(result);
    },
    [originalStartDate, originalEndDate, originalDurationDays, timelineColumnWidth, timelineStartIso, timelineEndIso, onChange],
  );

  const onResizeEnd = useCallback(
    (deltaPx: number, mode: "resizing-left" | "resizing-right") => {
      const result = computeResizedBarDates(
        originalStartDate,
        originalEndDate,
        originalDurationDays,
        deltaPx,
        timelineColumnWidth,
        mode,
        timelineStartIso,
        timelineEndIso,
      );
      onChange(result);
    },
    [originalStartDate, originalEndDate, originalDurationDays, timelineColumnWidth, timelineStartIso, timelineEndIso, onChange],
  );

  const interactions = useGanttBarInteractions({
    onDragChange,
    onResizeLeftChange,
    onResizeRightChange,
    onDragEnd,
    onResizeEnd,
    getTooltipLabel,
  });

  const { state } = interactions;

  const isInteracting = state.mode !== "idle";

  const baseLeft = startIndex * timelineColumnWidth;
  const baseWidth = span * timelineDayWidth + Math.max(0, span - 1) * timelineDayGap;

  // For resize, we adjust width and left directly
  let visualLeft = baseLeft;
  let visualWidth = baseWidth;

  if (state.mode === "resizing-left") {
    const deltaDays = Math.round(state.deltaPx / timelineColumnWidth);
    const dayDeltaPx = deltaDays * timelineColumnWidth;
    visualLeft = baseLeft + dayDeltaPx;
    visualWidth = baseWidth - dayDeltaPx;
    if (visualWidth < timelineDayWidth) {
      visualWidth = timelineDayWidth;
      visualLeft = baseLeft + baseWidth - timelineDayWidth;
    }
  } else if (state.mode === "resizing-right") {
    const deltaDays = Math.round(state.deltaPx / timelineColumnWidth);
    const dayDeltaPx = deltaDays * timelineColumnWidth;
    visualWidth = baseWidth + dayDeltaPx;
    if (visualWidth < timelineDayWidth) {
      visualWidth = timelineDayWidth;
    }
  } else if (state.mode === "dragging") {
    const deltaDays = Math.round(state.deltaPx / timelineColumnWidth);
    const dayDeltaPx = deltaDays * timelineColumnWidth;
    visualLeft = baseLeft + dayDeltaPx;
  }

  const barStyle = {
    left: `${visualLeft}px`,
    width: `${visualWidth}px`,
  };

  const isCritical = showCriticalPath && line.criticalPath?.isCritical;

  const distributions = line.monthlyDistributions;

  const tooltipContent = isInteracting
    ? state.tooltipLabel || getTooltipLabel(state.deltaPx, state.mode)
    : undefined;

  return (
    <div
      className={cn(
        "group absolute top-1/2 h-5 -translate-y-1/2 overflow-visible rounded-full",
        "shadow-sm",
        isInteracting && "z-20",
        state.isValid ? "opacity-100" : "opacity-70",
      )}
      style={barStyle}
      data-testid="gantt-bar"
      data-mode={state.mode}
      data-budget-item-id={line.budgetItemId}
    >
      {/* Main bar body */}
      <div
        className={cn(
          "absolute inset-0 cursor-grab overflow-hidden rounded-full active:cursor-grabbing",
          isInteracting && "cursor-grabbing",
          isCritical ? "bg-rose-500" : "bg-sky-600",
        )}
        onPointerDown={interactions.handleBarPointerDown}
        onPointerMove={interactions.handlePointerMove}
        onPointerUp={interactions.handlePointerUp}
        title={!isInteracting ? line.description : undefined}
      >
        <div className="absolute inset-0 flex overflow-hidden rounded-full">
          {distributions.length > 0 ? (
            distributions.map((distribution, index) => (
              <div
                key={`${distribution.year}-${distribution.month}`}
                className={cn(
                  "h-full",
                  isCritical ? "bg-rose-500" : segmentColors[index % segmentColors.length],
                )}
                style={{ width: `${distribution.percentage}%` }}
              />
            ))
          ) : (
            <div className={cn("h-full w-full", isCritical ? "bg-rose-500" : "bg-sky-600")} />
          )}
        </div>

        {/* Label */}
        <div className="absolute inset-0 flex items-center px-1.5">
          <span className="block truncate text-[9px] font-semibold text-white">
            {line.itemCode}
          </span>
        </div>
      </div>

      {/* Resize handles */}
      {startIndex >= 0 && endIndex >= 0 && (
        <>
          {/* Left handle */}
          <div
            className={cn(
              "absolute -left-1 top-1/2 z-10 h-6 w-3 -translate-y-1/2 cursor-w-resize rounded-sm bg-white/90 shadow-md ring-1 ring-slate-300 transition-opacity",
              "opacity-0 group-hover:opacity-100",
              isInteracting && state.mode === "resizing-left" && "opacity-100",
            )}
            onPointerDown={interactions.handleLeftHandlePointerDown}
            onPointerMove={interactions.handlePointerMove}
            onPointerUp={interactions.handlePointerUp}
            data-testid="gantt-bar-handle-left"
          />
          {/* Right handle */}
          <div
            className={cn(
              "absolute -right-1 top-1/2 z-10 h-6 w-3 -translate-y-1/2 cursor-e-resize rounded-sm bg-white/90 shadow-md ring-1 ring-slate-300 transition-opacity",
              "opacity-0 group-hover:opacity-100",
              isInteracting && state.mode === "resizing-right" && "opacity-100",
            )}
            onPointerDown={interactions.handleRightHandlePointerDown}
            onPointerMove={interactions.handlePointerMove}
            onPointerUp={interactions.handlePointerUp}
            data-testid="gantt-bar-handle-right"
          />
        </>
      )}

      {/* Connector dot for dependency creation */}
      {onStartConnection && startIndex >= 0 && endIndex >= 0 && (
        <div
          className={cn(
            "absolute right-0 top-1/2 z-10 h-3.5 w-3.5 -translate-y-1/2 translate-x-1/2 cursor-crosshair rounded-full bg-sky-100 shadow-md ring-1 ring-sky-400 transition-all",
            "opacity-0 group-hover:opacity-100 hover:scale-125 hover:bg-sky-300",
          )}
          onPointerDown={(event) => {
            event.preventDefault();
            event.stopPropagation();
            const barElement = event.currentTarget.closest<HTMLElement>("[data-testid='gantt-bar']");
            if (!barElement) return;
            const barRect = barElement.getBoundingClientRect();
            const barCenterY = barRect.top + barRect.height / 2;
            const barRightEdgeX = barRect.right;
            onStartConnection(line.itemCode, line.budgetItemId, barRightEdgeX, barCenterY);
          }}
          data-testid="gantt-bar-connector-dot"
          title="Arrastrar para crear predecesora"
        />
      )}

      {/* Interaction tooltip */}
      {isInteracting && tooltipContent && (
        <div
          className={cn(
            "pointer-events-none absolute -top-8 left-1/2 z-30 -translate-x-1/2 whitespace-nowrap rounded-md px-2 py-1 text-[11px] font-medium shadow-lg",
            state.isValid
              ? "bg-slate-900 text-white"
              : "bg-rose-600 text-white",
          )}
        >
          {tooltipContent}
          {state.isValid ? null : (
            <span className="ml-1 text-[10px] opacity-80">Inválido</span>
          )}
        </div>
      )}

      {/* Highlighted badge */}
      {highlighted && !isInteracting && (
        <div className="absolute -top-5 left-0">
          <span
            data-testid={`work-schedule-active-timeline-badge-${line.budgetItemId}`}
            className="rounded-md bg-slate-900 px-1.5 py-0.5 text-[9px] font-semibold text-white shadow-md"
          >
            Partida activa
          </span>
        </div>
      )}
    </div>
  );
});
