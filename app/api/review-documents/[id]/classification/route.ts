import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { assertWorkspaceMembership } from "@/lib/workspace/access";
import { markStaleForChange } from "@/lib/review-intelligence/stale";

const bodySchema = z.object({ category: z.enum(["PLAN", "TECHNICAL_SPECIFICATION", "QUANTITY_TAKEOFF", "BUDGET", "APU", "OTHER"]) }).strict();

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAuthSession();
  if (!session?.user?.id) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  try {
    const { id } = await params;
    const companyId = session.user.activeCompanyId ?? session.user.companyId;
    if (!companyId) return NextResponse.json({ error: "Workspace no disponible" }, { status: 403 });
    await assertWorkspaceMembership({ userId: session.user.id, companyId, minimumRole: "EDITOR" });
    const document = await prisma.projectDocument.findFirst({ where: { id }, select: { id: true, companyId: true, projectId: true } });
    if (!document) return NextResponse.json({ error: "Documento no encontrado" }, { status: 404 });
    if (document.companyId !== companyId) return NextResponse.json({ error: "No tienes acceso a este documento" }, { status: 403 });
    const project = await prisma.project.findFirst({ where: { id: document.projectId }, select: { id: true, companyId: true } });
    if (!project || project.companyId !== companyId) return NextResponse.json({ error: "El proyecto no pertenece a este workspace" }, { status: 403 });
    const parsed = bodySchema.parse(await request.json());
    const updated = await prisma.projectDocument.update({ where: { id_companyId_projectId: { id: document.id, companyId, projectId: document.projectId } }, data: { category: parsed.category }, select: { id: true, category: true, updatedAt: true } });
    await markStaleForChange({ companyId, projectId: document.projectId, kind: "document-classification", id: document.id, payload: parsed.category }, prisma);
    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Clasificación inválida" }, { status: 400 });
    if (error instanceof Error && /workspace|no tienes acceso|rol necesario/i.test(error.message)) return NextResponse.json({ error: error.message }, { status: 403 });
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo clasificar el documento" }, { status: 400 });
  }
}
