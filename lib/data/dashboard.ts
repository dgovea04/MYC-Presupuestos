import type { ActivityEventType } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { decimalToNumber } from "@/lib/db/serializers";

type DashboardPendingType =
  | "MISSING_GENERAL_BUDGET"
  | "MISSING_POLYNOMIAL_FORMULA"
  | "MISSING_ADJUSTMENTS"
  | "NO_RECENT_ACTIVITY";

type DashboardActivityType =
  | "PROJECT_UPDATED"
  | "PROJECT_CREATED"
  | "GENERAL_BUDGET_UPDATED"
  | "GENERAL_BUDGET_CREATED"
  | "POLYNOMIAL_FORMULA_UPDATED"
  | "POLYNOMIAL_FORMULA_GENERATED"
  | "ADJUSTMENT_REGISTERED";

export type DashboardPendingItem = {
  projectId: string;
  projectName: string;
  companyName: string;
  status: string;
  observation: string;
  priority: "high" | "medium" | "low";
  updatedAt: Date;
  href: string;
  type: DashboardPendingType;
};

export type DashboardActivityItem = {
  id: string;
  type: DashboardActivityType;
  title: string;
  detail: string;
  href: string;
  createdAt: Date;
};

export async function getDashboardStats(userId: string) {
  const companies = await prisma.company.findMany({
    where: { userId },
    include: {
      projects: {
        include: {
          budgets: {
            include: {
              polynomialFormulas: {
                include: {
                  adjustments: {
                    orderBy: { createdAt: "desc" },
                    take: 1,
                  },
                },
                orderBy: { updatedAt: "desc" },
              },
            },
          },
          polynomialFormulas: {
            include: {
              adjustments: {
                orderBy: { createdAt: "desc" },
                take: 1,
              },
            },
            orderBy: { updatedAt: "desc" },
          },
        },
        orderBy: { updatedAt: "desc" },
      },
    },
  });

  const projects = companies
    .flatMap((company) =>
      company.projects.map((project) => ({
        ...project,
        companyName: company.name,
      })),
    )
    .sort((left, right) => right.updatedAt.getTime() - left.updatedAt.getTime());
  const generalBudgets = projects
    .flatMap((project) =>
      project.budgets
        .filter((budget) => budget.kind === "GENERAL")
        .map((budget) => ({
          ...budget,
          projectId: project.id,
          projectName: project.name,
          companyName: project.companyName,
        })),
    )
    .sort((left, right) => right.updatedAt.getTime() - left.updatedAt.getTime());
  const formulas = projects
    .flatMap((project) =>
      project.polynomialFormulas.map((formula) => ({
        ...formula,
        projectId: project.id,
        projectName: project.name,
        companyName: project.companyName,
        budgetId: formula.budgetId,
      })),
    )
    .sort((left, right) => right.updatedAt.getTime() - left.updatedAt.getTime());
  const adjustments = formulas
    .flatMap((formula) =>
      formula.adjustments.map((adjustment) => ({
        ...adjustment,
        projectId: formula.projectId,
        projectName: formula.projectName,
        companyName: formula.companyName,
        formulaId: formula.id,
      })),
    )
    .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());
  const activityEvents =
    typeof (prisma as typeof prisma & { activityEvent?: unknown }).activityEvent === "undefined"
      ? []
      : await prisma.activityEvent.findMany({
          where: { userId },
          orderBy: { createdAt: "desc" },
          take: 12,
        });

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  return {
    companiesCount: companies.length > 0 ? 1 : 0,
    projectsCount: projects.length,
    budgetsCount: generalBudgets.length,
    portfolioValue: generalBudgets.reduce((sum, budget) => sum + decimalToNumber(budget.totalAmount), 0),
    monthlyAdjustmentsCount: adjustments.filter(
      (adjustment) => adjustment.month === currentMonth && adjustment.year === currentYear,
    ).length,
    pendingCount: getPendingItems(projects).length,
    recentProject: projects[0]
      ? {
          id: projects[0].id,
          name: projects[0].name,
          companyName: projects[0].companyName,
          status: projects[0].status,
          updatedAt: projects[0].updatedAt,
          generalBudget: generalBudgets.find((budget) => budget.projectId === projects[0].id)
            ? {
                id: generalBudgets.find((budget) => budget.projectId === projects[0].id)!.id,
                totalAmount: decimalToNumber(
                  generalBudgets.find((budget) => budget.projectId === projects[0].id)!.totalAmount,
                ),
                currency: generalBudgets.find((budget) => budget.projectId === projects[0].id)!.currency,
              }
            : null,
        }
      : null,
    projects: projects.slice(0, 5).map((project) => ({
      id: project.id,
      name: project.name,
      companyName: project.companyName,
      location: project.location,
      status: project.status,
      updatedAt: project.updatedAt,
    })),
    budgets: generalBudgets.slice(0, 5).map((budget) => ({
      id: budget.id,
      name: budget.name,
      projectId: budget.projectId,
      projectName: budget.projectName,
      updatedAt: budget.updatedAt,
      totalAmount: decimalToNumber(budget.totalAmount),
      currency: budget.currency,
    })),
    pendingItems: getPendingItems(projects).slice(0, 8),
    recentActivity: (activityEvents.length > 0
      ? activityEvents.map(mapActivityEvent)
      : getRecentActivity(projects, generalBudgets, formulas, adjustments)
    ).slice(0, 8),
  };
}

function getPendingItems(
  projects: Array<{
    id: string;
    name: string;
    companyName: string;
    status: string;
    updatedAt: Date;
    budgets: Array<{
      id: string;
      kind: string;
      polynomialFormulas: Array<{
        id: string;
        adjustments: Array<{ id: string }>;
      }>;
    }>;
    polynomialFormulas: Array<{
      id: string;
      adjustments: Array<{ id: string }>;
    }>;
  }>,
): DashboardPendingItem[] {
  const items: DashboardPendingItem[] = [];
  const staleThresholdMs = 1000 * 60 * 60 * 24 * 14;

  for (const project of projects) {
    const generalBudget = project.budgets.find((budget) => budget.kind === "GENERAL");
    const latestFormula = project.polynomialFormulas[0] ?? generalBudget?.polynomialFormulas[0];

    if (!generalBudget) {
      items.push({
        projectId: project.id,
        projectName: project.name,
        companyName: project.companyName,
        status: project.status,
        observation: "Registra el presupuesto general para habilitar el flujo economico del proyecto.",
        priority: "high",
        updatedAt: project.updatedAt,
        href: `/projects/${project.id}`,
        type: "MISSING_GENERAL_BUDGET",
      });
      continue;
    }

    if (!latestFormula) {
      items.push({
        projectId: project.id,
        projectName: project.name,
        companyName: project.companyName,
        status: project.status,
        observation: "Genera la formula polinomica del presupuesto general para continuar con reajustes.",
        priority: "high",
        updatedAt: project.updatedAt,
        href: `/budgets/${generalBudget.id}/polynomial-formula`,
        type: "MISSING_POLYNOMIAL_FORMULA",
      });
      continue;
    }

    if (latestFormula.adjustments.length === 0) {
      items.push({
        projectId: project.id,
        projectName: project.name,
        companyName: project.companyName,
        status: project.status,
        observation: "Registra el primer reajuste para empezar el seguimiento de variaciones.",
        priority: "medium",
        updatedAt: project.updatedAt,
        href: `/budgets/${generalBudget.id}/polynomial-formula`,
        type: "MISSING_ADJUSTMENTS",
      });
    }

    if (Date.now() - project.updatedAt.getTime() > staleThresholdMs) {
      items.push({
        projectId: project.id,
        projectName: project.name,
        companyName: project.companyName,
        status: project.status,
        observation: "Revisa el proyecto y confirma su avance para recuperar el ritmo operativo.",
        priority: "low",
        updatedAt: project.updatedAt,
        href: `/projects/${project.id}`,
        type: "NO_RECENT_ACTIVITY",
      });
    }
  }

  return items.sort((left, right) => {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    const priorityDiff = priorityOrder[left.priority] - priorityOrder[right.priority];
    if (priorityDiff !== 0) {
      return priorityDiff;
    }

    return right.updatedAt.getTime() - left.updatedAt.getTime();
  });
}

function getRecentActivity(
  projects: Array<{ id: string; name: string; companyName: string; updatedAt: Date }>,
  generalBudgets: Array<{ id: string; projectId: string; projectName: string; updatedAt: Date }>,
  formulas: Array<{ id: string; projectId: string; projectName: string; updatedAt: Date; budgetId: string }>,
  adjustments: Array<{ id: string; projectId: string; projectName: string; createdAt: Date }>,
): DashboardActivityItem[] {
  const items: DashboardActivityItem[] = [
    ...projects.map((project) => ({
      id: `project-${project.id}`,
      type: "PROJECT_UPDATED" as const,
      title: "Proyecto actualizado",
      detail: project.name,
      href: `/projects/${project.id}`,
      createdAt: project.updatedAt,
    })),
    ...generalBudgets.map((budget) => ({
      id: `budget-${budget.id}`,
      type: "GENERAL_BUDGET_UPDATED" as const,
      title: "Presupuesto general actualizado",
      detail: budget.projectName,
      href: `/budgets/${budget.id}`,
      createdAt: budget.updatedAt,
    })),
    ...formulas.map((formula) => ({
      id: `formula-${formula.id}`,
      type: "POLYNOMIAL_FORMULA_UPDATED" as const,
      title: "Formula polinomica actualizada",
      detail: formula.projectName,
      href: `/budgets/${formula.budgetId}/polynomial-formula`,
      createdAt: formula.updatedAt,
    })),
    ...adjustments.map((adjustment) => ({
      id: `adjustment-${adjustment.id}`,
      type: "ADJUSTMENT_REGISTERED" as const,
      title: "Reajuste registrado",
      detail: adjustment.projectName,
      href: `/projects/${adjustment.projectId}`,
      createdAt: adjustment.createdAt,
    })),
  ];

  return items.sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());
}

function mapActivityEvent(event: {
  id: string;
  type: ActivityEventType;
  title: string;
  detail: string;
  href: string;
  createdAt: Date;
}): DashboardActivityItem {
  return {
    id: event.id,
    type: normalizeActivityEventType(event.type),
    title: event.title,
    detail: event.detail,
    href: event.href,
    createdAt: event.createdAt,
  };
}

function normalizeActivityEventType(type: ActivityEventType): DashboardActivityType {
  switch (type) {
    case "PROJECT_CREATED":
      return "PROJECT_CREATED";
    case "PROJECT_UPDATED":
      return "PROJECT_UPDATED";
    case "BUDGET_CREATED":
      return "GENERAL_BUDGET_CREATED";
    case "BUDGET_UPDATED":
      return "GENERAL_BUDGET_UPDATED";
    case "POLYNOMIAL_FORMULA_UPDATED":
      return "POLYNOMIAL_FORMULA_UPDATED";
    case "POLYNOMIAL_FORMULA_GENERATED":
      return "POLYNOMIAL_FORMULA_GENERATED";
    case "ADJUSTMENT_REGISTERED":
      return "ADJUSTMENT_REGISTERED";
    default:
      throw new Error(`Unsupported activity event type: ${type satisfies never}`);
  }
}
