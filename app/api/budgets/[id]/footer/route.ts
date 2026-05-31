import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getAuthSession } from "@/lib/auth/session";
import { getBudgetFooterStructure, saveBudgetFooterStructure } from "@/lib/data/budgets";
import { getUserSettings } from "@/lib/data/settings";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAuthSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const settings = await getUserSettings(session.user.id);
    const structure = await getBudgetFooterStructure(id, session.user.id, settings.currencyDecimals);
    return NextResponse.json(structure);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo cargar el pie de presupuesto" }, { status: 400 });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAuthSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { id } = await params;
    const settings = await getUserSettings(session.user.id);
    const structure = await saveBudgetFooterStructure(id, session.user.id, body, settings.currencyDecimals);
    revalidateBudgetPaths(id);
    return NextResponse.json(structure);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo guardar el pie de presupuesto" }, { status: 400 });
  }
}

function revalidateBudgetPaths(budgetId: string) {
  revalidatePath(`/budgets/${budgetId}`);
  revalidatePath(`/budgets/${budgetId}/footer`);
}
