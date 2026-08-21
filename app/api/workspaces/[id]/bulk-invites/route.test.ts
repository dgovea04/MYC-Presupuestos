import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/session", () => ({ getAuthSession: vi.fn() }));
vi.mock("@/lib/workspace/entitlements", () => ({ assertWorkspaceFeatureAccess: vi.fn() }));
vi.mock("@/lib/workspace/authorization", () => ({
  WorkspaceAuthorizationError: class WorkspaceAuthorizationError extends Error {},
}));
vi.mock("@/lib/workspace/seats", () => ({
  WorkspaceSeatLimitError: class WorkspaceSeatLimitError extends Error {
    readonly code = "WORKSPACE_SEAT_LIMIT_REACHED";
  },
}));
vi.mock("@/lib/workspace/invitations", () => ({ bulkInviteWorkspaceMembers: vi.fn() }));

import { POST } from "@/app/api/workspaces/[id]/bulk-invites/route";
import { getAuthSession } from "@/lib/auth/session";
import { assertWorkspaceFeatureAccess } from "@/lib/workspace/entitlements";
import { bulkInviteWorkspaceMembers } from "@/lib/workspace/invitations";
import { WorkspaceSeatLimitError } from "@/lib/workspace/seats";
import { WorkspaceAuthorizationError } from "@/lib/workspace/authorization";

function makeSession() {
  return { expires: new Date().toISOString(), user: { id: "user-1" } };
}

describe("POST /api/workspaces/[id]/bulk-invites", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns 401 without a session", async () => {
    vi.mocked(getAuthSession).mockResolvedValue(null);
    const response = await POST(new Request("http://localhost/api/workspaces/ws-1/bulk-invites", { method: "POST", body: JSON.stringify({ emailsText: "a@x.com" }) }), { params: Promise.resolve({ id: "ws-1" }) });
    expect(response.status).toBe(401);
  });

  it("returns 403 when feature access is denied", async () => {
    vi.mocked(getAuthSession).mockResolvedValue(makeSession());
    vi.mocked(assertWorkspaceFeatureAccess).mockRejectedValue(new Error("No tienes acceso"));
    const response = await POST(new Request("http://localhost/api/workspaces/ws-1/bulk-invites", { method: "POST", body: JSON.stringify({ emailsText: "a@x.com" }) }), { params: Promise.resolve({ id: "ws-1" }) });
    expect(response.status).toBe(403);
  });

  it("returns 400 when the payload is invalid", async () => {
    vi.mocked(getAuthSession).mockResolvedValue(makeSession());
    const response = await POST(new Request("http://localhost/api/workspaces/ws-1/bulk-invites", { method: "POST", body: JSON.stringify({}) }), { params: Promise.resolve({ id: "ws-1" }) });
    expect(response.status).toBe(400);
  });

  it("delegates to the service and returns per-email results", async () => {
    vi.mocked(getAuthSession).mockResolvedValue(makeSession());
    vi.mocked(bulkInviteWorkspaceMembers).mockResolvedValue({
      results: [{ email: "ana@x.com", status: "created", userId: "user-2" }],
      invalid: [],
      createdCount: 1,
      rejectedCount: 0,
    });
    const response = await POST(new Request("http://localhost/api/workspaces/ws-1/bulk-invites", { method: "POST", body: JSON.stringify({ emailsText: "ana@x.com" }) }), { params: Promise.resolve({ id: "ws-1" }) });
    expect(response.status).toBe(200);
    expect(bulkInviteWorkspaceMembers).toHaveBeenCalledWith({ companyId: "ws-1", actorUserId: "user-1", emailsText: "ana@x.com" });
    await expect(response.json()).resolves.toMatchObject({ createdCount: 1 });
  });

  it("maps authorization errors to 403", async () => {
    vi.mocked(getAuthSession).mockResolvedValue(makeSession());
    vi.mocked(bulkInviteWorkspaceMembers).mockRejectedValue(new WorkspaceAuthorizationError("Sin permisos"));
    const response = await POST(new Request("http://localhost/api/workspaces/ws-1/bulk-invites", { method: "POST", body: JSON.stringify({ emailsText: "a@x.com" }) }), { params: Promise.resolve({ id: "ws-1" }) });
    expect(response.status).toBe(403);
  });

  it("maps seat limit errors to 409", async () => {
    vi.mocked(getAuthSession).mockResolvedValue(makeSession());
    vi.mocked(bulkInviteWorkspaceMembers).mockRejectedValue(new WorkspaceSeatLimitError(3, 3));
    const response = await POST(new Request("http://localhost/api/workspaces/ws-1/bulk-invites", { method: "POST", body: JSON.stringify({ emailsText: "a@x.com" }) }), { params: Promise.resolve({ id: "ws-1" }) });
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({ code: "WORKSPACE_SEAT_LIMIT_REACHED" });
  });
});
