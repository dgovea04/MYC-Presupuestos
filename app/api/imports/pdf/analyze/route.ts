import { NextResponse } from "next/server";

import { trackServerEvent } from "@/lib/analytics/events";
import { getAuthSession } from "@/lib/auth/session";
import { extractPdfImportFile } from "@/lib/pdf-import/extraction";
import { createPdfImportOcrProvider } from "@/lib/pdf-import/ocr";
import { getPdfImportAiConfiguration } from "@/lib/pdf-import/provider";
import { assertWorkspaceMembership } from "@/lib/workspace/access";
import { PdfImportRequestError, assertPdfImportPageLimit, readPdfImportMultipartInput } from "../request";

export async function POST(request: Request) {
  const session = await getAuthSession();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  let companyIdForTracking: string | null = null;

  try {
    const input = await readPdfImportMultipartInput(request);
    companyIdForTracking = input.companyId;
    await assertWorkspaceMembership({ userId: session.user.id, companyId: input.companyId, minimumRole: "EDITOR" });
    const aiConfiguration = await getPdfImportAiConfiguration(session.user.id);
    const ocrProvider = aiConfiguration.apiKey
      ? createPdfImportOcrProvider(aiConfiguration)
      : undefined;
    const files = await Promise.all(input.files.map(({ file, role }) => extractPdfImportFile(file, role, { ocrProvider })));
    assertPdfImportPageLimit(files);
    await safelyTrackPdfImportAnalyzed({
      userId: session.user.id,
      companyId: input.companyId,
      fileCount: files.length,
      pageCount: files.reduce((sum, file) => sum + file.pageCount, 0),
      ocrPageCount: files.filter((file) => file.requiresOcr).reduce((sum, file) => sum + file.pageCount, 0),
    });

    return NextResponse.json({
      files: files.map((file) => ({
        id: file.id,
        fileName: file.fileName,
        role: file.role,
        pageCount: file.pageCount,
        requiresOcr: file.requiresOcr,
        confidence: file.confidence,
      })),
      warnings: files
        .filter((file) => file.requiresOcr && !file.ocrApplied)
        .map((file) => `${file.fileName} parece escaneado y requerira OCR/vision. Configura una API key cloud en Configuracion > IA > Proveedores Cloud IA y selecciona el proveedor del importador PDF.`),
    });
  } catch (error) {
    if (error instanceof PdfImportRequestError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("PDF import analyze POST failed", error);
    await safelyTrackPdfImportFailed({ userId: session.user.id, companyId: companyIdForTracking, stage: "analyze" });
    return NextResponse.json({ error: "No se pudo analizar el paquete PDF." }, { status: 500 });
  }
}

async function safelyTrackPdfImportAnalyzed(payload: {
  userId: string;
  companyId: string;
  fileCount: number;
  pageCount: number;
  ocrPageCount: number;
}) {
  try {
    await trackServerEvent("pdf_import_analyzed", payload);
  } catch {
    // Analytics must not block a user from analyzing an import package.
  }
}

async function safelyTrackPdfImportFailed(payload: {
  userId: string;
  companyId: string | null;
  stage: "analyze";
}) {
  try {
    await trackServerEvent("pdf_import_failed", payload);
  } catch {
    // Analytics must not hide the original import analysis failure.
  }
}
