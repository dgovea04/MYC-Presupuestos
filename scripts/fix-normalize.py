with open("components/budget/budget-editor.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# Fix 1: Replace the dirty .map() with clean .filter().map()
old_map = """    normalized.findings = data.critical_findings.map((finding: unknown) => {
      if (!isRecord(finding)) return finding;
      return {"""

new_map = """    normalized.findings = data.critical_findings
      .filter((f: unknown): f is Record<string, unknown> => isRecord(f))
      .map((finding) => {"""

content = content.replace(old_map, new_map, 1)

# Fix 2: Remove risk_level check from resolveFindingSeverity (risk_level is top-level, not per-finding)
old_severity = """function resolveFindingSeverity(finding: Record<string, unknown>): "low" | "medium" | "high" {
  if (typeof finding.severity === "string") {
    const s = finding.severity.toLowerCase();
    if (s === "low" || s === "medium" || s === "high") return s;
  }
  // Inferir severidad desde otros campos
  if (typeof finding.risk_level === "string") {
    const r = finding.risk_level.toLowerCase();
    if (r === "low" || r === "medium" || r === "high") return r;
  }
  return "medium";
}"""

new_severity = """function resolveFindingSeverity(finding: Record<string, unknown>): "low" | "medium" | "high" {
  if (typeof finding.severity === "string") {
    const s = finding.severity.toLowerCase();
    if (s === "low" || s === "medium" || s === "high") return s;
  }
  return "medium";
}"""

content = content.replace(old_severity, new_severity, 1)

with open("components/budget/budget-editor.tsx", "w", encoding="utf-8") as f:
    f.write(content)

print("Done")
