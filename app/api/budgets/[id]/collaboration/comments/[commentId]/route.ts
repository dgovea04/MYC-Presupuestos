import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth/session";
import { resolveComment, reopenComment } from "@/lib/collaboration/comments";
import { getWorkspaceFeatureAccessStatus } from "@/lib/workspace/entitlements";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string; commentId: string }> }) {
  const session = await getAuthSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id: budgetId, commentId } = await params;
    const body = await request.json();
    const expectedUpdatedAt = typeof body.expectedUpdatedAt === "string" ? new Date(body.expectedUpdatedAt) : undefined;

    if (body.resolved === true) {
      const comment = await resolveComment(commentId, budgetId, session.user.id, expectedUpdatedAt);
      return NextResponse.json({ comment });
    }

    if (body.resolved === false) {
      const comment = await reopenComment(commentId, budgetId, session.user.id, expectedUpdatedAt);
      return NextResponse.json({ comment });
    }

    return NextResponse.json({ error: "Solo se permite resolver o reabrir comentarios" }, { status: 400 });
  } catch (error) {
    console.error("PATCH comment failed", error);
    const message = error instanceof Error ? error.message : "No se pudo actualizar el comentario";
    return NextResponse.json({ error: message }, { status: message.includes("cambi") ? 409 : getWorkspaceFeatureAccessStatus(error) });
  }
}
