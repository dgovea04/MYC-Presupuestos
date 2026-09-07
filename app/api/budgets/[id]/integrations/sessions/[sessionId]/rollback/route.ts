import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth/session";
import { rollbackIntegrationSession } from "@/lib/integrations/rollback";

export async function POST(request: Request, { params }: { params: Promise<{ id: string; sessionId: string }> }) {
  const session = await getAuthSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { id: budgetId, sessionId } = await params;
    const body = await request.json().catch(() => ({})) as { requestId?: string };
    return NextResponse.json({ session: await rollbackIntegrationSession({ sessionId, budgetId, userId: session.user.id, requestId: body.requestId ?? `${sessionId}:rollback` }) });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo revertir" }, { status: 409 }); }
}
