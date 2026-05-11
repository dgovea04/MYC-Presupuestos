import { prisma } from "@/lib/db/prisma";
import { projectSchema, type ProjectInput } from "@/lib/validations/project";
import type { Prisma } from "@prisma/client";

const defaultProjectBudgetNames = [
  "Estructuras",
  "Arquitectura",
  "Instalaciones Sanitarias",
  "Instalaciones Electricas",
] as const;

const defaultBudgetRates = {
  currency: "PEN",
  igvRate: 0.18,
  generalExpensesRate: 0.1,
  utilityRate: 0.08,
  totalDirectCost: 0,
  totalGeneralExpenses: 0,
  totalUtility: 0,
  totalTax: 0,
  totalAmount: 0,
} as const;

export async function getUserCompanies(userId: string) {
  return prisma.company.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
  });
}

export async function getProjectsByUser(userId: string) {
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
      const budgets = await ensureProjectBudgetStructure(tx, project.id);
      hydratedProjects.push({
        ...project,
        budgets,
      });
    }

    return hydratedProjects;
  });
}

export async function getProjectById(id: string, userId: string) {
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

    const budgets = await ensureProjectBudgetStructure(tx, project.id);

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
        ...defaultBudgetRates,
      },
    });

    await tx.budget.createMany({
      data: defaultProjectBudgetNames.map((name) => ({
        projectId: project.id,
        parentBudgetId: generalBudget.id,
        kind: "SUB_BUDGET",
        name,
        ...defaultBudgetRates,
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

async function ensureProjectBudgetStructure(tx: Prisma.TransactionClient, projectId: string) {
  const budgets = await tx.budget.findMany({
    where: { projectId },
    orderBy: [{ kind: "asc" }, { createdAt: "asc" }],
  });

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
        ...defaultBudgetRates,
      },
    });
  } else if (generalBudget.name !== "Presupuesto General") {
    generalBudget = await tx.budget.update({
      where: { id: generalBudget.id },
      data: { name: "Presupuesto General" },
    });
  }

  const budgetsByName = new Map(budgets.map((budget) => [budget.name, budget]));

  for (const name of defaultProjectBudgetNames) {
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
        ...defaultBudgetRates,
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
      totalDirectCost: totals.totalDirectCost + Number(childBudget.totalDirectCost),
      totalGeneralExpenses: totals.totalGeneralExpenses + Number(childBudget.totalGeneralExpenses),
      totalUtility: totals.totalUtility + Number(childBudget.totalUtility),
      totalTax: totals.totalTax + Number(childBudget.totalTax),
      totalAmount: totals.totalAmount + Number(childBudget.totalAmount),
    }),
    {
      totalDirectCost: 0,
      totalGeneralExpenses: 0,
      totalUtility: 0,
      totalTax: 0,
      totalAmount: 0,
    },
  );

  await tx.budget.update({
    where: { id: generalBudgetId },
    data: consolidated,
  });
}
