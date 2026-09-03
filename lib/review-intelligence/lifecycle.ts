import type { Prisma, PrismaClient } from "@prisma/client";
import type { FindingStatus, ReviewRunStatus } from "./types";

type LifecycleClient = Pick<PrismaClient, "reviewRun" | "reviewFinding" | "reviewAuditEvent"> & {
  $transaction<T>(callback: (transaction: LifecycleClient) => Promise<T>): Promise<T>;
};

export type ReviewLifecycleAction = "UNDER_REVIEW" | "REVIEWED";
export type MarkReviewRunStatusInput = { runId: string; companyId: string; userId: string; role: string; targetStatus: ReviewLifecycleAction; expectedUpdatedAt: Date; correlationId: string };
export type ReviewLifecycleStatus = { id: string; companyId: string; projectId: string; status: ReviewRunStatus; updatedAt: string; pendingFindingCount: number };

const terminalStatuses = ["COMPLETED", "COMPLETED_WITH_WARNINGS"] as const;
const unresolvedStatuses: FindingStatus[] = ["PENDING", "IN_REVIEW", "STALE"];

export async function readReviewRunStatus(input: { runId: string; companyId: string }, client: LifecycleClient): Promise<ReviewLifecycleStatus> {
  const run = await client.reviewRun.findFirst({ where: { id: input.runId, companyId: input.companyId }, select: { id: true, companyId: true, projectId: true, status: true, updatedAt: true } });
  if (!run) throw new Error("Review run not found.");
  const pendingFindingCount = await client.reviewFinding.count({ where: { reviewRunId: run.id, companyId: run.companyId, projectId: run.projectId, status: { in: unresolvedStatuses } } });
  return { id: String(run.id), companyId: String(run.companyId), projectId: String(run.projectId), status: String(run.status) as ReviewRunStatus, updatedAt: new Date(run.updatedAt as Date).toISOString(), pendingFindingCount };
}

export async function markReviewRunStatus(input: MarkReviewRunStatusInput, client: LifecycleClient): Promise<ReviewLifecycleStatus> {
  return client.$transaction(async (tx) => {
    const run = await tx.reviewRun.findFirst({ where: { id: input.runId, companyId: input.companyId }, select: { id: true, companyId: true, projectId: true, status: true, updatedAt: true } });
    if (!run) throw new Error("Review run not found.");
    const currentStatus = String(run.status);
    if (input.targetStatus === "UNDER_REVIEW" && !terminalStatuses.includes(currentStatus as (typeof terminalStatuses)[number])) throw new Error("Only completed review runs can move to UNDER_REVIEW.");
    if (input.targetStatus === "REVIEWED" && currentStatus !== "UNDER_REVIEW") throw new Error("Only UNDER_REVIEW runs can move to REVIEWED.");
    let pendingFindingCount = 0;
    if (input.targetStatus === "REVIEWED") {
      pendingFindingCount = await tx.reviewFinding.count({ where: { reviewRunId: run.id, companyId: run.companyId, projectId: run.projectId, status: { in: unresolvedStatuses } } });
      if (pendingFindingCount > 0) throw new Error("Cannot mark review as REVIEWED while pending or stale findings remain.");
    }
    const changed = await tx.reviewRun.updateMany({ where: { id: run.id, companyId: run.companyId, projectId: run.projectId, status: currentStatus as ReviewRunStatus, updatedAt: input.expectedUpdatedAt }, data: { status: input.targetStatus as ReviewRunStatus } });
    if (changed.count !== 1) throw new Error("Review run changed; reconfirmation required.");
    await tx.reviewAuditEvent.create({ data: { companyId: run.companyId, projectId: run.projectId, reviewRunId: run.id, actorUserId: input.userId, correlationId: input.correlationId, eventType: input.targetStatus === "REVIEWED" ? "REVIEW_MARKED_REVIEWED" : "REVIEW_MARKED_UNDER_REVIEW", payloadJson: { role: input.role, previousStatus: currentStatus, newStatus: input.targetStatus, expectedUpdatedAt: input.expectedUpdatedAt.toISOString(), pendingFindingCount } } });
    return { id: String(run.id), companyId: String(run.companyId), projectId: String(run.projectId), status: input.targetStatus, updatedAt: input.expectedUpdatedAt.toISOString(), pendingFindingCount };
  });
}

export type ReviewLifecyclePrismaWhere = Prisma.ReviewRunWhereInput;
