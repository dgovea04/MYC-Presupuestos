import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth/session";
import { startEditSession } from "@/lib/collaboration/edit-sessions";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAuthSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id: budgetId } = await params;
    const body = await request.json();
    const editSession = await startEditSession(budgetId, session.user.id, body);
    return NextResponse.json({ editSession }, { status: 201 });
  } catch (error) {
    console.error("POST edit session failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo iniciar la sesion de edicion" },
      { status: 400 },
    );
  }
}
