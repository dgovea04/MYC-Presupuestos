import { NextResponse } from "next/server";
import { getAuthSession, requireAdminSession } from "@/lib/auth/session";
import { listResourcePriceUpdateItems } from "@/lib/resource-pricing/requests";
import { resourcePriceUpdateItemsQuerySchema } from "@/lib/validations/resource-pricing";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAuthSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const query = resourcePriceUpdateItemsQuerySchema.parse(Object.fromEntries(new URL(request.url).searchParams.entries()));
  const admin = await requireAdminSession("resource_prices.manage");
  const result = await listResourcePriceUpdateItems(id, session.user.id, Boolean(admin), query.limit, query.cursor, query.status);
  if (!result) return NextResponse.json({ error: "Solicitud no encontrada." }, { status: 404 });
  return NextResponse.json(result);
}
