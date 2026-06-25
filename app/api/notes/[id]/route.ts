import { revalidatePath, revalidateTag } from "next/cache";
import { NextResponse } from "next/server";

import { getAuthSession } from "@/lib/auth/session";
import { deleteNoteTask, updateNoteTask } from "@/lib/data/notes";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAuthSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const note = await updateNoteTask(id, session.user.id, body);
    revalidateNotePaths(note.sourcePath);
    return NextResponse.json({ note });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo guardar la nota" }, { status: 400 });
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAuthSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    await deleteNoteTask(id, session.user.id);
    revalidateNotePaths();
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo eliminar la nota" }, { status: 400 });
  }
}

function revalidateNotePaths(sourcePath?: string) {
  revalidatePath("/dashboard");
  revalidateTag("dashboard-stats", "max");
  if (sourcePath) {
    revalidatePath(sourcePath);
  }
}
