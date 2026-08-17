import { NextResponse } from "next/server";
import { requireSuperAdminSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

export async function GET(request: Request) {
  const session = await requireSuperAdminSession(request);
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const url = new URL(request.url);
  const query = url.searchParams.get("q")?.trim() ?? "";
  const resources = await prisma.resource.findMany({
    where: {
      companyId: null,
      ...(query ? { OR: [{ code: { contains: query, mode: "insensitive" } }, { description: { contains: query, mode: "insensitive" } }] } : {}),
    },
    orderBy: [{ category: "asc" }, { description: "asc" }],
    take: 500,
    select: { id: true, code: true, description: true, unit: true, currency: true, unitPrice: true, priceUpdatedAt: true, priceSource: true },
  });
  return NextResponse.json({ resources: resources.map((resource) => ({ ...resource, unitPrice: resource.unitPrice.toString(), priceUpdatedAt: resource.priceUpdatedAt?.toISOString() ?? null })) });
}
