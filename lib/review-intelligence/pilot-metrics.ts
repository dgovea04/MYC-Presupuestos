export type ReviewPilotWindow = { from: Date; to: Date };

export type ReviewPilotMetricsInput = {
  window: ReviewPilotWindow;
  runs: Array<{ status: string; createdAt: Date; startedAt: Date | null; finishedAt: Date | null; coveragePercent: number }>;
  findings: Array<{ findingType: string; status: string; createdAt: Date }>;
  decisions: Array<{ resolution: string; createdAt: Date }>;
};

export type ReviewPilotMetrics = {
  window: { from: string; to: string };
  runs: { total: number; completed: number; reviewed: number; failed: number; completionRatePercent: number; reviewCompletionRatePercent: number; averageDurationSeconds: number | null };
  coverage: { averagePercent: number };
  findings: { total: number; byType: Record<string, number>; byStatus: Record<string, number> };
  humanReview: { decisions: number; confirmedIssues: number; falsePositives: number; resolutionRatePercent: number; falsePositiveRatePercent: number };
  limitations: string[];
};

const COMPLETED_STATUSES = new Set(["COMPLETED", "COMPLETED_WITH_WARNINGS", "UNDER_REVIEW", "REVIEWED"]);

export function calculateReviewPilotMetrics(input: ReviewPilotMetricsInput): ReviewPilotMetrics {
  const total = input.runs.length;
  const completed = input.runs.filter((run) => COMPLETED_STATUSES.has(run.status)).length;
  const reviewed = input.runs.filter((run) => run.status === "REVIEWED").length;
  const failed = input.runs.filter((run) => run.status === "FAILED").length;
  const durations = input.runs.flatMap((run) => run.startedAt && run.finishedAt ? [Math.max(0, (run.finishedAt.getTime() - run.startedAt.getTime()) / 1000)] : []);
  const byType = countBy(input.findings.map((finding) => finding.findingType));
  const byStatus = countBy(input.findings.map((finding) => finding.status));
  const decisions = input.decisions.length;
  const confirmedIssues = input.decisions.filter((decision) => decision.resolution === "CONFIRMED_ISSUE").length;
  const falsePositives = input.decisions.filter((decision) => decision.resolution === "FALSE_POSITIVE").length;
  return {
    window: { from: input.window.from.toISOString(), to: input.window.to.toISOString() },
    runs: { total, completed, reviewed, failed, completionRatePercent: percent(completed, total), reviewCompletionRatePercent: percent(reviewed, completed), averageDurationSeconds: durations.length > 0 ? Math.round(average(durations)) : null },
    coverage: { averagePercent: input.runs.length > 0 ? Math.round(average(input.runs.map((run) => clampPercent(run.coveragePercent)))) : 0 },
    findings: { total: input.findings.length, byType, byStatus },
    humanReview: { decisions, confirmedIssues, falsePositives, resolutionRatePercent: percent(input.findings.length > 0 ? decisions : 0, input.findings.length), falsePositiveRatePercent: percent(falsePositives, decisions) },
    limitations: ["No hay datos de ahorro de tiempo ni dataset dorado asociado a esta ejecución."],
  };
}

function countBy(values: string[]): Record<string, number> { return values.reduce<Record<string, number>>((result, value) => { result[value] = (result[value] ?? 0) + 1; return result; }, {}); }
function average(values: number[]): number { return values.reduce((sum, value) => sum + value, 0) / values.length; }
function percent(value: number, total: number): number { return total === 0 ? 0 : Math.round((value / total) * 100); }
function clampPercent(value: number): number { return Math.max(0, Math.min(100, value)); }
