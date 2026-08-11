import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth/session";
import { heartbeatEditSession, finishEditSession } from "@/lib/collaboration/edit-sessions";
import { getWorkspaceFeatureAccessStatus } from "@/lib/workspace/entitlements";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string; sessionId: string }> }) {
  const session = await getAuthSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id: budgetId, sessionId } = await params;
    const editSession = await heartbeatEditSession(sessionId, budgetId, session.user.id);
    return NextResponse.json({ editSession });
  } catch (error) {
    console.error("PATCH edit session failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo actualizar la sesion" },
      { status: getWorkspaceFeatureAccessStatus(error) },
    );
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string; sessionId: string }> }) {
  const session = await getAuthSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id: budgetId, sessionId } = await params;
    await finishEditSession(sessionId, budgetId, session.user.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE edit session failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo finalizar la sesion" },
      { status: getWorkspaceFeatureAccessStatus(error) },
    );
  }
}
