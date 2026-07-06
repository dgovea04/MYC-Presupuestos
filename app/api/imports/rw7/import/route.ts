import { revalidatePath, revalidateTag } from "next/cache";
import { NextResponse } from "next/server";

import { getAuthSession } from "@/lib/auth/session";
import { createBillingErrorResponse } from "@/lib/billing/api";
import { parseRw7WorkbookToS10Snapshot } from "@/lib/rw7/excel-import";
import { importS10SnapshotToMyc } from "@/lib/s10/import-persistence";

const maxRw7UploadBytes = 80 * 1024 * 1024;

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
      return NextResponse.json({ error: "Adjunta un archivo Excel exportado desde RW7." }, { status: 400 });
    }

    if (!isExcelFileName(file.name)) {
      return NextResponse.json({ error: "El archivo RW7 debe ser .xlsx o .xlsm." }, { status: 400 });
    }

    if (file.size > maxRw7UploadBytes) {
      return NextResponse.json({ error: "El archivo RW7 supera el limite de 80 MB para importacion." }, { status: 413 });
    }

    const snapshot = await parseRw7WorkbookToS10Snapshot({
      buffer: Buffer.from(await file.arrayBuffer()),
      fileName: file.name,
    });
    const result = await importS10SnapshotToMyc(session.user.id, snapshot, {
      companyId,
      sourceSystem: "RW7",
    });

    revalidatePath("/dashboard");
    revalidateTag("dashboard-stats", "max");
    revalidateTag("dashboard-analytics", "max");
    revalidateTag("projects-list", "max");
    revalidatePath("/projects");
    revalidatePath(`/projects/${result.projectId}`);
    revalidatePath("/budgets");
    revalidatePath(`/budgets/${result.generalBudgetId}`);

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    const billingResponse = createBillingErrorResponse(error);
    if (billingResponse) return billingResponse;

    console.error("RW7 import POST failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo importar el archivo RW7." },
      { status: 400 },
    );
  }
}

function readRequiredFormString(formData: FormData, key: string) {
  const value = formData.get(key);
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }

  throw new Error("Selecciona la empresa donde se importara el proyecto RW7.");
}

function isExcelFileName(fileName: string) {
  const normalized = fileName.toLowerCase();
  return normalized.endsWith(".xlsx") || normalized.endsWith(".xlsm");
}
