import { notFound } from "next/navigation";
import { getAuthSession } from "@/lib/auth/session";
import { decimalToNumber } from "@/lib/db/serializers";
import { getBudgetHeaderById } from "@/lib/data/budgets";
import { getProjectBudgetOverviewById, getProjectHeaderById } from "@/lib/data/projects";
import { resolveProjectGeneralBudget } from "@/lib/projects/general-budget";
import { getUserSettings } from "@/lib/data/settings";

export async function getGeneralBudgetSectionContext(id: string) {
  const session = await getAuthSession();
  if (!session) {
    notFound();
  }

  const [budget, settings] = await Promise.all([
    getBudgetHeaderById(id, session.user.id),
    getUserSettings(session.user.id),
  ]);

  if (!budget) {
    notFound();
  }

  const projectBudgetOverview = await getProjectBudgetOverviewById(budget.projectId, session.user.id);
  const resolvedGeneralBudget = projectBudgetOverview
    ? resolveProjectGeneralBudget(projectBudgetOverview.budgets)
    : null;

  if (!resolvedGeneralBudget || resolvedGeneralBudget.id !== budget.id) {
    notFound();
  }

  const project = await getProjectHeaderById(resolvedGeneralBudget.projectId, session.user.id);
  if (!project) {
    notFound();
  }

  const structuresBudget = projectBudgetOverview?.budgets.find(
    (candidate) => candidate.kind === "SUB_BUDGET" && candidate.name === "Estructuras",
  ) ?? null;

  return {
    session,
    currentUser: session.user,
    structuresBudgetId: structuresBudget?.id ?? null,
    budget: {
      ...budget,
      igvRate: decimalToNumber(budget.igvRate),
      generalExpensesRate: decimalToNumber(budget.generalExpensesRate),
      utilityRate: decimalToNumber(budget.utilityRate),
      totalDirectCost: decimalToNumber(budget.totalDirectCost),
      totalGeneralExpenses: decimalToNumber(budget.totalGeneralExpenses),
      totalUtility: decimalToNumber(budget.totalUtility),
      totalTax: decimalToNumber(budget.totalTax),
      totalAmount: decimalToNumber(budget.totalAmount),
    },
    project,
    settings,
  };
}
