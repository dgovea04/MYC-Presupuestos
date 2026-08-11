import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth/session";
import { getBudgetHeaderById } from "@/lib/data/budgets";
import { getBudgetTemplateCreationTraceability } from "@/lib/data/activity-events";
import { getFeatureAccessResponse } from "@/lib/billing/route-access";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAuthSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const accessResponse = await getFeatureAccessResponse(session.user.id, "templates.budget");
  if (accessResponse) return accessResponse;

  try {
    const { id: budgetId } = await params;
    const budget = await getBudgetHeaderById(budgetId, session.user.id);
    if (!budget) {
      return NextResponse.json({ error: "No tienes permisos para ver este presupuesto" }, { status: 404 });
    }

    const traceability = await getBudgetTemplateCreationTraceability({
      userId: session.user.id,
      budgetId,
    });

    return NextResponse.json({ traceability });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo cargar la trazabilidad de plantilla" },
      { status: 400 },
    );
  }
}
