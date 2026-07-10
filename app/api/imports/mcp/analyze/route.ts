import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth/session";
import { analyzeProjectPackageBuffer } from "@/lib/mcp/import-preview";

const maxMcpUploadBytes = 40 * 1024 * 1024;

export async function POST(request: Request) {
  const session = await getAuthSession();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return NextResponse.json({ error: "Adjunta un archivo .mcp para analizar." }, { status: 400 });
    }

    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Adjunta un archivo .mcp para analizar." }, { status: 400 });
    }

    if (!file.name.toLowerCase().endsWith(".mcp")) {
      return NextResponse.json({ error: "El archivo debe tener extension .mcp." }, { status: 400 });
    }

    if (file.size > maxMcpUploadBytes) {
      return NextResponse.json({ error: "El archivo .mcp supera el limite de 40 MB para analisis." }, { status: 413 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const result = analyzeProjectPackageBuffer(buffer);

    // Read all module file contents into a base64 map for later import
    const fileEntries: Record<string, string> = {};
    for (const [path, content] of result.fileContents) {
      fileEntries[path] = Buffer.from(content).toString("base64");
    }

    return NextResponse.json({
      ...result.preview,
      fileEntries,
    });
  } catch (error) {
    console.error("MCP analyze POST failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo analizar el archivo .mcp." },
      { status: 400 },
    );
  }
}
