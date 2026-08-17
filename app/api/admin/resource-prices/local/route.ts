import { NextResponse } from "next/server";
import { requireSuperAdminSession } from "@/lib/auth/session";
import { createLocalResourcePriceBatch, listLocalResourcePriceBatches } from "@/lib/local-resource-pricing/service";
import { localResourcePriceListQuerySchema, localResourcePriceManualInputSchema } from "@/lib/validations/local-resource-pricing";

export async function GET(request: Request) {
  const session = await requireSuperAdminSession(request);
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const url = new URL(request.url);
  const query = localResourcePriceListQuerySchema.parse({ status: url.searchParams.get("status") ?? undefined, limit: url.searchParams.get("limit") ?? undefined });
  return NextResponse.json({ batches: await listLocalResourcePriceBatches(query) });
}

export async function POST(request: Request) {
  const session = await requireSuperAdminSession(request);
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  try {
    const input = localResourcePriceManualInputSchema.parse(await request.json());
    const batch = await createLocalResourcePriceBatch({ actorUserId: session.user.id, source: "MANUAL", rows: input.rows, notes: input.notes });
    return NextResponse.json(batch, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo crear el preview local." }, { status: 400 });
  }
}
