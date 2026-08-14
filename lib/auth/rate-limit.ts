import { createHash, randomUUID } from "node:crypto";
import { prisma } from "@/lib/db/prisma";

export type RateLimitInput = {
  key: string;
  maxAttempts: number;
  windowMs: number;
};

export type RateLimitDecision = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

export async function consumeRateLimit(input: RateLimitInput, client: typeof prisma = prisma): Promise<RateLimitDecision> {
  const maxAttempts = Math.max(1, Math.trunc(input.maxAttempts));
  const windowMs = Math.max(1_000, Math.trunc(input.windowMs));
  const now = new Date();
  const windowStart = new Date(now.getTime() - windowMs);
  const bucketKey = hashRateLimitKey(input.key);
  const rows = await client.$queryRaw<Array<{ attempts: number; windowStartedAt: Date }>>`
    INSERT INTO "security_rate_limit_buckets" (
      "id", "bucketKey", "windowStartedAt", "attempts", "createdAt", "updatedAt"
    )
    VALUES (${randomUUID()}, ${bucketKey}, ${now}, 1, ${now}, ${now})
    ON CONFLICT ("bucketKey") DO UPDATE SET
      "attempts" = CASE
        WHEN "security_rate_limit_buckets"."windowStartedAt" < ${windowStart} THEN 1
        ELSE "security_rate_limit_buckets"."attempts" + 1
      END,
      "windowStartedAt" = CASE
        WHEN "security_rate_limit_buckets"."windowStartedAt" < ${windowStart} THEN ${now}
        ELSE "security_rate_limit_buckets"."windowStartedAt"
      END,
      "updatedAt" = ${now}
    RETURNING "attempts", "windowStartedAt"
  `;
  const bucket = rows[0];

  if (!bucket) {
    throw new Error("No se pudo evaluar el límite de seguridad.");
  }

  const retryAt = new Date(new Date(bucket.windowStartedAt).getTime() + windowMs);
  const retryAfterSeconds = Math.max(1, Math.ceil((retryAt.getTime() - now.getTime()) / 1000));

  return {
    allowed: bucket.attempts <= maxAttempts,
    remaining: Math.max(0, maxAttempts - bucket.attempts),
    retryAfterSeconds,
  };
}

export function hashRateLimitKey(key: string) {
  return createHash("sha256").update(key.trim()).digest("hex");
}

export function getRequestClientIp(request: Request) {
  return request.headers.get("x-real-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

export function getRateLimitHeaders(decision: RateLimitDecision) {
  return {
    "Retry-After": String(decision.retryAfterSeconds),
    "X-RateLimit-Limit": "security-policy",
    "X-RateLimit-Remaining": String(decision.remaining),
    "Cache-Control": "no-store",
  };
}
