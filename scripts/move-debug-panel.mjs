import fs from "fs";

const filePath = "components/budget/budget-editor.tsx";
let c = fs.readFileSync(filePath, "utf-8");

const nl = "\r\n";

// Step 1: Remove PreviewDebugPanel from inside panel.result block
const oldDebugUsage = `              </div>${nl}                <PreviewDebugPanel debug={panel.result.debug} />${nl}              <div className="mt-4 flex shrink-0 justify-end gap-2 border-t border-slate-100 pt-3">`;

const newDebugUsage = `              </div>${nl}              <div className="mt-4 flex shrink-0 justify-end gap-2 border-t border-slate-100 pt-3">`;

if (c.includes(oldDebugUsage)) {
  c = c.replace(oldDebugUsage, newDebugUsage);
  console.log("✅ Step 1: Removed PreviewDebugPanel from inside result block");
} else {
  console.log("❌ Step 1: Pattern not found");
  const idx = c.indexOf("PreviewDebugPanel");
  if (idx > -1) {
    console.log("  Found at", idx, "context:", JSON.stringify(c.slice(idx - 100, idx + 100)));
  }
}

// Step 2: Add PreviewDebugPanel after the panel.result block ends (after the last null)
// The pattern is: `          ) : null}` which closes the panel.result ternary
// Let's find the null that closes the panel.result block and add debug panel after it
const resultBlockEnd = `          ) : null}`;

// But we need to be careful - this pattern appears multiple times.
// Let's find the specific one that closes the panel.result block.
// It should be around where the PreviewDebugPanel was (before we removed it)
const importIdx = c.indexOf("import { PreviewDebugPanel }");
console.log("Import at", importIdx);

// Find the buttons section div (the one we already know about)
const buttonsDiv = `flex shrink-0 justify-end gap-2 border-t border-slate-100 pt-3">`;
const buttonsIdx = c.indexOf(buttonsDiv);
console.log("Buttons div at", buttonsIdx);

// Find the closing of the panel.result block - there should be a null before the buttons
// Let's look for the pattern: `          </div>${nl}          ) : null}` near the buttons
const beforeNullArea = c.slice(buttonsIdx - 400, buttonsIdx);
const nullMatch = beforeNullArea.lastIndexOf(") : null}");
console.log("nullMatch relative to buttons:", nullMatch - (buttonsIdx - 400));

// Find the exact string to replace
const searchArea = c.slice(buttonsIdx - 300, buttonsIdx);
const nullIdx = searchArea.lastIndexOf(") : null}");
if (nullIdx > -1) {
  const nullString = searchArea.slice(nullIdx);
  console.log("Found closing null:", JSON.stringify(nullString.slice(0, 60)));
  
  // Replace `          ) : null}` with `          ) : null}${debugPanelAddition}`
  const debugPanelAddition = `${nl}              <PreviewDebugPanel debug={panel.kind === "review" ? panel.result?.debug : panel.result?.debug} />`;
  const newSection = nullString + debugPanelAddition;
  
  // Get the exact context to replace
  const oldSection = c.slice(buttonsIdx - 300 + nullIdx, buttonsIdx);
  c = c.replace(oldSection + buttonsDiv.slice(0, 20), newSection + buttonsDiv.slice(0, 20));
  console.log("✅ Step 2: Added PreviewDebugPanel after result block");
} else {
  console.log("❌ Step 2: Could not find the closing null pattern");
  console.log("Search area:", JSON.stringify(searchArea.slice(-200)));
}

fs.writeFileSync(filePath, c, "utf-8");
console.log("\n✅ File written");
