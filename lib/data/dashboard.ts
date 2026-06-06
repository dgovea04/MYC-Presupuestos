import type { ActivityEventType } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { decimalToNumber } from "@/lib/db/serializers";
import { listNoteTasks } from "@/lib/data/notes";
import type { NoteTaskPriority, NoteTaskRecord } from "@/types/notes";

type DashboardPendingType =
  | "MISSING_GENERAL_BUDGET"
  | "MISSING_POLYNOMIAL_FORMULA"
  | "MISSING_ADJUSTMENTS"
  | "NO_RECENT_ACTIVITY"
  | "USER_NOTE_TASK";

type DashboardActivityType =
  | "PROJECT_UPDATED"
  | "PROJECT_CREATED"
  | "GENERAL_BUDGET_UPDATED"
  | "GENERAL_BUDGET_CREATED"
  | "METRADO_DUPLICATED"
  | "TEMPLATE_CHANGED"
  | "POLYNOMIAL_FORMULA_UPDATED"
  | "POLYNOMIAL_FORMULA_GENERATED"
  | "ADJUSTMENT_REGISTERED";

export type DashboardPendingItem = {
  id: string;
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
  projectName: string | null;
  href: string;
  createdAt: Date;
};

export type DashboardTemplateSummary = {
  savedTemplatesCount: number;
  templateBudgetApplicationCount: number;
  templateMaintenanceEventCount: number;
  totalTemplateItems: number;
  averageItemsPerTemplate: number;
  latestTemplate: {
    id: string;
    name: string;
    updatedAt: Date;
    itemCount: number;
  } | null;
};

type DashboardBudgetTemplateRow = {
  id: string;
  name: string;
  updatedAt: Date;
  payload: unknown;
};

export async function getDashboardStats(userId: string) {
  const [
    companiesCount,
    projects,
    activityEvents,
    noteTasks,
    budgetTemplates,
    templateBudgetApplicationCount,
    templateMaintenanceEventCount,
  ] = await Promise.all([
    prisma.company.count({
      where: { userId },
    }),
    prisma.project.findMany({
      where: {
        company: {
          userId,
        },
      },
      select: {
        id: true,
        name: true,
        location: true,
        status: true,
        updatedAt: true,
        company: {
          select: {
            name: true,
          },
        },
        budgets: {
          select: {
            id: true,
            name: true,
            kind: true,
            parentBudgetId: true,
            totalAmount: true,
            currency: true,
            updatedAt: true,
            polynomialFormulas: {
              select: {
                id: true,
                adjustments: {
                  select: {
                    id: true,
                  },
                  orderBy: { createdAt: "desc" },
                  take: 1,
                },
              },
              orderBy: { updatedAt: "desc" },
            },
          },
        },
        polynomialFormulas: {
          select: {
            id: true,
            budgetId: true,
            updatedAt: true,
            adjustments: {
              select: {
                id: true,
                month: true,
                year: true,
                createdAt: true,
              },
              orderBy: { createdAt: "desc" },
              take: 1,
            },
          },
          orderBy: { updatedAt: "desc" },
        },
      },
      orderBy: { updatedAt: "desc" },
    }),
    typeof (prisma as typeof prisma & { activityEvent?: unknown }).activityEvent === "undefined"
      ? Promise.resolve([])
      : prisma.activityEvent.findMany({
          where: { userId },
          orderBy: { createdAt: "desc" },
          take: 25,
        }),
    listNoteTasks(userId, { status: "OPEN" }),
    listDashboardBudgetTemplates(userId),
    countTemplateBudgetApplications(userId),
    countTemplateMaintenanceEvents(userId),
  ]);

  const projectsWithCompany = projects.map((project) => ({
    ...project,
    companyName: project.company.name,
  }));
  const generalBudgets = projectsWithCompany
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
  const formulas = projectsWithCompany
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
  const generalBudgetByProjectId = new Map(generalBudgets.map((budget) => [budget.projectId, budget]));
  const projectNameByProjectId = new Map(projectsWithCompany.map((project) => [project.id, project.name]));
  const polynomialFormulaRouteBudgetIdByBudgetId = buildPolynomialFormulaRouteBudgetIdByBudgetId(
    projectsWithCompany.flatMap((project) => project.budgets),
  );
  const projectNameByBudgetId = new Map(
    projectsWithCompany.flatMap((project) => project.budgets.map((budget) => [budget.id, project.name] as const)),
  );

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  const pendingItems = [...getPendingItems(projectsWithCompany), ...mapNoteTasksToPendingItems(noteTasks)];

  return {
    companiesCount,
    projectsCount: projectsWithCompany.length,
    budgetsCount: generalBudgets.length,
    portfolioValue: generalBudgets.reduce((sum, budget) => sum + decimalToNumber(budget.totalAmount), 0),
    monthlyAdjustmentsCount: adjustments.filter(
      (adjustment) => adjustment.month === currentMonth && adjustment.year === currentYear,
    ).length,
    pendingCount: pendingItems.length,
    recentProject: projectsWithCompany[0]
      ? {
          id: projectsWithCompany[0].id,
          name: projectsWithCompany[0].name,
          companyName: projectsWithCompany[0].companyName,
          status: projectsWithCompany[0].status,
          updatedAt: projectsWithCompany[0].updatedAt,
          generalBudget: generalBudgetByProjectId.get(projectsWithCompany[0].id)
            ? {
                id: generalBudgetByProjectId.get(projectsWithCompany[0].id)!.id,
                totalAmount: decimalToNumber(generalBudgetByProjectId.get(projectsWithCompany[0].id)!.totalAmount),
                currency: generalBudgetByProjectId.get(projectsWithCompany[0].id)!.currency,
              }
            : null,
        }
      : null,
    projects: projectsWithCompany.slice(0, 5).map((project) => ({
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
    pendingItems,
    templateSummary: buildTemplateDashboardSummary(
      budgetTemplates,
      templateBudgetApplicationCount,
      templateMaintenanceEventCount,
    ),
    recentActivity: (activityEvents.length > 0
      ? activityEvents.map((event) => mapActivityEvent(event, {
          polynomialFormulaRouteBudgetIdByBudgetId,
          projectNameByBudgetId,
          projectNameByProjectId,
        }))
      : getRecentActivity(projectsWithCompany, generalBudgets, formulas, adjustments, polynomialFormulaRouteBudgetIdByBudgetId)
    ).slice(0, 25),
  };
}

export function buildTemplateDashboardSummary(
  templates: DashboardBudgetTemplateRow[],
  templateBudgetApplicationCount: number,
  templateMaintenanceEventCount = 0,
): DashboardTemplateSummary {
  const templatesWithItemCount = templates.map((template) => ({
    ...template,
    itemCount: readTemplateItemCount(template.payload),
  }));
  const totalTemplateItems = templatesWithItemCount.reduce((sum, template) => sum + template.itemCount, 0);
  const latestTemplate = templatesWithItemCount[0] ?? null;

  return {
    savedTemplatesCount: templates.length,
    templateBudgetApplicationCount,
    templateMaintenanceEventCount,
    totalTemplateItems,
    averageItemsPerTemplate: templates.length > 0 ? Math.round(totalTemplateItems / templates.length) : 0,
    latestTemplate: latestTemplate
      ? {
          id: latestTemplate.id,
          name: latestTemplate.name,
          updatedAt: latestTemplate.updatedAt,
          itemCount: latestTemplate.itemCount,
        }
      : null,
  };
}

export function mapNoteTasksToPendingItems(notes: NoteTaskRecord[]): DashboardPendingItem[] {
  return notes
    .filter((note) => note.status === "OPEN")
    .map((note) => ({
      id: `note-${note.id}`,
      projectId: note.projectId ?? note.id,
      projectName: note.projectName ?? note.budgetName ?? "Nota general",
      companyName: "Sticky note",
      status: "PLANNING",
      observation: note.body,
      priority: mapNotePriority(note.priority),
      updatedAt: new Date(note.updatedAt),
      href: note.sourcePath || "/dashboard",
      type: "USER_NOTE_TASK",
    }));
}

async function listDashboardBudgetTemplates(userId: string): Promise<DashboardBudgetTemplateRow[]> {
  const client = prisma as typeof prisma & {
    budgetTemplate?: {
      findMany(args: {
        where: { userId: string; module: "BUDGET" };
        select: { id: true; name: true; updatedAt: true; payload: true };
        orderBy: { updatedAt: "desc" };
      }): Promise<DashboardBudgetTemplateRow[]>;
    };
  };

  if (!client.budgetTemplate) {
    return [];
  }

  return client.budgetTemplate.findMany({
    where: { userId, module: "BUDGET" },
    select: { id: true, name: true, updatedAt: true, payload: true },
    orderBy: { updatedAt: "desc" },
  });
}

async function countTemplateMaintenanceEvents(userId: string): Promise<number> {
  const client = prisma as typeof prisma & {
    activityEvent?: {
      count(args: {
        where: {
          userId: string;
          title: { startsWith: "Plantilla " };
        };
      }): Promise<number>;
    };
  };

  if (!client.activityEvent) {
    return 0;
  }

  return client.activityEvent.count({
    where: {
      userId,
      title: { startsWith: "Plantilla " },
    },
  });
}

async function countTemplateBudgetApplications(userId: string): Promise<number> {
  const client = prisma as typeof prisma & {
    activityEvent?: {
      count(args: {
        where: {
          userId: string;
          type: "BUDGET_CREATED";
          title: "Presupuesto creado desde plantilla";
        };
      }): Promise<number>;
    };
  };

  if (!client.activityEvent) {
    return 0;
  }

  return client.activityEvent.count({
    where: {
      userId,
      type: "BUDGET_CREATED",
      title: "Presupuesto creado desde plantilla",
    },
  });
}

function readTemplateItemCount(payload: unknown) {
  if (!isRecord(payload) || !isRecord(payload.summary)) {
    return 0;
  }

  const itemCount = payload.summary.itemCount;
  return typeof itemCount === "number" && Number.isFinite(itemCount) ? itemCount : 0;
}

function mapNotePriority(priority: NoteTaskPriority): DashboardPendingItem["priority"] {
  if (priority === "HIGH") return "high";
  if (priority === "MEDIUM") return "medium";
  return "low";
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
        id: `missing-general-budget-${project.id}`,
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
        id: `missing-polynomial-formula-${project.id}`,
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
        id: `missing-adjustments-${project.id}`,
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
        id: `no-recent-activity-${project.id}`,
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
  polynomialFormulaRouteBudgetIdByBudgetId: Map<string, string>,
): DashboardActivityItem[] {
  const items: DashboardActivityItem[] = [
    ...projects.map((project) => ({
      id: `project-${project.id}`,
      type: "PROJECT_UPDATED" as const,
      title: "Proyecto actualizado",
      detail: project.name,
      projectName: project.name,
      href: `/projects/${project.id}`,
      createdAt: project.updatedAt,
    })),
    ...generalBudgets.map((budget) => ({
      id: `budget-${budget.id}`,
      type: "GENERAL_BUDGET_UPDATED" as const,
      title: "Presupuesto general actualizado",
      detail: budget.projectName,
      projectName: budget.projectName,
      href: `/budgets/${budget.id}`,
      createdAt: budget.updatedAt,
    })),
    ...formulas.map((formula) => ({
      id: `formula-${formula.id}`,
      type: "POLYNOMIAL_FORMULA_UPDATED" as const,
      title: "Formula polinomica actualizada",
      detail: formula.projectName,
      projectName: formula.projectName,
      href: buildPolynomialFormulaActivityHref(formula.budgetId, polynomialFormulaRouteBudgetIdByBudgetId),
      createdAt: formula.updatedAt,
    })),
    ...adjustments.map((adjustment) => ({
      id: `adjustment-${adjustment.id}`,
      type: "ADJUSTMENT_REGISTERED" as const,
      title: "Reajuste registrado",
      detail: adjustment.projectName,
      projectName: adjustment.projectName,
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
}, lookups: {
  polynomialFormulaRouteBudgetIdByBudgetId: Map<string, string>;
  projectNameByBudgetId: Map<string, string>;
  projectNameByProjectId: Map<string, string>;
}): DashboardActivityItem {
  return {
    id: event.id,
    type: normalizeDashboardActivityEventType(event),
    title: event.title,
    detail: event.detail,
    projectName: resolveActivityProjectName(event.href, lookups),
    href: normalizePolynomialFormulaActivityHref(event.href, lookups.polynomialFormulaRouteBudgetIdByBudgetId),
    createdAt: event.createdAt,
  };
}

export function normalizePolynomialFormulaActivityHref(
  href: string,
  polynomialFormulaRouteBudgetIdByBudgetId: Map<string, string>,
) {
  const match = href.match(/^\/budgets\/([^/?#]+)\/polynomial-formula(?<suffix>[?#].*)?$/);
  if (!match) return href;

  const budgetId = match[1];
  if (!budgetId) return href;

  const routeBudgetId = polynomialFormulaRouteBudgetIdByBudgetId.get(budgetId);
  if (!routeBudgetId || routeBudgetId === budgetId) return href;

  return `/budgets/${routeBudgetId}/polynomial-formula${match.groups?.suffix ?? ""}`;
}

function buildPolynomialFormulaActivityHref(
  budgetId: string,
  polynomialFormulaRouteBudgetIdByBudgetId: Map<string, string>,
) {
  return normalizePolynomialFormulaActivityHref(
    `/budgets/${budgetId}/polynomial-formula`,
    polynomialFormulaRouteBudgetIdByBudgetId,
  );
}

function buildPolynomialFormulaRouteBudgetIdByBudgetId(
  budgets: Array<{ id: string; kind: string; parentBudgetId: string | null }>,
) {
  const routeBudgetIdByBudgetId = new Map<string, string>();
  const generalBudgetIds = new Set(budgets.filter((budget) => budget.kind === "GENERAL").map((budget) => budget.id));

  for (const budget of budgets) {
    if (budget.kind === "GENERAL") {
      routeBudgetIdByBudgetId.set(budget.id, budget.id);
      continue;
    }

    if (budget.parentBudgetId && generalBudgetIds.has(budget.parentBudgetId)) {
      routeBudgetIdByBudgetId.set(budget.id, budget.parentBudgetId);
    }
  }

  return routeBudgetIdByBudgetId;
}

function resolveActivityProjectName(
  href: string,
  lookups: {
    projectNameByBudgetId: Map<string, string>;
    projectNameByProjectId: Map<string, string>;
  },
): string | null {
  const budgetMatch = href.match(/^\/budgets\/([^/]+)/);
  if (budgetMatch) {
    return lookups.projectNameByBudgetId.get(budgetMatch[1]) ?? null;
  }

  const projectMatch = href.match(/^\/projects\/([^/]+)/);
  if (projectMatch) {
    return lookups.projectNameByProjectId.get(projectMatch[1]) ?? null;
  }

  return null;
}

export function normalizeDashboardActivityEventType(event: {
  type: ActivityEventType;
  title: string;
  href: string;
}): DashboardActivityType {
  if (event.title === "Metrado duplicado" || event.href.startsWith("/metrados-avanzados")) {
    return "METRADO_DUPLICATED";
  }

  if (event.title.startsWith("Plantilla ") || event.href.startsWith("/templates/budget/")) {
    return "TEMPLATE_CHANGED";
  }

  switch (event.type) {
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
      throw new Error(`Unsupported activity event type: ${event.type satisfies never}`);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
