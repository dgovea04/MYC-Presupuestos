import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth/session";
import { listBudgetChangeEvents } from "@/lib/collaboration/audit";
import { changeEventQuerySchema } from "@/lib/validations/collaboration";
import type { CollaborationEntityType, CollaborationChangeSource } from "@/types/collaboration";
import { getWorkspaceFeatureAccessStatus } from "@/lib/workspace/entitlements";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAuthSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id: budgetId } = await params;
    const { searchParams } = new URL(request.url);

    const rawFilters: Record<string, unknown> = {};

    const entityType = searchParams.get("entityType");
    if (entityType) rawFilters.entityType = entityType;

    const entityId = searchParams.get("entityId");
    if (entityId) rawFilters.entityId = entityId;

    const source = searchParams.get("source");
    if (source) rawFilters.source = source;

    const limit = searchParams.get("limit");
    if (limit) rawFilters.limit = Number(limit);

    const cursor = searchParams.get("cursor");
    if (cursor) rawFilters.cursor = cursor;

    const parsed = changeEventQuerySchema.parse(rawFilters);

    const events = await listBudgetChangeEvents(budgetId, session.user.id, {
      entityType: parsed.entityType as CollaborationEntityType | undefined,
      entityId: parsed.entityId,
      source: parsed.source as CollaborationChangeSource | undefined,
      cursor: parsed.cursor,
      limit: parsed.limit,
    });

    return NextResponse.json({ events });
  } catch (error) {
    console.error("GET history failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo cargar el historial" },
      { status: getWorkspaceFeatureAccessStatus(error) },
    );
  }
}
