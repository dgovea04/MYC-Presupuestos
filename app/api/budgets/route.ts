import { NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { getAuthSession } from "@/lib/auth/session";
import { createBillingErrorResponse } from "@/lib/billing/api";
import { recordActivityEvent } from "@/lib/data/activity-events";
import { BUDGETS_LIST_CACHE_TAG, createBudget } from "@/lib/data/budgets";
import { PROJECT_OVERVIEW_CACHE_TAG } from "@/lib/data/projects";

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
    revalidatePath("/dashboard");
    revalidateTag("dashboard-stats", "max");
    revalidateTag("dashboard-analytics", "max");
    revalidateTag(BUDGETS_LIST_CACHE_TAG, "max");
    revalidateTag(PROJECT_OVERVIEW_CACHE_TAG, "max");
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
