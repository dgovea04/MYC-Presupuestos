import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/auth/session";
import { getPublicPrimaryResourcePriceProviderConfig, updatePrimaryResourcePriceProviderConfig } from "@/lib/resource-pricing/admin-config";
import { resourcePriceProviderConfigSchema } from "@/lib/validations/resource-pricing";

export async function GET(request: Request) {
  const session = await requireAdminSession("resource_prices.manage", request);
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return NextResponse.json(await getPublicPrimaryResourcePriceProviderConfig());
}

export async function PUT(request: Request) {
  const session = await requireAdminSession("resource_prices.manage", request);
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  try {
    const input = resourcePriceProviderConfigSchema.parse(await request.json());
    return NextResponse.json(await updatePrimaryResourcePriceProviderConfig(input, session.user.id));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo guardar la configuración." }, { status: 400 });
  }
}
