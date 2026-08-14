import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { requireAdminSession } from "@/lib/auth/session";
import { consumeRateLimit, getRateLimitHeaders, getRequestClientIp } from "@/lib/auth/rate-limit";
import { ADMIN_MFA_COOKIE_MAX_AGE_SECONDS, ADMIN_MFA_COOKIE_NAME, createAdminMfaProof, verifyAdminMfaCode } from "@/lib/auth/admin-mfa";

const codeSchema = z.object({ code: z.string().trim().min(6).max(20) });

export async function POST(request: Request) {
  const session = await requireAdminSession("security.manage");

  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const rateLimit = await consumeRateLimit({
    key: `admin-mfa-verify:${session.user.id}:${getRequestClientIp(request)}`,
    maxAttempts: 5,
    windowMs: 5 * 60 * 1000,
  });

  if (!rateLimit.allowed) {
    return NextResponse.json({ error: "Demasiados intentos MFA. Intenta nuevamente más tarde." }, { status: 429, headers: getRateLimitHeaders(rateLimit) });
  }

  try {
    const { code } = codeSchema.parse(await request.json());
    const isValid = await verifyAdminMfaCode(session.user.id, code);

    if (!isValid) {
      return NextResponse.json({ error: "El código MFA no es válido." }, { status: 400 });
    }

    const response = NextResponse.json({ ok: true, expiresInSeconds: ADMIN_MFA_COOKIE_MAX_AGE_SECONDS });
    response.cookies.set({
      name: ADMIN_MFA_COOKIE_NAME,
      value: createAdminMfaProof(session.user.id),
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: ADMIN_MFA_COOKIE_MAX_AGE_SECONDS,
    });
    return response;
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: "Ingresa un código MFA válido." }, { status: 400 });
    }

    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo verificar MFA." }, { status: 400 });
  }
}
