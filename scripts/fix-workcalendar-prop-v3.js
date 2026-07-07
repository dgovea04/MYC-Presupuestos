const fs = require("fs");
const path = require("path");

const filepath = path.join(__dirname, "..", "components", "budget", "work-schedule-page-content.tsx");
let lines = fs.readFileSync(filepath, "utf-8").split("\n");

function insertAfter(lines, predicate, newLine) {
  for (let i = 0; i < lines.length; i++) {
    if (predicate(lines[i], i)) {
      lines.splice(i + 1, 0, newLine);
      console.log(`Inserted after line ${i + 1}: ${newLine.trim()}`);
      return true;
    }
  }
  console.log(`NOT FOUND for: ${newLine.trim()}`);
  return false;
}

// ---- Add workCalendar to WorkScheduleLineTableRowProps type ----
insertAfter(lines, (l) => l.trim() === "onInlineRowCancel: (rowId: string) => void;", 
  "  workCalendar: { workDays: number } | null | undefined;");

// ---- Add workCalendar to WorkScheduleLevelTableRowProps type ----
// This is the second "onRegisterRow: (rowId..." line with "element:" (type definition)
let foundFirstRegisterRow = false;
for (let i = 0; i < lines.length; i++) {
  const l = lines[i].trim();
  if (l.includes("onRegisterRow: (rowId: string, element: HTMLElement") && l.endsWith("void;")) {
    if (foundFirstRegisterRow) {
      lines.splice(i + 1, 0, "  workCalendar: { workDays: number } | null | undefined;");
      console.log(`Inserted workCalendar in LevelRow props after line ${i + 1}`);
      break;
    }
    foundFirstRegisterRow = true;
  }
}

// ---- Add workCalendar to WorkScheduleLineTableRow destructured props ----
insertAfter(lines, (l) => l.trim() === "onInlineRowCancel," && lines[lines.indexOf(l) + 1] && lines[lines.indexOf(l) + 1].includes("}: WorkScheduleLineTableRowProps"),
  "  workCalendar,");

// ---- Add workCalendar to WorkScheduleLevelTableRow destructured props ----
const levelFuncIdx = lines.findIndex(l => l.includes("const WorkScheduleLevelTableRow = memo(function WorkScheduleLevelTableRow("));
if (levelFuncIdx >= 0) {
  for (let i = levelFuncIdx; i < Math.min(lines.length, levelFuncIdx + 15); i++) {
    if (lines[i].trim() === "onRegisterRow," && lines[i+1] && lines[i+1].includes("}: WorkScheduleLevelTableRowProps")) {
      lines.splice(i + 1, 0, "  workCalendar,");
      console.log(`Inserted workCalendar in LevelRow destructure after line ${i + 1}`);
      break;
    }
  }
}

// ---- Add workCalendar prop at WorkScheduleLineTableRow call site ----
for (let i = 0; i < lines.length; i++) {
  if (lines[i].trim() === "onInlineRowCancel={handleInlineRowCancel}") {
    // Check if next non-empty line is the Level row
    let nextNonEmpty = "";
    for (let j = i + 1; j < Math.min(lines.length, i + 5); j++) {
      if (lines[j].trim()) { nextNonEmpty = lines[j].trim(); break; }
    }
    if (nextNonEmpty.includes("WorkScheduleLevelTableRow")) {
      lines.splice(i + 1, 0, "              workCalendar={data.workCalendar}");
      console.log(`Added workCalendar to LineRow call site after line ${i + 1}`);
      break;
    }
  }
}

// ---- Add workCalendar prop at WorkScheduleLevelTableRow call site ----
let afterLineRowCall = false;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].trim() === "onInlineRowCancel={handleInlineRowCancel}") {
    afterLineRowCall = true;
    continue;
  }
  if (afterLineRowCall && lines[i].trim() === "onRegisterRow={setLineRowRef}") {
    lines.splice(i + 1, 0, "              workCalendar={data.workCalendar}");
    console.log(`Added workCalendar to LevelRow call site after line ${i + 1}`);
    break;
  }
}

// ---- Fix cells to use the workCalendar prop instead of data.workCalendar ----
// For line row cell (formatRealDuration(line.startDate, line.endDate, data.workCalendar))
lines = lines.map(l => l.replace(
  "formatRealDuration(line.startDate, line.endDate, data.workCalendar)",
  "formatRealDuration(line.startDate, line.endDate, workCalendar)"
));

// For level row cell (formatRealDuration(row.startDate, row.endDate, data.workCalendar))
lines = lines.map(l => l.replace(
  "formatRealDuration(row.startDate, row.endDate, data.workCalendar)",
  "formatRealDuration(row.startDate, row.endDate, workCalendar)"
));

fs.writeFileSync(filepath, lines.join("\n"), "utf-8");
console.log("Done. All workCalendar prop changes applied.");
