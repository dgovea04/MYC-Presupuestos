import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth/session";
import { restoreWorkspace } from "@/lib/workspace/company-settings";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAuthSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const { id: companyId } = await params;

  try {
    const workspace = await restoreWorkspace({ companyId, actorUserId: session.user.id });
    return NextResponse.json({ ok: true, workspace });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo restaurar el workspace" },
      { status: 403 },
    );
  }
}
