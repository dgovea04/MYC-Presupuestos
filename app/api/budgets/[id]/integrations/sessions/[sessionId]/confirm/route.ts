import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth/session";
import { applyIntegrationSession } from "@/lib/integrations/apply";
import { resolveBudgetOwnership } from "@/lib/collaboration/authorization";
import { transitionIntegrationSession } from "@/lib/integrations/sessions";
import { prisma } from "@/lib/db/prisma";

export async function POST(request: Request, { params }: { params: Promise<{ id: string; sessionId: string }> }) {
  const session = await getAuthSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { id, sessionId } = await params;
    const body = await request.json() as { confirmationToken?: string; expectedVersion?: number; requestId?: string };
    if (!body.confirmationToken || body.expectedVersion === undefined) return NextResponse.json({ error: "Se requiere confirmación explícita y expectedVersion" }, { status: 400 });
    const { companyId } = await resolveBudgetOwnership(id, session.user.id);
    const current = await prisma.integrationSession.findFirst({ where: { id: sessionId, companyId, budgetId: id }, select: { status: true } });
    if (!current) return NextResponse.json({ error: "Sesión de integración no encontrada" }, { status: 404 });
    if (current.status === "PREVIEW_READY") await transitionIntegrationSession({ sessionId, companyId, to: "CONFIRMED" });
    else if (current.status !== "CONFIRMED" && current.status !== "APPLIED") return NextResponse.json({ error: `La sesión no está lista para confirmar: ${current.status}` }, { status: 409 });
    return NextResponse.json({ session: await applyIntegrationSession({ sessionId, userId: session.user.id, confirmationToken: body.confirmationToken, expectedVersion: body.expectedVersion, requestId: body.requestId ?? `${sessionId}:apply` }) });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo confirmar" }, { status: 409 }); }
}
