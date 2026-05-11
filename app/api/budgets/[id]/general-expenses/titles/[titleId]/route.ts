import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getAuthSession } from "@/lib/auth/session";
import { deleteBudgetGeneralExpenseTitle, updateBudgetGeneralExpenseTitle } from "@/lib/data/budgets";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string; titleId: string }> }) {
  const session = await getAuthSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { id, titleId } = await params;
    const structure = await updateBudgetGeneralExpenseTitle(id, titleId, session.user.id, body);
    revalidateBudgetPaths(id);
    return NextResponse.json(structure);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo actualizar el titulo" }, { status: 400 });
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string; titleId: string }> }) {
  const session = await getAuthSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id, titleId } = await params;
    const structure = await deleteBudgetGeneralExpenseTitle(id, titleId, session.user.id);
    revalidateBudgetPaths(id);
    return NextResponse.json(structure);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo eliminar el titulo" }, { status: 400 });
  }
}

function revalidateBudgetPaths(budgetId: string) {
  revalidatePath(`/budgets/${budgetId}`);
  revalidatePath(`/budgets/${budgetId}/general-expenses`);
}
