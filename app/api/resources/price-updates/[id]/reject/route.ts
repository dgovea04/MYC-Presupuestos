import { NextResponse } from "next/server";
import { getAuthSession, requireAdminSession } from "@/lib/auth/session";
import { rejectResourcePriceUpdate } from "@/lib/resource-pricing/requests";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAuthSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const admin = await requireAdminSession("resource_prices.manage");
  try {
    const result = await rejectResourcePriceUpdate(id, session.user.id, Boolean(admin));
    return NextResponse.json({ ok: true, request: result });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo rechazar la solicitud." }, { status: 400 });
  }
}
