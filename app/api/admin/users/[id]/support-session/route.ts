import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/auth/session";
import { ADMIN_SUPPORT_SESSION_COOKIE_NAME, ADMIN_SUPPORT_SESSION_MAX_AGE_SECONDS, createAdminSupportSession } from "@/lib/auth/admin-support-session";
import { consumeRateLimit, getRequestClientIp } from "@/lib/auth/rate-limit";
import { getAdminSupportTarget, recordAdminSupportAudit } from "@/lib/data/admin-support";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdminSession("users.impersonate");

  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const rateLimit = await consumeRateLimit({
    key: `admin-support-session:${session.user.id}:${getRequestClientIp(request)}`,
    maxAttempts: 5,
    windowMs: 60 * 60 * 1000,
  });
  if (!rateLimit.allowed) return NextResponse.json({ error: "Demasiadas sesiones de soporte. Intenta más tarde." }, { status: 429 });

  try {
    const { id } = await params;
    const target = await getAdminSupportTarget(id);
    if (!target) return NextResponse.json({ error: "Solo se puede abrir soporte para usuarios normales activos." }, { status: 400 });

    await recordAdminSupportAudit({ actorUserId: session.user.id, targetUserId: target.id, targetEmail: target.email, action: "USER_SUPPORT_SESSION_STARTED", context: getAdminActionContext(request) });
    const response = NextResponse.json({ ok: true, redirectTo: `/admin/support/${target.id}` });
    response.cookies.set({ name: ADMIN_SUPPORT_SESSION_COOKIE_NAME, value: createAdminSupportSession(session.user.id, target.id), httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: ADMIN_SUPPORT_SESSION_MAX_AGE_SECONDS });
    return response;
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo iniciar la sesión de soporte." }, { status: 400 });
  }
}

function getAdminActionContext(request: Request) {
  return { ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? request.headers.get("x-real-ip"), userAgent: request.headers.get("user-agent") };
}
