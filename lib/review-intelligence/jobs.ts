import type { ReviewRunStatus, ProgressJson, WarningJson } from "./types";
import { calculateReviewRunMetrics, type ReviewRunMetrics } from "./metrics";

type Row = Record<string, unknown>;
type Where = Record<string, unknown>;
export interface ReviewProgress { reviewRunId: string; status: ReviewRunStatus; progress: ProgressJson & { metrics?: { coveragePercent: number; analyzedItems: number; failures: number; incompleteness: number; deltaVsPrevious: number | null } }; warnings: WarningJson[]; }
export interface ReviewJobClient { reviewRun: { findUnique(args: { where: Where }): Promise<Row | null>; updateMany(args: { where: Where; data: Row }): Promise<{ count: number }>; findMany(args: { where: Where }): Promise<Row[]>; }; budget?: { findMany(args: { where: Where }): Promise<Row[]> }; budgetItem?: { findMany(args: { where: Where }): Promise<Row[]> }; reviewEvidence?: { findMany(args: { where: Where }): Promise<Row[]> }; entityLink?: { findMany(args: { where: Where }): Promise<Row[]> }; reviewFinding?: { findMany(args: { where: Where }): Promise<Row[]> }; }

export async function getReviewProgress(reviewRunId: string, companyId: string, client: ReviewJobClient, options: { staleAfterMs?: number } = {}): Promise<ReviewProgress> {
  const run = await client.reviewRun.findUnique({ where: { id: reviewRunId, companyId } });
  if (!run) throw new Error("Review run not found.");
  let status = String(run.status) as ReviewRunStatus;
  const staleAfterMs = options.staleAfterMs ?? 15 * 60 * 1000;
  const updatedAt = run.updatedAt instanceof Date ? run.updatedAt.getTime() : Date.now();
  if (["DRAFT", "QUEUED", "RUNNING"].includes(status) && Date.now() - updatedAt > staleAfterMs) { status = "STALE"; await client.reviewRun.updateMany({ where: { id: reviewRunId, companyId, status: { in: ["DRAFT", "QUEUED", "RUNNING"] } }, data: { status } }); }
  const value = (run.progressJson ?? {}) as Partial<ProgressJson>;
  const metrics = await persistedMetrics(run, companyId, client) ?? (value as Partial<ProgressJson> & { metrics?: ReviewRunMetrics }).metrics;
  return { reviewRunId, status, progress: { stage: String(value.stage ?? "validating"), completed: Number(value.completed ?? 0), total: Number(value.total ?? 8), percent: Number(value.percent ?? 0), metrics: metrics ? { coveragePercent: Number(metrics.coveragePercent ?? 0), analyzedItems: Number(metrics.analyzedItems ?? 0), failures: Number(metrics.failures ?? 0), incompleteness: Number(metrics.incompleteness ?? 0), deltaVsPrevious: metrics.deltaVsPrevious ?? null } : undefined }, warnings: Array.isArray(run.warningsJson) ? run.warningsJson as WarningJson[] : [] };
}

async function persistedMetrics(run: Row, companyId: string, client: ReviewJobClient): Promise<ReviewRunMetrics | undefined> {
  if (!client.budget?.findMany || !client.budgetItem?.findMany || !client.reviewEvidence?.findMany || !client.entityLink?.findMany || !client.reviewFinding?.findMany) return undefined;
  const projectId = typeof run.projectId === "string" ? run.projectId : undefined;
  const budgetId = typeof run.budgetId === "string" ? run.budgetId : undefined;
  if (!projectId || !budgetId || typeof run.id !== "string") return undefined;
  const budgets = await client.budget.findMany({ where: { companyId, projectId } });
  const budgetIds = new Set([budgetId]); let frontier = [budgetId];
  while (frontier.length) { const children = budgets.filter((budget) => typeof budget.parentBudgetId === "string" && frontier.includes(budget.parentBudgetId)); frontier = children.map((budget) => String(budget.id)).filter((id) => !budgetIds.has(id)); frontier.forEach((id) => budgetIds.add(id)); }
  const [items, evidence, links, findings, previousRuns] = await Promise.all([
    client.budgetItem.findMany({ where: { budgetId: { in: [...budgetIds] } } }),
    client.reviewEvidence.findMany({ where: { companyId, projectId } }),
    client.entityLink.findMany({ where: { companyId, projectId } }),
    client.reviewFinding.findMany({ where: { companyId, projectId, reviewRunId: run.id } }),
    client.reviewRun.findMany({ where: { companyId, projectId, budgetId } }),
  ]);
  const previous = previousRuns.filter((candidate) => candidate.id !== run.id).sort((a, b) => String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? "")))[0];
  const previousMetrics = (previous?.progressJson as { metrics?: ReviewRunMetrics } | undefined)?.metrics;
  return calculateReviewRunMetrics({ budgetIds: [...budgetIds], budgetItems: items.map((item) => ({ id: String(item.id), budgetId: String(item.budgetId) })), evidence: evidence.map((item) => ({ id: String(item.id), documentVersionId: String(item.documentVersionId) })), links: links.map((item) => ({ budgetItemId: String(item.budgetItemId), evidenceId: String(item.evidenceId) })), findings: findings.map((item) => ({ budgetItemId: typeof item.budgetItemId === "string" ? item.budgetItemId : null, status: String(item.status), findingType: String(item.findingType) })), warnings: Array.isArray(run.warningsJson) ? run.warningsJson as Array<{ code: string; message: string }> : [], previous: previousMetrics });
}

export async function requestReviewCancellation(reviewRunId: string, companyId: string, client: ReviewJobClient): Promise<void> {
  const run = await client.reviewRun.findUnique({ where: { id: reviewRunId, companyId } });
  if (!run) throw new Error("Review run not found.");
  if (["DRAFT", "QUEUED", "RUNNING"].includes(String(run.status))) await client.reviewRun.updateMany({ where: { id: reviewRunId, companyId, status: { in: ["DRAFT", "QUEUED", "RUNNING"] } }, data: { status: "CANCELLED", finishedAt: new Date() } });
}
