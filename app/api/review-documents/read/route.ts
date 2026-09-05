import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { getReviewDocumentStorage, verifyReviewDocumentReadToken } from "@/lib/review-intelligence/documents";
import { assertWorkspaceMembership } from "@/lib/workspace/access";

export async function GET(request: Request) {
  const session = await getAuthSession();
  if (!session?.user?.id) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const token = new URL(request.url).searchParams.get("token");
  if (!token) return NextResponse.json({ error: "Token temporal requerido" }, { status: 401 });
  try {
    const provenance = verifyReviewDocumentReadToken(token);
    const companyId = session.user.activeCompanyId ?? session.user.companyId;
    if (companyId !== provenance.companyId) return NextResponse.json({ error: "No tienes acceso a este documento" }, { status: 403 });
    await assertWorkspaceMembership({ userId: session.user.id, companyId, minimumRole: "VIEWER" });
    const project = await prisma.project.findFirst({ where: { id: provenance.projectId, companyId }, select: { id: true } });
    if (!project) return NextResponse.json({ error: "Documento no encontrado" }, { status: 404 });
    const version = await prisma.documentVersion.findFirst({ where: { companyId, projectId: provenance.projectId, storageKey: provenance.storageKey }, select: { id: true, originalFileName: true, mimeType: true } });
    if (!version) return NextResponse.json({ error: "Documento no encontrado" }, { status: 404 });
    const bytes = await getReviewDocumentStorage().read({ companyId, projectId: provenance.projectId, storageKey: provenance.storageKey });
    const body = new Uint8Array(bytes).buffer;
    return new Response(body, { headers: { "Content-Type": version.mimeType, "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(version.originalFileName)}`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo leer el documento";
    return NextResponse.json({ error: message }, { status: /token|expired|signature|payload|expiry/i.test(message) ? 401 : /workspace|acceso|rol/i.test(message) ? 403 : 404 });
  }
}
