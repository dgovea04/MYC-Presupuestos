"use client";

import { memo, useCallback, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { cn } from "@/lib/utils";
import type { WorkScheduleLineRecord } from "@/types/work-schedule";

export type GanttMiniMapProps = {
  allLines: WorkScheduleLineRecord[];
  timelineDayIndexByIso: Map<string, number>;
  timelineContentWidth: number;
  timelineDayCount: number;
  scrollLeft: number;
  viewportWidth: number;
  showCriticalPath: boolean;
  nearCriticalSlackDays: number;
  onScrollTo: (scrollLeft: number) => void;
};

const MINIMAP_HEIGHT = 56;
const BAR_HEIGHT = 2;
const MIN_VIEWPORT_PERCENT = 2;
const VIEWPORT_OVERLAY_COLOR = "rgba(37, 99, 235, 0.18)";
const VIEWPORT_OVERLAY_COLOR_DRAGGING = "rgba(37, 99, 235, 0.30)";
const VIEWPORT_BORDER_COLOR = "rgba(37, 99, 235, 0.55)";

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export const GanttMiniMap = memo(function GanttMiniMap({
  allLines,
  timelineDayIndexByIso,
  timelineContentWidth,
  timelineDayCount,
  scrollLeft,
  viewportWidth,
  showCriticalPath,
  nearCriticalSlackDays,
  onScrollTo,
}: GanttMiniMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ startX: number; startScrollLeft: number } | null>(null);

  const scheduledLines = allLines.filter(
    (line) => line.startDate && line.endDate && line.durationDays != null && line.durationDays > 0,
  );

  // Compute compressed bar positions
  const barRects = scheduledLines.map((line) => {
    const startIdx = timelineDayIndexByIso.get(line.startDate!) ?? 0;
    const endIdx = timelineDayIndexByIso.get(line.endDate!) ?? startIdx;
    const span = Math.max(1, endIdx - startIdx + 1);
    const leftPercent = timelineDayCount > 0 ? (startIdx / timelineDayCount) * 100 : 0;
    const widthPercent = timelineDayCount > 0 ? (span / timelineDayCount) * 100 : 0;

    const isCritical = showCriticalPath && line.criticalPath?.isCritical;
    const isNearCritical =
      showCriticalPath &&
      line.criticalPath &&
      nearCriticalSlackDays > 0 &&
      line.criticalPath.totalSlackDays > 0 &&
      line.criticalPath.totalSlackDays <= nearCriticalSlackDays;

    let color: string;
    if (isCritical) {
      color = "bg-rose-500/70";
    } else if (isNearCritical) {
      color = "bg-amber-500/60";
    } else {
      color = "bg-sky-500/40";
    }

    return { leftPercent, widthPercent, color };
  });

  // Clamp viewport indicator percentages so the indicator never exceeds the
  // minimap bounds (the parent uses overflow-hidden on the timeline panel).
  const rawViewportWidthPercent =
    timelineContentWidth > 0 ? (viewportWidth / timelineContentWidth) * 100 : 100;
  const safeViewportWidthPercent = clamp(rawViewportWidthPercent, MIN_VIEWPORT_PERCENT, 100);
  const rawViewportLeftPercent =
    timelineContentWidth > 0 ? (scrollLeft / timelineContentWidth) * 100 : 0;
  const safeViewportLeftPercent = clamp(
    rawViewportLeftPercent,
    0,
    100 - safeViewportWidthPercent,
  );

  const handlePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const container = containerRef.current;
      if (!container) return;

      container.setPointerCapture(event.pointerId);

      const rect = container.getBoundingClientRect();
      const clickX = event.clientX - rect.left;
      const ratio = rect.width > 0 ? clickX / rect.width : 0;
      const targetScrollLeft = ratio * timelineContentWidth - viewportWidth / 2;

      const maxScrollLeft = Math.max(0, timelineContentWidth - viewportWidth);
      onScrollTo(clamp(targetScrollLeft, 0, maxScrollLeft));
      setIsDragging(true);
      dragStartRef.current = { startX: event.clientX, startScrollLeft: scrollLeft };
      event.preventDefault();
    },
    [onScrollTo, scrollLeft, timelineContentWidth, viewportWidth],
  );

  const handlePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!isDragging || !dragStartRef.current) return;

      const container = containerRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const deltaX = event.clientX - dragStartRef.current.startX;
      const deltaRatio = rect.width > 0 ? deltaX / rect.width : 0;
      const targetScrollLeft =
        dragStartRef.current.startScrollLeft + deltaRatio * timelineContentWidth;

      const maxScrollLeft = Math.max(0, timelineContentWidth - viewportWidth);
      onScrollTo(clamp(targetScrollLeft, 0, maxScrollLeft));
    },
    [isDragging, onScrollTo, timelineContentWidth, viewportWidth],
  );

  const releasePointer = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const container = containerRef.current;
    if (container && container.hasPointerCapture(event.pointerId)) {
      container.releasePointerCapture(event.pointerId);
    }
    setIsDragging(false);
    dragStartRef.current = null;
  }, []);

  const handlePointerUp = releasePointer;
  const handlePointerCancel = releasePointer;

  const availableBarArea = MINIMAP_HEIGHT - 16;
  const isEmptyState = scheduledLines.length === 0;

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative w-full select-none rounded-md border border-[var(--app-border)] bg-[var(--app-surface-muted)] shadow-inner",
        isDragging ? "cursor-grabbing" : "cursor-grab hover:border-[var(--app-border-strong)]",
      )}
      style={{ height: MINIMAP_HEIGHT, touchAction: "none" }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      data-testid="gantt-minimap"
      title="Mini-mapa del cronograma. Arrastra para desplazarte."
      role="slider"
      tabIndex={0}
      aria-orientation="horizontal"
      aria-label="Mini-mapa del cronograma"
      aria-valuemin={0}
      aria-valuemax={Math.max(0, timelineContentWidth - viewportWidth)}
      aria-valuenow={scrollLeft}
    >
      {/* Bars layer (never blocks pointer events) */}
      <div className="pointer-events-none absolute inset-0 flex flex-col justify-center overflow-hidden px-1">
        <div className="relative w-full" style={{ height: availableBarArea }}>
          {barRects.map((bar, index) => {
            const stepY =
              barRects.length > 1 ? availableBarArea / (barRects.length - 1) : availableBarArea / 2;
            return (
              <div
                key={index}
                className={cn("absolute rounded-sm", bar.color)}
                style={{
                  left: `${bar.leftPercent}%`,
                  width: `${Math.max(0.5, bar.widthPercent)}%`,
                  height: BAR_HEIGHT,
                  top: barRects.length === 1 ? availableBarArea / 2 : index * stepY,
                }}
              />
            );
          })}
        </div>
      </div>

      {/* Empty-state placeholder shown when the cronograma has no scheduled
          lines yet: keeps the wrapper height stable so the surrounding UI does
          not collapse, but skips the draggable viewport indicator. */}
      {isEmptyState ? (
        <div
          className="pointer-events-none absolute inset-0 flex items-center justify-center text-[11px] font-medium text-[var(--app-text-muted)]"
          data-testid="gantt-minimap-empty"
        >
          Sin partidas programadas
        </div>
      ) : null}

      {/* Viewport indicator (no transition, never blocks pointer events). */}
      {!isEmptyState ? (
        <div
          className={cn(
            "pointer-events-none absolute top-0 h-full rounded-md border",
            isDragging
              ? "shadow-[0_0_0_1px_rgba(37,99,235,0.4),0_6px_16px_-6px_rgba(37,99,235,0.5)]"
              : "shadow-[0_0_0_1px_rgba(15,23,42,0.04)]",
          )}
          style={{
            left: `${safeViewportLeftPercent}%`,
            width: `${safeViewportWidthPercent}%`,
            backgroundColor: isDragging ? VIEWPORT_OVERLAY_COLOR_DRAGGING : VIEWPORT_OVERLAY_COLOR,
            borderColor: VIEWPORT_BORDER_COLOR,
          }}
          data-testid="gantt-minimap-viewport"
        />
      ) : null}
    </div>
  );
});
