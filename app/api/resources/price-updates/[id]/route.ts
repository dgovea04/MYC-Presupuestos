import { NextResponse } from "next/server";
import { getAuthSession, requireAdminSession } from "@/lib/auth/session";
import { getResourcePriceUpdateRequest } from "@/lib/resource-pricing/requests";
import { serializeResourcePriceItem, serializeResourcePriceRequest } from "@/lib/resource-pricing/serialization";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAuthSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const admin = await requireAdminSession("resource_prices.manage");
  const request = await getResourcePriceUpdateRequest(id, session.user.id, Boolean(admin));
  if (!request) return NextResponse.json({ error: "Solicitud no encontrada." }, { status: 404 });
  return NextResponse.json({ request: serializeResourcePriceRequest(request), items: request.items.map(serializeResourcePriceItem) });
}
