import fs from "fs";

const filePath = "components/budget/budget-editor.tsx";
let c = fs.readFileSync(filePath, "utf-8");

const nl = "\r\n";

// Change 1: Extend AiBudgetPanelState review type with requestSummary
const reviewTypeStart = `      kind: "review";${nl}      title: string;${nl}      result: AiEndpointResult | null;${nl}      loading: boolean;${nl}      error: string;${nl}    };`;

const reviewTypeEnd = `      kind: "review";${nl}      title: string;${nl}      result: AiEndpointResult | null;${nl}      loading: boolean;${nl}      error: string;${nl}      requestSummary?: {${nl}        items: number;${nl}        totalDirectCost: number;${nl}        budgetName: string;${nl}        currency: string;${nl}        projectName?: string;${nl}      };${nl}    };`;

if (c.includes(reviewTypeStart)) {
  c = c.replace(reviewTypeStart, reviewTypeEnd);
  console.log("✅ Change 1: Type extended with requestSummary");
} else {
  console.log("❌ Change 1: Pattern not found");
  const idx = c.indexOf('kind: "review"');
  if (idx > -1) {
    console.log("  Found at", idx, "context:", JSON.stringify(c.slice(idx, idx + 200)));
  }
}

// Change 2: Capture request summary in runAiBudgetReview
const reviewFuncStart = `  async function runAiBudgetReview() {${nl}    const title = "Revision IA del presupuesto";${nl}    setAiPanel({ kind: "review", title, result: null, loading: true, error: "" });`;

const reviewFuncEnd = `  async function runAiBudgetReview() {${nl}    const title = "Revision IA del presupuesto";${nl}    const requestSummary = {${nl}      items: summary.items.length,${nl}      totalDirectCost: summary.totals.totalDirectCost,${nl}      budgetName: summary.name,${nl}      currency: summary.currency,${nl}      projectName,${nl}    };${nl}    setAiPanel({ kind: "review", title, result: null, loading: true, error: "", requestSummary });`;

if (c.includes(reviewFuncStart)) {
  c = c.replace(reviewFuncStart, reviewFuncEnd);
  console.log("✅ Change 2: Request summary captured");
} else {
  console.log("❌ Change 2: Pattern not found");
  const idx = c.indexOf("async function runAiBudgetReview()");
  if (idx > -1) {
    console.log("  Found at", idx, "context:", JSON.stringify(c.slice(idx, idx + 300)));
  }
}

// Change 3: Show PreviewDebugPanel on error too - find the debug panel usage
const debugIdx = c.indexOf("PreviewDebugPanel");
if (debugIdx > -1) {
  console.log("  PreviewDebugPanel found at", debugIdx);
  console.log("  Context:", JSON.stringify(c.slice(debugIdx - 60, debugIdx + 100)));
}

// Change 4 is already applied - it adds debug info after error message

fs.writeFileSync(filePath, c, "utf-8");
console.log("\n✅ File written successfully");
