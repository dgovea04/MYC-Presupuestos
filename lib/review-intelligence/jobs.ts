import type { ReviewRunStatus, ProgressJson, WarningJson } from "./types";

type Row = Record<string, unknown>;
type Where = Record<string, unknown>;
export interface ReviewProgress { reviewRunId: string; status: ReviewRunStatus; progress: ProgressJson; warnings: WarningJson[]; }
export interface ReviewJobClient { reviewRun: { findUnique(args: { where: Where }): Promise<Row | null>; updateMany(args: { where: Where; data: Row }): Promise<{ count: number }>; findMany(args: { where: Where }): Promise<Row[]>; }; }

export async function getReviewProgress(reviewRunId: string, companyId: string, client: ReviewJobClient, options: { staleAfterMs?: number } = {}): Promise<ReviewProgress> {
  const run = await client.reviewRun.findUnique({ where: { id: reviewRunId, companyId } });
  if (!run) throw new Error("Review run not found.");
  let status = String(run.status) as ReviewRunStatus;
  const staleAfterMs = options.staleAfterMs ?? 15 * 60 * 1000;
  const updatedAt = run.updatedAt instanceof Date ? run.updatedAt.getTime() : Date.now();
  if (["DRAFT", "QUEUED", "RUNNING"].includes(status) && Date.now() - updatedAt > staleAfterMs) { status = "STALE"; await client.reviewRun.updateMany({ where: { id: reviewRunId, companyId, status: { in: ["DRAFT", "QUEUED", "RUNNING"] } }, data: { status } }); }
  const value = (run.progressJson ?? {}) as Partial<ProgressJson>;
  return { reviewRunId, status, progress: { stage: String(value.stage ?? "validating"), completed: Number(value.completed ?? 0), total: Number(value.total ?? 8), percent: Number(value.percent ?? 0) }, warnings: Array.isArray(run.warningsJson) ? run.warningsJson as WarningJson[] : [] };
}

export async function requestReviewCancellation(reviewRunId: string, companyId: string, client: ReviewJobClient): Promise<void> {
  const run = await client.reviewRun.findUnique({ where: { id: reviewRunId, companyId } });
  if (!run) throw new Error("Review run not found.");
  if (["DRAFT", "QUEUED", "RUNNING"].includes(String(run.status))) await client.reviewRun.updateMany({ where: { id: reviewRunId, companyId, status: { in: ["DRAFT", "QUEUED", "RUNNING"] } }, data: { status: "CANCELLED", finishedAt: new Date() } });
}
