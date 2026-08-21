import type { Prisma, WorkspaceAuditAction, WorkspaceAuditTargetType } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import type { PrismaClient } from "@prisma/client";

export type WorkspaceAuditInput = {
  companyId: string;
  actorUserId?: string;
  action: WorkspaceAuditAction;
  targetType: WorkspaceAuditTargetType;
  targetId?: string;
  targetLabel?: string;
  metadata?: Prisma.InputJsonValue;
};

export async function recordWorkspaceAudit(
  input: WorkspaceAuditInput,
  client: Pick<PrismaClient, "workspaceAuditEvent"> = prisma,
) {
  const delegate = client.workspaceAuditEvent;
  if (!delegate) return null;

  return delegate.create({
    data: {
      companyId: input.companyId,
      actorUserId: input.actorUserId,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId,
      targetLabel: input.targetLabel,
      metadata: input.metadata ?? {},
    },
  });
}

export async function listWorkspaceAuditEvents(options: {
  companyId: string;
  take?: number;
  cursor?: string;
  action?: WorkspaceAuditAction;
  actorUserId?: string;
}) {
  return prisma.workspaceAuditEvent.findMany({
    where: {
      companyId: options.companyId,
      action: options.action,
      actorUserId: options.actorUserId,
    },
    include: { actorUser: { select: { id: true, name: true, email: true } } },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: Math.min(options.take ?? 50, 100),
    ...(options.cursor ? { cursor: { id: options.cursor }, skip: 1 } : {}),
  });
}
