import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  executeRaw: vi.fn(),
  queryRaw: vi.fn(),
  transaction: vi.fn(),
  hashPassword: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    $executeRaw: mocks.executeRaw,
    $queryRaw: mocks.queryRaw,
    $transaction: mocks.transaction,
  },
}));

vi.mock("@/lib/auth/password", () => ({
  hashPassword: mocks.hashPassword,
}));

import {
  buildPasswordResetUrl,
  consumePasswordResetToken,
  hashPasswordResetToken,
} from "@/lib/auth/password-reset";

describe("password reset helpers", () => {
  beforeEach(() => {
    mocks.executeRaw.mockReset();
    mocks.queryRaw.mockReset();
    mocks.transaction.mockReset();
    mocks.hashPassword.mockReset();
    vi.unstubAllEnvs();
  });

  it("hashes reset tokens and builds the app URL", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://app.myc.test/");

    expect(hashPasswordResetToken("token-123")).not.toBe("token-123");
    expect(buildPasswordResetUrl("token-123")).toBe("https://app.myc.test/reset-password?token=token-123");
  });

  it("does not update a password when the token is invalid", async () => {
    mocks.hashPassword.mockResolvedValue("hashed-password");
    mocks.transaction.mockImplementation(async (callback: (tx: { $queryRaw: typeof mocks.queryRaw; $executeRaw: typeof mocks.executeRaw }) => Promise<unknown>) =>
      callback({ $queryRaw: mocks.queryRaw, $executeRaw: mocks.executeRaw }),
    );
    mocks.queryRaw.mockResolvedValue([]);

    await expect(consumePasswordResetToken("invalid-token", "new-password")).resolves.toEqual({ status: "invalid" });
    expect(mocks.executeRaw).not.toHaveBeenCalled();
  });

  it("consumes a valid token and updates the password", async () => {
    mocks.hashPassword.mockResolvedValue("hashed-password");
    mocks.transaction.mockImplementation(async (callback: (tx: { $queryRaw: typeof mocks.queryRaw; $executeRaw: typeof mocks.executeRaw }) => Promise<unknown>) =>
      callback({ $queryRaw: mocks.queryRaw, $executeRaw: mocks.executeRaw }),
    );
    mocks.queryRaw.mockResolvedValue([{ userId: "user-1" }]);

    await expect(consumePasswordResetToken("valid-token", "new-password")).resolves.toEqual({ status: "updated" });
    expect(mocks.executeRaw).toHaveBeenCalledOnce();
  });
});
