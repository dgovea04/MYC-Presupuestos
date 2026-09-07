import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth/session";
import { resolveBudgetOwnership } from "@/lib/collaboration/authorization";
import { prisma } from "@/lib/db/prisma";
import { transitionIntegrationSession } from "@/lib/integrations/sessions";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string; sessionId: string }> }) {
  const session = await getAuthSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { id, sessionId } = await params;
    const { companyId } = await resolveBudgetOwnership(id, session.user.id);
    const current = await prisma.integrationSession.findFirst({ where: { id: sessionId, budgetId: id, companyId }, select: { status: true } });
    if (current?.status === "VALIDATED") await transitionIntegrationSession({ sessionId, companyId, to: "PREVIEW_READY" });
    const result = await prisma.integrationSession.findFirst({ where: { id: sessionId, budgetId: id, companyId }, select: { id: true, status: true, counts: true, preview: true, confirmationToken: true, expectedVersion: true, conflicts: { where: { resolved: false }, select: { id: true, externalKey: true, kind: true, message: true } } } });
    if (!result) return NextResponse.json({ error: "Sesión no encontrada" }, { status: 404 });
    return NextResponse.json({ ...result, guardrail: "La preview no modifica el presupuesto." });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo cargar la preview" }, { status: 403 }); }
}
