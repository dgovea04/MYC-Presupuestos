import { NextResponse } from "next/server";

import { getAuthSession } from "@/lib/auth/session";
import { createS10ImportDraftPreview } from "@/lib/s10/import-preview";
import { parseS10SnapshotValue } from "@/lib/s10/snapshot-contract";
import { discoverDbProjects, createDbSnapshot } from "@/lib/db-import/service";
import { DbUploadError, withTemporaryDbUpload } from "@/lib/db-import/upload";

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

    const projectId = readOptionalString(formData.get("projectId"));
    const subBudgetId = readOptionalString(formData.get("subBudgetId"));
    const companyId = readOptionalString(formData.get("companyId"));

    const result = await withTemporaryDbUpload(file, (filePath) => {
      if (!projectId) {
        return { projects: discoverDbProjects(filePath) };
      }

      const snapshotResult = createDbSnapshot(filePath, projectId, subBudgetId);
      const preview = createS10ImportDraftPreview(parseS10SnapshotValue(snapshotResult.snapshot).snapshot, {
        companyId,
        sourceSystem: "DB",
      });
      return {
        snapshot: snapshotResult.snapshot,
        preview: {
          ...preview,
          warnings: [...new Set([...preview.warnings, ...(snapshotResult.project.warnings ?? [])])],
        },
        project: snapshotResult.project,
        inspection: snapshotResult.inspection,
      };
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("DB draft POST failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo preparar el draft del archivo .db." },
      { status: error instanceof DbUploadError ? error.status : 400 },
    );
  }
}

function readOptionalString(value: FormDataEntryValue | null) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}
