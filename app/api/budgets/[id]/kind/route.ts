import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth/session";
import { getBudgetHeaderById } from "@/lib/data/budgets";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAuthSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const budget = await getBudgetHeaderById(id, session.user.id);

    if (!budget) {
      return NextResponse.json({ error: "Budget not found" }, { status: 404 });
    }

    return NextResponse.json({ kind: budget.kind });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo identificar el tipo de presupuesto" },
      { status: 400 },
    );
  }
}
