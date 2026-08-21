import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAuthSession: vi.fn(),
  consumeRateLimit: vi.fn(),
  getRequestClientIp: vi.fn(),
  assertWorkspaceFeatureAccess: vi.fn(),
  requireWorkspaceRole: vi.fn(),
  createWorkspaceInviteLink: vi.fn(),
  listWorkspaceInviteLinks: vi.fn(),
  revokeWorkspaceInviteLink: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({ getAuthSession: mocks.getAuthSession }));
vi.mock("@/lib/auth/rate-limit", () => ({
  consumeRateLimit: mocks.consumeRateLimit,
  getRateLimitHeaders: vi.fn(() => ({ "Retry-After": "60" })),
  getRequestClientIp: mocks.getRequestClientIp,
}));
vi.mock("@/lib/workspace/entitlements", () => ({ assertWorkspaceFeatureAccess: mocks.assertWorkspaceFeatureAccess }));
vi.mock("@/lib/workspace/authorization", () => ({
  requireWorkspaceRole: mocks.requireWorkspaceRole,
  WorkspaceAuthorizationError: class WorkspaceAuthorizationError extends Error {},
}));
vi.mock("@/lib/workspace/invite-links", () => ({
  createWorkspaceInviteLink: mocks.createWorkspaceInviteLink,
  listWorkspaceInviteLinks: mocks.listWorkspaceInviteLinks,
  revokeWorkspaceInviteLink: mocks.revokeWorkspaceInviteLink,
}));

import { GET, POST, DELETE } from "@/app/api/workspaces/[id]/invite-links/route";

function post(body: unknown = {}) {
  return POST(
    new Request("http://localhost/api/workspaces/company-1/invite-links", { method: "POST", body: JSON.stringify(body) }),
    { params: Promise.resolve({ id: "company-1" }) },
  );
}

describe("workspace invite-links route", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.getRequestClientIp.mockReturnValue("127.0.0.1");
    mocks.consumeRateLimit.mockResolvedValue({ allowed: true, remaining: 9, retryAfterSeconds: 60 });
    mocks.getAuthSession.mockResolvedValue({ user: { id: "user-1" } });
    mocks.assertWorkspaceFeatureAccess.mockResolvedValue(undefined);
    mocks.requireWorkspaceRole.mockResolvedValue({ companyId: "company-1", userId: "user-1", role: "ADMIN" });
    mocks.createWorkspaceInviteLink.mockResolvedValue({ link: { id: "link-1" }, token: "raw-token" });
    mocks.listWorkspaceInviteLinks.mockResolvedValue([]);
    mocks.revokeWorkspaceInviteLink.mockResolvedValue({ ok: true });
  });

  it("rejects unauthenticated link creation", async () => {
    mocks.getAuthSession.mockResolvedValue(null);
    const response = await post();
    expect(response.status).toBe(401);
    expect(mocks.createWorkspaceInviteLink).not.toHaveBeenCalled();
  });

  it("enforces the link creation rate limit", async () => {
    mocks.consumeRateLimit.mockResolvedValue({ allowed: false, remaining: 0, retryAfterSeconds: 60 });

    const response = await post();

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("60");
    expect(mocks.createWorkspaceInviteLink).not.toHaveBeenCalled();
  });

  it("creates an invite link when authorized and under the rate limit", async () => {
    const response = await post({ role: "VIEWER", expiresInDays: 7 });

    expect(response.status).toBe(201);
    expect(mocks.consumeRateLimit).toHaveBeenCalledWith(
      expect.objectContaining({ key: "workspace-invite-links:create:user-1:127.0.0.1", maxAttempts: 10 }),
    );
    expect(mocks.createWorkspaceInviteLink).toHaveBeenCalledWith(
      expect.objectContaining({ companyId: "company-1", actorUserId: "user-1", role: "VIEWER", expiresInDays: 7 }),
    );
  });

  it("lists invite links", async () => {
    const response = await GET(
      new Request("http://localhost/api/workspaces/company-1/invite-links"),
      { params: Promise.resolve({ id: "company-1" }) },
    );
    expect(response.status).toBe(200);
    expect(mocks.listWorkspaceInviteLinks).toHaveBeenCalledWith("company-1");
  });

  it("revokes an invite link", async () => {
    const response = await DELETE(
      new Request("http://localhost/api/workspaces/company-1/invite-links", { method: "DELETE", body: JSON.stringify({ linkId: "link-1" }) }),
      { params: Promise.resolve({ id: "company-1" }) },
    );
    expect(response.status).toBe(200);
    expect(mocks.revokeWorkspaceInviteLink).toHaveBeenCalledWith({ companyId: "company-1", actorUserId: "user-1", linkId: "link-1" });
  });
});
