import { revalidatePath, revalidateTag } from "next/cache";
import { NextResponse } from "next/server";

import { trackServerEvent } from "@/lib/analytics/events";
import { getAuthSession } from "@/lib/auth/session";
import { importPdfAiDraftToMyc } from "@/lib/pdf-import/import-persistence";
import { pdfAiImportDraftSchema } from "@/lib/pdf-import/validation";
import { assertWorkspaceMembership } from "@/lib/workspace/access";
import { PdfImportRequestError } from "../request";

export async function POST(request: Request) {
  const session = await getAuthSession();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  let companyIdForTracking: string | null = null;

  try {
    const body: unknown = await request.json();
    if (!isRecord(body) || typeof body.companyId !== "string") {
      throw new PdfImportRequestError("Selecciona la empresa donde se importara el proyecto PDF.", 400);
    }
    const companyId = body.companyId.trim();
    companyIdForTracking = companyId;
    await assertWorkspaceMembership({ userId: session.user.id, companyId, minimumRole: "EDITOR" });
    const draft = pdfAiImportDraftSchema.parse(body.draft);
    const result = await importPdfAiDraftToMyc(session.user.id, draft, { companyId });

    await safelyTrackPdfImportCompleted({
      userId: session.user.id,
      companyId,
      projectId: result.projectId,
      generalBudgetId: result.generalBudgetId,
      budgetCount: result.budgetCount,
      itemCount: result.itemCount,
      apuCount: result.apuCount,
      resourceCount: result.resourceCount,
    });

    revalidatePath("/dashboard");
    revalidateTag("dashboard-stats", "max");
    revalidateTag("dashboard-analytics", "max");
    revalidateTag("projects-list", "max");
    revalidatePath("/projects");
    revalidatePath(`/projects/${result.projectId}`);
    revalidatePath("/budgets");
    revalidatePath(`/budgets/${result.generalBudgetId}`);

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof PdfImportRequestError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("PDF import POST failed", error);
    await safelyTrackPdfImportFailed({ userId: session.user.id, companyId: companyIdForTracking, stage: "import" });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo importar el draft PDF." },
      { status: 400 },
    );
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

async function safelyTrackPdfImportCompleted(payload: {
  userId: string;
  companyId: string;
  projectId: string;
  generalBudgetId: string;
  budgetCount: number;
  itemCount: number;
  apuCount: number;
  resourceCount: number;
}) {
  try {
    await trackServerEvent("budget_imported", {
      userId: payload.userId,
      companyId: payload.companyId,
      projectId: payload.projectId,
      generalBudgetId: payload.generalBudgetId,
      import_source: "pdf_ai",
      format: "pdf",
    });
    await trackServerEvent("pdf_import_imported", {
      ...payload,
      import_source: "pdf_ai",
      format: "pdf",
    });
  } catch {
    // Analytics must not turn a successful import into an API failure.
  }
}

async function safelyTrackPdfImportFailed(payload: {
  userId: string;
  companyId: string | null;
  stage: "import";
}) {
  try {
    await trackServerEvent("pdf_import_failed", payload);
  } catch {
    // Analytics must not hide the original import failure.
  }
}
