const fs = require("fs");

// ===== FIX 1: Line 378 - performance ?? null in handleGanttBarChange =====
{
  const path = "components/budget/work-schedule-page-content.tsx";
  let lines = fs.readFileSync(path, "utf8").split("\n");
  let found = false;
  // Find the first occurrence of "performance: line.performance," in handleGanttBarChange context
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === "performance: line.performance," && lines[i-1]?.includes("quantity:")) {
      lines[i] = "      performance: line.performance ?? null,";
      console.log("Fix 1 (line 378): performance ?? null at line " + (i + 1));
      found = true;
      break;
    }
  }
  if (!found) console.log("Fix 1 FAILED");
  fs.writeFileSync(path, lines.join("\n"));
}

// ===== FIX 2: Lines 1507, 5996-5997 - availableRange on valuationCalendar type =====
{
  const path = "types/work-schedule.ts";
  let content = fs.readFileSync(path, "utf8");
  
  // Replace inline valuationCalendar type with WorkScheduleValuationCalendarRecord
  const oldType = `  valuationCalendar: {
    periods: WorkSchedulePeriodRecord[];
    rows: WorkScheduleValuationCalendarRow[];
  } | null;`;
  const newType = `  valuationCalendar: WorkScheduleValuationCalendarRecord | null;`;
  
  if (content.includes(oldType)) {
    content = content.replace(oldType, newType);
    console.log("Fix 2: valuationCalendar type updated in WorkScheduleViewRecord");
  } else {
    console.log("Fix 2 FAILED - couldn't find the inline type");
  }
  
  fs.writeFileSync(path, content);
}

// ===== FIX 3: Import WorkScheduleValuationCalendarRecord in work-schedule-page-content.tsx =====
{
  const path = "components/budget/work-schedule-page-content.tsx";
  let lines = fs.readFileSync(path, "utf8").split("\n");
  
  // Find the import line that has WorkScheduleValuationCalendarRow
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes("WorkScheduleValuationCalendarRow,") && lines[i].includes("} from \"@/types/work-schedule\"")) {
      // Add WorkScheduleValuationCalendarRecord before WorkScheduleValuationCalendarRow
      const oldLine = lines[i];
      if (oldLine.includes("WorkScheduleValuationCalendarRecord")) {
        console.log("Fix 3: WorkScheduleValuationCalendarRecord already imported");
        break;
      }
      lines[i] = oldLine.replace("WorkScheduleValuationCalendarRow,", "WorkScheduleValuationCalendarRecord,\n  WorkScheduleValuationCalendarRow,");
      console.log("Fix 3: Added WorkScheduleValuationCalendarRecord import");
      break;
    }
  }
  fs.writeFileSync(path, lines.join("\n"));
}

// ===== FIX 4: Lines 2712, 3015 - Add onInlinePredecessorChange to WorkScheduleLineTableRowProps =====
{
  const path = "components/budget/work-schedule-page-content.tsx";
  let lines = fs.readFileSync(path, "utf8").split("\n");
  
  // Find the WorkScheduleLineTableRowProps type definition and add onInlinePredecessorChange
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === "onInlineDraftChange: (rowId: string, draft: EditableLine) => void;" &&
        lines[i + 1]?.trim() === "onInlineRowSave: (rowId: string) => void;") {
      lines.splice(i + 1, 0, "  onInlinePredecessorChange: (rowId: string, line: EditableLine, predecessor: string) => void;");
      console.log("Fix 4: Added onInlinePredecessorChange to WorkScheduleLineTableRowProps at line " + (i + 2));
      break;
    }
  }
  fs.writeFileSync(path, lines.join("\n"));
}

console.log("Done");
