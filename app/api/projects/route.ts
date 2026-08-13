import { NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { ZodError } from "zod";
import { getAuthSession } from "@/lib/auth/session";
import { trackServerEvent } from "@/lib/analytics/events";
import { createBillingErrorResponse } from "@/lib/billing/api";
import { recordActivityEvent } from "@/lib/data/activity-events";
import { createProject } from "@/lib/data/projects";
import { prisma } from "@/lib/db/prisma";
import { DASHBOARD_ANALYTICS_CACHE_TAG, getDashboardAnalyticsCacheTag } from "@/lib/dashboard/analytics";
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
    await trackFirstNonDemoProjectCreated(project.id, project.companyId, project.isDemo, session.user.id);
    revalidatePath("/dashboard");
    revalidateTag("dashboard-stats", "max");
    revalidateTag(DASHBOARD_ANALYTICS_CACHE_TAG, "max");
    revalidateTag(getDashboardAnalyticsCacheTag(project.companyId), "max");
    revalidateTag("projects-list", "max");
    revalidatePath("/projects");
    revalidatePath(`/projects/${project.id}`);
    revalidatePath("/budgets");
    return NextResponse.json(project, { status: 201 });
  } catch (error) {
    const billingResponse = createBillingErrorResponse(error);
    if (billingResponse) return billingResponse;

    if (error instanceof ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? "Datos de proyecto no validos" }, { status: 400 });
    }

    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo crear el proyecto" }, { status: 400 });
  }
}

async function trackFirstNonDemoProjectCreated(projectId: string, companyId: string, isDemo: boolean, userId: string) {
  if (isDemo) {
    return;
  }

  const [demoProject, nonDemoProjectCount] = await Promise.all([
    prisma.project.findFirst({
      where: { companyId, isDemo: true },
      select: { id: true },
    }),
    prisma.project.count({ where: { companyId, isDemo: false } }),
  ]);

  if (!demoProject || nonDemoProjectCount !== 1) {
    return;
  }

  await trackServerEvent("first_non_demo_project_created", {
    userId,
    companyId,
    projectId,
  });
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
