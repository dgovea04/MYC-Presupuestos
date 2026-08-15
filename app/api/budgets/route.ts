import { NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { getAuthSession } from "@/lib/auth/session";
import { trackServerEvent } from "@/lib/analytics/events";
import { createBillingErrorResponse } from "@/lib/billing/api";
import { recordActivityEvent } from "@/lib/data/activity-events";
import { BUDGETS_LIST_CACHE_TAG, createBudget } from "@/lib/data/budgets";
import { getProjectOverviewCacheTag, PROJECT_OVERVIEW_CACHE_TAG } from "@/lib/data/projects";
import { prisma } from "@/lib/db/prisma";

export async function POST(request: Request) {
  const session = await getAuthSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const budget = await createBudget(session.user.id, body);
    await recordActivityEvent({
      userId: session.user.id,
      type: "BUDGET_CREATED",
      title: "Presupuesto creado",
      detail: budget.name,
      href: `/budgets/${budget.id}`,
    });
    await safelyTrackBudgetCreated(budget.id, budget.projectId, session.user.id);
    revalidatePath("/dashboard");
    revalidateTag("dashboard-stats", "max");
    revalidateTag("dashboard-analytics", "max");
    revalidateTag(BUDGETS_LIST_CACHE_TAG, "max");
    revalidateTag(PROJECT_OVERVIEW_CACHE_TAG, "max");
    revalidateTag(getProjectOverviewCacheTag(budget.projectId), "max");
    revalidatePath("/budgets");
    revalidatePath("/projects");
    revalidatePath(`/projects/${budget.projectId}`);
    revalidatePath(`/budgets/${budget.id}`);
    if (budget.parentBudgetId) {
      revalidatePath(`/budgets/${budget.parentBudgetId}`);
    }
    return NextResponse.json(budget, { status: 201 });
  } catch (error) {
    const billingResponse = createBillingErrorResponse(error);
    if (billingResponse) return billingResponse;

    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo crear el presupuesto" }, { status: 400 });
  }
}

async function safelyTrackBudgetCreated(
  budgetId: string,
  projectId: string,
  userId: string,
) {
  try {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { companyId: true, isDemo: true },
    });

    if (!project) {
      return;
    }

    const budgetKind = await prisma.budget.findUnique({
      where: { id: budgetId },
      select: { kind: true },
    });
    if (!budgetKind) {
      return;
    }

    await trackServerEvent("budget_created", {
      userId,
      companyId: project.companyId,
      generalBudgetId: budgetId,
      budget_kind: budgetKind.kind,
      is_demo: project.isDemo,
    });
  } catch {
    // Analytics must not turn a successful budget creation into an API failure.
  }
}
