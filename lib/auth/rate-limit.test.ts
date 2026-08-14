import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    $queryRaw: vi.fn(),
  },
}));

vi.mock("@/lib/db/prisma", () => ({ prisma: prismaMock }));

import {
  consumeRateLimit,
  getRateLimitHeaders,
  getRequestClientIp,
  hashRateLimitKey,
} from "@/lib/auth/rate-limit";

describe("security rate limiting", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("hashes bucket keys so emails and IPs are not stored in plain text", () => {
    const hash = hashRateLimitKey("password-reset:127.0.0.1");

    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hash).not.toContain("127.0.0.1");
  });

  it("allows attempts below the limit and exposes retry headers", async () => {
    prismaMock.$queryRaw.mockResolvedValueOnce([
      { attempts: 2, windowStartedAt: new Date(Date.now() - 1_000) },
    ]);

    const decision = await consumeRateLimit({ key: "mfa:admin-1", maxAttempts: 5, windowMs: 60_000 });

    expect(decision.allowed).toBe(true);
    expect(decision.remaining).toBe(3);
    expect(getRateLimitHeaders(decision)).toMatchObject({
      "X-RateLimit-Remaining": "3",
      "Cache-Control": "no-store",
    });
  });

  it("blocks attempts over the limit and returns a positive retry duration", async () => {
    prismaMock.$queryRaw.mockResolvedValueOnce([
      { attempts: 6, windowStartedAt: new Date() },
    ]);

    const decision = await consumeRateLimit({ key: "mfa:admin-1", maxAttempts: 5, windowMs: 60_000 });

    expect(decision.allowed).toBe(false);
    expect(decision.remaining).toBe(0);
    expect(decision.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("prefers a trusted real IP header and falls back to forwarded-for", () => {
    expect(getRequestClientIp(new Request("http://localhost", { headers: { "x-real-ip": "10.0.0.1", "x-forwarded-for": "10.0.0.2" } }))).toBe("10.0.0.1");
    expect(getRequestClientIp(new Request("http://localhost", { headers: { "x-forwarded-for": "10.0.0.2, 10.0.0.3" } }))).toBe("10.0.0.2");
  });
});
