const fs = require("fs");
const path = require("path");

const filepath = path.join(__dirname, "..", "components", "budget", "work-schedule-page-content.tsx");
let content = fs.readFileSync(filepath, "utf-8");

// The duration cell in WorkScheduleLineTableRow ends with:
//   line.durationDays ?? "-"
//         )}
//       </TD>
// Followed immediately by the startDate cell:
//       <TD
//         className="align-middle"
//         data-testid={`work-schedule-inline-cell-startDate-

// Strategy: find the closing </TD> of durationDays cell by looking for
// the unique data-testid of the NEXT cell (startDate)
const marker = 'data-testid={`work-schedule-inline-cell-startDate-';
const markerIdx = content.indexOf(marker);
if (markerIdx < 0) {
  console.error("ERROR: Could not find startDate cell marker");
  process.exit(1);
}

// Go backwards from this marker to find the previous </TD>
const before = content.slice(0, markerIdx);
const lastClosingTd = before.lastIndexOf("</TD>");
if (lastClosingTd < 0) {
  console.error("ERROR: Could not find closing TD before startDate cell");
  process.exit(1);
}

const newCell = `
      <TD className="align-middle text-[11px] text-[var(--app-text-muted)]">
        {formatRealDuration(line.startDate, line.endDate, workCalendar)}
      </TD>`;

// Insert the new cell after the closing </TD> of the durationDays cell
content = content.slice(0, lastClosingTd + "</TD>".length) + newCell + content.slice(lastClosingTd + "</TD>".length);

fs.writeFileSync(filepath, content, "utf-8");
console.log("Successfully inserted real duration cell for line rows after durationDays TD");
