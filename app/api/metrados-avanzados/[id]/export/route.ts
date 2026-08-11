import { NextResponse } from "next/server";

import { getAuthSession } from "@/lib/auth/session";
import { getMetradoSheetById } from "@/lib/data/metrados";
import { createMetradoWorkbook } from "@/lib/metrados/excel-export";
import { getFeatureAccessResponse } from "@/lib/billing/route-access";

const excelContentType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAuthSession();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const accessResponse = await getFeatureAccessResponse(session.user.id, "metrados.advanced");
  if (accessResponse) return accessResponse;

  const { id } = await params;
  const sheet = await getMetradoSheetById(id, session.user.id);

  if (!sheet) {
    return NextResponse.json({ error: "Metrado no encontrado" }, { status: 404 });
  }

  const file = await createMetradoWorkbook(sheet);
  const filename = buildFilename(sheet.name, sheet.id);

  return new NextResponse(file, {
    headers: {
      "Content-Type": excelContentType,
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

function buildFilename(sheetName: string, sheetId: string): string {
  const normalized = sheetName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80);

  return `metrado-${normalized || sheetId}.xlsx`;
}
