import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth/session";
import { assertCanRequestResourcePriceUpdate, assertGlobalResourceIds } from "@/lib/resource-pricing/authorization";
import { createResourcePriceUpdateRequest } from "@/lib/resource-pricing/requests";
import { serializeResourcePriceRequest } from "@/lib/resource-pricing/serialization";
import { resourcePriceUpdateRequestSchema } from "@/lib/validations/resource-pricing";
import { prisma } from "@/lib/db/prisma";
import { consumeRateLimit, getRateLimitHeaders } from "@/lib/auth/rate-limit";
import { ResourcePriceIdempotencyConflictError } from "@/lib/resource-pricing/requests";

export async function POST(request: Request) {
  const session = await getAuthSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const rateLimit = await consumeRateLimit({
      key: `resource-price-request:${session.user.id}`,
      maxAttempts: 10,
      windowMs: 15 * 60 * 1000,
    });
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Has alcanzado el límite temporal de solicitudes de precios." },
        { status: 429, headers: getRateLimitHeaders(rateLimit) },
      );
    }

    await assertCanRequestResourcePriceUpdate(session.user.id);
    const body = resourcePriceUpdateRequestSchema.parse(await request.json());
    await assertGlobalResourceIds(body.resourceIds ?? []);
    const result = await createResourcePriceUpdateRequest(session.user.id, body);
    return NextResponse.json(result, { status: result.reused ? 200 : 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo crear la solicitud de precios.";
    const status = error instanceof ResourcePriceIdempotencyConflictError
      ? 409
      : message.includes("deshabilitado") || message.includes("no está configurado")
        ? 503
        : message.includes("administrador")
          ? 403
          : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function GET() {
  const session = await getAuthSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const requests = await prisma.resourcePriceUpdateRequest.findMany({
    where: { requestedById: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  return NextResponse.json({ requests: requests.map(serializeResourcePriceRequest) });
}
