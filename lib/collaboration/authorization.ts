import { prisma } from "@/lib/db/prisma";

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

  return {
    companyId: budget.project.companyId,
    projectId: budget.projectId,
  };
}
