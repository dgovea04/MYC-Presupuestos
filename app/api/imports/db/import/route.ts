import { revalidatePath, revalidateTag } from "next/cache";
import { NextResponse } from "next/server";

import { trackServerEvent } from "@/lib/analytics/events";
import { getAuthSession } from "@/lib/auth/session";
import { importS10SnapshotToMyc } from "@/lib/s10/import-persistence";
import { parseS10SnapshotValue } from "@/lib/s10/snapshot-contract";
import { assertWorkspaceMembership } from "@/lib/workspace/access";
import { createDbSnapshot } from "@/lib/db-import/service";
import { DbUploadError, withTemporaryDbUpload } from "@/lib/db-import/upload";
import { recordImportKnowledgeEvent } from "@/lib/knowledge/integrations";
import { recordImportLearningBestEffort } from "@/lib/knowledge/import-learning-runner";
import { buildS10ImportLearningBatch } from "@/lib/knowledge/import-learning-extraction";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = await getAuthSession();
  if (!session?.user?.id) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Adjunta un archivo .db de presupuesto." }, { status: 400 });
    }

    const companyId = readRequiredString(formData.get("companyId"), "Selecciona la empresa donde se importara el proyecto .db.");
    const projectId = readRequiredString(formData.get("projectId"), "Selecciona el proyecto que se importara.");
    const subBudgetId = readOptionalString(formData.get("subBudgetId"));
    await assertWorkspaceMembership({ userId: session.user.id, companyId, minimumRole: "EDITOR" });

    const result = await withTemporaryDbUpload(file, (filePath) => createDbSnapshot(filePath, projectId, subBudgetId));
    const snapshot = parseS10SnapshotValue(result.snapshot).snapshot;
    const importResult = await importS10SnapshotToMyc(session.user.id, snapshot, {
      companyId,
      sourceSystem: "DB",
    });

    await safelyTrackImportCompleted({
      userId: session.user.id,
      companyId,
      projectId: importResult.projectId,
      generalBudgetId: importResult.generalBudgetId,
      import_source: "db",
      format: "sqlite-db",
    });
    await safelyRecordKnowledgeImport({ userId: session.user.id, companyId, projectId: importResult.projectId, budgetId: importResult.generalBudgetId, sourceType: "DB_IMPORT" });
    await safelyRecordImportLearning({ snapshot, sourceLabel: file.name, sourceType: "DB_IMPORT", userId: session.user.id, companyId, projectId: importResult.projectId });
    revalidateImportPaths(importResult.projectId, importResult.generalBudgetId);

    return NextResponse.json(importResult, { status: 201 });
  } catch (error) {
    console.error("DB import POST failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo importar el archivo .db." },
      { status: error instanceof DbUploadError ? error.status : 400 },
    );
  }
}

async function safelyRecordImportLearning(input: { snapshot: Parameters<typeof buildS10ImportLearningBatch>[0]["snapshot"]; sourceLabel: string; sourceType: "DB_IMPORT"; userId: string; companyId: string; projectId: string }) {
  try { await recordImportLearningBestEffort(buildS10ImportLearningBatch({ snapshot: input.snapshot, sourceLabel: input.sourceLabel, sourceType: input.sourceType, createdById: input.userId, companyId: input.companyId, projectId: input.projectId })); } catch (error) { console.warn("Knowledge import learning was not recorded", error); }
}

async function safelyRecordKnowledgeImport(input: Parameters<typeof recordImportKnowledgeEvent>[0]) {
  try { await recordImportKnowledgeEvent(input); } catch (error) { console.warn("Knowledge import event was not recorded", error); }
}

function readRequiredString(value: FormDataEntryValue | null, message: string) {
  const result = readOptionalString(value);
  if (!result) throw new Error(message);
  return result;
}

function readOptionalString(value: FormDataEntryValue | null) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function revalidateImportPaths(projectId: string, generalBudgetId: string) {
  revalidatePath("/dashboard");
  revalidateTag("dashboard-stats", "max");
  revalidateTag("dashboard-analytics", "max");
  revalidateTag("projects-list", "max");
  revalidatePath("/projects");
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/budgets");
  revalidatePath(`/budgets/${generalBudgetId}`);
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
