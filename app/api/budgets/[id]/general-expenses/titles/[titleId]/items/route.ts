import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getAuthSession } from "@/lib/auth/session";
import { createBudgetGeneralExpenseItem } from "@/lib/data/budgets";

export async function POST(request: Request, { params }: { params: Promise<{ id: string; titleId: string }> }) {
  const session = await getAuthSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { id, titleId } = await params;
    const structure = await createBudgetGeneralExpenseItem(id, titleId, session.user.id, body);
    revalidateBudgetPaths(id);
    return NextResponse.json(structure, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo crear el item" }, { status: 400 });
  }
}

function revalidateBudgetPaths(budgetId: string) {
  revalidatePath(`/budgets/${budgetId}`);
  revalidatePath(`/budgets/${budgetId}/general-expenses`);
}
