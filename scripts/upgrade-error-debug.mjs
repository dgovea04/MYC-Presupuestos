import fs from "fs";

const filePath = "components/budget/budget-editor.tsx";
let c = fs.readFileSync(filePath, "utf-8");
const nl = "\n";

const oldSection = `              {panel.kind === "review" && panel.requestSummary ? (${nl}                <div className="mt-2 shrink-0 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2">${nl}                  <p className="text-xs font-semibold text-amber-800">Debug - Datos de la solicitud</p>${nl}                  <pre className="mt-1 max-h-40 overflow-auto text-[11px] leading-relaxed text-amber-700">${nl}                    {JSON.stringify(panel.requestSummary, null, 2)}${nl}                  </pre>${nl}                </div>${nl}              ) : null}`;

const newSection = `              {panel.kind === "review" && panel.requestSummary ? (${nl}                <div className="mt-2">${nl}                  <PreviewDebugPanel${nl}                    debug={{${nl}                      context: panel.requestSummary,${nl}                      fallback: { reason: panel.error, timeout: true },${nl}                    }}${nl}                  />${nl}                </div>${nl}              ) : null}`;

if (c.includes(oldSection)) {
  c = c.replace(oldSection, newSection);
  console.log("✅ Error debug upgraded to PreviewDebugPanel");
} else {
  console.log("❌ Pattern not found");
  // Try \r\n
  const nl2 = "\r\n";
  const oldSection2 = oldSection.replaceAll(nl, nl2);
  if (c.includes(oldSection2)) {
    c = c.replace(oldSection2, newSection.replaceAll(nl, nl2));
    console.log("✅ Found with \\r\\n");
  } else {
    console.log("❌ Still not found");
    const idx = c.indexOf("Debug - Datos de la solicitud");
    if (idx > -1) {
      // Find exactly what's around there
      const charBefore = c.charCodeAt(idx - 3);
      const charAfter = c.charCodeAt(idx + 10);
      console.log("Char before:", charBefore, "Char after:", charAfter);
    }
  }
}

fs.writeFileSync(filePath, c, "utf-8");
console.log("✅ File written");
