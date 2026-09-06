export interface AssignmentClient { $transaction<T>(callback: (transaction: AssignmentTransaction) => Promise<T>): Promise<T> }
interface AssignmentTransaction {
  reviewFinding: { findFirst(args: { where: Record<string, unknown>; select: Record<string, boolean> }): Promise<{ id: string; companyId: string; projectId: string; updatedAt: Date } | null>; updateMany(args: { where: Record<string, unknown>; data: Record<string, unknown> }): Promise<{ count: number }> };
  projectMembership: { findFirst(args: { where: Record<string, unknown>; select: Record<string, boolean> }): Promise<{ userId: string; role: string } | null> };
  reviewAuditEvent: { create(args: { data: Record<string, unknown> }): Promise<unknown> };
}
export interface AssignFindingInput { findingId: string; assigneeId: string | null; actorUserId: string; companyId: string; projectId: string; expectedUpdatedAt: Date }
export interface AssignedFinding { findingId: string; assignedToId: string | null; assignedAt: string | null }

export async function assignFinding(input: AssignFindingInput, client: AssignmentClient): Promise<AssignedFinding> {
  return client.$transaction(async (tx) => {
    const finding = await tx.reviewFinding.findFirst({ where: { id: input.findingId, companyId: input.companyId, projectId: input.projectId }, select: { id: true, companyId: true, projectId: true, updatedAt: true } });
    if (!finding) throw new Error("Finding not found.");
    if (input.assigneeId) {
      const member = await tx.projectMembership.findFirst({ where: { projectId: input.projectId, companyId: input.companyId, userId: input.assigneeId }, select: { userId: true, role: true } });
      if (!member) throw new Error("Assignee must be a project member.");
    }
    const assignedAt = input.assigneeId ? new Date() : null;
    const changed = await tx.reviewFinding.updateMany({ where: { id: input.findingId, companyId: input.companyId, projectId: input.projectId, updatedAt: input.expectedUpdatedAt }, data: { assignedToId: input.assigneeId, assignedAt } });
    if (changed.count !== 1) throw new Error("Finding was changed by another user.");
    await tx.reviewAuditEvent.create({ data: { companyId: input.companyId, projectId: input.projectId, actorUserId: input.actorUserId, eventType: "FINDING_ASSIGNED", payloadJson: { findingId: input.findingId, assignedToId: input.assigneeId, expectedUpdatedAt: input.expectedUpdatedAt.toISOString() } } });
    return { findingId: input.findingId, assignedToId: input.assigneeId, assignedAt: assignedAt?.toISOString() ?? null };
  });
}
