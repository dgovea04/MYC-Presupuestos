import { NextResponse } from "next/server";
import { requireSuperAdminSession } from "@/lib/auth/session";
import { createLocalResourcePriceTemplate } from "@/lib/local-resource-pricing/workbook";

export async function GET(request: Request) {
  const session = await requireSuperAdminSession(request);
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const buffer = await createLocalResourcePriceTemplate();
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": "attachment; filename=\"plantilla-precios-insumos.xlsx\"",
      "Cache-Control": "private, no-store",
    },
  });
}
