import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth/session";
import { listCommentsForEntity, createComment } from "@/lib/collaboration/comments";
import { getWorkspaceFeatureAccessStatus } from "@/lib/workspace/entitlements";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAuthSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id: budgetId } = await params;
    const { searchParams } = new URL(request.url);
    const rawQuery: Record<string, unknown> = {};

    const entityType = searchParams.get("entityType");
    if (entityType) rawQuery.entityType = entityType;

    const entityId = searchParams.get("entityId");
    if (entityId) rawQuery.entityId = entityId;

    const cursor = searchParams.get("cursor");
    if (cursor) rawQuery.cursor = cursor;

    const limit = searchParams.get("limit");
    if (limit) rawQuery.limit = Number(limit);

    const comments = await listCommentsForEntity(budgetId, session.user.id, rawQuery);
    return NextResponse.json({ comments });
  } catch (error) {
    console.error("GET comments failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo cargar los comentarios" },
      { status: getWorkspaceFeatureAccessStatus(error) },
    );
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAuthSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id: budgetId } = await params;
    const body = await request.json();
    const comment = await createComment(budgetId, session.user.id, body);
    return NextResponse.json({ comment }, { status: 201 });
  } catch (error) {
    console.error("POST comment failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo crear el comentario" },
      { status: getWorkspaceFeatureAccessStatus(error) },
    );
  }
}
