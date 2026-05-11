import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getAuthSession } from "@/lib/auth/session";
import { deleteBudgetGeneralExpenseItem, updateBudgetGeneralExpenseItem } from "@/lib/data/budgets";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string; itemId: string }> }) {
  const session = await getAuthSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { id, itemId } = await params;
    const structure = await updateBudgetGeneralExpenseItem(id, itemId, session.user.id, body);
    revalidateBudgetPaths(id);
    return NextResponse.json(structure);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo actualizar el item" }, { status: 400 });
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string; itemId: string }> }) {
  const session = await getAuthSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id, itemId } = await params;
    const structure = await deleteBudgetGeneralExpenseItem(id, itemId, session.user.id);
    revalidateBudgetPaths(id);
    return NextResponse.json(structure);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo eliminar el item" }, { status: 400 });
  }
}

function revalidateBudgetPaths(budgetId: string) {
  revalidatePath(`/budgets/${budgetId}`);
  revalidatePath(`/budgets/${budgetId}/general-expenses`);
}
