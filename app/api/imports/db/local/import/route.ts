import { revalidatePath, revalidateTag } from "next/cache";
import { NextResponse } from "next/server";

import { trackServerEvent } from "@/lib/analytics/events";
import { getAuthSession } from "@/lib/auth/session";
import { isLocalServerRuntimeEnabled } from "@/lib/runtime/local-capabilities";
import { createDbSnapshot } from "@/lib/db-import/service";
import { readPath } from "@/app/api/imports/db/local/projects/route";
import { importS10SnapshotToMyc } from "@/lib/s10/import-persistence";
import { parseS10SnapshotValue } from "@/lib/s10/snapshot-contract";
import { assertWorkspaceMembership } from "@/lib/workspace/access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = await getAuthSession();
  if (!session?.user?.id) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!isLocalServerRuntimeEnabled()) {
    return NextResponse.json({ error: "La lectura local de bases .db solo esta habilitada en entorno local." }, { status: 403 });
  }

  try {
    const body: unknown = await request.json();
    if (!isRecord(body)) throw new Error("Envia un body JSON valido.");
    const path = readPath(new Request(`http://local/db?path=${encodeURIComponent(readString(body, "path"))}`));
    const projectId = readString(body, "projectId");
    const subBudgetId = readOptionalString(body, "subBudgetId");
    const companyId = readString(body, "companyId");
    await assertWorkspaceMembership({ userId: session.user.id, companyId, minimumRole: "EDITOR" });

    const snapshotResult = createDbSnapshot(path, projectId, subBudgetId);
    const snapshot = parseS10SnapshotValue(snapshotResult.snapshot).snapshot;
    const result = await importS10SnapshotToMyc(session.user.id, snapshot, { companyId, sourceSystem: "DB" });

    await safelyTrackImportCompleted({
      userId: session.user.id,
      companyId,
      projectId: result.projectId,
      generalBudgetId: result.generalBudgetId,
      import_source: "db",
      format: "sqlite-db-local",
    });
    revalidateImportPaths(result.projectId, result.generalBudgetId);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error("Local DB import POST failed", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo importar la base .db local." }, { status: 400 });
  }
}

function readString(record: Record<string, unknown>, key: string) {
  const value = record[key];
  if (typeof value !== "string" || value.trim().length === 0) throw new Error(`Falta ${key}.`);
  return value.trim();
}

function readOptionalString(record: Record<string, unknown>, key: string) {
  const value = record[key];
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
