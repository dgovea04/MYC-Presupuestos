import { revalidatePath, revalidateTag } from "next/cache";
import { NextResponse } from "next/server";

import { getAuthSession } from "@/lib/auth/session";
import { deleteUserBudgetTemplate, updateUserBudgetTemplate } from "@/lib/data/budget-templates";
import { recordActivityEvent } from "@/lib/data/activity-events";
import { getFeatureAccessResponse } from "@/lib/billing/route-access";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAuthSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const accessResponse = await getFeatureAccessResponse(session.user.id, "templates.budget");
  if (accessResponse) return accessResponse;

  const { id } = await params;

  try {
    const input = parseUpdateBudgetTemplateRequest(await request.json());
    const template = await updateUserBudgetTemplate(id, session.user.id, input);
    await safelyRecordTemplateUpdatedActivity(session.user.id, template);
    revalidatePath("/templates");
    revalidatePath("/dashboard");
    revalidateTag("dashboard-stats", "max");
    revalidatePath(`/templates/budget/${id}`);
    return NextResponse.json(template);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo actualizar la plantilla" }, { status: 400 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAuthSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const accessResponse = await getFeatureAccessResponse(session.user.id, "templates.budget");
  if (accessResponse) return accessResponse;

  const { id } = await params;

  try {
    const template = await deleteUserBudgetTemplate(id, session.user.id);
    await safelyRecordTemplateDeletedActivity(session.user.id, template);
    revalidatePath("/templates");
    revalidatePath("/dashboard");
    revalidateTag("dashboard-stats", "max");
    revalidatePath(`/templates/budget/${id}`);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo eliminar la plantilla" }, { status: 400 });
  }
}

function parseUpdateBudgetTemplateRequest(body: unknown) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new Error("Solicitud invalida");
  }

  const record = body as Record<string, unknown>;
  if (typeof record.name !== "string" || record.name.trim().length === 0) {
    throw new Error("El nombre de la plantilla es obligatorio");
  }

  return {
    name: record.name.trim(),
    description: typeof record.description === "string" ? record.description : undefined,
  };
}

async function safelyRecordTemplateUpdatedActivity(
  userId: string,
  template: { id: string; name: string },
) {
  try {
    await recordActivityEvent({
      userId,
      type: "BUDGET_UPDATED",
      title: "Plantilla actualizada",
      detail: template.name,
      href: `/templates/budget/${template.id}`,
    });
  } catch {
    // Activity logging should not turn a successful template update into an API failure.
  }
}

async function safelyRecordTemplateDeletedActivity(
  userId: string,
  template: { name: string },
) {
  try {
    await recordActivityEvent({
      userId,
      type: "BUDGET_UPDATED",
      title: "Plantilla eliminada",
      detail: template.name,
      href: "/templates",
    });
  } catch {
    // Activity logging should not turn a successful template deletion into an API failure.
  }
}
