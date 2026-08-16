import { NextResponse } from "next/server";
import { z } from "zod";
import { createBetaApplication, BetaApplicationConflictError } from "@/lib/beta/applications";
import { getRequestClientIp, consumeRateLimit, getRateLimitHeaders } from "@/lib/auth/rate-limit";
import { getAnalyticsRequestContext } from "@/lib/analytics/request-context";

const requestSchema = z.object({
  name: z.string(),
  email: z.string(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export async function POST(request: Request) {
  const ip = getRequestClientIp(request);
  const ipLimit = await consumeRateLimit({
    key: `beta-application:ip:${ip}`,
    maxAttempts: 5,
    windowMs: 60 * 60 * 1000,
  });

  if (!ipLimit.allowed) {
    return NextResponse.json(
      { error: "Demasiadas solicitudes. Intenta nuevamente más tarde." },
      { status: 429, headers: getRateLimitHeaders(ipLimit) },
    );
  }

  const body = await request.json().catch(() => null);
  const bodyResult = requestSchema.safeParse(body);
  if (!bodyResult.success) {
    return NextResponse.json({ error: "Ingresa un nombre y un correo válido." }, { status: 400 });
  }

  const emailResult = z.string().trim().email().safeParse(bodyResult.data.email);
  if (!emailResult.success) {
    return NextResponse.json({ error: "Ingresa un correo válido." }, { status: 400 });
  }
  const emailKey = emailResult.data.toLowerCase();
  const emailLimit = await consumeRateLimit({
    key: `beta-application:email:${emailKey}`,
    maxAttempts: 3,
    windowMs: 24 * 60 * 60 * 1000,
  });

  if (!emailLimit.allowed) {
    return NextResponse.json(
      { error: "Este correo alcanzó el límite de solicitudes por hoy." },
      { status: 429, headers: getRateLimitHeaders(emailLimit) },
    );
  }

  const analyticsContext = getAnalyticsRequestContext(request);
  const metadata = {
    ...(bodyResult.data.metadata ?? {}),
    ...analyticsContext.params,
    client_id: analyticsContext.clientId ?? undefined,
    landing_path: analyticsContext.params.landing_path ?? new URL(request.url).pathname,
  };

  try {
    const application = await createBetaApplication({
      name: bodyResult.data.name,
      email: bodyResult.data.email,
      metadata,
    });

    return NextResponse.json({ ok: true, applicationId: application.id }, { status: 201 });
  } catch (error) {
    if (error instanceof BetaApplicationConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? "Revisa los datos ingresados." }, { status: 400 });
    }

    return NextResponse.json({ error: "No se pudo registrar la solicitud. Intenta nuevamente." }, { status: 500 });
  }
}
