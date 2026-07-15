import { memo } from "react";
import { cn, formatCurrency } from "@/lib/utils";
import type {
  WorkScheduleDisplayRowRecord,
  WorkScheduleLineRecord,
  WorkScheduleMonthlyDistributionRecord,
} from "@/types/work-schedule";
import { GanttBar } from "./gantt-bar";
import type { GanttBarChangeResult } from "./gantt-utils";

export type TimelineDay = {
  iso: string;
  date: Date;
};

export type TimelineRowProps = {
  row: WorkScheduleDisplayRowRecord;
  timelineDays: TimelineDay[];
  timelineDayIndexByIso: Map<string, number>;
  currency: string;
  currencyDecimals: number;
  showCriticalPath: boolean;
  timelineDayWidth: number;
  timelineDayGap: number;
  highlighted: boolean;
  rowHeight?: number;
  timelineStartIso: string | null;
  timelineEndIso: string | null;
  onGanttBarChange?: (line: WorkScheduleLineRecord, result: GanttBarChangeResult) => void;
  onStartConnection?: (itemCode: string, budgetItemId: string, barRightEdgeX: number, barCenterY: number) => void;
  onHoverBar?: (itemCode: string | null) => void;
  onUnhoverBar?: () => void;
  nearCriticalSlackDays?: number;
};

const segmentColors = [
  "bg-sky-600 dark:bg-sky-500",
  "bg-cyan-500 dark:bg-cyan-400",
  "bg-indigo-500 dark:bg-indigo-400",
  "bg-emerald-500 dark:bg-emerald-400",
  "bg-amber-500 dark:bg-amber-400",
  "bg-rose-500 dark:bg-rose-400",
] as const;

export const TimelineRow = memo(function TimelineRow({
  row,
  timelineDays,
  timelineDayIndexByIso,
  currency,
  currencyDecimals,
  showCriticalPath,
  timelineDayWidth,
  timelineDayGap,
  highlighted,
  rowHeight,
  timelineStartIso,
  timelineEndIso,
  onGanttBarChange,
  onStartConnection,
  onHoverBar,
  onUnhoverBar,
  nearCriticalSlackDays,
}: TimelineRowProps) {
  const line = row.kind === "line" ? row.line : null;
  const startDate = row.kind === "line" ? row.line.startDate : row.startDate;
  const endDate = row.kind === "line" ? row.line.endDate : row.endDate;
  const itemCode = row.kind === "line" ? row.line.itemCode : row.itemCode;
  const description = row.kind === "line" ? row.line.description : row.description;
  const partial = row.kind === "line" ? row.line.partial : row.partial;
  const timelineDayCount = Math.max(timelineDays.length, 1);
  const startIndex = startDate ? (timelineDayIndexByIso.get(startDate) ?? -1) : -1;
  const endIndex = endDate ? (timelineDayIndexByIso.get(endDate) ?? -1) : -1;
  const span = startIndex >= 0 && endIndex >= startIndex ? endIndex - startIndex + 1 : 0;
  const hasActiveRange = span > 0;
  const timelineColumnWidth = timelineDayWidth + timelineDayGap;
  const timelineBarStyle = hasActiveRange
    ? {
        left: `${startIndex * timelineColumnWidth}px`,
        width: `${span * timelineDayWidth + Math.max(0, span - 1) * timelineDayGap}px`,
      }
    : null;
  const timelineRowBackgroundStyle = {
    backgroundColor: highlighted ? "var(--app-surface-hover-strong)" : "var(--app-surface-muted)",
    backgroundImage: `repeating-linear-gradient(
      to right,
      var(--app-surface) 0,
      var(--app-surface) calc((100% / ${timelineDayCount}) - 1px),
      var(--app-surface-hover-strong) calc((100% / ${timelineDayCount}) - 1px),
      var(--app-surface-hover-strong) calc(100% / ${timelineDayCount})
    )`,
  } as const;

  const isLine = row.kind === "line";
  const canInteract = isLine && line && onGanttBarChange;
  const hoverableItemCode = isLine && line ? line.itemCode : null;
  const progressPercent = line?.percentComplete != null ? Math.min(100, Math.max(0, line.percentComplete)) : null;
  const progressLabel = progressPercent != null && progressPercent > 0 ? ` ${Math.round(progressPercent)}%` : "";

  return (
    <div
      data-testid="work-schedule-timeline-row"
      onPointerEnter={() => onHoverBar?.(hoverableItemCode)}
      onPointerLeave={() => onUnhoverBar?.()}
      data-line-id={row.rowId}
      data-highlighted={highlighted ? "true" : "false"}
      data-critical={showCriticalPath && line?.criticalPath?.isCritical ? "true" : (showCriticalPath && line?.criticalPath && nearCriticalSlackDays != null && nearCriticalSlackDays > 0 && line.criticalPath.totalSlackDays > 0 && line.criticalPath.totalSlackDays <= nearCriticalSlackDays ? "near" : "false")}
      className="relative overflow-visible border-b border-[var(--app-border-soft)] px-0.5 py-1"
      style={{
        height: rowHeight ? `${rowHeight}px` : undefined,
        ...timelineRowBackgroundStyle,
      }}
    >
      {canInteract && line && timelineBarStyle ? (
        <GanttBar
          line={line}
          startIndex={startIndex}
          endIndex={endIndex}
          span={span}
          timelineDayWidth={timelineDayWidth}
          timelineDayGap={timelineDayGap}
          timelineColumnWidth={timelineColumnWidth}
          showCriticalPath={showCriticalPath}
          highlighted={highlighted}
          timelineStartIso={timelineStartIso}
          timelineEndIso={timelineEndIso}
          onChange={(result) => onGanttBarChange!(line, result)}
          onStartConnection={onStartConnection}
          timelineDayIndexByIso={timelineDayIndexByIso}
          nearCriticalSlackDays={nearCriticalSlackDays}
        />
      ) : timelineBarStyle ? (
        <div
          className={cn(
            "absolute inset-y-2 z-20 overflow-visible rounded-full",
            row.kind === "line"
              ? "shadow-[0_10px_20px_-16px_rgba(37,99,235,0.9)] ring-1 ring-black/5 dark:ring-white/6"
              : "bg-[var(--app-text-subtle)]/90",
          )}
          style={timelineBarStyle}
          title={description ?? undefined}
        >
          <div className="absolute inset-0 flex overflow-hidden rounded-full">
            {line && line.monthlyDistributions.length > 0 ? (
              line.monthlyDistributions.map((distribution, distributionIndex) => (
                <div
                  key={`${row.rowId}-${distribution.year}-${distribution.month}`}
                  data-testid={`work-schedule-bar-segment-${row.rowId}`}
                  className={cn(
                    "h-full border-r border-white/35 dark:border-black/20 last:border-r-0",
                    showCriticalPath && line.criticalPath?.isCritical ? "bg-rose-600 dark:bg-rose-500" : (showCriticalPath && line.criticalPath && nearCriticalSlackDays != null && nearCriticalSlackDays > 0 && line.criticalPath.totalSlackDays > 0 && line.criticalPath.totalSlackDays <= nearCriticalSlackDays ? "bg-amber-500 dark:bg-amber-400" : segmentColors[distributionIndex % segmentColors.length]),
                  )}
                  style={{ width: `${distribution.percentage}%` }}
                  title={formatDistributionTooltip(distribution, partial, currency, currencyDecimals)}
                />
              ))
            ) : line ? (
              <div className={cn("h-full w-full", showCriticalPath && line.criticalPath?.isCritical ? "bg-rose-600 dark:bg-rose-500" : (showCriticalPath && line.criticalPath && nearCriticalSlackDays != null && nearCriticalSlackDays > 0 && line.criticalPath.totalSlackDays > 0 && line.criticalPath.totalSlackDays <= nearCriticalSlackDays ? "bg-amber-500 dark:bg-amber-400" : "bg-sky-600 dark:bg-sky-500"))} />
            ) : (
              <div className="h-full w-full bg-[var(--app-text-subtle)]" />
            )}
          </div>
          <div className="absolute inset-0 px-1 text-[9px] font-semibold text-white">
            <span className="line-clamp-1 block truncate py-1">{itemCode}{progressLabel}</span>
          </div>
          {highlighted ? (
            <div className="absolute -top-5 left-0">
              <span
                data-testid={`work-schedule-active-timeline-badge-${row.rowId}`}
                className="theme-status-warning theme-status-warning-strong rounded-full border px-1.5 py-0.5 text-[9px] font-semibold shadow-sm"
              >
                Partida activa
              </span>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}, areTimelineRowPropsEqual);

function formatDistributionLabel(distribution: WorkScheduleMonthlyDistributionRecord) {
  return `${distribution.month.toString().padStart(2, "0")}/${distribution.year}`;
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

function areTimelineRowPropsEqual(previousProps: TimelineRowProps, nextProps: TimelineRowProps) {
  return (
    previousProps.row === nextProps.row &&
    previousProps.timelineDays === nextProps.timelineDays &&
    previousProps.timelineDayIndexByIso === nextProps.timelineDayIndexByIso &&
    previousProps.currency === nextProps.currency &&
    previousProps.currencyDecimals === nextProps.currencyDecimals &&
    previousProps.showCriticalPath === nextProps.showCriticalPath &&
    previousProps.timelineDayWidth === nextProps.timelineDayWidth &&
    previousProps.timelineDayGap === nextProps.timelineDayGap &&
    previousProps.highlighted === nextProps.highlighted &&
    previousProps.rowHeight === nextProps.rowHeight &&
    previousProps.timelineStartIso === nextProps.timelineStartIso &&
    previousProps.timelineEndIso === nextProps.timelineEndIso &&
    previousProps.onGanttBarChange === nextProps.onGanttBarChange &&
    previousProps.onStartConnection === nextProps.onStartConnection &&
    previousProps.onHoverBar === nextProps.onHoverBar &&
    previousProps.onUnhoverBar === nextProps.onUnhoverBar &&
    previousProps.nearCriticalSlackDays === nextProps.nearCriticalSlackDays
  );
}
