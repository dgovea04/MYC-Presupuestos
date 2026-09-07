import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth/session";
import { applyIntegrationSession } from "@/lib/integrations/apply";

export async function POST(request: Request, { params }: { params: Promise<{ id: string; sessionId: string }> }) {
  const session = await getAuthSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { sessionId } = await params;
    const body = await request.json() as { confirmationToken?: string; expectedVersion?: number; requestId?: string };
    if (!body.confirmationToken || body.expectedVersion === undefined) return NextResponse.json({ error: "Se requiere confirmación explícita y expectedVersion" }, { status: 400 });
    return NextResponse.json({ session: await applyIntegrationSession({ sessionId, userId: session.user.id, confirmationToken: body.confirmationToken, expectedVersion: body.expectedVersion, requestId: body.requestId ?? `${sessionId}:apply` }) });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo confirmar" }, { status: 409 }); }
}
