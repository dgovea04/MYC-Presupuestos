import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { assertWorkspaceMembership } from "@/lib/workspace/access";
import { assignFinding, type AssignmentClient } from "@/lib/review-intelligence/assignments";

const bodySchema = z.object({ assigneeId: z.string().min(1).nullable(), expectedUpdatedAt: z.coerce.date() }).strict();

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAuthSession();
  if (!session?.user?.id) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const companyId = session.user.activeCompanyId ?? session.user.companyId;
  if (!companyId) return NextResponse.json({ error: "Workspace no disponible" }, { status: 403 });
  try {
    await assertWorkspaceMembership({ userId: session.user.id, companyId, minimumRole: "EDITOR" });
    const body = bodySchema.parse(await request.json());
    const finding = await prisma.reviewFinding.findFirst({ where: { id: (await params).id, companyId }, select: { id: true, projectId: true } });
    if (!finding) return NextResponse.json({ error: "Hallazgo no encontrado" }, { status: 404 });
    return NextResponse.json(await assignFinding({ findingId: finding.id, assigneeId: body.assigneeId, actorUserId: session.user.id, companyId, projectId: finding.projectId, expectedUpdatedAt: body.expectedUpdatedAt }, prisma as unknown as AssignmentClient));
  } catch (error) {
    const message = error instanceof z.ZodError ? "Payload de asignación inválido" : error instanceof Error ? error.message : "No se pudo asignar el hallazgo";
    return NextResponse.json({ error: message }, { status: error instanceof z.ZodError ? 400 : /member|changed|Finding not found/i.test(message) ? 409 : 403 });
  }
}
