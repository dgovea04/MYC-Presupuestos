import { beforeEach, describe, expect, it, vi } from "vitest";

const executeRawMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    $executeRaw: executeRawMock,
  },
}));

import { revokeUserSessions } from "@/lib/auth/session-revocation";

describe("session revocation", () => {
  beforeEach(() => {
    executeRawMock.mockReset();
  });

  it("increments the persistent session version", async () => {
    executeRawMock.mockResolvedValue(1);

    await expect(revokeUserSessions("user-1")).resolves.toBeUndefined();
    expect(executeRawMock).toHaveBeenCalledOnce();
  });

  it("reports when the user does not exist", async () => {
    executeRawMock.mockResolvedValue(0);

    await expect(revokeUserSessions("missing-user")).rejects.toThrow("Usuario no encontrado.");
  });
});
