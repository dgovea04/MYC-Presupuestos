import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/auth/session";
import { getPrimaryResourcePriceProviderConfig, recordPrimaryProviderHealth } from "@/lib/resource-pricing/admin-config";
import { createResourcePriceProvider } from "@/lib/resource-pricing/provider-registry";

export async function POST(request: Request, { params }: { params: Promise<{ provider: string }> }) {
  const session = await requireAdminSession("resource_prices.manage", request);
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { provider } = await params;
  const config = await getPrimaryResourcePriceProviderConfig();
  if (config.provider !== provider) return NextResponse.json({ error: "El proveedor solicitado no es el principal configurado." }, { status: 400 });
  const health = await createResourcePriceProvider(config).healthCheck();
  await recordPrimaryProviderHealth(health);
  return NextResponse.json(health, { status: health.ok ? 200 : 503 });
}
