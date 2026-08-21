import { describe, expect, it } from "vitest";
import { createWorkspaceInviteToken, hashWorkspaceInviteToken } from "@/lib/workspace/invite-links";
import { createWorkspaceInviteLinkSchema } from "@/lib/validations/workspace";

describe("workspace invite links", () => {
  it("creates a high entropy token and matching hash", () => {
    const result = createWorkspaceInviteToken();
    expect(result.token).toHaveLength(64);
    expect(result.tokenHash).toBe(hashWorkspaceInviteToken(result.token));
    expect(result.tokenHash).not.toContain(result.token);
  });

  it("applies safe defaults and rejects owner links", () => {
    expect(createWorkspaceInviteLinkSchema.parse({})).toMatchObject({ role: "VIEWER", expiresInDays: 7, maxUses: null });
    expect(() => createWorkspaceInviteLinkSchema.parse({ role: "OWNER" })).toThrow();
  });

  it("limits expiry and use count", () => {
    expect(() => createWorkspaceInviteLinkSchema.parse({ expiresInDays: 31 })).toThrow();
    expect(() => createWorkspaceInviteLinkSchema.parse({ maxUses: 1001 })).toThrow();
  });
});
