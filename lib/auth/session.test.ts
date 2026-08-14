import { describe, expect, it, vi } from "vitest";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth/options", () => ({ authOptions: {} }));

import { getServerSession } from "next-auth";
import { createAdminMfaProof } from "@/lib/auth/admin-mfa";
import { requireAdminSession } from "@/lib/auth/session";

const mockedGetServerSession = vi.mocked(getServerSession);

function makeSession(overrides?: { isSuperAdmin?: boolean; mfaEnabled?: boolean }) {
  return {
    expires: "2026-12-31T00:00:00.000Z",
    user: {
      id: "admin-1",
      email: "admin@example.com",
      role: "ADMIN" as const,
      status: "ACTIVE" as const,
      isSuperAdmin: overrides?.isSuperAdmin ?? false,
      mfaEnabled: overrides?.mfaEnabled ?? false,
    },
  };
}

describe("admin session capabilities", () => {
  it("allows operational admin actions without MFA", async () => {
    const session = makeSession();
    mockedGetServerSession.mockResolvedValue(session);

    await expect(requireAdminSession("users.manage_access")).resolves.toEqual(session);
  });

  it("blocks critical actions until the primary administrator has MFA enabled and verified", async () => {
    mockedGetServerSession.mockResolvedValue(makeSession({ isSuperAdmin: true, mfaEnabled: false }));
    await expect(requireAdminSession("users.delete_permanently", new Request("http://localhost"))).resolves.toBeNull();

    mockedGetServerSession.mockResolvedValue(makeSession({ isSuperAdmin: true, mfaEnabled: true }));
    await expect(requireAdminSession("users.delete_permanently", new Request("http://localhost"))).resolves.toBeNull();
  });

  it("accepts a recent proof for a critical action", async () => {
    const session = makeSession({ isSuperAdmin: true, mfaEnabled: true });
    mockedGetServerSession.mockResolvedValue(session);
    const proof = createAdminMfaProof("admin-1");

    const request = new Request("http://localhost", {
      headers: { cookie: `myc-presupuestos.admin-mfa=${encodeURIComponent(proof)}` },
    });

    await expect(requireAdminSession("users.delete_permanently", request)).resolves.toEqual(session);
  });
});
