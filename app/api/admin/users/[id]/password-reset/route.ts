import { NextResponse } from "next/server";
import { requireSuperAdminSession } from "@/lib/auth/session";
import { consumeRateLimit, getRateLimitHeaders, getRequestClientIp } from "@/lib/auth/rate-limit";
import { notifyPrimaryAdminSecurityEvent } from "@/lib/auth/admin-security-alert";
import { requestAdminPasswordReset } from "@/lib/data/admin-users";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSuperAdminSession(request);

  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const rateLimit = await consumeRateLimit({
    key: `admin-password-reset:${session.user.id}:${getRequestClientIp(request)}`,
    maxAttempts: 5,
    windowMs: 60 * 60 * 1000,
  });

  if (!rateLimit.allowed) {
    return NextResponse.json({ error: "Demasiadas solicitudes de recuperación. Intenta nuevamente más tarde." }, { status: 429, headers: getRateLimitHeaders(rateLimit) });
  }

  try {
    const { id } = await params;
    const result = await requestAdminPasswordReset(id, session.user.id, getAdminActionContext(request));
    await notifyPrimaryAdminSecurityEvent({
      action: "PASSWORD_RESET_REQUESTED",
      actorEmail: session.user.email ?? session.user.id,
      detail: `Se solicitó un enlace de cambio de contraseña para el usuario ${id}.`,
    });

    return NextResponse.json({ ok: true, expiresAt: result.expiresAt.toISOString() });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo enviar el enlace." }, { status: 400 });
  }
}

function getAdminActionContext(request: Request) {
  return {
    ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? request.headers.get("x-real-ip"),
    userAgent: request.headers.get("user-agent"),
  };
}
