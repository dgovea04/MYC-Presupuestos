import { describe, expect, it } from "vitest";
import { createAdminSupportSession, verifyAdminSupportSession } from "@/lib/auth/admin-support-session";

describe("admin support sessions", () => {
  it("binds a short-lived token to the administrator and target user", () => {
    const issuedAt = 1_700_000_000_000;
    const token = createAdminSupportSession("admin-1", "user-1", issuedAt);

    expect(verifyAdminSupportSession(token, "admin-1", issuedAt + 5 * 60 * 1000)).toMatchObject({
      adminUserId: "admin-1",
      targetUserId: "user-1",
    });
    expect(verifyAdminSupportSession(token, "other-admin", issuedAt + 5 * 60 * 1000)).toBeNull();
    expect(verifyAdminSupportSession(token, "admin-1", issuedAt + 16 * 60 * 1000)).toBeNull();
  });

  it("rejects tampered tokens", () => {
    const token = createAdminSupportSession("admin-1", "user-1", 1_700_000_000_000);
    const tampered = `${token.slice(0, -1)}x`;

    expect(verifyAdminSupportSession(tampered, "admin-1", 1_700_000_000_000)).toBeNull();
  });
});
