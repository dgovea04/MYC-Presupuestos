import { revalidatePath, revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { createBillingErrorResponse } from "@/lib/billing/api";
import { getAuthSession } from "@/lib/auth/session";
import { assertWorkspaceMembership } from "@/lib/workspace/access";
import { analyzeProjectPackageBuffer } from "@/lib/mcp/import-preview";
import { importProjectPackageToMyc } from "@/lib/mcp/import-persistence";

const maxMcpUploadBytes = 40 * 1024 * 1024;

export async function POST(request: Request) {
  const session = await getAuthSession();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const input = await readImportRequestInput(request);
    await assertWorkspaceMembership({ userId: session.user.id, companyId: input.companyId, minimumRole: "EDITOR" });

    // Analyze the file to get manifest and modules
    const analysis = analyzeProjectPackageBuffer(input.fileBuffer);

    if (analysis.preview.compatibility === "unsupported") {
      return NextResponse.json(
        { error: `El paquete .mcp no es compatible: ${analysis.preview.errors.join(", ")}` },
        { status: 400 },
      );
    }

    // Create a module reader from the analysis
    const readModule = (path: string): unknown => {
      const content = analysis.fileContents.get(path);
      if (!content) {
        throw new Error(`Modulo no encontrado en el paquete: ${path}`);
      }
      return JSON.parse(content);
    };

    const result = await importProjectPackageToMyc(
      session.user.id,
      analysis.manifest,
      readModule,
      {
        companyId: input.companyId,
        mode: "restore_as_new_project",
      },
    );

    revalidatePath("/dashboard");
    revalidateTag("dashboard-stats");
    revalidateTag("dashboard-analytics");
    revalidateTag("projects-list");
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

    console.error("MCP import POST failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo importar el proyecto .mcp." },
      { status: 400 },
    );
  }
}

async function readImportRequestInput(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      throw new ImportRequestError("Adjunta un archivo .mcp para importar.", 400);
    }

    if (!file.name.toLowerCase().endsWith(".mcp")) {
      throw new ImportRequestError("El archivo debe tener extension .mcp.", 400);
    }

    if (file.size > maxMcpUploadBytes) {
      throw new ImportRequestError("El archivo .mcp supera el limite de 40 MB para importacion.", 413);
    }

    const arrayBuffer = await file.arrayBuffer();

    return {
      fileBuffer: Buffer.from(arrayBuffer),
      companyId: readRequiredFormString(formData, "companyId"),
    };
  }

  throw new ImportRequestError("Usa multipart/form-data para subir el archivo .mcp.", 400);
}

function readOptionalFormString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function readRequiredFormString(formData: FormData, key: string) {
  const value = readOptionalFormString(formData, key);
  if (!value) {
    throw new ImportRequestError("Selecciona la empresa donde se importara el proyecto MCP.", 400);
  }

  return value;
}

class ImportRequestError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}
