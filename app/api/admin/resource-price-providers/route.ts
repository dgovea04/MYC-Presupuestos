import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/auth/session";
import { listResourcePriceProviders } from "@/lib/resource-pricing/provider-registry";

export async function GET(request: Request) {
  const session = await requireAdminSession("resource_prices.manage", request);
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return NextResponse.json({ providers: await listResourcePriceProviders() });
}
