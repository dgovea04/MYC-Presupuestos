import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { decimalToString } from "@/lib/db/serializers";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAuthSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const resource = await prisma.resource.findFirst({ where: { id, companyId: null }, select: { id: true, unitPrice: true, currency: true, unit: true, priceUpdatedAt: true, priceObservedAt: true, priceSource: true, priceSyncStatus: true } });
  if (!resource) return NextResponse.json({ error: "Insumo global no encontrado." }, { status: 404 });
  return NextResponse.json({ ...resource, unitPrice: decimalToString(resource.unitPrice), priceUpdatedAt: resource.priceUpdatedAt?.toISOString() ?? null, priceObservedAt: resource.priceObservedAt?.toISOString() ?? null });
}
