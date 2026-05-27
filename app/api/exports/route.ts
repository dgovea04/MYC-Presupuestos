import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth/session";
import { createCentralizedExport, createExportResponse } from "@/lib/exports/centralized";
import type { ExportRequest } from "@/lib/exports/definitions";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = await getAuthSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as ExportRequest;
    const result = await createCentralizedExport(body, session.user.id);
    return createExportResponse(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo generar la exportacion" },
      { status: 400 },
    );
  }
}
