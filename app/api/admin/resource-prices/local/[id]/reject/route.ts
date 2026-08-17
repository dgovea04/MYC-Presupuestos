import { NextResponse } from "next/server";
import { requireSuperAdminSession } from "@/lib/auth/session";
import { rejectLocalResourcePriceBatch } from "@/lib/local-resource-pricing/service";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSuperAdminSession(request);
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  try {
    const { id } = await params;
    return NextResponse.json({ batch: await rejectLocalResourcePriceBatch({ batchId: id, actorUserId: session.user.id }) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo rechazar el lote." }, { status: 400 });
  }
}
