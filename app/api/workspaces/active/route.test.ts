import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAuthSession: vi.fn(),
  getActiveWorkspaceId: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  getAuthSession: mocks.getAuthSession,
}));

vi.mock("@/lib/workspace/active-workspace", () => ({
  getActiveWorkspaceId: mocks.getActiveWorkspaceId,
}));

import { GET } from "@/app/api/workspaces/active/route";

describe("GET /api/workspaces/active", () => {
  beforeEach(() => {
    mocks.getAuthSession.mockReset();
    mocks.getActiveWorkspaceId.mockReset();
  });

  it("returns 401 when the user is not authenticated", async () => {
    mocks.getAuthSession.mockResolvedValue(null);

    const response = await GET(new Request("http://localhost/api/workspaces/active"));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" });
  });

  it("returns null activeCompanyId when user has no active workspace", async () => {
    mocks.getAuthSession.mockResolvedValue({ user: { id: "user-1" } });
    mocks.getActiveWorkspaceId.mockResolvedValue(null);

    const response = await GET(new Request("http://localhost/api/workspaces/active"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ activeCompanyId: null });
  });

  it("returns the active workspace id", async () => {
    mocks.getAuthSession.mockResolvedValue({ user: { id: "user-1" } });
    mocks.getActiveWorkspaceId.mockResolvedValue("ws-1");

    const response = await GET(new Request("http://localhost/api/workspaces/active"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ activeCompanyId: "ws-1" });
    expect(mocks.getActiveWorkspaceId).toHaveBeenCalledWith("user-1");
  });
});
