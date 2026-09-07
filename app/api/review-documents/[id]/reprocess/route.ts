import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { assertWorkspaceMembership } from "@/lib/workspace/access";
import { getReviewDocumentStorage } from "@/lib/review-intelligence/documents";
import { reprocessDocumentCoverage } from "@/lib/review-intelligence/extraction-persistence";
import { markStaleForChange } from "@/lib/review-intelligence/stale";
import { getPdfImportAiConfiguration } from "@/lib/pdf-import/provider";
import { createPdfImportOcrProvider } from "@/lib/pdf-import/ocr";
import { createPdfImportOcrAdapter } from "@/lib/review-intelligence/ocr";

const bodySchema = z.object({
  pages: z.array(z.coerce.number().int().min(1)).max(300).optional(),
  worksheets: z.array(z.string().trim().min(1).max(200)).max(100).optional(),
}).strict().refine((body) => (body.pages?.length ?? 0) > 0 || (body.worksheets?.length ?? 0) > 0, {
  message: "Selecciona al menos una página u hoja para reprocesar.",
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAuthSession();
  if (!session?.user?.id) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const companyId = session.user.activeCompanyId ?? session.user.companyId;
  if (!companyId) return NextResponse.json({ error: "Workspace no disponible" }, { status: 403 });
  const documentId = (await params).id;

  try {
    await assertWorkspaceMembership({ userId: session.user.id, companyId, minimumRole: "EDITOR" });
    const body = bodySchema.parse(await request.json());
    const document = await prisma.projectDocument.findFirst({
      where: { id: documentId, companyId },
      select: { id: true, projectId: true, currentVersion: { select: { id: true, storageKey: true, originalFileName: true, mimeType: true } } },
    });
    if (!document) return NextResponse.json({ error: "Documento no encontrado" }, { status: 404 });
    if (!document.currentVersion) return NextResponse.json({ error: "El documento no tiene una versión procesable" }, { status: 409 });

    const storage = getReviewDocumentStorage();
    const bytes = await storage.read({ companyId, projectId: document.projectId, storageKey: document.currentVersion.storageKey });
    const fileBuffer = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(fileBuffer).set(bytes);
    const file = new File([fileBuffer], document.currentVersion.originalFileName, { type: document.currentVersion.mimeType });
    const aiConfiguration = await getPdfImportAiConfiguration(session.user.id);
    const ocrProvider = aiConfiguration.apiKey ? createPdfImportOcrProvider(aiConfiguration) : undefined;
    const result = await reprocessDocumentCoverage({
      file,
      documentVersionId: document.currentVersion.id,
      companyId,
      projectId: document.projectId,
      pages: body.pages,
      worksheets: body.worksheets,
      ocrAdapter: createPdfImportOcrAdapter(ocrProvider),
    }, prisma as never);
    await markStaleForChange({ companyId, projectId: document.projectId, kind: "document-reprocessing", id: document.currentVersion.id, payload: { pages: body.pages ?? [], worksheets: body.worksheets ?? [] }, actorUserId: session.user.id }, prisma);
    return NextResponse.json({ documentVersionId: document.currentVersion.id, coverage: result.coverage, warnings: result.warnings });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.issues[0]?.message ?? "Selección inválida" }, { status: 400 });
    const message = error instanceof Error ? error.message : "No se pudo reprocesar la fuente.";
    if (/workspace|acceso|rol necesario/i.test(message)) return NextResponse.json({ error: message }, { status: 403 });
    if (/not found|no encontrado|outside|fuera de|no tiene una versión/i.test(message)) return NextResponse.json({ error: message }, { status: 404 });
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
