import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth/session";
import { resolveComment, reopenComment } from "@/lib/collaboration/comments";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string; commentId: string }> }) {
  const session = await getAuthSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id: budgetId, commentId } = await params;
    const body = await request.json();

    if (body.resolved === true) {
      const comment = await resolveComment(commentId, budgetId, session.user.id);
      return NextResponse.json({ comment });
    }

    if (body.resolved === false) {
      const comment = await reopenComment(commentId, budgetId, session.user.id);
      return NextResponse.json({ comment });
    }

    return NextResponse.json({ error: "Solo se permite resolver o reabrir comentarios" }, { status: 400 });
  } catch (error) {
    console.error("PATCH comment failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo actualizar el comentario" },
      { status: 400 },
    );
  }
}
