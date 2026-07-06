const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'components', 'budget', 'work-schedule-page-content.tsx');
let content = fs.readFileSync(filePath, 'utf-8');

// Normalize line endings for easier matching, then restore at the end
const hadCRLF = content.includes('\r\n');
content = content.replace(/\r\n/g, '\n');

let changes = 0;

// 1. Remove type TimelineRowProps
const trp = `type TimelineRowProps = {\n  row: WorkScheduleDisplayRowRecord;\n  timelineDays: TimelineDay[];\n  timelineDayIndexByIso: Map<string, number>;\n  currency: string;\n  currencyDecimals: number;\n  showCriticalPath: boolean;\n  timelineDayWidth: number;\n  timelineDayGap: number;\n  highlighted: boolean;\n  rowHeight?: number;\n};\n`;
if (content.includes(trp)) {
  content = content.replace(trp, '');
  changes++;
  console.log('Removed TimelineRowProps');
}

// 2. Add onGanttBarChange to WorkScheduleOverview destructured props
const d1 = `  onEditLine,\n  activeInlineRowId,`;
const d1r = `  onEditLine,\n  onGanttBarChange,\n  activeInlineRowId,`;
if (content.includes(d1) && !content.includes(d1r)) {
  content = content.replace(d1, d1r);
  changes++;
  console.log('Added onGanttBarChange to destructured props');
}

// 3. Add onGanttBarChange prop type
const t1 = `  onEditLine: (line: WorkScheduleLineRecord) => void;\n  activeInlineRowId: string | null;`;
const t1r = `  onEditLine: (line: WorkScheduleLineRecord) => void;\n  onGanttBarChange?: (line: WorkScheduleLineRecord, result: GanttBarChangeResult) => void;\n  activeInlineRowId: string | null;`;
if (content.includes(t1) && !content.includes('onGanttBarChange?:')) {
  content = content.replace(t1, t1r);
  changes++;
  console.log('Added onGanttBarChange prop type');
}

// 4. Add handleGanttBarChange after persistWorkScheduleLine
const p1 = `    return (await response.json()) as WorkScheduleViewRecord;\n  }\n\n  const loadDerivedViewData = useCallback(async`; 
const p1r = `    return (await response.json()) as WorkScheduleViewRecord;\n  }\n\n  const handleGanttBarChange = useCallback(async (line: WorkScheduleLineRecord, result: GanttBarChangeResult) => {\n    const editableLine: EditableLine = {\n      budgetItemId: line.budgetItemId,\n      description: line.description,\n      quantity: line.quantity,\n      performance: line.performance,\n      startDate: result.startDate,\n      endDate: result.endDate,\n      durationDays: result.durationDays,\n      predecessor: line.predecessor ?? "",\n      crew: line.crew?.toString() ?? "",\n      monthlyDistributions: result.monthlyDistributions,\n    };\n\n    try {\n      const nextData = await persistWorkScheduleLine(editableLine);\n      setData(normalizeWorkScheduleView(nextData));\n    } catch {\n      // Bar snaps back visually since we do not mutate local state optimistically\n    }\n  }, [persistWorkScheduleLine]);\n\n  const loadDerivedViewData = useCallback(async`;

if (content.includes(p1) && !content.includes('handleGanttBarChange')) {
  content = content.replace(p1, p1r);
  changes++;
  console.log('Added handleGanttBarChange handler');
}

// 5. Pass onGanttBarChange to WorkScheduleOverview JSX
const c1 = `          onEditLine={handleEditLine}\n          activeInlineRowId={activeInlineRowId}`;
const c1r = `          onEditLine={handleEditLine}\n          onGanttBarChange={handleGanttBarChange}\n          activeInlineRowId={activeInlineRowId}`;
if (content.includes(c1) && !content.includes('onGanttBarChange={handleGanttBarChange}')) {
  content = content.replace(c1, c1r);
  changes++;
  console.log('Passed onGanttBarChange to WorkScheduleOverview');
}

// 6. Update TimelineRow JSX call
const tr1 = `                          <TimelineRow\n                            key={item.key}\n                            row={item.row}\n                            timelineDays={timelineDays}\n                            timelineDayIndexByIso={timelineDayIndexByIso}\n                            currency={data.currency}\n                            currencyDecimals={currencyDecimals}\n                            showCriticalPath={showCriticalPath}\n                            timelineDayWidth={getZoomedTimelineDayWidth(timelineZoomPercent)}\n                            timelineDayGap={getZoomedTimelineDayGap(timelineZoomPercent)}\n                            highlighted={item.row.kind === "line" && highlightedBudgetItemId === item.row.line.budgetItemId}\n                            rowHeight={normalizeMeasuredHeight(\n                              tableLineHeights[item.row.rowId] ?? OVERVIEW_LINE_ROW_ESTIMATED_HEIGHT,\n                              OVERVIEW_SYNCHRONIZED_MIN_ROW_HEIGHT,\n                            )}\n                          />`;

const tr1r = `                          <TimelineRow\n                            key={item.key}\n                            row={item.row}\n                            timelineDays={timelineDays}\n                            timelineDayIndexByIso={timelineDayIndexByIso}\n                            currency={data.currency}\n                            currencyDecimals={currencyDecimals}\n                            showCriticalPath={showCriticalPath}\n                            timelineDayWidth={getZoomedTimelineDayWidth(timelineZoomPercent)}\n                            timelineDayGap={getZoomedTimelineDayGap(timelineZoomPercent)}\n                            highlighted={item.row.kind === "line" && highlightedBudgetItemId === item.row.line.budgetItemId}\n                            rowHeight={normalizeMeasuredHeight(\n                              tableLineHeights[item.row.rowId] ?? OVERVIEW_LINE_ROW_ESTIMATED_HEIGHT,\n                              OVERVIEW_SYNCHRONIZED_MIN_ROW_HEIGHT,\n                            )}\n                            timelineStartIso={timelineDays[0]?.iso ?? null}\n                            timelineEndIso={timelineDays[timelineDays.length - 1]?.iso ?? null}\n                            onGanttBarChange={onGanttBarChange}\n                          />`;

if (content.includes(tr1)) {
  content = content.replace(tr1, tr1r);
  changes++;
  console.log('Updated TimelineRow JSX call');
} else {
  console.log('WARNING: Could not find TimelineRow JSX call to update');
}

// Restore line endings if needed
if (hadCRLF) {
  content = content.replace(/\n/g, '\r\n');
}

fs.writeFileSync(filePath, content, 'utf-8');
console.log(`Done. Applied ${changes} changes.`);
