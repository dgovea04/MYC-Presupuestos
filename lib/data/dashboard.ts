import { prisma } from "@/lib/db/prisma";
import { decimalToNumber } from "@/lib/db/serializers";

export async function getDashboardStats(userId: string) {
  const companies = await prisma.company.findMany({
    where: { userId },
    include: {
      projects: {
        include: {
          budgets: true,
        },
      },
    },
  });

  const projects = companies.flatMap((company) => company.projects);
  const generalBudgets = projects.flatMap((project) => project.budgets).filter((budget) => budget.kind === "GENERAL");

  return {
    companiesCount: companies.length > 0 ? 1 : 0,
    projectsCount: projects.length,
    budgetsCount: generalBudgets.length,
    portfolioValue: generalBudgets.reduce((sum, budget) => sum + decimalToNumber(budget.totalAmount), 0),
    projects: projects.slice(0, 5),
    budgets: generalBudgets.slice(0, 5),
  };
}
