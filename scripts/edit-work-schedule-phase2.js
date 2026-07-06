const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'components', 'budget', 'work-schedule-page-content.tsx');
let content = fs.readFileSync(filePath, 'utf-8');

let changes = 0;

// 1. Remove type TimelineRowProps
const timelineRowPropsIdx = content.indexOf('type TimelineRowProps = {\n  row: WorkScheduleDisplayRowRecord;');
if (timelineRowPropsIdx !== -1) {
  const endIdx = content.indexOf('};', timelineRowPropsIdx);
  if (endIdx !== -1) {
    // Find the newline after the closing brace
    let afterEnd = endIdx + 2;
    while (afterEnd < content.length && (content[afterEnd] === '\n' || content[afterEnd] === '\r')) {
      afterEnd++;
    }
    content = content.slice(0, timelineRowPropsIdx) + content.slice(afterEnd);
    changes++;
    console.log('Removed TimelineRowProps type');
  }
}

// 2. Add onGanttBarChange prop to WorkScheduleOverview destructured props
// Find the line: "  onEditLine," inside WorkScheduleOverview function
const onEditLineDestructuring = '  onEditLine,\n  activeInlineRowId,';
const onEditLineDestructuringReplacement = '  onEditLine,\n  onGanttBarChange,\n  activeInlineRowId,';
if (content.includes(onEditLineDestructuring) && !content.includes(onEditLineDestructuringReplacement)) {
  content = content.replace(onEditLineDestructuring, onEditLineDestructuringReplacement);
  changes++;
  console.log('Added onGanttBarChange to destructured props');
}

// 3. Add onGanttBarChange prop type to WorkScheduleOverview props interface
const onEditLineType = '  onEditLine: (line: WorkScheduleLineRecord) => void;\n  activeInlineRowId: string | null;';
const onEditLineTypeReplacement = '  onEditLine: (line: WorkScheduleLineRecord) => void;\n  onGanttBarChange?: (line: WorkScheduleLineRecord, result: GanttBarChangeResult) => void;\n  activeInlineRowId: string | null;';
if (content.includes(onEditLineType) && !content.includes('onGanttBarChange?:')) {
  content = content.replace(onEditLineType, onEditLineTypeReplacement);
  changes++;
  console.log('Added onGanttBarChange prop type');
}

// 4. Add handleGanttBarChange after persistWorkScheduleLine
const persistEnd = `    return (await response.json()) as WorkScheduleViewRecord;\n  }\n\n  async function handleSave() {`;
const persistEndReplacement = `    return (await response.json()) as WorkScheduleViewRecord;\n  }\n\n  const handleGanttBarChange = useCallback(async (line: WorkScheduleLineRecord, result: GanttBarChangeResult) => {\n    const editableLine: EditableLine = {\n      budgetItemId: line.budgetItemId,\n      description: line.description,\n      quantity: line.quantity,\n      performance: line.performance,\n      startDate: result.startDate,\n      endDate: result.endDate,\n      durationDays: result.durationDays,\n      predecessor: line.predecessor ?? "",\n      crew: line.crew?.toString() ?? "",\n      monthlyDistributions: result.monthlyDistributions,\n    };\n\n    try {\n      const nextData = await persistWorkScheduleLine(editableLine);\n      setData(normalizeWorkScheduleView(nextData));\n    } catch {\n      // Bar snaps back visually since we do not mutate local state optimistically\n    }\n  }, [persistWorkScheduleLine]);\n\n  async function handleSave() {`;

if (content.includes(persistEnd) && !content.includes('handleGanttBarChange')) {
  content = content.replace(persistEnd, persistEndReplacement);
  changes++;
  console.log('Added handleGanttBarChange handler');
}

// 5. Pass onGanttBarChange to WorkScheduleOverview JSX
const overviewCall = '          onEditLine={handleEditLine}\n        />';
const overviewCallReplacement = '          onEditLine={handleEditLine}\n          onGanttBarChange={handleGanttBarChange}\n        />';
if (content.includes(overviewCall) && !content.includes('onGanttBarChange={handleGanttBarChange}')) {
  content = content.replace(overviewCall, overviewCallReplacement);
  changes++;
  console.log('Passed onGanttBarChange to WorkScheduleOverview');
}

// 6. Update TimelineRow JSX call to include new props
const timelineCallOld = `                          <TimelineRow\n                            key={item.key}\n                            row={item.row}\n                            timelineDays={timelineDays}\n                            timelineDayIndexByIso={timelineDayIndexByIso}\n                            currency={data.currency}\n                            currencyDecimals={currencyDecimals}\n                            showCriticalPath={showCriticalPath}\n                            timelineDayWidth={getZoomedTimelineDayWidth(timelineZoomPercent)}\n                            timelineDayGap={getZoomedTimelineDayGap(timelineZoomPercent)}\n                            highlighted={item.row.kind === "line" && highlightedBudgetItemId === item.row.line.budgetItemId}\n                            rowHeight={normalizeMeasuredHeight(\n                              tableLineHeights[item.row.rowId] ?? OVERVIEW_LINE_ROW_ESTIMATED_HEIGHT,\n                              OVERVIEW_SYNCHRONIZED_MIN_ROW_HEIGHT,\n                            )}\n                          />`;

const timelineCallNew = `                          <TimelineRow\n                            key={item.key}\n                            row={item.row}\n                            timelineDays={timelineDays}\n                            timelineDayIndexByIso={timelineDayIndexByIso}\n                            currency={data.currency}\n                            currencyDecimals={currencyDecimals}\n                            showCriticalPath={showCriticalPath}\n                            timelineDayWidth={getZoomedTimelineDayWidth(timelineZoomPercent)}\n                            timelineDayGap={getZoomedTimelineDayGap(timelineZoomPercent)}\n                            highlighted={item.row.kind === "line" && highlightedBudgetItemId === item.row.line.budgetItemId}\n                            rowHeight={normalizeMeasuredHeight(\n                              tableLineHeights[item.row.rowId] ?? OVERVIEW_LINE_ROW_ESTIMATED_HEIGHT,\n                              OVERVIEW_SYNCHRONIZED_MIN_ROW_HEIGHT,\n                            )}\n                            timelineStartIso={timelineDays[0]?.iso ?? null}\n                            timelineEndIso={timelineDays[timelineDays.length - 1]?.iso ?? null}\n                            onGanttBarChange={onGanttBarChange}\n                          />`;

if (content.includes(timelineCallOld)) {
  content = content.replace(timelineCallOld, timelineCallNew);
  changes++;
  console.log('Updated TimelineRow JSX call');
} else {
  console.log('WARNING: Could not find TimelineRow JSX call to update');
}

fs.writeFileSync(filePath, content, 'utf-8');
console.log(`Done. Applied ${changes} changes.`);
