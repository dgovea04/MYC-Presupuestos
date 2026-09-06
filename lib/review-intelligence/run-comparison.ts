export type ComparableFinding = { budgetItemId: string | null; findingType: string; evidenceId: string; status: string; comparison: Record<string, string> };
export type ReviewRunComparison = { baseRun: { id: string; status: string }; compareRun: { id: string; status: string }; metrics: { base: Record<string, number>; compare: Record<string, number> }; summary: { new: number; persistent: number; resolved: number; changed: number }; findings: Array<ComparableFinding & { classification: "NEW" | "PERSISTENT" | "RESOLVED" | "CHANGED" }> };

export function compareReviewRuns(input: { baseRun: { id: string; status: string; metrics: Record<string, number> }; compareRun: { id: string; status: string; metrics: Record<string, number> }; baseFindings: ComparableFinding[]; compareFindings: ComparableFinding[] }): ReviewRunComparison {
  const base = new Map(input.baseFindings.map((finding) => [identity(finding), finding]));
  const current = new Map(input.compareFindings.map((finding) => [identity(finding), finding]));
  const findings: ReviewRunComparison["findings"] = [];
  for (const finding of input.compareFindings) {
    const previous = base.get(identity(finding));
    const classification = !previous ? "NEW" : sameComparison(previous.comparison, finding.comparison) ? "PERSISTENT" : "CHANGED";
    findings.push({ ...finding, classification });
  }
  for (const finding of input.baseFindings) if (!current.has(identity(finding))) findings.push({ ...finding, classification: "RESOLVED" });
  findings.sort((left, right) => `${left.classification}:${identity(left)}`.localeCompare(`${right.classification}:${identity(right)}`));
  const summary = { new: findings.filter((item) => item.classification === "NEW").length, persistent: findings.filter((item) => item.classification === "PERSISTENT").length, resolved: findings.filter((item) => item.classification === "RESOLVED").length, changed: findings.filter((item) => item.classification === "CHANGED").length };
  return { baseRun: input.baseRun, compareRun: input.compareRun, metrics: { base: input.baseRun.metrics, compare: input.compareRun.metrics }, summary, findings };
}

function identity(finding: ComparableFinding): string { return `${finding.budgetItemId ?? "none"}|${finding.findingType}|${finding.evidenceId}`; }
function sameComparison(left: Record<string, string>, right: Record<string, string>): boolean { const keys = new Set([...Object.keys(left), ...Object.keys(right)]); return [...keys].every((key) => left[key] === right[key]); }
