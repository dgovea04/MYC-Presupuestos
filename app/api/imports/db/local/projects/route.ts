import { NextResponse } from "next/server";

import { getAuthSession } from "@/lib/auth/session";
import { isLocalServerRuntimeEnabled } from "@/lib/runtime/local-capabilities";
import { discoverDbProjects } from "@/lib/db-import/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await getAuthSession();
  if (!session?.user?.id) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!isLocalServerRuntimeEnabled()) {
    return NextResponse.json({ error: "La lectura local de bases .db solo esta habilitada en entorno local." }, { status: 403 });
  }

  try {
    const path = readPath(request);
    return NextResponse.json({ projects: discoverDbProjects(path) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudieron leer los proyectos de la base .db." }, { status: 400 });
  }
}

export function readPath(request: Request) {
  const value = new URL(request.url).searchParams.get("path");
  if (!value || value.trim().length === 0) throw new Error("Indica la ruta local del archivo .db.");
  if (value.includes("..")) throw new Error("La ruta local del archivo no es valida.");
  return value.trim();
}
