import { NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/auth/cron-auth";
import { prisma } from "@/lib/db/prisma";
import { getPrimaryResourcePriceProviderConfig } from "@/lib/resource-pricing/admin-config";
import { createResourcePriceUpdateRequest } from "@/lib/resource-pricing/requests";

export async function GET(request: Request) {
  const authorization = isAuthorizedCronRequest(request);
  if (!authorization.configured) return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  if (!authorization.authorized) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const config = await getPrimaryResourcePriceProviderConfig();
  if (config.status === "DISABLED" || config.status === "SUSPENDED") {
    return NextResponse.json({ skipped: true, reason: "Proveedor deshabilitado" });
  }

  const staleBefore = new Date(Date.now() - config.defaultTtlHours * 60 * 60 * 1000);
  const resources = await prisma.resource.findMany({
    where: { companyId: null, OR: [{ priceObservedAt: null }, { priceObservedAt: { lt: staleBefore } }] },
    select: { id: true },
    take: Math.min(config.maxBatchSize * 20, 1000),
  });
  if (resources.length === 0) return NextResponse.json({ queued: 0, staleBefore: staleBefore.toISOString() });

  try {
    const result = await createResourcePriceUpdateRequest(null, { resourceIds: resources.map((resource) => resource.id), mode: "SCHEDULED", idempotencyKey: `cron:${new Date().toISOString().slice(0, 10)}` });
    return NextResponse.json({ queued: resources.length, requestId: result.request.id, status: result.request.status });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo sincronizar el catálogo." }, { status: 503 });
  }
}
