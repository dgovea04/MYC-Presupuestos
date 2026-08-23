import { NextResponse } from "next/server";

import { getAuthSession } from "@/lib/auth/session";
import { isLocalServerRuntimeEnabled } from "@/lib/runtime/local-capabilities";
import { parseS10SnapshotJson } from "@/lib/s10/snapshot-contract";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = await getAuthSession();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  if (!isLocalServerRuntimeEnabled()) {
    return NextResponse.json(
      { error: "La lectura local de bases Delphin solo esta habilitada en entorno local." },
      { status: 403 },
    );
  }

  try {
    const body: unknown = await request.json();
    if (!isRecord(body)) {
      throw new Error("Envia un body JSON valido.");
    }

    const path = readRequiredString(body, "path");
    const projectId = readRequiredString(body, "projectId");

    const { exportDelphinSqliteProject } = await import("@/lib/delphin/sqlite-reader");
    const snapshot = exportDelphinSqliteProject(path, projectId);

    // Validate via S10 contract
    const { contract } = parseS10SnapshotJson(JSON.stringify(snapshot));
    return NextResponse.json({ snapshot: contract });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo exportar el proyecto Delphin." },
      { status: 400 },
    );
  }
}

function readRequiredString(record: Record<string, unknown>, key: string) {
  const value = record[key];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Falta ${key}.`);
  }

  return value.trim();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}