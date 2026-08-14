import { createHmac, timingSafeEqual } from "node:crypto";

export const ADMIN_SUPPORT_SESSION_COOKIE_NAME = "myc-presupuestos.admin-support";
export const ADMIN_SUPPORT_SESSION_MAX_AGE_SECONDS = 15 * 60;

type SupportSessionPayload = {
  adminUserId: string;
  targetUserId: string;
  issuedAt: number;
  expiresAt: number;
};

export function createAdminSupportSession(adminUserId: string, targetUserId: string, now = Date.now()) {
  const payload: SupportSessionPayload = {
    adminUserId,
    targetUserId,
    issuedAt: now,
    expiresAt: now + ADMIN_SUPPORT_SESSION_MAX_AGE_SECONDS * 1000,
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${encodedPayload}.${sign(encodedPayload)}`;
}

export function getAdminSupportSessionFromRequest(request: Request) {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const cookie = cookieHeader.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${ADMIN_SUPPORT_SESSION_COOKIE_NAME}=`));
  return cookie ? decodeURIComponent(cookie.slice(ADMIN_SUPPORT_SESSION_COOKIE_NAME.length + 1)) : null;
}

export function verifyAdminSupportSession(token: string | null, adminUserId: string, now = Date.now()) {
  if (!token) return null;

  const [encodedPayload, encodedSignature] = token.split(".");
  if (!encodedPayload || !encodedSignature) return null;

  const expectedSignature = sign(encodedPayload);
  const actualBuffer = Buffer.from(encodedSignature, "base64url");
  const expectedBuffer = Buffer.from(expectedSignature, "base64url");

  if (actualBuffer.length !== expectedBuffer.length || !timingSafeEqual(actualBuffer, expectedBuffer)) return null;

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as SupportSessionPayload;
    if (
      payload.adminUserId !== adminUserId ||
      !payload.targetUserId ||
      !Number.isFinite(payload.issuedAt) ||
      !Number.isFinite(payload.expiresAt) ||
      now < payload.issuedAt ||
      now > payload.expiresAt
    ) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

function sign(value: string) {
  const secret = process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET ?? "myc-presupuestos-dev-auth-secret";
  return createHmac("sha256", secret).update(value).digest("base64url");
}
