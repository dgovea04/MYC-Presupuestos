import { prisma } from "@/lib/db/prisma";
import type { WorkspaceRole } from "@/types/workspace";
import { resolveWorkspaceCapabilities } from "@/lib/workspace/permissions";
import type { WorkspaceCapability } from "@/lib/workspace/capabilities";

const ROLE_RANK: Record<WorkspaceRole, number> = {
  OWNER: 4,
  ADMIN: 3,
  EDITOR: 2,
  VIEWER: 1,
};

export class WorkspaceAuthorizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WorkspaceAuthorizationError";
  }
}

export async function requireWorkspaceRole(options: {
  userId: string;
  companyId: string;
  minimumRole: WorkspaceRole;
}) {
  const membership = await prisma.companyMembership.findUnique({
    where: {
      companyId_userId: { companyId: options.companyId, userId: options.userId },
      company: { deletedAt: null },
    },
    select: { role: true, status: true, suspendedUntil: true },
  });

  if (!membership || membership.status !== "ACTIVE") {
    throw new WorkspaceAuthorizationError("Workspace no disponible");
  }

  const role = membership.role as WorkspaceRole;
  if (ROLE_RANK[role] < ROLE_RANK[options.minimumRole]) {
    throw new WorkspaceAuthorizationError("No tienes el rol necesario en este workspace");
  }

  return { companyId: options.companyId, userId: options.userId, role };
}

export async function requireWorkspaceOwner(options: { userId: string; companyId: string }) {
  return requireWorkspaceRole({ ...options, minimumRole: "OWNER" });
}

export function assertTargetMembershipChangeAllowed(options: {
  actorUserId: string;
  targetUserId: string;
  targetRole: WorkspaceRole;
  action: "TRANSFER_OWNERSHIP" | "CHANGE_ROLE" | "CHANGE_STATUS" | "REMOVE";
}) {
  if (options.action !== "TRANSFER_OWNERSHIP" && options.actorUserId === options.targetUserId) {
    throw new WorkspaceAuthorizationError("No puedes modificar tu propia membresía");
  }

  if (options.targetRole === "OWNER" && options.action !== "TRANSFER_OWNERSHIP") {
    throw new WorkspaceAuthorizationError("La membresía del Owner requiere una transferencia de ownership");
  }
}

export async function requireWorkspaceCapability(options: {
  userId: string;
  companyId: string;
  capability: WorkspaceCapability;
}) {
  const { capabilities, role } = await resolveWorkspaceCapabilities(options);

  if (!capabilities.has(options.capability)) {
    throw new WorkspaceAuthorizationError(`No tienes el permiso "${options.capability}" en este workspace`);
  }

  return { companyId: options.companyId, userId: options.userId, role };
}
