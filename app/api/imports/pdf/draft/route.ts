import { NextResponse } from "next/server";

import { trackServerEvent } from "@/lib/analytics/events";
import { getAuthSession } from "@/lib/auth/session";
import { structurePdfImportWithAi } from "@/lib/pdf-import/ai-structure";
import { extractPdfImportFile } from "@/lib/pdf-import/extraction";
import { createPdfAiImportDraftFromText } from "@/lib/pdf-import/import-preview";
import { createPdfImportOcrProvider, PdfImportOcrProviderError } from "@/lib/pdf-import/ocr";
import { getPdfImportAiConfiguration } from "@/lib/pdf-import/provider";
import { assertWorkspaceMembership } from "@/lib/workspace/access";
import { assertWorkspaceFeatureAccess, getWorkspaceFeatureAccessStatus, isWorkspaceFeatureAccessError } from "@/lib/workspace/entitlements";
import { PdfImportRequestError, assertPdfImportPageLimit, readPdfImportMultipartInput } from "../request";

type PdfDraftProgressEvent = {
  type: "progress";
  phase: "preparing" | "ocr" | "structuring" | "completed";
  status?: "started" | "completed";
  pageNumber?: number;
  totalPages?: number;
  fileName?: string;
  detail: string;
};

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
    await assertWorkspaceFeatureAccess({ userId: session.user.id, companyId: input.companyId, feature: "ai.pdf" });
    const aiConfiguration = await getPdfImportAiConfiguration(session.user.id);
    if (request.headers.get("accept")?.includes("application/x-ndjson")) {
      return createPdfDraftProgressStream({ session, input, aiConfiguration });
    }
    const ocrProvider = aiConfiguration.apiKey
      ? createPdfImportOcrProvider(aiConfiguration)
      : undefined;
    const extractedFiles = await Promise.all(input.files.map(({ file, role }) => extractPdfImportFile(file, role, { ocrProvider })));
    assertPdfImportPageLimit(extractedFiles);
    const deterministicDraft = createPdfAiImportDraftFromText({
      companyId: input.companyId,
      projectName: input.projectName,
      currency: input.currency,
      priceTolerance: input.priceTolerance,
      files: extractedFiles,
    });
    const shouldUseAi = shouldUseAiStructureFallback(deterministicDraft, extractedFiles);
    const draft = shouldUseAi
      ? await createAiStructuredDraftOrFallback({
          userId: session.user.id,
          companyId: input.companyId,
          projectName: input.projectName,
          currency: input.currency,
          priceTolerance: input.priceTolerance,
          extractedFiles,
          provider: aiConfiguration.provider,
          fallbackDraft: deterministicDraft,
        })
      : deterministicDraft;
    await safelyTrackPdfImportDraftCreated({
      userId: session.user.id,
      companyId: input.companyId,
      fileCount: extractedFiles.length,
      pageCount: extractedFiles.reduce((sum, file) => sum + file.pageCount, 0),
      itemCount: draft.budgets.reduce((sum, budget) => sum + budget.items.length, 0),
      apuCount: draft.apus.length,
      subpartidaCount: draft.subpartidas.length,
      warningCount: draft.warnings.length + draft.validations.length,
      usedAi: shouldUseAi,
    });

    return NextResponse.json(draft);
  } catch (error) {
    if (isWorkspaceFeatureAccessError(error)) {
      return NextResponse.json({ error: "El importador PDF IA esta disponible en Pro." }, { status: getWorkspaceFeatureAccessStatus(error) });
    }
    if (error instanceof PdfImportRequestError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("PDF import draft POST failed", error);
    await safelyTrackPdfImportFailed({ userId: session.user.id, companyId: companyIdForTracking, stage: "draft" });
    const detail = error instanceof Error && error.message.trim().length > 0 ? ` ${error.message}` : "";
    return NextResponse.json({
      error: `No se pudo preparar el draft de importacion PDF.${detail}`,
      aiDebug: error instanceof PdfImportOcrProviderError ? [error.debug] : undefined,
    }, { status: 500 });
  }
}

function createPdfDraftProgressStream(input: {
  session: { user: { id: string } };
  input: Awaited<ReturnType<typeof readPdfImportMultipartInput>>;
  aiConfiguration: Awaited<ReturnType<typeof getPdfImportAiConfiguration>>;
}) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const emit = (event: Record<string, unknown>) => controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      emit({ type: "progress", phase: "preparing", status: "started", detail: "Preparando OCR y validando el paquete PDF." } satisfies PdfDraftProgressEvent);

      void preparePdfDraft({
        userId: input.session.user.id,
        input: input.input,
        aiConfiguration: input.aiConfiguration,
        onProgress: (event) => emit(event),
      }).then(async (result) => {
        await safelyTrackPdfImportDraftCreated({
          userId: input.session.user.id,
          companyId: input.input.companyId,
          fileCount: result.extractedFiles.length,
          pageCount: result.extractedFiles.reduce((sum, file) => sum + file.pageCount, 0),
          itemCount: result.draft.budgets.reduce((sum, budget) => sum + budget.items.length, 0),
          apuCount: result.draft.apus.length,
          subpartidaCount: result.draft.subpartidas.length,
          warningCount: result.draft.warnings.length + result.draft.validations.length,
          usedAi: result.usedAi,
        });
        emit({ type: "progress", phase: "completed", status: "completed", detail: "Draft PDF listo para revisión." } satisfies PdfDraftProgressEvent);
        emit({ type: "result", draft: result.draft });
      }).catch(async (error: unknown) => {
        console.error("PDF import draft streaming POST failed", error);
        await safelyTrackPdfImportFailed({ userId: input.session.user.id, companyId: input.input.companyId, stage: "draft" });
        emit({
          type: "error",
          error: `No se pudo preparar el draft de importacion PDF.${error instanceof Error && error.message.trim().length > 0 ? ` ${error.message}` : ""}`,
          aiDebug: error instanceof PdfImportOcrProviderError ? [error.debug] : undefined,
        });
      }).finally(() => controller.close());
    },
  });

  return new Response(stream, {
    headers: {
      "Cache-Control": "no-cache, no-transform",
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "X-Accel-Buffering": "no",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

async function preparePdfDraft(input: {
  userId: string;
  input: Awaited<ReturnType<typeof readPdfImportMultipartInput>>;
  aiConfiguration: Awaited<ReturnType<typeof getPdfImportAiConfiguration>>;
  onProgress?: (event: PdfDraftProgressEvent) => void;
}) {
  const ocrProvider = input.aiConfiguration.apiKey ? createPdfImportOcrProvider(input.aiConfiguration) : undefined;
  const extractedFiles = await Promise.all(input.input.files.map(({ file, role }) => extractPdfImportFile(file, role, {
    ocrProvider,
    onProgress: (event) => input.onProgress?.({
      type: "progress",
      phase: event.phase,
      status: event.status,
      pageNumber: event.pageNumber,
      totalPages: event.totalPages,
      fileName: event.fileName,
      detail: event.status === "started"
        ? `OCR página ${event.pageNumber} de ${event.totalPages}; esperando respuesta del proveedor.`
        : `OCR página ${event.pageNumber} de ${event.totalPages} completado.`,
    }),
  })));
  assertPdfImportPageLimit(extractedFiles);
  const deterministicDraft = createPdfAiImportDraftFromText({
    companyId: input.input.companyId,
    projectName: input.input.projectName,
    currency: input.input.currency,
    priceTolerance: input.input.priceTolerance,
    files: extractedFiles,
  });
  const shouldUseAi = shouldUseAiStructureFallback(deterministicDraft, extractedFiles);
  if (shouldUseAi) {
    input.onProgress?.({ type: "progress", phase: "structuring", status: "started", detail: "Estructurando el contenido OCR con IA." });
  }
  const draft = shouldUseAi
    ? await createAiStructuredDraftOrFallback({
        userId: input.userId,
        companyId: input.input.companyId,
        projectName: input.input.projectName,
        currency: input.input.currency,
        priceTolerance: input.input.priceTolerance,
        extractedFiles,
        provider: input.aiConfiguration.provider,
        fallbackDraft: deterministicDraft,
        onProgress: input.onProgress,
      })
    : deterministicDraft;

  return { draft, extractedFiles, usedAi: shouldUseAi };
}

async function safelyTrackPdfImportDraftCreated(payload: {
  userId: string;
  companyId: string;
  fileCount: number;
  pageCount: number;
  itemCount: number;
  apuCount: number;
  subpartidaCount: number;
  warningCount: number;
  usedAi: boolean;
}) {
  try {
    await trackServerEvent("pdf_import_draft_created", payload);
  } catch {
    // Analytics must not block a user from creating a reviewable draft.
  }
}

async function safelyTrackPdfImportFailed(payload: {
  userId: string;
  companyId: string | null;
  stage: "draft";
}) {
  try {
    await trackServerEvent("pdf_import_failed", payload);
  } catch {
    // Analytics must not hide the original draft creation failure.
  }
}

function shouldUseAiStructureFallback(
  draft: ReturnType<typeof createPdfAiImportDraftFromText>,
  files: Awaited<ReturnType<typeof extractPdfImportFile>>[],
) {
  const itemCount = draft.budgets.reduce((sum, budget) => sum + budget.items.length, 0);
  const hasApuSource = files.some((file) => file.role === "APU");
  return itemCount === 0 || hasApuSource && draft.apus.length === 0 || files.some((file) => file.requiresOcr);
}

async function createAiStructuredDraftOrFallback(input: {
  userId: string;
  companyId: string;
  projectName?: string;
  currency: string;
  priceTolerance: string;
  extractedFiles: Awaited<ReturnType<typeof extractPdfImportFile>>[];
  provider: Awaited<ReturnType<typeof getPdfImportAiConfiguration>>["provider"];
  fallbackDraft: ReturnType<typeof createPdfAiImportDraftFromText>;
  onProgress?: (event: PdfDraftProgressEvent) => void;
}) {
  try {
    const result = await structurePdfImportWithAi({
      userId: input.userId,
      companyId: input.companyId,
      provider: input.provider,
      projectName: input.projectName,
      currency: input.currency,
      priceTolerance: input.priceTolerance,
      files: input.extractedFiles,
    });
    input.onProgress?.({ type: "progress", phase: "structuring", status: "completed", detail: "Estructuración IA completada." });
    return result.draft;
  } catch (error) {
    input.onProgress?.({ type: "progress", phase: "structuring", status: "completed", detail: "La estructuración IA falló; se conserva el fallback revisable." });
    return {
      ...input.fallbackDraft,
      warnings: [
        ...input.fallbackDraft.warnings,
        error instanceof Error ? error.message : "No se pudo ejecutar la estructuracion IA del paquete PDF.",
      ],
    };
  }
}
