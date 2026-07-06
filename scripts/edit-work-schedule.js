const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'components', 'budget', 'work-schedule-page-content.tsx');
let content = fs.readFileSync(filePath, 'utf-8');

// 1. Add imports for TimelineRow and GanttBarChangeResult
const importAnchor = `import { parseWorkSchedulePredecessors } from "@/lib/work-schedule/predecessors";`;
const importReplacement = `import { parseWorkSchedulePredecessors } from "@/lib/work-schedule/predecessors";
import { TimelineRow } from "@/components/budget/gantt/timeline-row";
import type { GanttBarChangeResult } from "@/components/budget/gantt/gantt-utils";`;

if (!content.includes('import { TimelineRow }')) {
  content = content.replace(importAnchor, importReplacement);
}

// 2. Add onGanttBarChange prop to WorkScheduleOverview props
const overviewPropsAnchor = `  onEditLine: (line: WorkScheduleLineRecord) => void;\n}`;
const overviewPropsReplacement = `  onEditLine: (line: WorkScheduleLineRecord) => void;\n  onGanttBarChange?: (line: WorkScheduleLineRecord, result: GanttBarChangeResult) => void;\n}`;

content = content.replace(overviewPropsAnchor, overviewPropsReplacement);

// 3. Add handleGanttBarChange handler in WorkSchedulePageContentInner (after persistWorkScheduleLine definition)
const persistAnchor = `  async function persistWorkScheduleLine(line: EditableLine) {\n    const response = await fetch(\`/api/budgets/\${data.budgetId}/work-schedule\`, {\n      method: "PATCH",\n      headers: { "Content-Type": "application/json" },\n      body: JSON.stringify(serializeEditableLine(line, predecessorRowNumberToItemCode)),\n    });\n\n    if (!response.ok) {\n      const payload = (await response.json()) as { error?: string };\n      throw new Error(payload.error ?? "No se pudo guardar la programacion");\n    }\n\n    return (await response.json()) as WorkScheduleViewRecord;\n  }`;

const persistReplacement = `  async function persistWorkScheduleLine(line: EditableLine) {\n    const response = await fetch(\`/api/budgets/\${data.budgetId}/work-schedule\`, {\n      method: "PATCH",\n      headers: { "Content-Type": "application/json" },\n      body: JSON.stringify(serializeEditableLine(line, predecessorRowNumberToItemCode)),\n    });\n\n    if (!response.ok) {\n      const payload = (await response.json()) as { error?: string };\n      throw new Error(payload.error ?? "No se pudo guardar la programacion");\n    }\n\n    return (await response.json()) as WorkScheduleViewRecord;\n  }\n\n  const handleGanttBarChange = useCallback(async (line: WorkScheduleLineRecord, result: GanttBarChangeResult) => {\n    const editableLine: EditableLine = {\n      budgetItemId: line.budgetItemId,\n      description: line.description,\n      quantity: line.quantity,\n      performance: line.performance,\n      startDate: result.startDate,\n      endDate: result.endDate,\n      durationDays: result.durationDays,\n      predecessor: line.predecessor ?? "",\n      crew: line.crew?.toString() ?? "",\n      monthlyDistributions: result.monthlyDistributions,\n    };\n\n    try {\n      const nextData = await persistWorkScheduleLine(editableLine);\n      setData(normalizeWorkScheduleView(nextData));\n    } catch {\n      // Bar snaps back visually since we optimistically don't mutate local state\n    }\n  }, [persistWorkScheduleLine]);`;

content = content.replace(persistAnchor, persistReplacement);

// 4. Pass onGanttBarChange to WorkScheduleOverview
const overviewCallAnchor = `          onEditLine={handleEditLine}\n        />`;
const overviewCallReplacement = `          onEditLine={handleEditLine}\n          onGanttBarChange={handleGanttBarChange}\n        />`;

content = content.replace(overviewCallAnchor, overviewCallReplacement);

// 5. Update TimelineRow JSX call inside WorkScheduleOverview to add new props
const timelineRowCallAnchor = `                          <TimelineRow\n                            key={item.key}\n                            row={item.row}\n                            timelineDays={timelineDays}\n                            timelineDayIndexByIso={timelineDayIndexByIso}\n                            currency={data.currency}\n                            currencyDecimals={currencyDecimals}\n                            showCriticalPath={showCriticalPath}\n                            timelineDayWidth={getZoomedTimelineDayWidth(timelineZoomPercent)}\n                            timelineDayGap={getZoomedTimelineDayGap(timelineZoomPercent)}\n                            highlighted={item.row.kind === "line" && highlightedBudgetItemId === item.row.line.budgetItemId}\n                            rowHeight={normalizeMeasuredHeight(\n                              tableLineHeights[item.row.rowId] ?? OVERVIEW_LINE_ROW_ESTIMATED_HEIGHT,\n                              OVERVIEW_SYNCHRONIZED_MIN_ROW_HEIGHT,\n                            )}\n                          />`;

const timelineRowCallReplacement = `                          <TimelineRow\n                            key={item.key}\n                            row={item.row}\n                            timelineDays={timelineDays}\n                            timelineDayIndexByIso={timelineDayIndexByIso}\n                            currency={data.currency}\n                            currencyDecimals={currencyDecimals}\n                            showCriticalPath={showCriticalPath}\n                            timelineDayWidth={getZoomedTimelineDayWidth(timelineZoomPercent)}\n                            timelineDayGap={getZoomedTimelineDayGap(timelineZoomPercent)}\n                            highlighted={item.row.kind === "line" && highlightedBudgetItemId === item.row.line.budgetItemId}\n                            rowHeight={normalizeMeasuredHeight(\n                              tableLineHeights[item.row.rowId] ?? OVERVIEW_LINE_ROW_ESTIMATED_HEIGHT,\n                              OVERVIEW_SYNCHRONIZED_MIN_ROW_HEIGHT,\n                            )}\n                            timelineStartIso={timelineDays[0]?.iso ?? null}\n                            timelineEndIso={timelineDays[timelineDays.length - 1]?.iso ?? null}\n                            onGanttBarChange={onGanttBarChange}\n                          />`;

content = content.replace(timelineRowCallAnchor, timelineRowCallReplacement);

// 6. Remove old TimelineRowProps type
const oldTimelineRowProps = `type TimelineRowProps = {\n  row: WorkScheduleDisplayRowRecord;\n  timelineDays: TimelineDay[];\n  timelineDayIndexByIso: Map<string, number>;\n  currency: string;\n  currencyDecimals: number;\n  showCriticalPath: boolean;\n  timelineDayWidth: number;\n  timelineDayGap: number;\n  highlighted: boolean;\n  rowHeight?: number;\n};\n\n`;
content = content.replace(oldTimelineRowProps, '');

// 7. Remove old TimelineRow component definition (from const to closing of areTimelineRowPropsEqual)
// We need to match from "const TimelineRow = memo(function TimelineRow({" to the end of areTimelineRowPropsEqual call
const timelineRowStart = content.indexOf('const TimelineRow = memo(function TimelineRow({');
if (timelineRowStart !== -1) {
  // Find the end: after areTimelineRowPropsEqual));
  const searchAfter = timelineRowStart + 1;
  const timelineRowEnd = content.indexOf('}, areTimelineRowPropsEqual);', searchAfter);
  if (timelineRowEnd !== -1) {
    const endPos = timelineRowEnd + '}, areTimelineRowPropsEqual);'.length;
    content = content.slice(0, timelineRowStart) + content.slice(endPos);
  }
}

// 8. Remove areTimelineRowPropsEqual function
const areEqualStart = content.indexOf('function areTimelineRowPropsEqual(previousProps: TimelineRowProps, nextProps: TimelineRowProps) {');
if (areEqualStart !== -1) {
  const areEqualEnd = content.indexOf('\n}', areEqualStart) + 2;
  content = content.slice(0, areEqualStart) + content.slice(areEqualEnd);
}

// 9. Remove formatDistributionLabel function
const formatLabelStart = content.indexOf('function formatDistributionLabel(distribution: WorkScheduleMonthlyDistributionRecord) {');
if (formatLabelStart !== -1) {
  const formatLabelEnd = content.indexOf('\n}', formatLabelStart) + 2;
  content = content.slice(0, formatLabelStart) + content.slice(formatLabelEnd);
}

// 10. Remove formatDistributionTooltip function
const formatTooltipStart = content.indexOf('function formatDistributionTooltip(\n  distribution: WorkScheduleMonthlyDistributionRecord,\n  partial: number,\n  currency: string,\n  currencyDecimals: number,\n) {');
if (formatTooltipStart === -1) {
  // Try single line variant
  const formatTooltipStart2 = content.indexOf('function formatDistributionTooltip(');
  if (formatTooltipStart2 !== -1) {
    const formatTooltipEnd = content.indexOf('\n}', formatTooltipStart2) + 2;
    content = content.slice(0, formatTooltipStart2) + content.slice(formatTooltipEnd);
  }
} else {
  const formatTooltipEnd = content.indexOf('\n}', formatTooltipStart) + 2;
  content = content.slice(0, formatTooltipStart) + content.slice(formatTooltipEnd);
}

fs.writeFileSync(filePath, content, 'utf-8');
console.log('Done editing work-schedule-page-content.tsx');
