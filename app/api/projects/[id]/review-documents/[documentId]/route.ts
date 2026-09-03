import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { assertWorkspaceMembership } from "@/lib/workspace/access";
import { markStaleForChange } from "@/lib/review-intelligence/stale";

type RouteContext = { params: Promise<{ id: string; documentId: string }> };

export async function DELETE(_request: Request, { params }: RouteContext) {
  const session = await getAuthSession();
  if (!session?.user?.id) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const { id: projectId, documentId } = await params;
  const companyId = session.user.activeCompanyId ?? session.user.companyId;
  if (!companyId) return NextResponse.json({ error: "Workspace no disponible" }, { status: 403 });
  try {
    await assertWorkspaceMembership({ userId: session.user.id, companyId, minimumRole: "EDITOR" });
    const document = await prisma.projectDocument.findFirst({ where: { id: documentId, projectId, companyId }, select: { id: true } });
    if (!document) return NextResponse.json({ error: "Documento fuente no encontrado" }, { status: 404 });
    await markStaleForChange({ companyId, projectId, kind: "document-deletion", id: document.id, payload: document.id, actorUserId: session.user.id }, prisma);
    await prisma.$transaction(async (transaction) => {
      await transaction.projectDocument.updateMany({ where: { id: document.id, projectId, companyId }, data: { currentVersionId: null } });
      await transaction.projectDocument.delete({ where: { id: document.id } });
    });
    return NextResponse.json({ deletedDocumentId: document.id });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo eliminar el documento fuente." }, { status: 400 });
  }
}
