import { revalidatePath, revalidateTag } from "next/cache";
import { NextResponse } from "next/server";

import { getAuthSession } from "@/lib/auth/session";
import {
  createUserBudgetTemplateFromBudget,
  listUserBudgetTemplates,
} from "@/lib/data/budget-templates";
import { recordActivityEvent } from "@/lib/data/activity-events";
import { getFeatureAccessResponse } from "@/lib/billing/route-access";

export async function GET() {
  const session = await getAuthSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const accessResponse = await getFeatureAccessResponse(session.user.id, "templates.budget");
  if (accessResponse) return accessResponse;

  const templates = await listUserBudgetTemplates(session.user.id);
  return NextResponse.json(templates);
}

export async function POST(request: Request) {
  const session = await getAuthSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const accessResponse = await getFeatureAccessResponse(session.user.id, "templates.budget");
  if (accessResponse) return accessResponse;

  try {
    const input = parseCreateBudgetTemplateRequest(await request.json());
    const template = await createUserBudgetTemplateFromBudget(session.user.id, input);
    await safelyRecordTemplateCreatedActivity(session.user.id, template);
    revalidatePath("/templates");
    revalidatePath("/dashboard");
    revalidateTag("dashboard-stats", "max");
    return NextResponse.json(template, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo crear la plantilla" }, { status: 400 });
  }
}

function parseCreateBudgetTemplateRequest(body: unknown) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new Error("Solicitud invalida");
  }

  const record = body as Record<string, unknown>;
  if (typeof record.budgetId !== "string" || record.budgetId.trim().length === 0) {
    throw new Error("budgetId es obligatorio");
  }

  return {
    budgetId: record.budgetId.trim(),
    name: typeof record.name === "string" ? record.name : undefined,
    description: typeof record.description === "string" ? record.description : undefined,
  };
}

async function safelyRecordTemplateCreatedActivity(
  userId: string,
  template: { id: string; name: string },
) {
  try {
    await recordActivityEvent({
      userId,
      type: "BUDGET_CREATED",
      title: "Plantilla creada",
      detail: template.name,
      href: `/templates/budget/${template.id}`,
    });
  } catch {
    // Activity logging should not turn a successful template creation into an API failure.
  }
}
