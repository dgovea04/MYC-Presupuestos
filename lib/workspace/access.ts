import { prisma } from "@/lib/db/prisma";
import type { WorkspaceRole } from "@/types/workspace";

export async function assertWorkspaceMembership(options: {
  userId: string;
  companyId: string;
  minimumRole?: WorkspaceRole;
}) {
  const membership = await prisma.companyMembership.findUnique({
    where: {
      companyId_userId: {
        companyId: options.companyId,
        userId: options.userId,
      },
      company: { deletedAt: null },
    },
    select: { role: true, status: true, suspendedUntil: true },
  });

  if (!membership) {
    throw new Error("Workspace no disponible");
  }

  // Auto-reactivate if suspension has expired
  if (membership.status === "SUSPENDED" && membership.suspendedUntil && membership.suspendedUntil < new Date()) {
    await prisma.companyMembership.update({
      where: { companyId_userId: { companyId: options.companyId, userId: options.userId } },
      data: { status: "ACTIVE", suspendedUntil: null },
    });
    membership.status = "ACTIVE";
  }

  if (membership.status !== "ACTIVE") {
    throw new Error("Workspace no disponible");
  }

  if (options.minimumRole) {
    const roleRank = { OWNER: 4, ADMIN: 3, EDITOR: 2, VIEWER: 1 } as const;
    const required = roleRank[options.minimumRole];
    const current = roleRank[membership.role as WorkspaceRole];
    if (current < required) {
      throw new Error("No tienes el rol necesario en este workspace");
    }
  }

  return { companyId: options.companyId, role: membership.role as WorkspaceRole };
}

export async function assertProjectInWorkspace(options: {
  companyId: string;
  projectId: string;
}) {
  const project = await prisma.project.findFirst({
    where: {
      id: options.projectId,
      companyId: options.companyId,
    },
    select: { id: true },
  });

  if (!project) {
    throw new Error("El proyecto no pertenece a este workspace");
  }
}

export async function assertBudgetInWorkspace(options: {
  companyId: string;
  budgetId: string;
}) {
  const budget = await prisma.budget.findFirst({
    where: {
      id: options.budgetId,
      project: {
        companyId: options.companyId,
      },
    },
    select: { id: true },
  });

  if (!budget) {
    throw new Error("El presupuesto no pertenece a este workspace");
  }
}
