import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth/session";
import { getBudgetById } from "@/lib/data/budgets";
import { getCatalogPartidas } from "@/lib/data/partidas";
import { getProjectBudgetOverviewById } from "@/lib/data/projects";
import { getResourcesByUser } from "@/lib/data/resources";
import { decimalToNumber } from "@/lib/db/serializers";
import { measureAsync } from "@/lib/platform/performance";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAuthSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id: budgetId } = await params;
    const budget = await getBudgetById(budgetId, session.user.id);
    if (!budget) {
      return NextResponse.json({ error: "No tienes permisos para ver este presupuesto" }, { status: 404 });
    }

    const project = await getProjectBudgetOverviewById(budget.projectId, session.user.id);
    if (!project) {
      return NextResponse.json({ error: "No tienes permisos para ver este proyecto" }, { status: 404 });
    }

    const [resources, partidasCatalog] = await measureAsync(
      "api.budgetEditorCatalogs.load",
      () => Promise.all([getResourcesByUser(session.user.id, project.companyId), getCatalogPartidas()]),
      { budgetId },
    );

    return NextResponse.json({
      partidasCatalog,
      resourcesCatalog: resources.map((resource) => ({
        id: resource.id,
        companyId: resource.companyId ?? undefined,
        code: resource.code,
        description: resource.description,
        category: resource.category,
        iu: resource.iu ?? undefined,
        iuCurrent: resource.iuCurrent ?? undefined,
        iuCurrentReviewStatus: resource.iuCurrentReviewStatus ?? undefined,
        subcategory: resource.subcategory ?? undefined,
        unit: resource.unit,
        unitPrice: decimalToNumber(resource.unitPrice),
        currency: resource.currency,
        source: resource.source ?? undefined,
        createdAt: resource.createdAt,
        updatedAt: resource.updatedAt,
      })),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudieron cargar los catalogos del editor" },
      { status: 400 },
    );
  }
}
