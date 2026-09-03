import { createHash } from "node:crypto";

type StaleClient = { reviewRun: { updateMany(args: { where: Record<string, unknown>; data: Record<string, unknown> }): Promise<{ count: number }> } };

export function changeFingerprint(input: { kind: string; id: string; payload: unknown }): string {
  return createHash("sha256").update(JSON.stringify(input)).digest("hex");
}

export async function markReviewRunsStale(input: { companyId: string; projectId: string; budgetId?: string; fingerprint: string }, client: StaleClient): Promise<number> {
  const result = await client.reviewRun.updateMany({ where: { companyId: input.companyId, projectId: input.projectId, ...(input.budgetId ? { budgetId: input.budgetId } : {}), status: { in: ["DRAFT", "QUEUED", "RUNNING", "COMPLETED", "COMPLETED_WITH_WARNINGS"] } }, data: { status: "STALE", progressJson: { staleFingerprint: input.fingerprint } } });
  return result.count;
}

export async function markStaleForChange(input: { companyId: string; projectId: string; budgetId?: string; kind: string; id: string; payload: unknown }, client: StaleClient): Promise<number> {
  return markReviewRunsStale({ ...input, fingerprint: changeFingerprint({ kind: input.kind, id: input.id, payload: input.payload }) }, client);
}
