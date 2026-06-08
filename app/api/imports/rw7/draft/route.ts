import { NextResponse } from "next/server";

import { getAuthSession } from "@/lib/auth/session";
import { parseRw7WorkbookToS10Snapshot } from "@/lib/rw7/excel-import";
import { createS10ImportDraftPreview } from "@/lib/s10/import-preview";

const maxRw7UploadBytes = 80 * 1024 * 1024;

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
      return NextResponse.json({ error: "Adjunta un archivo Excel exportado desde RW7." }, { status: 400 });
    }

    if (!isExcelFileName(file.name)) {
      return NextResponse.json({ error: "El archivo RW7 debe ser .xlsx o .xlsm." }, { status: 400 });
    }

    if (file.size > maxRw7UploadBytes) {
      return NextResponse.json({ error: "El archivo RW7 supera el limite de 80 MB para previsualizacion." }, { status: 413 });
    }

    const snapshot = await parseRw7WorkbookToS10Snapshot({
      buffer: Buffer.from(await file.arrayBuffer()),
      fileName: file.name,
    });
    const preview = createS10ImportDraftPreview(snapshot, {
      companyId,
      sourceSystem: "RW7",
    });

    return NextResponse.json(preview);
  } catch (error) {
    console.error("RW7 draft POST failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo preparar el draft de importacion RW7." },
      { status: 400 },
    );
  }
}

function readOptionalFormString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function isExcelFileName(fileName: string) {
  const normalized = fileName.toLowerCase();
  return normalized.endsWith(".xlsx") || normalized.endsWith(".xlsm");
}
