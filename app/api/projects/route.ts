import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getAuthSession } from "@/lib/auth/session";
import { recordActivityEvent } from "@/lib/data/activity-events";
import { createProject } from "@/lib/data/projects";

export async function POST(request: Request) {
  const session = await getAuthSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const project = await createProject(session.user.id, body);
    await recordActivityEvent({
      userId: session.user.id,
      type: "PROJECT_CREATED",
      title: "Proyecto creado",
      detail: project.name,
      href: `/projects/${project.id}`,
    });
    revalidatePath("/dashboard");
    revalidatePath("/projects");
    revalidatePath(`/projects/${project.id}`);
    revalidatePath("/budgets");
    return NextResponse.json(project, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo crear el proyecto" }, { status: 400 });
  }
}
