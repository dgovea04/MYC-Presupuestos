const fs = require("fs");
const path = require("path");

const filepath = path.join(__dirname, "..", "components", "budget", "work-schedule-page-content.tsx");
let content = fs.readFileSync(filepath, "utf-8");

// ─────────────────────────────────────────────────────────────────────────
// 1. Add countCalendarDays import
// ─────────────────────────────────────────────────────────────────────────
content = content.replace(
  'import { countWorkDays } from "@/lib/work-schedule/calendar";',
  'import { countCalendarDays, countWorkDays } from "@/lib/work-schedule/calendar";'
);

// ─────────────────────────────────────────────────────────────────────────
// 2. Add realDuration column width
// ─────────────────────────────────────────────────────────────────────────
content = content.replace(
  "  duration: 88,",
  "  duration: 88,\n  realDuration: 108,"
);

// ─────────────────────────────────────────────────────────────────────────
// 3. Add realDuration to leftTableColumnWidths array (after duration)
// ─────────────────────────────────────────────────────────────────────────
content = content.replace(
  "OVERVIEW_TABLE_COLUMN_WIDTHS.duration,",
  "OVERVIEW_TABLE_COLUMN_WIDTHS.duration,\n      OVERVIEW_TABLE_COLUMN_WIDTHS.realDuration,"
);

// ─────────────────────────────────────────────────────────────────────────
// 4. Add "Dur. real" header after "Duracion" header
// ─────────────────────────────────────────────────────────────────────────
const duracionHeader = `<TH className={cn(OVERVIEW_HEADER_HEIGHT_CLASS, "py-0 align-middle")}>Duracion</TH>`;
const realDurationHeader = `<TH className={cn(OVERVIEW_HEADER_HEIGHT_CLASS, "py-0 align-middle")}>Dur. real</TH>`;
content = content.replace(duracionHeader, duracionHeader + "\n                        " + realDurationHeader);

// ─────────────────────────────────────────────────────────────────────────
// 5. Add formatRealDuration helper function (before WorkScheduleOverview)
// ─────────────────────────────────────────────────────────────────────────
const helperFn = `
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

// Insert before "function WorkScheduleOverview("
const overviewFnMarker = "\nfunction WorkScheduleOverview(";
const idx = content.indexOf(overviewFnMarker);
if (idx > 0) {
  content = content.slice(0, idx) + "\n" + helperFn + content.slice(idx);
}

// ─────────────────────────────────────────────────────────────────────────
// 6. Add workCalendar to WorkScheduleLineTableRowProps type definition
//    Target: the closing "};" right after "onInlineRowCancel: (rowId..."
// ─────────────────────────────────────────────────────────────────────────
// Use a unique anchor: the type definition starts with "type WorkScheduleLineTableRowProps = {"
// Find the closing "};" of that type block
const lineRowPropsStart = "type WorkScheduleLineTableRowProps = {";
const lineRowPropsStartIdx = content.indexOf(lineRowPropsStart);
if (lineRowPropsStartIdx > 0) {
  // Find the closing }; after this position
  const closingIdx = content.indexOf("\n};", lineRowPropsStartIdx);
  if (closingIdx > 0) {
    content = content.slice(0, closingIdx) + "\n  workCalendar: { workDays: number } | null | undefined;\n};" + content.slice(closingIdx + 3);
  }
}

// ─────────────────────────────────────────────────────────────────────────
// 7. Add workCalendar to WorkScheduleLevelTableRowProps type definition
// ─────────────────────────────────────────────────────────────────────────
const levelRowPropsStart = "type WorkScheduleLevelTableRowProps = {";
const levelRowPropsStartIdx = content.indexOf(levelRowPropsStart);
if (levelRowPropsStartIdx > 0) {
  const closingIdx = content.indexOf("\n};", levelRowPropsStartIdx);
  if (closingIdx > 0) {
    content = content.slice(0, closingIdx) + "\n  workCalendar: { workDays: number } | null | undefined;\n};" + content.slice(closingIdx + 3);
  }
}

// ─────────────────────────────────────────────────────────────────────────
// 8. Add workCalendar to WorkScheduleLineTableRow destructured props
//    Target: after "onInlineRowCancel," in the memo function params
// ─────────────────────────────────────────────────────────────────────────
// Find: "const WorkScheduleLineTableRow = memo(function WorkScheduleLineTableRow({"
// Then find the "onInlineRowCancel," line within its scope and add after it
const lineRowFnMarker = "const WorkScheduleLineTableRow = memo(function WorkScheduleLineTableRow({";
const lineRowFnIdx = content.indexOf(lineRowFnMarker);
if (lineRowFnIdx > 0) {
  // Find "onInlineRowCancel," after this position but before "}: WorkScheduleLineTableRowProps)"
  const section = content.slice(lineRowFnIdx);
  const closingParenIdx = section.indexOf("}: WorkScheduleLineTableRowProps)");
  if (closingParenIdx > 0) {
    const beforeClose = section.slice(0, closingParenIdx);
    const onInlineRowCancelIdx = beforeClose.lastIndexOf("onInlineRowCancel,");
    if (onInlineRowCancelIdx > 0) {
      const nextLineStart = beforeClose.indexOf("\n", onInlineRowCancelIdx);
      const insertPos = lineRowFnIdx + nextLineStart;
      content = content.slice(0, insertPos) + "\n  workCalendar," + content.slice(insertPos);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────
// 9. Add workCalendar to WorkScheduleLevelTableRow destructured props
// ─────────────────────────────────────────────────────────────────────────
const levelRowFnMarker = "const WorkScheduleLevelTableRow = memo(function WorkScheduleLevelTableRow({";
const levelRowFnIdx = content.indexOf(levelRowFnMarker);
if (levelRowFnIdx > 0) {
  const section = content.slice(levelRowFnIdx);
  const closingParenIdx = section.indexOf("}: WorkScheduleLevelTableRowProps)");
  if (closingParenIdx > 0) {
    const beforeClose = section.slice(0, closingParenIdx);
    const onRegisterRowIdx = beforeClose.lastIndexOf("onRegisterRow,");
    if (onRegisterRowIdx > 0) {
      const nextLineStart = beforeClose.indexOf("\n", onRegisterRowIdx);
      const insertPos = levelRowFnIdx + nextLineStart;
      content = content.slice(0, insertPos) + "\n  workCalendar," + content.slice(insertPos);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────
// 10. Pass workCalendar at WorkScheduleLineTableRow call site
//     Target: after "onInlineRowCancel={handleInlineRowCancel}" that's
//             followed by a closing tag "/>" or next prop for the LineRow
// ─────────────────────────────────────────────────────────────────────────
// Find the LineRow rendering: <WorkScheduleLineTableRow ... />
// It ends with some prop before either /> or the next component
// The unique marker: "onInlineRowCancel={handleInlineRowCancel}" followed by "/>"
// But it's followed by workCalendar={...} which we'll add
// Actually, the clear anchor is: onInlineRowCancel={handleInlineRowCancel}\n            />
// Let me find that pattern

const lineRowCallAnchor = "onInlineRowCancel={handleInlineRowCancel}\n            />";
if (content.includes(lineRowCallAnchor)) {
  content = content.replace(
    lineRowCallAnchor,
    "onInlineRowCancel={handleInlineRowCancel}\n              workCalendar={data.workCalendar}\n            />"
  );
} else {
  console.log("WARNING: LineRow call site anchor not found. Trying alternative...");
  // Try the multiline version
  const altAnchor = "            onInlineRowCancel={handleInlineRowCancel}";
  const altIdx = content.indexOf(altAnchor);
  if (altIdx > 0) {
    const afterIdx = content.indexOf("\n", altIdx + altAnchor.length);
    content = content.slice(0, afterIdx) + "\n              workCalendar={data.workCalendar}" + content.slice(afterIdx);
  }
}

// ─────────────────────────────────────────────────────────────────────────
// 11. Pass workCalendar at WorkScheduleLevelTableRow call site
// ─────────────────────────────────────────────────────────────────────────
const levelRowCallAnchor = "            onRegisterRow={setLineRowRef}\n            />";
if (content.includes(levelRowCallAnchor)) {
  // But wait - the LineRow also has onRegisterRow={setLineRowRef}
  // We need the SECOND occurrence (after the LineRow call)
  const firstIdx = content.indexOf(levelRowCallAnchor);
  const secondIdx = content.indexOf(levelRowCallAnchor, firstIdx + levelRowCallAnchor.length);
  if (secondIdx > 0) {
    content = content.slice(0, secondIdx) +
      "            onRegisterRow={setLineRowRef}\n              workCalendar={data.workCalendar}\n            />" +
      content.slice(secondIdx + levelRowCallAnchor.length);
  }
}

// ─────────────────────────────────────────────────────────────────────────
// 12. Add real duration cell in inline line rows
//     After the durationDays TD (which ends with `</TD>` after
//     `line.durationDays ?? "-"`), add a new TD
// ─────────────────────────────────────────────────────────────────────────
// The duration cell ends with:
// `line.durationDays ?? "-"\n        )}\n      </TD>`
const inlineDurationEnd = `line.durationDays ?? "-"\n        )}\n      </TD>`;
const newRealDurationCell = `
      <TD className="align-middle text-[11px] text-[var(--app-text-muted)]">
        {formatRealDuration(line.startDate, line.endDate, workCalendar)}
      </TD>`;

if (content.includes(inlineDurationEnd)) {
  content = content.replace(inlineDurationEnd, inlineDurationEnd + newRealDurationCell);
} else {
  console.log("WARNING: Inline duration end not found");
}

// ─────────────────────────────────────────────────────────────────────────
// 13. Add real duration cell in level summary rows
//     After `<TD className="align-middle">{row.durationDays ?? "-"}</TD>`
// ─────────────────────────────────────────────────────────────────────────
const levelDurationCell = `<TD className="align-middle">{row.durationDays ?? "-"}</TD>`;
const newLevelRealDurationCell = `
                    <TD className="align-middle text-[11px] text-[var(--app-text-muted)]">
                      {formatRealDuration(row.startDate, row.endDate, workCalendar)}
                    </TD>`;

if (content.includes(levelDurationCell)) {
  content = content.replace(levelDurationCell, levelDurationCell + newLevelRealDurationCell);
} else {
  console.log("WARNING: Level duration cell not found");
}

// ─────────────────────────────────────────────────────────────────────────
// 14. Update CSV export headers
// ─────────────────────────────────────────────────────────────────────────
const oldCsvHeaders = '"Item", "Partida", "Duracion", "Inicio",';
const newCsvHeaders = '"Item", "Partida", "Duracion", "Dur. real", "Inicio",';
content = content.split(oldCsvHeaders).join(newCsvHeaders);

// Add the real duration value in CSV data rows
const oldCsvDurationRow = 'line.durationDays != null ? String(line.durationDays) : "-",';
const newCsvDurationRow = oldCsvDurationRow + '\n            line.startDate && line.endDate && data.workCalendar ? `${countWorkDays(line.startDate, line.endDate, data.workCalendar.workDays)}h / ${countCalendarDays(line.startDate, line.endDate)}u` : "-",';
// Only replace the first occurrence (overview CSV)
const firstCsvDurationRow = content.indexOf(oldCsvDurationRow);
if (firstCsvDurationRow > 0) {
  content = content.slice(0, firstCsvDurationRow + oldCsvDurationRow.length) + "\n" + newCsvDurationRow + content.slice(firstCsvDurationRow + oldCsvDurationRow.length);
}

fs.writeFileSync(filepath, content, "utf-8");
console.log("All changes applied successfully.");
