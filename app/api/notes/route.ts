import { revalidatePath, revalidateTag } from "next/cache";
import { NextResponse } from "next/server";

import { getAuthSession } from "@/lib/auth/session";
import { createNoteTask, listNoteTasks } from "@/lib/data/notes";
import { noteTaskStatusSchema } from "@/lib/validations/notes";

export async function GET(request: Request) {
  const session = await getAuthSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const searchParams = new URL(request.url).searchParams;
  const statusValue = searchParams.get("status");
  const status = statusValue && noteTaskStatusSchema.safeParse(statusValue).success ? noteTaskStatusSchema.parse(statusValue) : undefined;
  const notes = await listNoteTasks(session.user.id, {
    status,
    projectId: searchParams.get("projectId") ?? undefined,
    budgetId: searchParams.get("budgetId") ?? undefined,
    budgetItemId: searchParams.get("budgetItemId") ?? undefined,
    sourcePath: searchParams.get("sourcePath") ?? undefined,
  });

  return NextResponse.json({ notes });
}

export async function POST(request: Request) {
  const session = await getAuthSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const note = await createNoteTask(session.user.id, body);
    revalidateNotePaths(note.sourcePath);
    return NextResponse.json({ note });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo crear la nota" }, { status: 400 });
  }
}

function revalidateNotePaths(sourcePath?: string) {
  revalidatePath("/dashboard");
  revalidateTag("dashboard-stats", "max");
  if (sourcePath) {
    revalidatePath(sourcePath);
  }
}
