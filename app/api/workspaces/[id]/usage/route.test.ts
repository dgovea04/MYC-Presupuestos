import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/session", () => ({ getAuthSession: vi.fn() }));
vi.mock("@/lib/workspace/entitlements", () => ({ assertWorkspaceFeatureAccess: vi.fn() }));
vi.mock("@/lib/workspace/authorization", () => ({
  requireWorkspaceRole: vi.fn(),
  WorkspaceAuthorizationError: class WorkspaceAuthorizationError extends Error {},
}));
vi.mock("@/lib/workspace/usage", () => ({ getWorkspaceUsage: vi.fn() }));

import { GET } from "@/app/api/workspaces/[id]/usage/route";
import { getAuthSession } from "@/lib/auth/session";
import { getWorkspaceUsage } from "@/lib/workspace/usage";
import { requireWorkspaceRole } from "@/lib/workspace/authorization";

describe("GET /api/workspaces/[id]/usage", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns 401 without a session", async () => {
    vi.mocked(getAuthSession).mockResolvedValue(null);
    const response = await GET(new Request("http://localhost/api/workspaces/ws-1/usage"), { params: Promise.resolve({ id: "ws-1" }) });
    expect(response.status).toBe(401);
  });

  it("returns 403 for non-admin roles", async () => {
    vi.mocked(getAuthSession).mockResolvedValue({ expires: new Date().toISOString(), user: { id: "user-1" } });
    vi.mocked(requireWorkspaceRole).mockRejectedValue(new Error("Sin permisos"));
    const response = await GET(new Request("http://localhost/api/workspaces/ws-1/usage"), { params: Promise.resolve({ id: "ws-1" }) });
    expect(response.status).toBe(403);
  });

  it("delegates to the usage service scoped to the workspace", async () => {
    vi.mocked(getAuthSession).mockResolvedValue({ expires: new Date().toISOString(), user: { id: "user-1" } });
    vi.mocked(getWorkspaceUsage).mockResolvedValue({ seats: { used: 1, limit: 3 } } as never);
    const response = await GET(new Request("http://localhost/api/workspaces/ws-1/usage"), { params: Promise.resolve({ id: "ws-1" }) });
    expect(response.status).toBe(200);
    expect(getWorkspaceUsage).toHaveBeenCalledWith("ws-1");
    await expect(response.json()).resolves.toMatchObject({ seats: { used: 1, limit: 3 } });
  });
});
