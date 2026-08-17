import { NextResponse } from "next/server";
import { requireSuperAdminSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { getLocalResourcePriceHistory } from "@/lib/local-resource-pricing/service";

export async function GET(request: Request, { params }: { params: Promise<{ resourceId: string }> }) {
  const session = await requireSuperAdminSession(request);
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { resourceId } = await params;
  const resource = await prisma.resource.findFirst({ where: { id: resourceId, companyId: null }, select: { id: true, code: true, description: true, unit: true, currency: true, unitPrice: true } });
  if (!resource) return NextResponse.json({ error: "Insumo global no encontrado." }, { status: 404 });
  return NextResponse.json({
    resource: { ...resource, unitPrice: resource.unitPrice.toString() },
    history: await getLocalResourcePriceHistory(resourceId),
  });
}
