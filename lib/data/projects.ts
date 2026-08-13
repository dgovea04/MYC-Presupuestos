import { cache } from "react";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { getUserSettings } from "@/lib/data/settings";
import { projectSchema, type ProjectInput } from "@/lib/validations/project";
import { Prisma } from "@prisma/client";
import { DEFAULT_INITIAL_SUB_BUDGET_NAMES } from "@/types/settings";
import { assertWithinPlanLimit } from "@/lib/billing/entitlements";
import { getTemplateLibraryItem } from "@/lib/templates/template-library";
import { ensureDate } from "@/lib/utils";
import { serializeBudgetForClientForm } from "@/lib/data/serializers";
import { assertWorkspaceMembership } from "@/lib/workspace/access";
import { measureAsync } from "@/lib/platform/performance";

export const PROJECTS_LIST_CACHE_TAG = "projects-list";
export const PROJECT_OVERVIEW_CACHE_TAG = "project-overview";
export const USER_COMPANIES_CACHE_TAG = "user-companies";
export function getProjectOverviewCacheTag(projectId: string) {
  return `${PROJECT_OVERVIEW_CACHE_TAG}:${projectId}`;
}

const defaultBudgetTotals = {
  totalDirectCost: 0,
  totalGeneralExpenses: 0,
  totalUtility: 0,
  totalTax: 0,
  totalAmount: 0,
} as const;

type BudgetDefaultsContext = {
  currency: string;
  igvRate: Prisma.Decimal | number;
  generalExpensesRate: Prisma.Decimal | number;
  utilityRate: Prisma.Decimal | number;
};

type BudgetDefaultsSource = BudgetDefaultsContext & {
  kind: "GENERAL" | "SUB_BUDGET";
  name: string;
};

type SourceProjectGraph = Prisma.ProjectGetPayload<{
  include: {
    budgets: {
      include: {
        levels: true;
        items: {
          include: {
            apu: {
              include: {
                resources: true;
              };
            };
          };
        };
        generalExpenses: true;
        generalExpenseGroups: {
          include: {
            titles: {
              include: {
                items: true;
              };
            };
          };
        };
        footerRows: true;
      };
    };
    polynomialFormulas: {
      include: {
        monomials: {
          include: {
            components: true;
          };
        };
      };
    };
  };
}>;

type ProjectWithCalendars = Prisma.ProjectGetPayload<{
  include: {
    company: true;
    projectCalendars: {
      include: {
        workCalendar: {
          include: {
            exceptions: true;
          };
        };
      };
    };
  };
}>;

function createDefaultBudgetContext(settings: Awaited<ReturnType<typeof getUserSettings>>): BudgetDefaultsContext {
  return {
    currency: settings.defaultCurrency,
    igvRate: settings.defaultIgvRate,
    generalExpensesRate: settings.defaultGeneralExpensesRate,
    utilityRate: settings.defaultUtilityRate,
  };
}

function createBudgetData(context: BudgetDefaultsContext) {
  return {
    currency: context.currency,
    igvRate: context.igvRate,
    generalExpensesRate: context.generalExpensesRate,
    utilityRate: context.utilityRate,
    ...defaultBudgetTotals,
  };
}

function resolveBudgetDefaultsContext(
  budgets: BudgetDefaultsSource[],
  fallbackContext: BudgetDefaultsContext,
): BudgetDefaultsContext {
  const compatibleBudget =
    budgets.find((budget) => budget.kind === "GENERAL" && budget.name === "Presupuesto General") ??
    budgets.find((budget) => budget.kind === "GENERAL") ??
    budgets[0];

  if (!compatibleBudget) {
    return fallbackContext;
  }

  return {
    currency: compatibleBudget.currency,
    igvRate: compatibleBudget.igvRate,
    generalExpensesRate: compatibleBudget.generalExpensesRate,
    utilityRate: compatibleBudget.utilityRate,
  };
}

function createZeroDecimalBudgetTotals() {
  return {
    totalDirectCost: new Prisma.Decimal(0),
    totalGeneralExpenses: new Prisma.Decimal(0),
    totalUtility: new Prisma.Decimal(0),
    totalTax: new Prisma.Decimal(0),
    totalAmount: new Prisma.Decimal(0),
  };
}

function getDefaultSubBudgetNames(settings: Awaited<ReturnType<typeof getUserSettings>>) {
  if (settings.defaultSubBudgetNames.length > 0) {
    return [...settings.defaultSubBudgetNames];
  }

  return [...DEFAULT_INITIAL_SUB_BUDGET_NAMES];
}

function getFallbackSubBudgetNames(defaultSubBudgetNames: readonly string[]) {
  if (defaultSubBudgetNames.length > 0) {
    return [...defaultSubBudgetNames];
  }

  return [...DEFAULT_INITIAL_SUB_BUDGET_NAMES];
}

const _getUserCompanies = async (userId: string) => {
  const memberships = await prisma.companyMembership.findMany({
    where: { userId, status: "ACTIVE" },
    include: { company: true },
    orderBy: { joinedAt: "asc" },
  });

  return memberships.map((m) => m.company);
}

export const getUserCompanies = cache(
  async (userId: string) => {
    if (shouldBypassPersistentCache) {
      return _getUserCompanies(userId);
    }

    return unstable_cache(
      async (uid: string) => _getUserCompanies(uid),
      [USER_COMPANIES_CACHE_TAG, userId],
      { tags: [USER_COMPANIES_CACHE_TAG] },
    )(userId);
  },
);

export async function getProjectsByUser(userId: string, activeCompanyId?: string | null) {
  const settings = await getUserSettings(userId);
  const defaultBudgetContext = createDefaultBudgetContext(settings);
  const defaultSubBudgetNames = getFallbackSubBudgetNames(settings.defaultSubBudgetNames);

  return prisma.$transaction(async (tx) => {
    const projects = await tx.project.findMany({
      where: {
        companyId: activeCompanyId ?? undefined,
        company: {
          memberships: {
            some: {
              userId,
              status: "ACTIVE",
            },
          },
        },
      },
      include: {
        company: true,
      },
      orderBy: {
        updatedAt: "desc",
      },
    });

    if (projects.length === 0) {
      return [];
    }

    // Batch-read all budgets for all projects in a single query — eliminates N+1
    const projectIds = projects.map((project) => project.id);
    const allBudgets = await tx.budget.findMany({
      where: { projectId: { in: projectIds } },
      orderBy: [{ kind: "asc" }, { createdAt: "asc" }],
    });
    const budgetsByProjectId = groupBudgetsByProjectId(allBudgets);

    const hydratedProjects = [];
    for (const project of projects) {
      const projectBudgets = budgetsByProjectId.get(project.id) ?? [];
      const generalBudget = findGeneralBudget(projectBudgets);
      const structureComplete =
        generalBudget !== null &&
        generalBudget.name === "Presupuesto General" &&
        defaultSubBudgetNames.every((name) => {
          const sub = projectBudgets.find((b) => b.name === name);
          return sub && sub.parentBudgetId === generalBudget.id && sub.kind === "SUB_BUDGET";
        });

      const budgets = structureComplete
        ? projectBudgets
        : await ensureProjectBudgetStructure(tx, project.id, defaultBudgetContext, settings.defaultSubBudgetNames);

      hydratedProjects.push({
        ...project,
        budgets,
      });
    }

    return hydratedProjects;
  });
}

function groupBudgetsByProjectId(budgets: Awaited<ReturnType<typeof prisma.budget.findMany>>) {
  const budgetsByProjectId = new Map<string, typeof budgets>();

  for (const budget of budgets) {
    const list = budgetsByProjectId.get(budget.projectId);
    if (list) {
      list.push(budget);
    } else {
      budgetsByProjectId.set(budget.projectId, [budget]);
    }
  }

  return budgetsByProjectId;
}

function findGeneralBudget(budgets: Awaited<ReturnType<typeof prisma.budget.findMany>>) {
  return (
    budgets.find((budget) => budget.kind === "GENERAL" && budget.name === "Presupuesto General") ??
    budgets.find((budget) => budget.kind === "GENERAL") ??
    null
  );
}

const _getProjectsListByUser = async (userId: string, activeCompanyId?: string | null) => {
  return prisma.project.findMany({
    where: {
      companyId: activeCompanyId ?? undefined,
      company: {
        memberships: {
          some: {
            userId,
            status: "ACTIVE",
          },
        },
      },
    },
    select: {
      id: true,
      companyId: true,
      name: true,
      isDemo: true,
      demoKey: true,
      clientName: true,
      location: true,
      projectType: true,
      projectCategory: true,
      buildingSubtype: true,
      contractType: true,
      builtArea: true,
      landArea: true,
      floors: true,
      basements: true,
      buildingHeight: true,
      contractAmount: true,
      referenceBudget: true,
      region: true,
      province: true,
      district: true,
      executiveSummary: true,
      projectManager: true,
      ownerEntity: true,
      supervisor: true,
      startDate: true,
      endDate: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      _count: {
        select: {
          budgets: {
            where: {
              kind: "GENERAL",
            },
          },
        },
      },
    },
    orderBy: {
      updatedAt: "desc",
    },
  });
}

function normalizeProjectsListDates(
  projects: Awaited<ReturnType<typeof _getProjectsListByUser>>,
) {
  return projects.map((project) => ({
    ...project,
    startDate: project.startDate ? ensureDate(project.startDate) : null,
    endDate: project.endDate ? ensureDate(project.endDate) : null,
    createdAt: ensureDate(project.createdAt),
    updatedAt: ensureDate(project.updatedAt),
  }));
}

const shouldBypassPersistentCache = process.env.NODE_ENV !== "production" || process.env.VITEST === "true";
const shouldUseProjectProcessCache = process.env.NODE_ENV !== "production" && process.env.VITEST !== "true";
const PROJECT_BUDGET_OVERVIEW_PROCESS_CACHE_TTL_MS = 5_000;

export const getProjectsListByUser = cache(
  async (userId: string, activeCompanyId?: string | null) => {
    if (shouldBypassPersistentCache) {
      return normalizeProjectsListDates(await _getProjectsListByUser(userId, activeCompanyId));
    }

    const result = await unstable_cache(
      async (uid: string) => _getProjectsListByUser(uid, activeCompanyId),
      activeCompanyId
        ? [PROJECTS_LIST_CACHE_TAG, userId, activeCompanyId]
        : [PROJECTS_LIST_CACHE_TAG, userId],
      { tags: [PROJECTS_LIST_CACHE_TAG] },
    )(userId);
    return normalizeProjectsListDates(result);
  },
);

export async function getProjectById(id: string, userId: string) {
  const settings = await getUserSettings(userId);

  return prisma.$transaction(async (tx) => {
    const project = await tx.project.findFirst({
      where: {
        id,
        company: {
          memberships: {
            some: {
              userId,
              status: "ACTIVE",
            },
          },
        },
      },
      include: {
        company: true,
        projectCalendars: {
          include: {
            workCalendar: {
              include: {
                exceptions: true,
              },
            },
          },
        },
      },
    });

    if (!project) {
      return null;
    }

    const budgets = await ensureProjectBudgetStructure(
      tx,
      project.id,
      createDefaultBudgetContext(settings),
      settings.defaultSubBudgetNames,
    );

    return serializeProjectForClientForm(project, budgets);
  });
}

function serializeProjectForClientForm(
  project: ProjectWithCalendars,
  budgets: Awaited<ReturnType<typeof ensureProjectBudgetStructure>>,
) {
  return {
    id: project.id,
    companyId: project.companyId,
    name: project.name,
    clientName: project.clientName,
    location: project.location,
    projectType: project.projectType,
    projectCategory: project.projectCategory,
    buildingSubtype: project.buildingSubtype,
    contractType: project.contractType,
    builtArea: project.builtArea ? Number(project.builtArea) : null,
    landArea: project.landArea ? Number(project.landArea) : null,
    floors: project.floors,
    basements: project.basements,
    buildingHeight: project.buildingHeight ? Number(project.buildingHeight) : null,
    contractAmount: project.contractAmount ? Number(project.contractAmount) : null,
    referenceBudget: project.referenceBudget ? Number(project.referenceBudget) : null,
    region: project.region,
    province: project.province,
    district: project.district,
    executiveSummary: project.executiveSummary,
    projectManager: project.projectManager,
    ownerEntity: project.ownerEntity,
    supervisor: project.supervisor,
    startDate: project.startDate?.toISOString() ?? null,
    endDate: project.endDate?.toISOString() ?? null,
    status: project.status,
    budgets: budgets.map(serializeBudgetForClientForm),
    workCalendarId: project.projectCalendars?.[0]?.workCalendarId ?? null,
  };
}

const _getProjectOverviewById = async (id: string, userId: string) => {
  return measureAsync("data.projects.overview.query", () => prisma.project.findFirst({
    where: {
      id,
      company: {
        memberships: {
          some: {
            userId,
            status: "ACTIVE",
          },
        },
      },
    },
    select: {
      id: true,
      companyId: true,
      name: true,
      isDemo: true,
      clientName: true,
      location: true,
      projectType: true,
      projectCategory: true,
      buildingSubtype: true,
      contractType: true,
      builtArea: true,
      landArea: true,
      floors: true,
      basements: true,
      buildingHeight: true,
      contractAmount: true,
      referenceBudget: true,
      region: true,
      province: true,
      district: true,
      executiveSummary: true,
      projectManager: true,
      ownerEntity: true,
      supervisor: true,
      startDate: true,
      endDate: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      company: {
        select: {
          name: true,
        },
      },
      projectCalendars: {
        select: {
          id: true,
          label: true,
          sortOrder: true,
          workCalendar: {
            select: {
              id: true,
              name: true,
              workDays: true,
              workHoursPerDay: true,
              exceptions: {
                select: {
                  id: true,
                  date: true,
                  type: true,
                  description: true,
                },
              },
            },
          },
        },
        orderBy: { sortOrder: "asc" },
      },
      budgets: {
        select: {
          id: true,
          projectId: true,
          parentBudgetId: true,
          kind: true,
          name: true,
          currency: true,
          totalDirectCost: true,
          totalGeneralExpenses: true,
          totalUtility: true,
          totalTax: true,
          totalAmount: true,
          updatedAt: true,
          _count: {
            select: {
              levels: true,
              items: true,
            },
          },
        },
        orderBy: {
          createdAt: "asc",
        },
      },
    },
  }), { projectId: id });
}

const _getProjectBudgetOverviewById = async (id: string, userId: string) => {
  return measureAsync("data.projects.budgetOverview.query", () => prisma.project.findFirst({
    where: {
      id,
      company: {
        memberships: {
          some: {
            userId,
            status: "ACTIVE",
          },
        },
      },
    },
    select: {
      id: true,
      companyId: true,
      name: true,
      clientName: true,
      updatedAt: true,
      budgets: {
        select: {
          id: true,
          projectId: true,
          parentBudgetId: true,
          kind: true,
          name: true,
          currency: true,
          totalDirectCost: true,
          totalGeneralExpenses: true,
          totalUtility: true,
          totalTax: true,
          totalAmount: true,
          updatedAt: true,
          _count: {
            select: {
              levels: true,
              items: true,
            },
          },
        },
        orderBy: {
          createdAt: "asc",
        },
      },
    },
  }), { projectId: id });
};

type ProjectBudgetOverviewCacheEntry = {
  expiresAt: number;
  value: Promise<Awaited<ReturnType<typeof _getProjectBudgetOverviewById>>>;
};

const projectBudgetOverviewProcessCache = new Map<string, ProjectBudgetOverviewCacheEntry>();

function normalizeProjectOverviewDates(
  project: Awaited<ReturnType<typeof _getProjectOverviewById>>,
) {
  if (!project) return null;

  return {
    ...project,
    builtArea: project.builtArea ? Number(project.builtArea) : null,
    landArea: project.landArea ? Number(project.landArea) : null,
    buildingHeight: project.buildingHeight ? Number(project.buildingHeight) : null,
    contractAmount: project.contractAmount ? Number(project.contractAmount) : null,
    referenceBudget: project.referenceBudget ? Number(project.referenceBudget) : null,
    startDate: project.startDate ? ensureDate(project.startDate) : null,
    endDate: project.endDate ? ensureDate(project.endDate) : null,
    createdAt: ensureDate(project.createdAt),
    updatedAt: ensureDate(project.updatedAt),
    workCalendar: project.projectCalendars?.[0]?.workCalendar
      ? {
          id: project.projectCalendars[0].workCalendar.id,
          name: project.projectCalendars[0].workCalendar.name,
          workDays: project.projectCalendars[0].workCalendar.workDays,
          workHoursPerDay: Number(project.projectCalendars[0].workCalendar.workHoursPerDay),
          exceptions: project.projectCalendars[0].workCalendar.exceptions.map((e) => ({
            id: e.id,
            date: e.date.toISOString().slice(0, 10),
            type: e.type as "HOLIDAY" | "WORK_DAY",
            description: e.description,
          })),
        }
      : null,
    budgets: project.budgets.map((budget) => ({
      ...budget,
      updatedAt: ensureDate(budget.updatedAt),
    })),
  };
}

function normalizeProjectBudgetOverviewDates(
  project: Awaited<ReturnType<typeof _getProjectBudgetOverviewById>>,
) {
  if (!project) return null;

  return {
    ...project,
    updatedAt: ensureDate(project.updatedAt),
    budgets: project.budgets.map((budget) => ({
      ...budget,
      updatedAt: ensureDate(budget.updatedAt),
    })),
  };
}

export const getProjectOverviewById = cache(
  async (id: string, userId: string) => {
    if (shouldBypassPersistentCache) {
      const result = await _getProjectOverviewById(id, userId);
      return measureAsync("data.projects.overview.normalize", async () => normalizeProjectOverviewDates(result), { projectId: id });
    }

    const result = await measureAsync("data.projects.overview.cached", () => unstable_cache(
      async (projectId: string, uid: string) => _getProjectOverviewById(projectId, uid),
      [PROJECT_OVERVIEW_CACHE_TAG, id, userId],
      { tags: [PROJECT_OVERVIEW_CACHE_TAG, getProjectOverviewCacheTag(id)] },
    )(id, userId), { projectId: id });
    return measureAsync("data.projects.overview.normalize", async () => normalizeProjectOverviewDates(result), { projectId: id });
  },
);

export const getProjectBudgetOverviewById = cache(
  async (id: string, userId: string) => {
    if (shouldBypassPersistentCache) {
      const cacheKey = `${id}:${userId}`;
      const existing = projectBudgetOverviewProcessCache.get(cacheKey);
      const result = shouldUseProjectProcessCache && existing && existing.expiresAt > Date.now()
        ? await existing.value
        : await (() => {
            const value = _getProjectBudgetOverviewById(id, userId).catch((error: unknown) => {
              projectBudgetOverviewProcessCache.delete(cacheKey);
              throw error;
            });

            if (shouldUseProjectProcessCache) {
              projectBudgetOverviewProcessCache.set(cacheKey, {
                expiresAt: Date.now() + PROJECT_BUDGET_OVERVIEW_PROCESS_CACHE_TTL_MS,
                value,
              });
            }

            return value;
          })();
      return measureAsync("data.projects.budgetOverview.normalize", async () => normalizeProjectBudgetOverviewDates(result), { projectId: id });
    }

    const result = await measureAsync("data.projects.budgetOverview.cached", () => unstable_cache(
      async (projectId: string, uid: string) => _getProjectBudgetOverviewById(projectId, uid),
      [`${PROJECT_OVERVIEW_CACHE_TAG}:budget-page`, id, userId],
      { tags: [PROJECT_OVERVIEW_CACHE_TAG, getProjectOverviewCacheTag(id)] },
    )(id, userId), { projectId: id });
    return measureAsync("data.projects.budgetOverview.normalize", async () => normalizeProjectBudgetOverviewDates(result), { projectId: id });
  },
);

export async function getProjectHeaderById(id: string, userId: string) {
  return prisma.project.findFirst({
    where: {
      id,
      company: {
        memberships: {
          some: {
            userId,
            status: "ACTIVE",
          },
        },
      },
    },
    select: {
      id: true,
      companyId: true,
      name: true,
      clientName: true,
      location: true,
      projectType: true,
      projectCategory: true,
      buildingSubtype: true,
      contractType: true,
      builtArea: true,
      landArea: true,
      floors: true,
      basements: true,
      buildingHeight: true,
      contractAmount: true,
      referenceBudget: true,
      region: true,
      province: true,
      district: true,
      executiveSummary: true,
      projectManager: true,
      ownerEntity: true,
      supervisor: true,
      status: true,
      updatedAt: true,
    },
  });
}

export async function createProject(userId: string, input: ProjectInput) {
  const data = projectSchema.parse(input);
  await assertWithinPlanLimit({ userId, resource: "projects" });

  await assertWorkspaceMembership({ userId, companyId: data.companyId, minimumRole: "EDITOR" });

  const settings = await getUserSettings(userId);
  const template = data.templateId ? getTemplateLibraryItem(data.templateId) : null;
  if (data.templateId && template?.module !== "BUDGET") {
    throw new Error("La plantilla seleccionada no esta disponible para crear proyectos");
  }

  const defaultBudgetData = createBudgetData(createDefaultBudgetContext(settings));
  const defaultBudgetNames = getDefaultSubBudgetNames(settings);

  return prisma.$transaction(async (tx) => {
    const project = await tx.project.create({
      data: {
        companyId: data.companyId,
        name: data.name,
        clientName: data.clientName,
        location: data.location,
        projectType: data.projectType || (template?.id === "budget-edificacion-base" ? "Edificacion" : undefined),
        projectCategory: data.projectCategory ?? null,
        buildingSubtype: data.buildingSubtype ?? null,
        contractType: data.contractType ?? null,
        builtArea: data.builtArea ?? null,
        landArea: data.landArea ?? null,
        floors: data.floors ?? null,
        basements: data.basements ?? null,
        buildingHeight: data.buildingHeight ?? null,
        contractAmount: data.contractAmount ?? null,
        referenceBudget: data.referenceBudget ?? null,
        region: data.region ?? null,
        province: data.province ?? null,
        district: data.district ?? null,
        executiveSummary: data.executiveSummary ?? null,
        projectManager: data.projectManager ?? null,
        ownerEntity: data.ownerEntity ?? null,
        supervisor: data.supervisor ?? null,
        status: data.status,
        startDate: data.startDate ? new Date(data.startDate) : undefined,
        endDate: data.endDate ? new Date(data.endDate) : undefined,
        projectCalendars: data.workCalendarId
          ? {
              create: {
                workCalendarId: data.workCalendarId,
                sortOrder: 0,
              },
            }
          : undefined,
      },
    });

    const generalBudget = await tx.budget.create({
      data: {
        projectId: project.id,
        kind: "GENERAL",
        name: "Presupuesto General",
        ...defaultBudgetData,
      },
    });

    await tx.budget.createMany({
      data: defaultBudgetNames.map((name) => ({
        projectId: project.id,
        parentBudgetId: generalBudget.id,
        kind: "SUB_BUDGET",
        name,
        ...defaultBudgetData,
      })),
    });

    return project;
  });
}

export async function updateProject(id: string, userId: string, input: Partial<ProjectInput>) {
  const current = await prisma.project.findFirstOrThrow({
    where: {
      id,
      company: {
        memberships: {
          some: {
            userId,
            status: "ACTIVE",
          },
        },
      },
    },
  });
  await assertWorkspaceMembership({ userId, companyId: current.companyId, minimumRole: "EDITOR" });
  const merged = {
    companyId: input.companyId ?? current.companyId,
    name: input.name ?? current.name,
    clientName: input.clientName ?? current.clientName ?? "",
    location: input.location ?? current.location ?? "",
    projectType: input.projectType ?? current.projectType ?? "",
    projectCategory: input.projectCategory !== undefined ? (input.projectCategory || null) : current.projectCategory,
    buildingSubtype: input.buildingSubtype !== undefined ? (input.buildingSubtype || null) : current.buildingSubtype,
    contractType: input.contractType !== undefined ? (input.contractType || null) : current.contractType,
    builtArea: input.builtArea !== undefined ? (input.builtArea as unknown === "" ? null : Number(input.builtArea)) : Number(current.builtArea ?? 0),
    landArea: input.landArea !== undefined ? (input.landArea as unknown === "" ? null : Number(input.landArea)) : Number(current.landArea ?? 0),
    floors: input.floors !== undefined ? (input.floors as unknown === "" ? null : Number(input.floors)) : current.floors,
    basements: input.basements !== undefined ? (input.basements as unknown === "" ? null : Number(input.basements)) : current.basements,
    buildingHeight: input.buildingHeight !== undefined ? (input.buildingHeight as unknown === "" ? null : Number(input.buildingHeight)) : Number(current.buildingHeight ?? 0),
    contractAmount: input.contractAmount !== undefined ? (input.contractAmount as unknown === "" ? null : Number(input.contractAmount)) : Number(current.contractAmount ?? 0),
    referenceBudget: input.referenceBudget !== undefined ? (input.referenceBudget as unknown === "" ? null : Number(input.referenceBudget)) : Number(current.referenceBudget ?? 0),
    region: input.region !== undefined ? (input.region || null) : current.region,
    province: input.province !== undefined ? (input.province || null) : current.province,
    district: input.district !== undefined ? (input.district || null) : current.district,
    executiveSummary: input.executiveSummary !== undefined ? (input.executiveSummary || null) : current.executiveSummary,
    projectManager: input.projectManager !== undefined ? (input.projectManager || null) : current.projectManager,
    ownerEntity: input.ownerEntity !== undefined ? (input.ownerEntity || null) : current.ownerEntity,
    supervisor: input.supervisor !== undefined ? (input.supervisor || null) : current.supervisor,
    startDate: input.startDate ?? (current.startDate ? ensureDate(current.startDate).toISOString().slice(0, 10) : ""),
    endDate: input.endDate ?? (current.endDate ? ensureDate(current.endDate).toISOString().slice(0, 10) : ""),
    status: input.status ?? current.status,
    workCalendarId: input.workCalendarId !== undefined ? (input.workCalendarId || null) : undefined,
  };
  const data = projectSchema.parse(merged);

  const upsertProjectCalendars =
    merged.workCalendarId !== undefined
      ? {
          deleteMany: {},
          ...(merged.workCalendarId
            ? {
                create: {
                  workCalendarId: merged.workCalendarId,
                  sortOrder: 0,
                },
              }
            : {}),
        }
      : undefined;

  const prismaData = { ...data };
  delete prismaData.workCalendarId;
  delete prismaData.templateId;

  return prisma.project.update({
    where: { id },
    data: {
      companyId: data.companyId,
      name: data.name,
      clientName: data.clientName || null,
      location: data.location || null,
      projectType: data.projectType || null,
      projectCategory: data.projectCategory ?? null,
      buildingSubtype: data.buildingSubtype ?? null,
      contractType: data.contractType ?? null,
      builtArea: data.builtArea ?? null,
      landArea: data.landArea ?? null,
      floors: data.floors ?? null,
      basements: data.basements ?? null,
      buildingHeight: data.buildingHeight ?? null,
      contractAmount: data.contractAmount ?? null,
      referenceBudget: data.referenceBudget ?? null,
      region: data.region || null,
      province: data.province || null,
      district: data.district || null,
      executiveSummary: data.executiveSummary || null,
      projectManager: data.projectManager || null,
      ownerEntity: data.ownerEntity || null,
      supervisor: data.supervisor || null,
      status: data.status,
      startDate: data.startDate ? new Date(data.startDate) : null,
      endDate: data.endDate ? new Date(data.endDate) : null,
      projectCalendars: upsertProjectCalendars,
    },
  });
}

export async function deleteProject(id: string, userId: string) {
  const project = await prisma.project.findFirst({
    where: { id },
    select: { id: true, companyId: true },
  });

  if (!project) {
    throw new Error("El proyecto no existe");
  }

  await assertWorkspaceMembership({ userId, companyId: project.companyId, minimumRole: "ADMIN" });

  await prisma.project.delete({
    where: { id },
  });
}

export async function duplicateProject(sourceProjectId: string, userId: string) {
  const preview = await prisma.project.findFirst({
    where: { id: sourceProjectId },
    select: { id: true, companyId: true },
  });

  if (!preview) {
    throw new Error("No tienes permisos para duplicar este proyecto");
  }

  await assertWorkspaceMembership({ userId, companyId: preview.companyId, minimumRole: "EDITOR" });

  return prisma.$transaction(async (tx) => {
    const sourceProject = await tx.project.findFirst({
      where: {
        id: sourceProjectId,
      },
      include: {
        budgets: {
          include: {
            levels: {
              orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
            },
            items: {
              include: {
                apu: {
                  include: {
                    resources: {
                      orderBy: {
                        createdAt: "asc",
                      },
                    },
                  },
                },
              },
              orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
            },
            generalExpenses: {
              orderBy: [{ createdAt: "asc" }],
            },
            generalExpenseGroups: {
              include: {
                titles: {
                  include: {
                    items: {
                      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
                    },
                  },
                  orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
                },
              },
              orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
            },
            footerRows: {
              orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
            },
          },
          orderBy: [{ kind: "asc" }, { createdAt: "asc" }],
        },
        polynomialFormulas: {
          include: {
            monomials: {
              include: {
                components: {
                  orderBy: {
                    createdAt: "asc",
                  },
                },
              },
              orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
            },
          },
          orderBy: [{ createdAt: "asc" }],
        },
      },
    });

    if (!sourceProject) {
      throw new Error("No tienes permisos para duplicar este proyecto");
    }

    const duplicatedName = await resolveDuplicateProjectName(tx, sourceProject.companyId, sourceProject.name);

    return createDuplicatedProjectGraph(tx, sourceProject, duplicatedName);
  });
}

async function resolveDuplicateProjectName(
  tx: Prisma.TransactionClient,
  companyId: string,
  sourceName: string,
) {
  const baseName = `${sourceName} (copia)`;
  const copyPrefix = `${sourceName} (copia`;
  const validCopyNamePattern = new RegExp(`^${escapeForRegExp(sourceName)} \\(copia(?: \\d+)?\\)$`);
  const siblingProjects = await tx.project.findMany({
    where: {
      companyId,
      name: {
        startsWith: copyPrefix,
      },
    },
    select: {
      name: true,
    },
  });
  const takenNames = new Set(
    siblingProjects.map((project) => project.name).filter((projectName) => validCopyNamePattern.test(projectName)),
  );

  if (!takenNames.has(baseName)) {
    return baseName;
  }

  let suffix = 2;
  let candidate = `${sourceName} (copia ${suffix})`;

  while (takenNames.has(candidate)) {
    suffix += 1;
    candidate = `${sourceName} (copia ${suffix})`;
  }

  return candidate;
}

function escapeForRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function requireMappedId(idMap: Map<string, string>, sourceId: string, message: string) {
  const mappedId = idMap.get(sourceId);

  if (!mappedId) {
    throw new Error(message);
  }

  return mappedId;
}

async function createDuplicatedProjectGraph(
  tx: Prisma.TransactionClient,
  sourceProject: SourceProjectGraph,
  duplicatedName: string,
) {
  const duplicatedProject = await tx.project.create({
    data: {
      companyId: sourceProject.companyId,
      name: duplicatedName,
      clientName: sourceProject.clientName,
      location: sourceProject.location,
      projectType: sourceProject.projectType,
      projectCategory: sourceProject.projectCategory,
      buildingSubtype: sourceProject.buildingSubtype,
      contractType: sourceProject.contractType,
      builtArea: sourceProject.builtArea,
      landArea: sourceProject.landArea,
      floors: sourceProject.floors,
      basements: sourceProject.basements,
      buildingHeight: sourceProject.buildingHeight,
      contractAmount: sourceProject.contractAmount,
      referenceBudget: sourceProject.referenceBudget,
      region: sourceProject.region,
      province: sourceProject.province,
      district: sourceProject.district,
      executiveSummary: sourceProject.executiveSummary,
      projectManager: sourceProject.projectManager,
      ownerEntity: sourceProject.ownerEntity,
      supervisor: sourceProject.supervisor,
      startDate: sourceProject.startDate,
      endDate: sourceProject.endDate,
      status: sourceProject.status,
    },
  });

  const budgetIdMap = new Map<string, string>();
  const levelIdMap = new Map<string, string>();
  const itemIdMap = new Map<string, string>();
  const apuResourceIdMap = new Map<string, string>();

  for (const sourceBudget of sourceProject.budgets) {
    const createdBudget = await tx.budget.create({
      data: {
        projectId: duplicatedProject.id,
        parentBudgetId: sourceBudget.parentBudgetId
          ? requireMappedId(
              budgetIdMap,
              sourceBudget.parentBudgetId,
              "No se pudo remapear el presupuesto padre al duplicar el proyecto",
            )
          : null,
        kind: sourceBudget.kind,
        name: sourceBudget.name,
        currency: sourceBudget.currency,
        igvRate: sourceBudget.igvRate,
        generalExpensesRate: sourceBudget.generalExpensesRate,
        utilityRate: sourceBudget.utilityRate,
        totalDirectCost: sourceBudget.totalDirectCost,
        totalGeneralExpenses: sourceBudget.totalGeneralExpenses,
        totalUtility: sourceBudget.totalUtility,
        totalTax: sourceBudget.totalTax,
        totalAmount: sourceBudget.totalAmount,
      },
    });

    budgetIdMap.set(sourceBudget.id, createdBudget.id);

    await cloneBudgetLevels(tx, sourceBudget.levels, createdBudget.id, levelIdMap);

    for (const sourceGeneralExpense of sourceBudget.generalExpenses) {
      await tx.generalExpense.create({
        data: {
          budgetId: createdBudget.id,
          name: sourceGeneralExpense.name,
          type: sourceGeneralExpense.type,
          amount: sourceGeneralExpense.amount,
          percentage: sourceGeneralExpense.percentage,
        },
      });
    }

    for (const sourceItem of sourceBudget.items) {
      const createdItem = await tx.budgetItem.create({
        data: {
          budgetId: createdBudget.id,
          levelId: sourceItem.levelId
            ? requireMappedId(
                levelIdMap,
                sourceItem.levelId,
                "No se pudo remapear el nivel del item al duplicar el proyecto",
              )
            : null,
          code: sourceItem.code,
          description: sourceItem.description,
          unit: sourceItem.unit,
          quantity: sourceItem.quantity,
          unitPrice: sourceItem.unitPrice,
          partial: sourceItem.partial,
          sortOrder: sourceItem.sortOrder,
        },
      });

      itemIdMap.set(sourceItem.id, createdItem.id);

      if (!sourceItem.apu) {
        continue;
      }

      const createdApu = await tx.apu.create({
        data: {
          budgetItemId: createdItem.id,
          name: sourceItem.apu.name,
          unit: sourceItem.apu.unit,
          performance: sourceItem.apu.performance,
          totalUnitCost: sourceItem.apu.totalUnitCost,
        },
      });

      for (const sourceApuResource of sourceItem.apu.resources) {
        const createdApuResource = await tx.apuResource.create({
          data: {
            apuId: createdApu.id,
            resourceId: sourceApuResource.resourceId,
            resourceType: sourceApuResource.resourceType,
            crew: sourceApuResource.crew,
            quantity: sourceApuResource.quantity,
            unitPrice: sourceApuResource.unitPrice,
            subtotal: sourceApuResource.subtotal,
          },
        });

        apuResourceIdMap.set(sourceApuResource.id, createdApuResource.id);
      }
    }

    for (const sourceGroup of sourceBudget.generalExpenseGroups) {
      const createdGroup = await tx.generalExpenseGroup.create({
        data: {
          budgetId: createdBudget.id,
          name: sourceGroup.name,
          kind: sourceGroup.kind,
          sortOrder: sourceGroup.sortOrder,
        },
      });

      for (const sourceTitle of sourceGroup.titles) {
        const createdTitle = await tx.generalExpenseTitle.create({
          data: {
            groupId: createdGroup.id,
            code: sourceTitle.code,
            name: sourceTitle.name,
            category: sourceTitle.category,
            sortOrder: sourceTitle.sortOrder,
          },
        });

        for (const sourceExpenseItem of sourceTitle.items) {
          await tx.generalExpenseItem.create({
            data: {
              titleId: createdTitle.id,
              code: sourceExpenseItem.code,
              description: sourceExpenseItem.description,
              category: sourceExpenseItem.category,
              unit: sourceExpenseItem.unit,
              quantityDescription: sourceExpenseItem.quantityDescription,
              quantity: sourceExpenseItem.quantity,
              participationPercentage: sourceExpenseItem.participationPercentage,
              unitPrice: sourceExpenseItem.unitPrice,
              sortOrder: sourceExpenseItem.sortOrder,
            },
          });
        }
      }
    }

    for (const sourceFooterRow of sourceBudget.footerRows) {
      await tx.budgetFooterRow.create({
        data: {
          budgetId: createdBudget.id,
          variable: sourceFooterRow.variable,
          description: sourceFooterRow.description,
          formula: sourceFooterRow.formula,
          manualValue: sourceFooterRow.manualValue,
          iu: sourceFooterRow.iu,
          highlight: sourceFooterRow.highlight,
          sortOrder: sourceFooterRow.sortOrder,
        },
      });
    }
  }

  for (const sourceFormula of sourceProject.polynomialFormulas) {
    const createdFormula = await tx.polynomialFormula.create({
      data: {
        projectId: duplicatedProject.id,
        budgetId: requireMappedId(
          budgetIdMap,
          sourceFormula.budgetId,
          "No se pudo remapear el presupuesto de la formula polinomica al duplicar el proyecto",
        ),
        name: sourceFormula.name,
        baseMonth: sourceFormula.baseMonth,
        baseYear: sourceFormula.baseYear,
        totalBaseAmount: sourceFormula.totalBaseAmount,
        status: sourceFormula.status,
      },
    });

    for (const sourceMonomial of sourceFormula.monomials) {
      const createdMonomial = await tx.polynomialMonomial.create({
        data: {
          formulaId: createdFormula.id,
          code: sourceMonomial.code,
          name: sourceMonomial.name,
          costGroupKey: sourceMonomial.costGroupKey,
          amount: sourceMonomial.amount,
          coefficient: sourceMonomial.coefficient,
          baseIndexCode: sourceMonomial.baseIndexCode,
          baseIndexName: sourceMonomial.baseIndexName,
          baseIndexValue: sourceMonomial.baseIndexValue,
          adjustmentIndexCode: sourceMonomial.adjustmentIndexCode,
          adjustmentIndexName: sourceMonomial.adjustmentIndexName,
          adjustmentIndexValue: sourceMonomial.adjustmentIndexValue,
          sortOrder: sourceMonomial.sortOrder,
        },
      });

      for (const sourceComponent of sourceMonomial.components) {
        await tx.polynomialMonomialComponent.create({
          data: {
            monomialId: createdMonomial.id,
            budgetItemId: sourceComponent.budgetItemId
              ? requireMappedId(
                  itemIdMap,
                  sourceComponent.budgetItemId,
                  "No se pudo remapear el item del monomio al duplicar el proyecto",
                )
              : null,
            apuResourceId: sourceComponent.apuResourceId
              ? requireMappedId(
                  apuResourceIdMap,
                  sourceComponent.apuResourceId,
                  "No se pudo remapear el recurso APU del monomio al duplicar el proyecto",
                )
              : null,
            resourceType: sourceComponent.resourceType,
            amount: sourceComponent.amount,
          },
        });
      }
    }
  }

  return duplicatedProject;
}

async function cloneBudgetLevels(
  tx: Prisma.TransactionClient,
  sourceLevels: SourceProjectGraph["budgets"][number]["levels"],
  budgetId: string,
  levelIdMap: Map<string, string>,
) {
  let pendingLevels = [...sourceLevels];

  while (pendingLevels.length > 0) {
    const nextPendingLevels: typeof pendingLevels = [];
    let createdLevels = 0;

    for (const sourceLevel of pendingLevels) {
      if (sourceLevel.parentId && !levelIdMap.has(sourceLevel.parentId)) {
        nextPendingLevels.push(sourceLevel);
        continue;
      }

      const createdLevel = await tx.budgetLevel.create({
        data: {
          budgetId,
          parentId: sourceLevel.parentId ? levelIdMap.get(sourceLevel.parentId) ?? null : null,
          type: sourceLevel.type,
          code: sourceLevel.code,
          name: sourceLevel.name,
          sortOrder: sourceLevel.sortOrder,
        },
      });

      levelIdMap.set(sourceLevel.id, createdLevel.id);
      createdLevels += 1;
    }

    if (createdLevels === 0) {
      throw new Error("No se pudo duplicar la jerarquia de niveles del presupuesto");
    }

    pendingLevels = nextPendingLevels;
  }
}

async function ensureProjectBudgetStructure(
  tx: Prisma.TransactionClient,
  projectId: string,
  fallbackBudgetContext: BudgetDefaultsContext,
  defaultSubBudgetNames: string[],
) {
  const budgets = await tx.budget.findMany({
    where: { projectId },
    orderBy: [{ kind: "asc" }, { createdAt: "asc" }],
  });

  const recoveryBudgetDefaults = createBudgetData(
    resolveBudgetDefaultsContext(budgets, fallbackBudgetContext),
  );

  let generalBudget =
    budgets.find((budget) => budget.kind === "GENERAL" && budget.name === "Presupuesto General") ??
    budgets.find((budget) => budget.kind === "GENERAL") ??
    null;

  if (!generalBudget) {
    generalBudget = await tx.budget.create({
      data: {
        projectId,
        kind: "GENERAL",
        name: "Presupuesto General",
        ...recoveryBudgetDefaults,
      },
    });
  } else if (generalBudget.name !== "Presupuesto General") {
    generalBudget = await tx.budget.update({
      where: { id: generalBudget.id },
      data: { name: "Presupuesto General" },
    });
  }

  const budgetsByName = new Map(budgets.map((budget) => [budget.name, budget]));
  const childBudgetDefaults = createBudgetData({
    currency: generalBudget.currency,
    igvRate: generalBudget.igvRate,
    generalExpensesRate: generalBudget.generalExpensesRate,
    utilityRate: generalBudget.utilityRate,
  });

  const defaultBudgetNames = getFallbackSubBudgetNames(defaultSubBudgetNames);

  for (const name of defaultBudgetNames) {
    const existing = budgetsByName.get(name);

    if (existing) {
      if (existing.parentBudgetId !== generalBudget.id || existing.kind !== "SUB_BUDGET") {
        const updated = await tx.budget.update({
          where: { id: existing.id },
          data: {
            parentBudgetId: generalBudget.id,
            kind: "SUB_BUDGET",
          },
        });
        budgetsByName.set(name, updated);
      }
      continue;
    }

    const created = await tx.budget.create({
      data: {
        projectId,
        parentBudgetId: generalBudget.id,
        kind: "SUB_BUDGET",
        name,
        ...childBudgetDefaults,
      },
    });

    budgetsByName.set(name, created);
  }

  await refreshGeneralBudgetTotals(tx, generalBudget.id);

  return tx.budget.findMany({
    where: { projectId },
    orderBy: [{ kind: "asc" }, { createdAt: "asc" }],
  });
}

/**
 * Loads the full project graph needed for .mcp package export.
 * Includes budgets, levels, items, APUs with resources, general expenses,
 * footer rows, and polynomial formulas with monomials and components.
 */
export async function getProjectForPackageExport(projectId: string, userId: string) {
  return prisma.project.findFirst({
    where: {
      id: projectId,
      company: {
        memberships: {
          some: {
            userId,
            status: "ACTIVE",
          },
        },
      },
    },
    include: {
      budgets: {
        include: {
          levels: true,
          items: {
            include: {
              apu: {
                include: {
                  resources: {
                    include: {
                      resource: true,
                    },
                  },
                },
              },
            },
          },
          generalExpenses: true,
          generalExpenseGroups: {
            include: {
              titles: {
                include: {
                  items: true,
                },
              },
            },
          },
          footerRows: true,
        },
      },
      polynomialFormulas: {
        include: {
          monomials: {
            include: {
              components: true,
            },
          },
        },
      },
    },
  });
}

async function refreshGeneralBudgetTotals(tx: Prisma.TransactionClient, generalBudgetId: string) {
  const generalBudget = await tx.budget.findUnique({
    where: { id: generalBudgetId },
    include: {
      childBudgets: {
        select: {
          totalDirectCost: true,
          totalGeneralExpenses: true,
          totalUtility: true,
          totalTax: true,
          totalAmount: true,
        },
      },
    },
  });

  if (!generalBudget) return;

  const consolidated = generalBudget.childBudgets.reduce(
    (totals, childBudget) => ({
      totalDirectCost: totals.totalDirectCost.plus(childBudget.totalDirectCost),
      totalGeneralExpenses: totals.totalGeneralExpenses.plus(childBudget.totalGeneralExpenses),
      totalUtility: totals.totalUtility.plus(childBudget.totalUtility),
      totalTax: totals.totalTax.plus(childBudget.totalTax),
      totalAmount: totals.totalAmount.plus(childBudget.totalAmount),
    }),
    createZeroDecimalBudgetTotals(),
  );

  await tx.budget.update({
    where: { id: generalBudgetId },
    data: consolidated,
  });
}
