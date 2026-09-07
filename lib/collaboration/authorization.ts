import { prisma } from "@/lib/db/prisma";
import { assertWorkspaceFeatureAccess } from "@/lib/workspace/entitlements";
import type { AuthorizedBudgetContext, CollaborationAction } from "./types";
import { collaborationEntityRefSchema, type CollaborationEntityType } from "@/lib/validations/collaboration";

/**
 * Resolves the company and project for a given budget, verifying the user
 * belongs to the owning company. Returns { companyId, projectId } or throws.
 * This is the mandatory gate for all collaboration endpoints.
 */
export async function resolveBudgetOwnership(budgetId: string, userId: string) {
  const budget = await prisma.budget.findFirst({
    where: {
      id: budgetId,
      project: {
        company: {
          memberships: {
            some: {
              userId,
              status: "ACTIVE",
            },
          },
        },
      },
    },
    select: {
      projectId: true,
      project: {
        select: {
          companyId: true,
        },
      },
    },
  });

  if (!budget) {
    throw new Error("No tienes permisos para acceder a este presupuesto");
  }

  await assertWorkspaceFeatureAccess({
    userId,
    companyId: budget.project.companyId,
    feature: "collaboration.realtime",
  });

  return {
    companyId: budget.project.companyId,
    projectId: budget.projectId,
  };
}

export async function assertBudgetCollaborationAccess(input: {
  userId: string;
  budgetId: string;
  action: CollaborationAction;
  entity?: unknown;
}): Promise<AuthorizedBudgetContext> {
  const budget = await prisma.budget.findFirst({
    where: { id: input.budgetId, project: { company: { memberships: { some: { userId: input.userId, status: "ACTIVE" } } } } },
    select: { projectId: true, project: { select: { companyId: true } } },
  });
  if (!budget) throw new Error("Presupuesto no encontrado");
  await assertWorkspaceFeatureAccess({ userId: input.userId, companyId: budget.project.companyId, feature: "collaboration.realtime" });
  if (input.entity !== undefined) {
    const entity = collaborationEntityRefSchema.parse(input.entity);
    if (!(await entityBelongsToBudget(input.budgetId, entity.entityType, entity.entityId))) throw new Error("La entidad no pertenece al presupuesto");
  }
  const membership = await prisma.companyMembership.findUnique({ where: { companyId_userId: { companyId: budget.project.companyId, userId: input.userId } }, select: { role: true } });
  if (!membership) throw new Error("Workspace no disponible");
  if (["COMMENT", "EDIT", "RESOLVE"].includes(input.action) && membership.role === "VIEWER") throw new Error("No tienes el rol necesario en este workspace");
  return { userId: input.userId, budgetId: input.budgetId, companyId: budget.project.companyId, projectId: budget.projectId, role: membership.role as AuthorizedBudgetContext["role"], action: input.action };
}

async function entityBelongsToBudget(budgetId: string, entityType: CollaborationEntityType, entityId: string): Promise<boolean> {
  if (entityType === "BUDGET") return entityId === budgetId;
  if (entityType === "BUDGET_ITEM" || entityType === "APU") {
    return (await prisma.budgetItem.findFirst({ where: entityType === "BUDGET_ITEM" ? { id: entityId, budgetId } : { budgetId, apu: { id: entityId } }, select: { id: true } })) !== null;
  }
  if (entityType === "METRADO" || entityType === "METRADO_SHEET" || entityType === "METRADO_ROW") return (await prisma.metradoSheet.findFirst({ where: { id: entityId, project: { budgets: { some: { id: budgetId } } } }, select: { id: true } })) !== null;
  if (entityType === "REVIEW_FINDING") return (await prisma.reviewFinding.findFirst({ where: { id: entityId, budgetId }, select: { id: true } })) !== null;
  return true;
}
