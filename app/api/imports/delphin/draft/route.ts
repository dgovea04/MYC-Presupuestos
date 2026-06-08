import { NextResponse } from "next/server";

import { getAuthSession } from "@/lib/auth/session";
import { parseDelphinDprjToS10Snapshot } from "@/lib/delphin/dprj-import";
import { createS10ImportDraftPreview } from "@/lib/s10/import-preview";

const maxDelphinUploadBytes = 80 * 1024 * 1024;

export async function POST(request: Request) {
  const session = await getAuthSession();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const companyId = readOptionalFormString(formData, "companyId");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Adjunta un archivo .dprj exportado desde Delphin Express." }, { status: 400 });
    }

    if (!file.name.toLowerCase().endsWith(".dprj")) {
      return NextResponse.json({ error: "El archivo Delphin Express debe tener extension .dprj." }, { status: 400 });
    }

    if (file.size > maxDelphinUploadBytes) {
      return NextResponse.json({ error: "El archivo Delphin supera el limite de 80 MB para previsualizacion." }, { status: 413 });
    }

    const snapshot = parseDelphinDprjToS10Snapshot({
      buffer: Buffer.from(await file.arrayBuffer()),
      fileName: file.name,
    });
    const preview = createS10ImportDraftPreview(snapshot, {
      companyId,
      sourceSystem: "DELPHIN",
    });

    return NextResponse.json(preview);
  } catch (error) {
    console.error("Delphin draft POST failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo preparar el draft de importacion Delphin." },
      { status: 400 },
    );
  }
}

function readOptionalFormString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}
