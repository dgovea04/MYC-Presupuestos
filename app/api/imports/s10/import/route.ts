import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { createBillingErrorResponse } from "@/lib/billing/api";
import { getAuthSession } from "@/lib/auth/session";
import { importS10SnapshotToMyc } from "@/lib/s10/import-persistence";
import { parseS10ExportSnapshotJson } from "@/lib/s10/import-preview";

const maxSnapshotUploadBytes = 40 * 1024 * 1024;

export async function POST(request: Request) {
  const session = await getAuthSession();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const input = await readImportRequestInput(request);
    const snapshot = parseSnapshotOrThrow(input.snapshotJson);
    const result = await importS10SnapshotToMyc(session.user.id, snapshot, {
      budgetCode: input.budgetCode,
      companyId: input.companyId,
    });

    revalidatePath("/dashboard");
    revalidatePath("/projects");
    revalidatePath(`/projects/${result.projectId}`);
    revalidatePath("/budgets");
    revalidatePath(`/budgets/${result.generalBudgetId}`);

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof ImportRequestError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    const billingResponse = createBillingErrorResponse(error);
    if (billingResponse) return billingResponse;

    console.error("S10 import POST failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo importar el snapshot S10." },
      { status: 400 },
    );
  }
}

function parseSnapshotOrThrow(snapshotJson: string) {
  try {
    return parseS10ExportSnapshotJson(snapshotJson);
  } catch (error) {
    const message = error instanceof Error ? error.message : "El snapshot S10 no es valido.";
    throw new ImportRequestError(message, 400);
  }
}

async function readImportRequestInput(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      throw new ImportRequestError("Adjunta un JSON exportado desde S10.", 400);
    }

    if (!file.name.toLowerCase().endsWith(".json")) {
      throw new ImportRequestError("El snapshot S10 debe ser un archivo .json.", 400);
    }

    if (file.size > maxSnapshotUploadBytes) {
      throw new ImportRequestError("El snapshot S10 supera el limite de 40 MB para importacion.", 413);
    }

    return {
      snapshotJson: await file.text(),
      budgetCode: readOptionalFormString(formData, "budgetCode"),
      companyId: readRequiredFormString(formData, "companyId"),
    };
  }

  const body: unknown = await request.json();
  if (!isRecord(body) || typeof body.snapshot !== "object" || body.snapshot == null) {
    throw new ImportRequestError("Envia un body JSON con la propiedad snapshot.", 400);
  }

  return {
    snapshotJson: JSON.stringify(body.snapshot),
    budgetCode: readOptionalRecordString(body, "budgetCode"),
    companyId: readRequiredRecordString(body, "companyId"),
  };
}

function readOptionalFormString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function readRequiredFormString(formData: FormData, key: string) {
  const value = readOptionalFormString(formData, key);
  if (!value) {
    throw new ImportRequestError("Selecciona la empresa donde se importara el proyecto S10.", 400);
  }

  return value;
}

function readOptionalRecordString(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function readRequiredRecordString(record: Record<string, unknown>, key: string) {
  const value = readOptionalRecordString(record, key);
  if (!value) {
    throw new ImportRequestError("Selecciona la empresa donde se importara el proyecto S10.", 400);
  }

  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

class ImportRequestError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}
