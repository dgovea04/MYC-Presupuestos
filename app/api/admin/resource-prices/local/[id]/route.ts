import { NextResponse } from "next/server";
import { requireSuperAdminSession } from "@/lib/auth/session";
import { getLocalResourcePriceBatch } from "@/lib/local-resource-pricing/service";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSuperAdminSession(request);
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  const batch = await getLocalResourcePriceBatch(id);
  if (!batch) return NextResponse.json({ error: "Lote no encontrado." }, { status: 404 });
  return NextResponse.json(batch);
}
