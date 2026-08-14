import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { requireAdminSession } from "@/lib/auth/session";
import { notifyPrimaryAdminSecurityEvent } from "@/lib/auth/admin-security-alert";
import { consumeRateLimit, getRateLimitHeaders, getRequestClientIp } from "@/lib/auth/rate-limit";
import { ADMIN_MFA_COOKIE_NAME, disableAdminMfa } from "@/lib/auth/admin-mfa";

const codeSchema = z.object({ code: z.string().trim().min(6).max(20) });

export async function DELETE(request: Request) {
  const session = await requireAdminSession("security.manage");

  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const rateLimit = await consumeRateLimit({
    key: `admin-mfa-disable:${session.user.id}:${getRequestClientIp(request)}`,
    maxAttempts: 5,
    windowMs: 10 * 60 * 1000,
  });

  if (!rateLimit.allowed) {
    return NextResponse.json({ error: "Demasiados intentos MFA. Intenta nuevamente más tarde." }, { status: 429, headers: getRateLimitHeaders(rateLimit) });
  }

  try {
    const { code } = codeSchema.parse(await request.json());
    const disabled = await disableAdminMfa(session.user.id, code);

    if (!disabled) {
      return NextResponse.json({ error: "El código MFA no es válido." }, { status: 400 });
    }

    await notifyPrimaryAdminSecurityEvent({
      action: "MFA_DISABLED",
      actorEmail: session.user.email ?? session.user.id,
      detail: "Se desactivó MFA para el administrador principal.",
    });
    const response = NextResponse.json({ ok: true });
    response.cookies.delete(ADMIN_MFA_COOKIE_NAME);
    return response;
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: "Ingresa un código MFA válido." }, { status: 400 });
    }

    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo desactivar MFA." }, { status: 400 });
  }
}
