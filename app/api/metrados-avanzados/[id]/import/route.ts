import { NextResponse } from "next/server";
import { z } from "zod";

import { getAuthSession } from "@/lib/auth/session";
import { getMetradoSheetById } from "@/lib/data/metrados";
import { normalizeMetradoImportRows } from "@/lib/metrados/excel-import";

const importBodySchema = z.object({
  rows: z.array(z.record(z.string(), z.unknown())),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAuthSession();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const sheet = await getMetradoSheetById(id, session.user.id);

    if (!sheet) {
      return NextResponse.json({ error: "Metrado no encontrado" }, { status: 404 });
    }

    const body = importBodySchema.parse(await request.json());
    const result = normalizeMetradoImportRows(body.rows);

    return NextResponse.json({
      sheetId: id,
      rows: result.rows,
      issues: result.issues,
    });
  } catch (error) {
    if (error instanceof z.ZodError || error instanceof SyntaxError) {
      return NextResponse.json({ error: "Revisa las filas importadas." }, { status: 400 });
    }

    console.error("Metrado import POST failed", error);
    return NextResponse.json({ error: "No se pudo importar el metrado." }, { status: 500 });
  }
}
