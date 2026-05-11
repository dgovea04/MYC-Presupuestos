import { notFound } from "next/navigation";
import { getAuthSession } from "@/lib/auth/session";
import { getBudgetById } from "@/lib/data/budgets";
import { getProjectById } from "@/lib/data/projects";
import { getUserSettings } from "@/lib/data/settings";

export async function getGeneralBudgetSectionContext(id: string) {
  const session = await getAuthSession();
  if (!session) {
    notFound();
  }

  const [budget, settings] = await Promise.all([
    getBudgetById(id, session.user.id),
    getUserSettings(session.user.id),
  ]);

  if (!budget || budget.kind !== "GENERAL") {
    notFound();
  }

  const project = await getProjectById(budget.projectId, session.user.id);
  if (!project) {
    notFound();
  }

  return {
    session,
    budget,
    project,
    settings,
  };
}
