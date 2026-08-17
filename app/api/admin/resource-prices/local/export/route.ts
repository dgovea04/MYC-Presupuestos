import { NextResponse } from "next/server";
import { requireSuperAdminSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { createGlobalResourcePriceExport } from "@/lib/local-resource-pricing/workbook";

export async function GET(request: Request) {
  const session = await requireSuperAdminSession(request);
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const resources = await prisma.resource.findMany({
    where: { companyId: null },
    orderBy: [{ category: "asc" }, { description: "asc" }],
    select: {
      id: true,
      code: true,
      description: true,
      unit: true,
      currency: true,
      unitPrice: true,
      priceObservedAt: true,
      priceSource: true,
      source: true,
    },
  });
  const buffer = await createGlobalResourcePriceExport(resources.map((resource) => ({ ...resource, unitPrice: resource.unitPrice.toString() })));
  const date = new Date().toISOString().slice(0, 10);

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="catalogo-precios-global-${date}.xlsx"`,
      "Cache-Control": "private, no-store",
    },
  });
}
