import { NextResponse } from "next/server";

import { getAuthSession } from "@/lib/auth/session";
import { isLocalServerRuntimeEnabled } from "@/lib/runtime/local-capabilities";
import { createDbSnapshot } from "@/lib/db-import/service";
import { readPath } from "@/app/api/imports/db/local/projects/route";

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
    const result = createDbSnapshot(path, projectId, subBudgetId);
    return NextResponse.json({ snapshot: result.snapshot, project: result.project, inspection: result.inspection });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo exportar la base .db." }, { status: 400 });
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
