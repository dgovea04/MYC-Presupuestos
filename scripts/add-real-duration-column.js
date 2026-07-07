// Script to add "Dur. real" column to work schedule overview table
const fs = require("fs");
const path = require("path");

const filepath = path.join(__dirname, "..", "components", "budget", "work-schedule-page-content.tsx");
let content = fs.readFileSync(filepath, "utf-8");

// =============================================================================
// 1. Add helper function for formatting real duration
// =============================================================================
const helperFunction = `
function formatRealDuration(
  startDate: string | null | undefined,
  endDate: string | null | undefined,
  workCalendar: { workDays: number } | null | undefined,
): string {
  if (!startDate || !endDate || !workCalendar) return "-";
  try {
    const work = countWorkDays(startDate, endDate, workCalendar.workDays);
    const cal = countCalendarDays(startDate, endDate);
    return \`\${work}h / \${cal}u\`;
  } catch {
    return "-";
  }
}
`;

// Insert helper after the checkRowDiff function or before WorkScheduleOverview
// Find a good insertion point: right before "// ── Virtual window helpers"
const virtualWindowMarker = "// Virtual window helpers";
const virtualWindowIdx = content.indexOf(virtualWindowMarker);
if (virtualWindowIdx > 0) {
  // Find the preceding newline to insert before this comment
  const insertIdx = content.lastIndexOf("\n", virtualWindowIdx - 1);
  content = content.slice(0, insertIdx) + "\n" + helperFunction + content.slice(insertIdx);
} else {
  console.log("WARNING: Could not find '// Virtual window helpers' marker, trying alternative...");
  // Try inserting before "function WorkScheduleOverview"
  const overviewMarker = "function WorkScheduleOverview(";
  const overviewIdx = content.indexOf(overviewMarker);
  if (overviewIdx > 0) {
    const insertIdx = content.lastIndexOf("\n", overviewIdx - 1);
    content = content.slice(0, insertIdx) + "\n" + helperFunction + "\n" + content.slice(insertIdx);
  } else {
    console.error("ERROR: Could not find insertion point for helper function");
    process.exit(1);
  }
}

// =============================================================================
// 2. Add "Dur. real" column header after the Duracion header
// =============================================================================
const duracionHeader = `<TH className={cn(OVERVIEW_HEADER_HEIGHT_CLASS, "py-0 align-middle")}>Duracion</TH>`;
const newHeader = `<TH className={cn(OVERVIEW_HEADER_HEIGHT_CLASS, "py-0 align-middle")}>Dur. real</TH>`;
const duracionHeaderIdx = content.indexOf(duracionHeader);
if (duracionHeaderIdx > 0) {
  const endIdx = duracionHeaderIdx + duracionHeader.length;
  content = content.slice(0, endIdx) + "\n" + "                        " + newHeader + content.slice(endIdx);
} else {
  console.error("ERROR: Could not find Duracion header");
  process.exit(1);
}

// =============================================================================
// 3. Add real duration cell after inline durationDays TD (for line rows)
// =============================================================================
// The inline duration cell ends with: `line.durationDays ?? "-"\n        )}\n      </TD>`
const inlineDurationEndPattern = `line.durationDays ?? "-"`;
const inlineDurationIdx = content.indexOf(inlineDurationEndPattern);
if (inlineDurationIdx > 0) {
  // Find the closing </TD> after this
  const afterDuration = content.slice(inlineDurationIdx);
  const closingTdIdx = afterDuration.indexOf("</TD>");
  if (closingTdIdx > 0) {
    const insertIdx = inlineDurationIdx + closingTdIdx + "</TD>".length;
    const newCell = `
      <TD className="align-middle text-[11px] text-[var(--app-text-muted)]">
        {formatRealDuration(line.startDate, line.endDate, data.workCalendar)}
      </TD>`;
    content = content.slice(0, insertIdx) + newCell + content.slice(insertIdx);
  }
}

// =============================================================================
// 4. Add real duration cell after level summary duration TD
// =============================================================================
const levelDurationPattern = `<TD className="align-middle">{row.durationDays ?? "-"}</TD>`;
const levelDurationIdx = content.indexOf(levelDurationPattern);
if (levelDurationIdx > 0) {
  const endIdx = levelDurationIdx + levelDurationPattern.length;
  const newCell = `
                    <TD className="align-middle text-[11px] text-[var(--app-text-muted)]">
                      {formatRealDuration(row.startDate, row.endDate, data.workCalendar)}
                    </TD>`;
  content = content.slice(0, endIdx) + newCell + content.slice(endIdx);
}

// =============================================================================
// 5. Update CSV export headers (two locations)
// =============================================================================
// Pattern: `"Item", "Partida", "Duracion", "Inicio",`
const csvHeaderPattern = `"Item", "Partida", "Duracion", "Inicio",`;
const newCsvHeader = `"Item", "Partida", "Duracion", "Dur. real", "Inicio",`;
content = content.split(csvHeaderPattern).join(newCsvHeader);

// Update the CSV data row generation that maps to durationDays (line ~6188)
// Pattern: `line.durationDays != null ? String(line.durationDays) : "-",`
// Insert the real duration value before this line
const csvDurationValuePattern = `line.durationDays != null ? String(line.durationDays) : "-",`;
const newCsvDurationValue = `line.durationDays != null ? String(line.durationDays) : "-",
            line.startDate && line.endDate && data.workCalendar ? \`\${countWorkDays(line.startDate, line.endDate, data.workCalendar.workDays)}h / \${countCalendarDays(line.startDate, line.endDate)}u\` : "-",`;
// Only replace the first occurrence (overview CSV)
const csvDurationIdx = content.indexOf(csvDurationValuePattern);
if (csvDurationIdx > 0) {
  const endIdx = csvDurationIdx + csvDurationValuePattern.length;
  content = content.slice(0, endIdx) + "\n" + newCsvDurationValue + content.slice(endIdx);
}

// =============================================================================
// 6. Update workbook export headers
// =============================================================================
// Pattern: `{ value: line.durationDays ?? "-" },` (line ~6555)
const wbDurationValuePattern = `{ value: line.durationDays ?? "-" },`;
const newWbDurationValue = `{ value: line.durationDays ?? "-" },
            { value: line.startDate && line.endDate && data.workCalendar ? \`\${countWorkDays(line.startDate, line.endDate, data.workCalendar.workDays)}h / \${countCalendarDays(line.startDate, line.endDate)}u\` : "-" },`;
// Only replace the first occurrence (overview workbook export)
const wbDurationIdx = content.indexOf(wbDurationValuePattern);
if (wbDurationIdx > 0) {
  const endIdx = wbDurationIdx + wbDurationValuePattern.length;
  content = content.slice(0, endIdx) + "\n" + newWbDurationValue + content.slice(endIdx);
}

fs.writeFileSync(filepath, content, "utf-8");
console.log("All changes applied successfully to", filepath);
