import { NextResponse } from "next/server";
import { requireSuperAdminSession } from "@/lib/auth/session";
import { parseLocalResourcePriceWorkbook } from "@/lib/local-resource-pricing/parser";
import { createLocalResourcePriceBatch } from "@/lib/local-resource-pricing/service";

const MAX_FILE_BYTES = 10 * 1024 * 1024;

export async function POST(request: Request) {
  const session = await requireSuperAdminSession(request);
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  try {
    const formData = await request.formData();
    const entry = formData.get("file");
    if (!(entry instanceof File)) return NextResponse.json({ error: "Adjunta un archivo .xlsx." }, { status: 400 });
    if (entry.size === 0 || entry.size > MAX_FILE_BYTES) return NextResponse.json({ error: "El archivo debe pesar entre 1 byte y 10 MB." }, { status: 400 });
    if (!entry.name.toLowerCase().endsWith(".xlsx")) return NextResponse.json({ error: "Solo se admite Excel .xlsx en esta fase." }, { status: 400 });
    const parsed = await parseLocalResourcePriceWorkbook(await entry.arrayBuffer());
    const batch = await createLocalResourcePriceBatch({ actorUserId: session.user.id, source: "EXCEL", rows: parsed.rows, fileName: entry.name, fileHash: parsed.fileHash, notes: `Hoja importada: ${parsed.worksheetName}` });
    return NextResponse.json(batch, { status: "reused" in batch && batch.reused ? 200 : 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo importar el Excel." }, { status: 400 });
  }
}
