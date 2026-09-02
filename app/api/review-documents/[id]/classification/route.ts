import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { assertWorkspaceMembership } from "@/lib/workspace/access";

const bodySchema = z.object({ category: z.enum(["PLAN", "TECHNICAL_SPECIFICATION", "QUANTITY_TAKEOFF", "BUDGET", "APU", "OTHER"]) }).strict();

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAuthSession();
  if (!session?.user?.id) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  try {
    const { id } = await params;
    const document = await prisma.projectDocument.findFirst({ where: { id }, select: { id: true, companyId: true, projectId: true } });
    if (!document) return NextResponse.json({ error: "Documento no encontrado" }, { status: 404 });
    await assertWorkspaceMembership({ userId: session.user.id, companyId: document.companyId, minimumRole: "EDITOR" });
    const parsed = bodySchema.parse(await request.json());
    const updated = await prisma.projectDocument.update({ where: { id: document.id }, data: { category: parsed.category }, select: { id: true, category: true, updatedAt: true } });
    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Clasificación inválida" }, { status: 400 });
    if (error instanceof Error && error.message.includes("Workspace")) return NextResponse.json({ error: error.message }, { status: 403 });
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo clasificar el documento" }, { status: 400 });
  }
}
