import { NextResponse } from "next/server";
import { getBaseAuthSession } from "@/lib/auth/session";
import { ADMIN_SUPPORT_SESSION_COOKIE_NAME, getAdminSupportSessionFromRequest, verifyAdminSupportSession } from "@/lib/auth/admin-support-session";
import { getAdminSupportTarget, recordAdminSupportAudit } from "@/lib/data/admin-support";

export async function POST(request: Request) {
  const session = await getBaseAuthSession();
  const token = session?.user?.id ? verifyAdminSupportSession(getAdminSupportSessionFromRequest(request), session.user.id) : null;
  const response = NextResponse.json({ ok: true });
  response.cookies.set({ name: ADMIN_SUPPORT_SESSION_COOKIE_NAME, value: "", httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 0 });

  if (session?.user?.id && token) {
    const target = await getAdminSupportTarget(token.targetUserId);
    if (target) {
      await recordAdminSupportAudit({ actorUserId: session.user.id, targetUserId: target.id, targetEmail: target.email, action: "USER_SUPPORT_SESSION_STOPPED", context: getAdminActionContext(request) });
    }
  }

  return response;
}

function getAdminActionContext(request: Request) {
  return { ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? request.headers.get("x-real-ip"), userAgent: request.headers.get("user-agent") };
}
