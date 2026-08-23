import { NextResponse } from "next/server";

import { getAuthSession } from "@/lib/auth/session";
import { isLocalServerRuntimeEnabled } from "@/lib/runtime/local-capabilities";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
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
    const url = new URL(request.url);
    const path = url.searchParams.get("path");
    if (!path || path.trim().length === 0) {
      return NextResponse.json({ error: "Indica la ruta del archivo .sqlite de Delphin." }, { status: 400 });
    }

    const safePath = validateFilePath(path.trim());
    const { listDelphinSqliteProjects } = await import("@/lib/delphin/sqlite-reader");
    const projects = listDelphinSqliteProjects(safePath);

    return NextResponse.json({ projects });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudieron leer los proyectos Delphin." },
      { status: 400 },
    );
  }
}

function validateFilePath(raw: string) {
  if (raw.includes("..")) {
    throw new Error("La ruta del archivo no es valida.");
  }

  return raw;
}