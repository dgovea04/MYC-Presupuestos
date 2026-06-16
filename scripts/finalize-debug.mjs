import fs from "fs";

const filePath = "components/budget/budget-editor.tsx";
let c = fs.readFileSync(filePath, "utf-8");
const nl = "\r\n";

// The pattern: after the outer div closes and before Dialog.Content closes
// Insert PreviewDebugPanel between `          ) : null}` and `        </Dialog.Content>`
const oldPattern = `          ) : null}${nl}        </Dialog.Content>`;
const newPattern = `          ) : null}${nl}          <PreviewDebugPanel debug={panel.result?.debug} />${nl}        </Dialog.Content>`;

if (c.includes(oldPattern)) {
  c = c.replace(oldPattern, newPattern);
  console.log("✅ PreviewDebugPanel added outside result block");
} else {
  console.log("❌ Pattern not found");
  // Debug: find similar context
  const idx1 = c.indexOf(") : null}");
  if (idx1 > -1) {
    console.log("Found ) : null} at", idx1);
    console.log("Context:", JSON.stringify(c.slice(idx1, idx1 + 160)));
  }
}

fs.writeFileSync(filePath, c, "utf-8");
console.log("✅ File written");
