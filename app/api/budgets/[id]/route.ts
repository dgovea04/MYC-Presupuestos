import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getAuthSession } from "@/lib/auth/session";
import { recordActivityEvent } from "@/lib/data/activity-events";
import { deleteBudget, getBudgetHeaderById, getBudgetLiveUpdateSummaries, saveBudgetPatch } from "@/lib/data/budgets";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAuthSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { id } = await params;
    const budget = await saveBudgetPatch(id, session.user.id, body);
    await recordActivityEvent({
      userId: session.user.id,
      type: "BUDGET_UPDATED",
      title: "Presupuesto actualizado",
      detail: budget.name,
      href: `/budgets/${id}`,
    });
    const optimisticBudgets = await getBudgetLiveUpdateSummaries(id, session.user.id);
    revalidateBudgetPaths(budget.projectId, id);
    return NextResponse.json({ budget, optimisticBudgets });
  } catch (error) {
    console.error("Budget PATCH failed", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo guardar el presupuesto" }, { status: 400 });
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAuthSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const budget = await getBudgetHeaderById(id, session.user.id);
    if (!budget) {
      return NextResponse.json({ error: "No tienes permisos para eliminar este presupuesto" }, { status: 400 });
    }

    await deleteBudget(id, session.user.id);
    revalidateBudgetPaths(budget.projectId, id);
    if (budget.parentBudgetId) {
      revalidatePath(`/budgets/${budget.parentBudgetId}`);
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo eliminar el presupuesto" }, { status: 400 });
  }
}

function revalidateBudgetPaths(projectId: string, budgetId: string) {
  revalidatePath("/dashboard");
  revalidatePath("/budgets");
  revalidatePath(`/budgets/${budgetId}`);
  revalidatePath("/projects");
  revalidatePath(`/projects/${projectId}`);
}
