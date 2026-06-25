import { NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { getAuthSession } from "@/lib/auth/session";
import { recordActivityEvent } from "@/lib/data/activity-events";
import { getProjectHeaderById } from "@/lib/data/projects";
import { deleteProject, updateProject } from "@/lib/data/projects";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAuthSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { id } = await params;
    const project = await updateProject(id, session.user.id, body);
    await recordActivityEvent({
      userId: session.user.id,
      type: "PROJECT_UPDATED",
      title: "Proyecto actualizado",
      detail: project.name,
      href: `/projects/${project.id}`,
    });
    revalidateProjectPaths(id);
    return NextResponse.json(project);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo actualizar el proyecto" }, { status: 400 });
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAuthSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const project = await getProjectHeaderById(id, session.user.id);
    if (!project) {
      return NextResponse.json({ error: "No tienes permisos para eliminar este proyecto" }, { status: 400 });
    }

    await deleteProject(id, session.user.id);
    revalidateProjectPaths(project.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo eliminar el proyecto" }, { status: 400 });
  }
}

function revalidateProjectPaths(projectId: string) {
  revalidatePath("/dashboard");
  revalidateTag("dashboard-stats", "max");
  revalidateTag("dashboard-analytics");
  revalidateTag("projects-list");
  revalidatePath("/projects");
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/budgets");
}
