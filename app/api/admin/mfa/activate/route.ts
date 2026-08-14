import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { requireAdminSession } from "@/lib/auth/session";
import { notifyPrimaryAdminSecurityEvent } from "@/lib/auth/admin-security-alert";
import { consumeRateLimit, getRateLimitHeaders, getRequestClientIp } from "@/lib/auth/rate-limit";
import { activateAdminMfa, createAdminMfaProof, ADMIN_MFA_COOKIE_MAX_AGE_SECONDS, ADMIN_MFA_COOKIE_NAME } from "@/lib/auth/admin-mfa";

const codeSchema = z.object({ code: z.string().trim().min(6).max(12) });

export async function POST(request: Request) {
  const session = await requireAdminSession("security.manage");

  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const rateLimit = await consumeRateLimit({
    key: `admin-mfa-activate:${session.user.id}:${getRequestClientIp(request)}`,
    maxAttempts: 5,
    windowMs: 10 * 60 * 1000,
  });

  if (!rateLimit.allowed) {
    return NextResponse.json({ error: "Demasiados intentos MFA. Intenta nuevamente más tarde." }, { status: 429, headers: getRateLimitHeaders(rateLimit) });
  }

  try {
    const { code } = codeSchema.parse(await request.json());
    const result = await activateAdminMfa(session.user.id, code);

    if (result.status === "invalid") {
      return NextResponse.json({ error: "El código MFA no es válido." }, { status: 400 });
    }

    await notifyPrimaryAdminSecurityEvent({
      action: "MFA_ENABLED",
      actorEmail: session.user.email ?? session.user.id,
      detail: "Se activó MFA para el administrador principal.",
    });
    const response = NextResponse.json({ ok: true, recoveryCodes: result.recoveryCodes });
    setMfaCookie(response, session.user.id);
    return response;
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: "Ingresa el código de seis dígitos de tu aplicación autenticadora." }, { status: 400 });
    }

    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo activar MFA." }, { status: 400 });
  }
}

function setMfaCookie(response: NextResponse, userId: string) {
  response.cookies.set({
    name: ADMIN_MFA_COOKIE_NAME,
    value: createAdminMfaProof(userId),
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: ADMIN_MFA_COOKIE_MAX_AGE_SECONDS,
  });
}
