import { notFound } from "next/navigation";
import { getAuthSession } from "@/lib/auth/session";
import { decimalToNumber } from "@/lib/db/serializers";
import { getBudgetHeaderById } from "@/lib/data/budgets";
import { getProjectHeaderById } from "@/lib/data/projects";
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

  if (!budget || budget.kind !== "GENERAL") {
    notFound();
  }

  const project = await getProjectHeaderById(budget.projectId, session.user.id);
  if (!project) {
    notFound();
  }

  return {
    session,
    currentUser: session.user,
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
