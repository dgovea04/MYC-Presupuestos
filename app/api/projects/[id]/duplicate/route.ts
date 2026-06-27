import { revalidatePath, revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth/session";
import { recordActivityEvent } from "@/lib/data/activity-events";
import { duplicateProject, PROJECT_OVERVIEW_CACHE_TAG, PROJECTS_LIST_CACHE_TAG, USER_COMPANIES_CACHE_TAG } from "@/lib/data/projects";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAuthSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const project = await duplicateProject(id, session.user.id);

    await safelyRecordDuplicateActivity(project.id, project.name, session.user.id);

    revalidateProjectPaths(project.id);

    return NextResponse.json(project, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo duplicar el proyecto" },
      { status: 400 },
    );
  }
}

function revalidateProjectPaths(projectId: string) {
  revalidatePath("/dashboard");
  revalidateTag("dashboard-stats", "max");
  revalidateTag("dashboard-analytics");
  revalidateTag(PROJECTS_LIST_CACHE_TAG);
  revalidateTag(PROJECT_OVERVIEW_CACHE_TAG);
  revalidateTag(USER_COMPANIES_CACHE_TAG);
  revalidatePath("/projects");
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/budgets");
}

async function safelyRecordDuplicateActivity(projectId: string, projectName: string, userId: string) {
  try {
    await recordActivityEvent({
      userId,
      type: "PROJECT_CREATED",
      title: "Proyecto duplicado",
      detail: projectName,
      href: `/projects/${projectId}`,
    });
  } catch {
    // Activity logging should not turn a successful duplication into an API failure.
  }
}
