import { NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";

import { getAuthSession } from "@/lib/auth/session";
import { trackServerEvent } from "@/lib/analytics/events";
import { assertWorkspaceMembership } from "@/lib/workspace/access";
import { parseDelphinDprjToS10Snapshot } from "@/lib/delphin/dprj-import";
import { importS10SnapshotToMyc } from "@/lib/s10/import-persistence";
import { recordImportKnowledgeEvent } from "@/lib/knowledge/integrations";
import { recordImportLearningBestEffort } from "@/lib/knowledge/import-learning-runner";
import { buildS10ImportLearningBatch } from "@/lib/knowledge/import-learning-extraction";

const maxDelphinUploadBytes = 80 * 1024 * 1024;

export async function POST(request: Request) {
  const session = await getAuthSession();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const companyId = readRequiredFormString(formData, "companyId");
    await assertWorkspaceMembership({ userId: session.user.id, companyId, minimumRole: "EDITOR" });

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Adjunta un archivo .dprj exportado desde Delphin Express." }, { status: 400 });
    }

    if (!file.name.toLowerCase().endsWith(".dprj")) {
      return NextResponse.json({ error: "El archivo Delphin Express debe tener extension .dprj." }, { status: 400 });
    }

    if (file.size > maxDelphinUploadBytes) {
      return NextResponse.json({ error: "El archivo Delphin supera el limite de 80 MB para importacion." }, { status: 413 });
    }

    const snapshot = parseDelphinDprjToS10Snapshot({
      buffer: Buffer.from(await file.arrayBuffer()),
      fileName: file.name,
    });
    const result = await importS10SnapshotToMyc(session.user.id, snapshot, {
      companyId,
      sourceSystem: "DELPHIN",
    });

    await safelyTrackImportCompleted({
      userId: session.user.id,
      companyId,
      projectId: result.projectId,
      generalBudgetId: result.generalBudgetId,
      import_source: "delphin",
      format: "dprj",
    });
    await safelyRecordKnowledgeImport({ userId: session.user.id, companyId, projectId: result.projectId, budgetId: result.generalBudgetId, sourceType: "DELPHIN_IMPORT" });
    await safelyRecordImportLearning({ snapshot, sourceLabel: file.name, sourceType: "DELPHIN_IMPORT", userId: session.user.id, companyId, projectId: result.projectId });

    revalidatePath("/dashboard");
    revalidateTag("dashboard-stats", "max");
    revalidateTag("dashboard-analytics", "max");
    revalidateTag("projects-list", "max");
    revalidatePath("/projects");
    revalidatePath(`/projects/${result.projectId}`);
    revalidatePath("/budgets");
    revalidatePath(`/budgets/${result.generalBudgetId}`);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Delphin import POST failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo importar el archivo Delphin Express." },
      { status: 400 },
    );
  }
}

async function safelyRecordImportLearning(input: { snapshot: Parameters<typeof buildS10ImportLearningBatch>[0]["snapshot"]; sourceLabel: string; sourceType: "DELPHIN_IMPORT"; userId: string; companyId: string; projectId: string }) {
  try { await recordImportLearningBestEffort(buildS10ImportLearningBatch({ snapshot: input.snapshot, sourceLabel: input.sourceLabel, sourceType: input.sourceType, createdById: input.userId, companyId: input.companyId, projectId: input.projectId })); } catch (error) { console.warn("Knowledge import learning was not recorded", error); }
}

async function safelyRecordKnowledgeImport(input: Parameters<typeof recordImportKnowledgeEvent>[0]) {
  try { await recordImportKnowledgeEvent(input); } catch (error) { console.warn("Knowledge import event was not recorded", error); }
}

async function safelyTrackImportCompleted(payload: {
  userId: string;
  companyId: string;
  projectId: string;
  generalBudgetId: string;
  import_source: string;
  format: string;
}) {
  try {
    await trackServerEvent("budget_imported", payload);
  } catch {
    // Analytics must not turn a successful import into an API failure.
  }
}

function readRequiredFormString(formData: FormData, key: string) {
  const value = formData.get(key);
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error("Selecciona la empresa donde se importara el proyecto Delphin.");
  }

  return value.trim();
}
