// Fix script: add workCalendar prop to WorkScheduleLineTableRow and WorkScheduleLevelTableRow
const fs = require("fs");
const path = require("path");

const filepath = path.join(__dirname, "..", "components", "budget", "work-schedule-page-content.tsx");
let content = fs.readFileSync(filepath, "utf-8");

// =============================================================================
// 1. Add workCalendar to WorkScheduleLineTableRowProps type (after line 3099: "};")
// =============================================================================
const lineRowPropsEnd = `  onInlineRowCancel: (rowId: string) => void;\n};`;
const newLineRowPropsEnd = `  onInlineRowCancel: (rowId: string) => void;\n  workCalendar: { workDays: number } | null | undefined;\n};`;
content = content.replace(lineRowPropsEnd, newLineRowPropsEnd);

// =============================================================================
// 2. Add workCalendar to WorkScheduleLevelTableRowProps type
// =============================================================================
const levelRowPropsEnd = `  onRegisterRow: (rowId: string, element: HTMLElement | null) => void;\n};`;
const newLevelRowPropsEnd = `  onRegisterRow: (rowId: string, element: HTMLElement | null) => void;\n  workCalendar: { workDays: number } | null | undefined;\n};`;
// Only replace the second occurrence (level row props)
const firstOccurrence = content.indexOf(levelRowPropsEnd);
const secondOccurrence = content.indexOf(levelRowPropsEnd, firstOccurrence + 1);
if (secondOccurrence > 0) {
  content = content.slice(0, secondOccurrence) + newLevelRowPropsEnd + content.slice(secondOccurrence + levelRowPropsEnd.length);
} else {
  console.error("ERROR: Could not find WorkScheduleLevelTableRowProps end marker");
  process.exit(1);
}

// =============================================================================
// 3. Add workCalendar to WorkScheduleLineTableRow destructured props
// =============================================================================
const lineRowPropsDestructure = `  onInlineRowSave,\n  onInlineRowCancel,\n}: WorkScheduleLineTableRowProps)`;
const newLineRowPropsDestructure = `  onInlineRowSave,\n  onInlineRowCancel,\n  workCalendar,\n}: WorkScheduleLineTableRowProps)`;
content = content.replace(lineRowPropsDestructure, newLineRowPropsDestructure);

// =============================================================================
// 4. Add workCalendar to WorkScheduleLevelTableRow destructured props
// =============================================================================
const levelRowPropsDestructure = `  onToggleCollapsed,\n  onRegisterRow,\n}: WorkScheduleLevelTableRowProps)`;
const newLevelRowPropsDestructure = `  onToggleCollapsed,\n  onRegisterRow,\n  workCalendar,\n}: WorkScheduleLevelTableRowProps)`;
content = content.replace(levelRowPropsDestructure, newLevelRowPropsDestructure);

// =============================================================================
// 5. Pass workCalendar at WorkScheduleLineTableRow call site
// =============================================================================
const lineRowCallEnd = `              onInlineRowCancel={handleInlineRowCancel}`;
const newLineRowCallEnd = `              onInlineRowCancel={handleInlineRowCancel}\n              workCalendar={data.workCalendar}`;
content = content.replace(lineRowCallEnd, newLineRowCallEnd);

// =============================================================================
// 6. Pass workCalendar at WorkScheduleLevelTableRow call site
// =============================================================================
const levelRowCallEnd = `              onRegisterRow={setLineRowRef}`;
const newLevelRowCallEnd = `              onRegisterRow={setLineRowRef}\n              workCalendar={data.workCalendar}`;
// This pattern appears twice (line row and level row). Only change the level row one.
// The line row one was already changed. Let me find the right occurrence.
// The line row uses the same pattern: `onRegisterRow={setLineRowRef}`
// Actually, they're different - the line row call site has `onRegisterRow={setLineRowRef}` too.
// Let me handle this differently. I already changed the one before line row. 
// Now I need to change only the level row one, which comes after.
const firstRegisterRow = content.indexOf(levelRowCallEnd);
const secondRegisterRow = content.indexOf(levelRowCallEnd, firstRegisterRow + levelRowCallEnd.length);
if (secondRegisterRow > 0) {
  content = content.slice(0, secondRegisterRow + levelRowCallEnd.length) + "\n" + "              workCalendar={data.workCalendar}" + content.slice(secondRegisterRow + levelRowCallEnd.length);
} else {
  console.error("ERROR: Could not find second onRegisterRow occurrence for level row call site");
  process.exit(1);
}

fs.writeFileSync(filepath, content, "utf-8");
console.log("All workCalendar prop changes applied successfully to", filepath);
