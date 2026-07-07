const fs = require("fs");
const path = require("path");

const filepath = path.join(__dirname, "..", "components", "budget", "work-schedule-page-content.tsx");
let lines = fs.readFileSync(filepath, "utf-8").split("\n");

// Check for duplicate workCalendar lines and remove extras
const workCalendarLineStr = "  workCalendar: { workDays: number } | null | undefined;";

// Step 1: Remove workCalendar from WorkScheduleOverview destructured props (around line 2756 area)
// The overview destructure has onInlineRowCancel, workCalendar, onGanttBarChange,
// We need to remove workCalendar, from that area (not from the LineRow component)
for (let i = 0; i < lines.length; i++) {
  if (lines[i].trim() === "workCalendar,") {
    // If next line has onGanttBarChange, this is the WorkScheduleOverview area - REMOVE
    if (lines[i + 1] && lines[i + 1].includes("onGanttBarChange")) {
      lines.splice(i, 1);
      console.log(`Removed workCalendar, from WorkScheduleOverview props at line ${i + 1}`);
      break;
    }
  }
}

// Step 2: Remove duplicate workCalendar type definition in LineRowProps
let foundWorkCalendarType = false;
for (let i = 0; i < lines.length; i++) {
  if (lines[i] === workCalendarLineStr) {
    if (foundWorkCalendarType) {
      // This is a duplicate - remove it
      lines.splice(i, 1);
      console.log(`Removed duplicate workCalendar type def at line ${i + 1}`);
      break;
    }
    foundWorkCalendarType = true;
  }
}

// Step 3: Remove duplicate workCalendar, destructured prop (if any)
let foundWorkCalendarDestructured = false;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].trim() === "workCalendar,") {
    if (foundWorkCalendarDestructured) {
      lines.splice(i, 1);
      console.log(`Removed duplicate workCalendar, destructured at line ${i + 1}`);
      break;
    }
    foundWorkCalendarDestructured = true;
  }
}

fs.writeFileSync(filepath, lines.join("\n"), "utf-8");
console.log("Cleanup done.");
