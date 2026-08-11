import { revalidatePath, revalidateTag } from "next/cache";
import { NextResponse } from "next/server";

import { getAuthSession } from "@/lib/auth/session";
import { recordActivityEvent } from "@/lib/data/activity-events";
import { applyUserBudgetTemplateToProject } from "@/lib/data/budget-templates";
import { getFeatureAccessResponse } from "@/lib/billing/route-access";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAuthSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const accessResponse = await getFeatureAccessResponse(session.user.id, "templates.budget");
  if (accessResponse) return accessResponse;

  const { id } = await params;

  try {
    const input = parseApplyBudgetTemplateRequest(await request.json());
    const budget = await applyUserBudgetTemplateToProject(id, session.user.id, input);
    await safelyRecordTemplateActivity(session.user.id, budget);
    revalidatePath("/budgets");
    revalidatePath(`/budgets/${budget.id}`);
    revalidatePath(`/projects/${input.projectId}`);
    revalidatePath("/dashboard");
    revalidateTag("dashboard-stats", "max");
    return NextResponse.json(budget, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo aplicar la plantilla" }, { status: 400 });
  }
}

function parseApplyBudgetTemplateRequest(body: unknown) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new Error("Solicitud invalida");
  }

  const record = body as Record<string, unknown>;
  if (typeof record.projectId !== "string" || record.projectId.trim().length === 0) {
    throw new Error("projectId es obligatorio");
  }

  return {
    projectId: record.projectId.trim(),
    name: typeof record.name === "string" ? record.name : undefined,
  };
}

async function safelyRecordTemplateActivity(
  userId: string,
  budget: { id: string; name: string; templateName: string },
) {
  try {
    await recordActivityEvent({
      userId,
      type: "BUDGET_CREATED",
      title: "Presupuesto creado desde plantilla",
      detail: `${budget.name} desde ${budget.templateName}`,
      href: `/budgets/${budget.id}`,
    });
  } catch {
    // Activity logging should not turn a successful template application into an API failure.
  }
}
