const fs = require("fs");
const path = require("path");

const filepath = path.join(__dirname, "..", "components", "budget", "work-schedule-page-content.tsx");
let lines = fs.readFileSync(filepath, "utf-8").split("\n");

/*** Check if fix already applied */
if (lines.some((l) => l.includes("workCalendar: { workDays: number } | null | undefined"))) {
  console.log("workCalendar prop already added. Nothing to do.");
  process.exit(0);
}

/*** Add workCalendar to WorkScheduleLineTableRowProps (before "};" that follows onInlineRowCancel) */
for (let i = 0; i < lines.length; i++) {
  if (lines[i].trim() === "};" && i > 0 && lines[i - 1].includes("onInlineRowCancel")) {
    lines.splice(i, 0, "  workCalendar: { workDays: number } | null | undefined;");
    console.log(`Added workCalendar to LineRow props after line ${i}`);
    break;
  }
}

/*** Add workCalendar to WorkScheduleLevelTableRowProps (before "};" that follows onRegisterRow in type) */
for (let i = 0; i < lines.length; i++) {
  if (lines[i].trim() === "};" && i > 0 && lines[i - 1].includes("onRegisterRow") && lines[i - 1].includes("element:")) {
    lines.splice(i, 0, "  workCalendar: { workDays: number } | null | undefined;");
    console.log(`Added workCalendar to LevelRow props after line ${i}`);
    break;
  }
}

/*** Add workCalendar to WorkScheduleLineTableRow destructured props (after onInlineRowCancel) */
for (let i = 0; i < lines.length; i++) {
  if (lines[i].trim() === "onInlineRowCancel," && lines[i + 1] && lines[i + 1].includes("}: WorkScheduleLineTableRowProps)")) {
    lines.splice(i + 1, 0, "  workCalendar,");
    console.log(`Added workCalendar to LineRow destructured props after line ${i}`);
    break;
  }
}

/*** Add workCalendar to WorkScheduleLevelTableRow destructured props (after onRegisterRow, before closing) */
const levelRowFuncStart = lines.findIndex((l) => l.includes("const WorkScheduleLevelTableRow = memo(function WorkScheduleLevelTableRow("));
if (levelRowFuncStart >= 0) {
  for (let i = levelRowFuncStart; i < lines.length && i < levelRowFuncStart + 20; i++) {
    if (lines[i].trim() === "onRegisterRow," && lines[i + 1] && lines[i + 1].includes("}: WorkScheduleLevelTableRowProps)")) {
      lines.splice(i + 1, 0, "  workCalendar,");
      console.log(`Added workCalendar to LevelRow destructured props after line ${i}`);
      break;
    }
  }
}

/*** Add workCalendar prop at WorkScheduleLineTableRow call site (first occurrence) */
for (let i = 0; i < lines.length; i++) {
  if (lines[i].trim() === "onInlineRowCancel={handleInlineRowCancel}" && lines[i + 1] && lines[i + 1].includes("<WorkScheduleLevelTableRow")) {
    lines.splice(i + 1, 0, "              workCalendar={data.workCalendar}");
    console.log(`Added workCalendar to LineRow call site after line ${i}`);
    break;
  }
}

/*** Add workCalendar prop at WorkScheduleLevelTableRow call site (after onRegisterRow={setLineRowRef}) */
let foundLineRowCall = false;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].trim() === "onInlineRowCancel={handleInlineRowCancel}") {
    foundLineRowCall = true;
    continue;
  }
  if (foundLineRowCall && lines[i].trim() === "onRegisterRow={setLineRowRef}") {
    lines.splice(i + 1, 0, "              workCalendar={data.workCalendar}");
    console.log(`Added workCalendar to LevelRow call site after line ${i}`);
    break;
  }
}

fs.writeFileSync(filepath, lines.join("\n"), "utf-8");
console.log("Done.");
