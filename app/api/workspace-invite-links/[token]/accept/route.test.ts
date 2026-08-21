import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAuthSession: vi.fn(),
  consumeRateLimit: vi.fn(),
  getRequestClientIp: vi.fn(),
  acceptWorkspaceInviteLink: vi.fn(),
  revalidateTag: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({ getAuthSession: mocks.getAuthSession }));
vi.mock("@/lib/auth/rate-limit", () => ({
  consumeRateLimit: mocks.consumeRateLimit,
  getRateLimitHeaders: vi.fn(() => ({ "Retry-After": "60" })),
  getRequestClientIp: mocks.getRequestClientIp,
}));
vi.mock("@/lib/workspace/invite-links", () => ({
  acceptWorkspaceInviteLink: mocks.acceptWorkspaceInviteLink,
}));
vi.mock("@/lib/workspace/seats", () => ({
  WorkspaceSeatLimitError: class WorkspaceSeatLimitError extends Error {},
}));
vi.mock("@/lib/workspace/active-workspace", () => ({
  WORKSPACE_LIST_CACHE_TAG: "workspace-list",
}));
vi.mock("next/cache", () => ({ revalidateTag: mocks.revalidateTag }));

import { POST } from "@/app/api/workspace-invite-links/[token]/accept/route";

function post() {
  return POST(
    new Request("http://localhost/api/workspace-invite-links/raw-token/accept", { method: "POST" }),
    { params: Promise.resolve({ token: "raw-token" }) },
  );
}

describe("workspace invite-link accept route", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.getRequestClientIp.mockReturnValue("127.0.0.1");
    mocks.consumeRateLimit.mockResolvedValue({ allowed: true, remaining: 9, retryAfterSeconds: 60 });
    mocks.getAuthSession.mockResolvedValue({ user: { id: "user-1" } });
    mocks.acceptWorkspaceInviteLink.mockResolvedValue({ workspace: { id: "company-1" }, role: "VIEWER", alreadyMember: false });
  });

  it("requires a session to accept an invitation", async () => {
    mocks.getAuthSession.mockResolvedValue(null);
    const response = await post();
    expect(response.status).toBe(401);
    expect(mocks.acceptWorkspaceInviteLink).not.toHaveBeenCalled();
  });

  it("enforces the accept rate limit", async () => {
    mocks.consumeRateLimit.mockResolvedValue({ allowed: false, remaining: 0, retryAfterSeconds: 60 });

    const response = await post();

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("60");
    expect(mocks.acceptWorkspaceInviteLink).not.toHaveBeenCalled();
  });

  it("accepts an invitation and revalidates the workspace list", async () => {
    const response = await post();

    expect(response.status).toBe(200);
    expect(mocks.consumeRateLimit).toHaveBeenCalledWith(
      expect.objectContaining({ key: "workspace-invite-links:accept:user-1:127.0.0.1", maxAttempts: 10 }),
    );
    expect(mocks.acceptWorkspaceInviteLink).toHaveBeenCalledWith({ token: "raw-token", userId: "user-1" });
    expect(mocks.revalidateTag).toHaveBeenCalledWith("workspace-list-user-1", "max");
  });

  it("returns 409 when the workspace seat limit is reached", async () => {
    const { WorkspaceSeatLimitError } = await import("@/lib/workspace/seats");
    mocks.acceptWorkspaceInviteLink.mockRejectedValue(new WorkspaceSeatLimitError("Sin asientos"));

    const response = await post();

    expect(response.status).toBe(409);
  });
});
