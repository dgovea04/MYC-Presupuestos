import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth/session";
import { resolveBudgetOwnership } from "@/lib/collaboration/authorization";
import { stageIntegrationSession, transitionIntegrationSession } from "@/lib/integrations/sessions";
import { prisma } from "@/lib/db/prisma";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string; sessionId: string }> }) {
  const session = await getAuthSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { id, sessionId } = await params;
    const { companyId } = await resolveBudgetOwnership(id, session.user.id);
    const budget = await prisma.budget.findUnique({ where: { id }, select: { updatedAt: true } });
    if (!budget) return NextResponse.json({ error: "Presupuesto no encontrado" }, { status: 404 });
    await prisma.integrationSession.updateMany({ where: { id: sessionId, companyId, budgetId: id }, data: { expectedVersion: Math.floor(budget.updatedAt.getTime() / 1000) } });
    const staged = await stageIntegrationSession({ sessionId, companyId });
    const current = await prisma.integrationSession.findFirst({ where: { id: sessionId, companyId, budgetId: id }, select: { status: true } });
    if (!current) return NextResponse.json({ error: "Sesión de integración no encontrada" }, { status: 404 });
    if (current.status === "DRAFT") await transitionIntegrationSession({ sessionId, companyId, to: "STAGED" });
    if (current.status === "DRAFT" || current.status === "STAGED") return NextResponse.json({ session: await transitionIntegrationSession({ sessionId, companyId, to: "VALIDATED" }), staged });
    return NextResponse.json({ session: await prisma.integrationSession.findFirst({ where: { id: sessionId, companyId, budgetId: id } }), staged });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo validar" }, { status: 400 }); }
}
