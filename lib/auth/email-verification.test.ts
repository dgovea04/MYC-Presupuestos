import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  executeRawMock: vi.fn(),
  queryRawMock: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    $executeRaw: mocks.executeRawMock,
    $queryRaw: mocks.queryRawMock,
    $transaction: vi.fn(async (callback: (tx: { $executeRaw: typeof mocks.executeRawMock; $queryRaw: typeof mocks.queryRawMock }) => Promise<unknown>) =>
      callback({
        $executeRaw: mocks.executeRawMock,
        $queryRaw: mocks.queryRawMock,
      })),
  },
}));

import {
  buildEmailVerificationUrl,
  consumeEmailVerificationToken,
  hashEmailVerificationToken,
} from "@/lib/auth/email-verification";

describe("email verification helpers", () => {
  beforeEach(() => {
    mocks.executeRawMock.mockReset();
    mocks.queryRawMock.mockReset();
    vi.unstubAllEnvs();
  });

  it("hashes tokens deterministically", () => {
    expect(hashEmailVerificationToken("token-123")).toBe(hashEmailVerificationToken("token-123"));
    expect(hashEmailVerificationToken("token-123")).not.toBe("token-123");
  });

  it("builds a verification URL from NEXTAUTH_URL", () => {
    vi.stubEnv("NEXTAUTH_URL", "https://app.myc.test");

    expect(buildEmailVerificationUrl("token-123")).toBe(
      "https://app.myc.test/api/auth/verify-email?token=token-123",
    );
  });

  it("marks the user as verified when a valid token is consumed", async () => {
    mocks.queryRawMock.mockResolvedValueOnce([
      { userId: "user-1", expiresAt: new Date(Date.now() + 60_000), emailVerifiedAt: null },
    ]);

    const result = await consumeEmailVerificationToken("token-123");

    expect(result).toEqual({ status: "verified" });
    expect(mocks.executeRawMock).toHaveBeenCalledTimes(2);
  });

  it("returns expired when the token is no longer valid", async () => {
    mocks.queryRawMock.mockResolvedValueOnce([
      { userId: "user-1", expiresAt: new Date(Date.now() - 60_000), emailVerifiedAt: null },
    ]);

    const result = await consumeEmailVerificationToken("token-123");

    expect(result).toEqual({ status: "expired" });
  });
});
