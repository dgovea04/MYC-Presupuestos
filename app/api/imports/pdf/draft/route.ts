import { NextResponse } from "next/server";

import { trackServerEvent } from "@/lib/analytics/events";
import { getAuthSession } from "@/lib/auth/session";
import { structurePdfImportWithAi } from "@/lib/pdf-import/ai-structure";
import { extractPdfImportFile } from "@/lib/pdf-import/extraction";
import { createPdfAiImportDraftFromText } from "@/lib/pdf-import/import-preview";
import { createPdfImportOcrProvider } from "@/lib/pdf-import/ocr";
import { getPdfImportAiConfiguration } from "@/lib/pdf-import/provider";
import { assertWorkspaceMembership } from "@/lib/workspace/access";
import { assertWorkspaceFeatureAccess, getWorkspaceFeatureAccessStatus, isWorkspaceFeatureAccessError } from "@/lib/workspace/entitlements";
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
    await assertWorkspaceFeatureAccess({ userId: session.user.id, companyId: input.companyId, feature: "ai.pdf" });
    const aiConfiguration = await getPdfImportAiConfiguration(session.user.id);
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
    return NextResponse.json({ error: "No se pudo preparar el draft de importacion PDF." }, { status: 500 });
  }
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
  return itemCount === 0 || draft.apus.length === 0 || files.some((file) => file.requiresOcr);
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
    return result.draft;
  } catch (error) {
    return {
      ...input.fallbackDraft,
      warnings: [
        ...input.fallbackDraft.warnings,
        error instanceof Error ? error.message : "No se pudo ejecutar la estructuracion IA del paquete PDF.",
      ],
    };
  }
}
