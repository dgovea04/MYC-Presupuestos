import { revalidatePath, revalidateTag } from "next/cache";
import { NextResponse } from "next/server";

import { getAuthSession } from "@/lib/auth/session";
import { duplicateUserBudgetTemplate } from "@/lib/data/budget-templates";
import { recordActivityEvent } from "@/lib/data/activity-events";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAuthSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const template = await duplicateUserBudgetTemplate(id, session.user.id, parseDuplicateBudgetTemplateRequest(await request.json()));
    await safelyRecordTemplateDuplicateActivity(session.user.id, template);
    revalidatePath("/templates");
    revalidatePath("/dashboard");
    revalidateTag("dashboard-stats", "max");
    revalidatePath(`/templates/budget/${template.id}`);
    return NextResponse.json(template, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo duplicar la plantilla" }, { status: 400 });
  }
}

function parseDuplicateBudgetTemplateRequest(body: unknown) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return {};
  }

  const record = body as Record<string, unknown>;

  return {
    name: typeof record.name === "string" ? record.name : undefined,
    description: typeof record.description === "string" ? record.description : undefined,
  };
}

async function safelyRecordTemplateDuplicateActivity(
  userId: string,
  template: { id: string; name: string },
) {
  try {
    await recordActivityEvent({
      userId,
      type: "BUDGET_UPDATED",
      title: "Plantilla duplicada",
      detail: template.name,
      href: `/templates/budget/${template.id}`,
    });
  } catch {
    // Activity logging should not turn a successful template duplication into an API failure.
  }
}
