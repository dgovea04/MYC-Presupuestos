import { prisma } from "@/lib/db/prisma";
import { getUserSettings } from "@/lib/data/settings";
import { projectSchema, type ProjectInput } from "@/lib/validations/project";
import { Prisma } from "@prisma/client";
import { DEFAULT_INITIAL_SUB_BUDGET_NAMES } from "@/types/settings";

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

export async function getUserCompanies(userId: string) {
  return prisma.company.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
  });
}

export async function getProjectsByUser(userId: string) {
  const settings = await getUserSettings(userId);

  return prisma.$transaction(async (tx) => {
    const projects = await tx.project.findMany({
      where: {
        company: {
          userId,
        },
      },
      include: {
        company: true,
      },
      orderBy: {
        updatedAt: "desc",
      },
    });

    const hydratedProjects = [];
    for (const project of projects) {
      const budgets = await ensureProjectBudgetStructure(
        tx,
        project.id,
        createDefaultBudgetContext(settings),
        settings.defaultSubBudgetNames,
      );
      hydratedProjects.push({
        ...project,
        budgets,
      });
    }

    return hydratedProjects;
  });
}

export async function getProjectById(id: string, userId: string) {
  const settings = await getUserSettings(userId);

  return prisma.$transaction(async (tx) => {
    const project = await tx.project.findFirst({
      where: {
        id,
        company: {
          userId,
        },
      },
      include: {
        company: true,
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

    return {
      ...project,
      budgets,
    };
  });
}

export async function createProject(userId: string, input: ProjectInput) {
  const data = projectSchema.parse(input);

  const company = await prisma.company.findFirst({
    where: {
      id: data.companyId,
      userId,
    },
    select: { id: true },
  });

  if (!company) {
    throw new Error("No puedes crear proyectos en una empresa que no te pertenece");
  }

  const settings = await getUserSettings(userId);
  const defaultBudgetData = createBudgetData(createDefaultBudgetContext(settings));
  const defaultBudgetNames = getDefaultSubBudgetNames(settings);

  return prisma.$transaction(async (tx) => {
    const project = await tx.project.create({
      data: {
        ...data,
        startDate: data.startDate ? new Date(data.startDate) : undefined,
        endDate: data.endDate ? new Date(data.endDate) : undefined,
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
        userId,
      },
    },
  });
  const merged = {
    companyId: input.companyId ?? current.companyId,
    name: input.name ?? current.name,
    clientName: input.clientName ?? current.clientName ?? "",
    location: input.location ?? current.location ?? "",
    projectType: input.projectType ?? current.projectType ?? "",
    startDate: input.startDate ?? current.startDate?.toISOString().slice(0, 10) ?? "",
    endDate: input.endDate ?? current.endDate?.toISOString().slice(0, 10) ?? "",
    status: input.status ?? current.status,
  };
  const data = projectSchema.parse(merged);

  return prisma.project.update({
    where: { id },
    data: {
      ...data,
      startDate: data.startDate ? new Date(data.startDate) : null,
      endDate: data.endDate ? new Date(data.endDate) : null,
    },
  });
}

export async function deleteProject(id: string, userId: string) {
  const project = await prisma.project.findFirst({
    where: {
      id,
      company: {
        userId,
      },
    },
    select: { id: true },
  });

  if (!project) {
    throw new Error("No tienes permisos para eliminar este proyecto");
  }

  await prisma.project.delete({
    where: { id },
  });
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
