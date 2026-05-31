import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getAuthSession } from "@/lib/auth/session";
import { createBillingErrorResponse } from "@/lib/billing/api";
import { recordActivityEvent } from "@/lib/data/activity-events";
import { createProject } from "@/lib/data/projects";
import { getTemplateLibraryItem } from "@/lib/templates/template-library";

export async function POST(request: Request) {
  const session = await getAuthSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const project = await createProject(session.user.id, body);
    await safelyRecordProjectCreatedActivity(project.id, project.name, session.user.id, getRequestTemplateId(body));
    revalidatePath("/dashboard");
    revalidatePath("/projects");
    revalidatePath(`/projects/${project.id}`);
    revalidatePath("/budgets");
    return NextResponse.json(project, { status: 201 });
  } catch (error) {
    const billingResponse = createBillingErrorResponse(error);
    if (billingResponse) return billingResponse;

    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo crear el proyecto" }, { status: 400 });
  }
}

function getRequestTemplateId(body: unknown) {
  if (!body || typeof body !== "object" || !("templateId" in body)) {
    return null;
  }

  const templateId = (body as { templateId?: unknown }).templateId;
  return typeof templateId === "string" && templateId.length > 0 ? templateId : null;
}

async function safelyRecordProjectCreatedActivity(
  projectId: string,
  projectName: string,
  userId: string,
  templateId: string | null,
) {
  const template = templateId ? getTemplateLibraryItem(templateId) : null;

  try {
    await recordActivityEvent({
      userId,
      type: "PROJECT_CREATED",
      title: template?.module === "BUDGET" ? "Proyecto creado desde plantilla" : "Proyecto creado",
      detail: template?.module === "BUDGET" ? `${projectName} | ${template.name}` : projectName,
      href: `/projects/${projectId}`,
    });
  } catch {
    // Activity logging should not turn a successful project creation into an API failure.
  }
}
