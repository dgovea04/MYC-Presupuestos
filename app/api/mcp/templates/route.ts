import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth/session";
import { storeProjectPackage, findExistingPackage } from "@/lib/data/stored-project-packages";

const MAX_TEMPLATE_SIZE = 40 * 1024 * 1024; // 40 MB

export async function POST(request: Request) {
  const session = await getAuthSession();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const contentType = request.headers.get("content-type") ?? "";

    if (!contentType.includes("multipart/form-data")) {
      return NextResponse.json(
        { error: "Usa multipart/form-data para subir el archivo .mcp" },
        { status: 400 },
      );
    }

    const formData = await request.formData();
    const file = formData.get("file");
    const companyId = formData.get("companyId");
    const projectType = formData.get("projectType");
    const overwrite = formData.get("overwrite") === "true";

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "Adjunta un archivo .mcp" },
        { status: 400 },
      );
    }

    if (!file.name.toLowerCase().endsWith(".mcp")) {
      return NextResponse.json(
        { error: "El archivo debe tener extensión .mcp" },
        { status: 400 },
      );
    }

    if (file.size > MAX_TEMPLATE_SIZE) {
      return NextResponse.json(
        { error: `El archivo supera el límite de ${MAX_TEMPLATE_SIZE / 1024 / 1024} MB` },
        { status: 413 },
      );
    }

    if (typeof companyId !== "string" || !companyId.trim()) {
      return NextResponse.json(
        { error: "Se requiere el ID de la empresa (companyId)" },
        { status: 400 },
      );
    }

    // Derivar nombre del proyecto desde el nombre del archivo
    const fileName = file.name.replace(/\.mcp$/i, "");
    const projectName = fileName
      .replace(/[-_]/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());

    const effectiveCompanyId = companyId.trim();
    const effectiveProjectType = typeof projectType === "string" ? projectType.trim() : "";

    // Verificar duplicado
    const existing = await findExistingPackage(effectiveCompanyId, projectName);

    if (existing && !overwrite) {
      return NextResponse.json(
        {
          error: "Ya existe una plantilla con el mismo nombre en esta empresa.",
          existing: {
            id: existing.id,
            projectName: existing.projectName,
            projectType: existing.projectType,
            createdAt: existing.createdAt,
          },
          hint: "Envía overwrite=true para sobrescribir la plantilla existente.",
        },
        { status: 409 },
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const content = Buffer.from(arrayBuffer);

    const stored = await storeProjectPackage({
      projectName,
      projectType: effectiveProjectType,
      description: `Plantilla cargada: ${projectName} (${effectiveProjectType || "Sin tipo"})`,
      content,
      companyId: effectiveCompanyId,
      userId: session.user.id,
    });

    return NextResponse.json(
      {
        id: stored.id,
        projectName: stored.projectName,
        projectType: stored.projectType,
        description: stored.description,
        createdAt: stored.createdAt,
        sizeBytes: content.length,
        updated: stored.updated,
      },
      { status: stored.updated ? 200 : 201 },
    );
  } catch (error) {
    console.error("MCP template upload failed", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No se pudo guardar la plantilla .mcp",
      },
      { status: 500 },
    );
  }
}
