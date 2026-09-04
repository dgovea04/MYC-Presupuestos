import { NextResponse } from "next/server";

import { getAuthSession } from "@/lib/auth/session";
import { createS10ImportDraftPreview, parseS10ExportSnapshotJson } from "@/lib/s10/import-preview";

const maxSnapshotUploadBytes = 40 * 1024 * 1024;

export async function POST(request: Request) {
  const session = await getAuthSession();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const input = await readDraftRequestInput(request);
    const snapshot = parseSnapshotOrThrow(input.snapshotJson);
    const preview = createS10ImportDraftPreview(snapshot, {
      budgetCode: input.budgetCode,
      companyId: input.companyId,
      projectId: input.projectId,
      sourceSystem: input.sourceSystem,
    });

    return NextResponse.json(preview);
  } catch (error) {
    if (error instanceof DraftRequestError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("S10 draft POST failed", error);
    return NextResponse.json({ error: "No se pudo preparar el draft de importacion S10." }, { status: 500 });
  }
}

function parseSnapshotOrThrow(snapshotJson: string) {
  try {
    return parseS10ExportSnapshotJson(snapshotJson);
  } catch (error) {
    const message = error instanceof Error ? error.message : "El snapshot S10 no es valido.";
    throw new DraftRequestError(message, 400);
  }
}

async function readDraftRequestInput(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      throw new DraftRequestError("Adjunta un JSON exportado desde S10.", 400);
    }

    if (!file.name.toLowerCase().endsWith(".json")) {
      throw new DraftRequestError("El snapshot S10 debe ser un archivo .json.", 400);
    }

    if (file.size > maxSnapshotUploadBytes) {
      throw new DraftRequestError("El snapshot S10 supera el limite de 40 MB para previsualizacion.", 413);
    }

    return {
      snapshotJson: await file.text(),
      budgetCode: readOptionalFormString(formData, "budgetCode"),
      companyId: readOptionalFormString(formData, "companyId"),
      projectId: readOptionalFormString(formData, "projectId"),
      sourceSystem: readSourceSystem(formData.get("sourceSystem")),
    };
  }

  const body: unknown = await request.json();
  if (!isRecord(body) || typeof body.snapshot !== "object" || body.snapshot == null) {
    throw new DraftRequestError("Envia un body JSON con la propiedad snapshot.", 400);
  }

  return {
    snapshotJson: JSON.stringify(body.snapshot),
    budgetCode: readOptionalRecordString(body, "budgetCode"),
    companyId: readOptionalRecordString(body, "companyId"),
    projectId: readOptionalRecordString(body, "projectId"),
    sourceSystem: readSourceSystem(body.sourceSystem),
  };
}

function readOptionalFormString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function readOptionalRecordString(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function readSourceSystem(value: unknown): "S10" | "RW7" | "DELPHIN" | "DB" {
  if (value === "DB" || value === "RW7" || value === "DELPHIN" || value === "S10") {
    return value;
  }

  return "S10";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

class DraftRequestError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}
