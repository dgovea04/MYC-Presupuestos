import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { getReviewDocumentStorage } from "@/lib/review-intelligence/documents";
import { reprocessDocumentCoverage } from "@/lib/review-intelligence/extraction-persistence";
import { assertWorkspaceMembership } from "@/lib/workspace/access";

const bodySchema = z.object({ pages: z.array(z.number().int().positive()).min(1).optional(), sheetNames: z.array(z.string().min(1)).min(1).optional() }).strict().refine((value) => Boolean(value.pages?.length) !== Boolean(value.sheetNames?.length), "Select pages or worksheets, but not both.");
type Coverage = { page?: number; worksheet?: string };

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAuthSession();
  if (!session?.user?.id) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const companyId = session.user.activeCompanyId ?? session.user.companyId;
  if (!companyId) return NextResponse.json({ error: "Workspace no disponible" }, { status: 403 });
  try {
    await assertWorkspaceMembership({ userId: session.user.id, companyId, minimumRole: "EDITOR" });
    const document = await prisma.projectDocument.findFirst({ where: { id: (await params).id }, select: { id: true, companyId: true, projectId: true, currentVersionId: true } });
    if (!document) return NextResponse.json({ error: "Documento no encontrado" }, { status: 404 });
    if (document.companyId !== companyId) return NextResponse.json({ error: "No tienes acceso a este documento" }, { status: 403 });
    if (!document.currentVersionId) return NextResponse.json({ error: "El documento no tiene una versión procesable" }, { status: 400 });
    const version = await prisma.documentVersion.findFirst({ where: { id: document.currentVersionId, companyId, projectId: document.projectId }, select: { id: true, companyId: true, projectId: true, storageKey: true, originalFileName: true, mimeType: true, sha256: true, extractionCoverage: true, extractionWarnings: true } });
    if (!version) return NextResponse.json({ error: "Versión de documento no encontrada" }, { status: 404 });
    const selection = bodySchema.parse(await request.json());
    assertAuthorizedCoverage(selection, version.extractionCoverage);
    const bytes = await getReviewDocumentStorage().read({ companyId, projectId: document.projectId, storageKey: version.storageKey });
    const fileBytes = new Uint8Array(bytes.byteLength);
    fileBytes.set(bytes);
    const file = new File([fileBytes.buffer], version.originalFileName, { type: version.mimeType });
    const result = await reprocessDocumentCoverage({ file, version, companyId, projectId: document.projectId, pages: selection.pages, sheetNames: selection.sheetNames }, prisma);
    const stale = await prisma.reviewRun.updateMany({ where: { companyId, projectId: document.projectId, status: { in: ["COMPLETED", "COMPLETED_WITH_WARNINGS"] }, documentVersionLinks: { some: { documentVersionId: version.id, companyId, projectId: document.projectId } } }, data: { status: "STALE" } });
    return NextResponse.json({ ...result, staleRuns: stale.count });
  } catch (error) {
    if (error instanceof z.ZodError || error instanceof RangeError) return NextResponse.json({ error: error instanceof Error ? error.message : "Selección inválida" }, { status: 400 });
    if (error instanceof Error && /workspace|rol necesario|permisos/i.test(error.message)) return NextResponse.json({ error: error.message }, { status: 403 });
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo reprocesar el documento" }, { status: 400 });
  }
}

function assertAuthorizedCoverage(selection: z.infer<typeof bodySchema>, value: unknown): void {
  const coverage = Array.isArray(value) ? value.filter((entry): entry is Coverage => typeof entry === "object" && entry !== null && !Array.isArray(entry)) : [];
  const pages = new Set(coverage.flatMap((entry) => typeof entry.page === "number" ? [entry.page] : []));
  const sheets = new Set(coverage.flatMap((entry) => typeof entry.worksheet === "string" ? [entry.worksheet] : []));
  if (selection.pages && (pages.size === 0 || selection.pages.some((page) => !pages.has(page)))) throw new RangeError("La selección contiene páginas fuera de la cobertura autorizada.");
  if (selection.sheetNames && (sheets.size === 0 || selection.sheetNames.some((sheet) => !sheets.has(sheet)))) throw new RangeError("La selección contiene hojas fuera de la cobertura autorizada.");
}
