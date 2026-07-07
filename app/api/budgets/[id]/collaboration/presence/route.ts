import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth/session";
import { upsertPresenceHeartbeat, removePresence, listActivePresence } from "@/lib/collaboration/presence";
import { presenceUpsertSchema } from "@/lib/validations/collaboration";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAuthSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id: budgetId } = await params;
    const presence = await listActivePresence(budgetId, session.user.id);
    return NextResponse.json({ presence });
  } catch (error) {
    console.error("GET presence failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo cargar la presencia" },
      { status: 400 },
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
    const body = presenceUpsertSchema.parse(await request.json());
    const presence = await upsertPresenceHeartbeat(
      budgetId,
      session.user.id,
      body.route,
      body.module,
      body.status,
    );
    return NextResponse.json({ presence });
  } catch (error) {
    console.error("POST presence failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo actualizar la presencia" },
      { status: 400 },
    );
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAuthSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id: budgetId } = await params;
    await removePresence(budgetId, session.user.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE presence failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo eliminar la presencia" },
      { status: 400 },
    );
  }
}
