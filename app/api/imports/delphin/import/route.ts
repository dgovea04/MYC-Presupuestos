import { NextResponse } from "next/server";

import { getAuthSession } from "@/lib/auth/session";
import { parseDelphinDprjToS10Snapshot } from "@/lib/delphin/dprj-import";
import { importS10SnapshotToMyc } from "@/lib/s10/import-persistence";

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

    return NextResponse.json(result);
  } catch (error) {
    console.error("Delphin import POST failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo importar el archivo Delphin Express." },
      { status: 400 },
    );
  }
}

function readRequiredFormString(formData: FormData, key: string) {
  const value = formData.get(key);
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error("Selecciona la empresa donde se importara el proyecto Delphin.");
  }

  return value.trim();
}
