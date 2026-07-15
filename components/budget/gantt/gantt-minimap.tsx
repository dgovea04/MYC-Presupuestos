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

const MINIMAP_HEIGHT = 40;
const BAR_HEIGHT = 1;
const VIEWPORT_OVERLAY_COLOR = "rgba(37, 99, 235, 0.18)";
const VIEWPORT_BORDER_COLOR = "rgba(37, 99, 235, 0.45)";

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
      color = "bg-rose-500/60";
    } else if (isNearCritical) {
      color = "bg-amber-500/50";
    } else {
      color = "bg-sky-500/30";
    }

    return { leftPercent, widthPercent, color };
  });

  // Viewport indicator
  const viewportLeftPercent =
    timelineContentWidth > 0 ? (scrollLeft / timelineContentWidth) * 100 : 0;
  const viewportWidthPercent =
    timelineContentWidth > 0 ? (viewportWidth / timelineContentWidth) * 100 : 100;

  const handlePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const container = containerRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const clickX = event.clientX - rect.left;
      const ratio = clickX / rect.width;
      const targetScrollLeft = ratio * timelineContentWidth - viewportWidth / 2;

      onScrollTo(Math.max(0, Math.min(targetScrollLeft, timelineContentWidth - viewportWidth)));
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
      const deltaRatio = deltaX / rect.width;
      const targetScrollLeft =
        dragStartRef.current.startScrollLeft + deltaRatio * timelineContentWidth;

      onScrollTo(Math.max(0, Math.min(targetScrollLeft, timelineContentWidth - viewportWidth)));
    },
    [isDragging, onScrollTo, timelineContentWidth, viewportWidth],
  );

  const handlePointerUp = useCallback(() => {
    setIsDragging(false);
    dragStartRef.current = null;
  }, []);

  if (scheduledLines.length === 0) return null;

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative w-full cursor-pointer select-none overflow-hidden rounded-md border border-[var(--app-border)] bg-[var(--app-surface-muted)]",
        isDragging && "cursor-grabbing",
      )}
      style={{ height: MINIMAP_HEIGHT }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      data-testid="gantt-minimap"
      title="Mini-mapa del cronograma. Arrastra para desplazarte."
    >
      {/* Bars layer */}
      <div className="absolute inset-0 flex flex-col justify-center overflow-hidden px-0.5">
        <div className="relative w-full" style={{ height: MINIMAP_HEIGHT - 8 }}>
          {barRects.map((bar, index) => {
            const availableHeight = MINIMAP_HEIGHT - 8;
            const stepY = barRects.length > 1 ? availableHeight / (barRects.length - 1) : availableHeight / 2;
            return (
            <div
              key={index}
              className={cn("absolute rounded-sm", bar.color)}
              style={{
                left: `${bar.leftPercent}%`,
                width: `${Math.max(0.5, bar.widthPercent)}%`,
                height: BAR_HEIGHT,
                top: barRects.length === 1 ? availableHeight / 2 : index * stepY,
              }}
            />
            );
          })}
        </div>
      </div>

      {/* Viewport indicator */}
      <div
        className="absolute top-0 h-full rounded-md border transition-[left] duration-75"
        style={{
          left: `${viewportLeftPercent}%`,
          width: `${viewportWidthPercent}%`,
          backgroundColor: VIEWPORT_OVERLAY_COLOR,
          borderColor: VIEWPORT_BORDER_COLOR,
        }}
        data-testid="gantt-minimap-viewport"
      />
    </div>
  );
});
