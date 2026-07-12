import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth/session";
import { getProjectSubBudgetDetails } from "@/lib/data/budgets";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAuthSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id: projectId } = await params;
    const budgets = await getProjectSubBudgetDetails(projectId, session.user.id);
    return NextResponse.json({ budgets });
  } catch (error) {
    console.error("GET project sub-budget details failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo cargar el detalle de sub presupuestos" },
      { status: 400 },
    );
  }
}
