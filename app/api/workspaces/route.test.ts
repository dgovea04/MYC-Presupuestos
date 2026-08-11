import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAuthSession: vi.fn(),
  listUserWorkspaces: vi.fn(),
  setActiveWorkspaceId: vi.fn(),
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  getAuthSession: mocks.getAuthSession,
}));

vi.mock("@/lib/workspace/active-workspace", () => ({
  listUserWorkspaces: mocks.listUserWorkspaces,
  setActiveWorkspaceId: mocks.setActiveWorkspaceId,
  WORKSPACE_LIST_CACHE_TAG: "workspace-list",
}));

vi.mock("@/lib/workspace/entitlements", () => ({
  assertWorkspaceFeatureAccess: vi.fn(),
  isWorkspaceFeatureAccessError: () => false,
}));

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
  revalidateTag: mocks.revalidateTag,
}));

import { GET, POST } from "@/app/api/workspaces/route";

describe("GET /api/workspaces", () => {
  beforeEach(() => {
    mocks.getAuthSession.mockReset();
    mocks.listUserWorkspaces.mockReset();
  });

  it("returns 401 when the user is not authenticated", async () => {
    mocks.getAuthSession.mockResolvedValue(null);

    const response = await GET(new Request("http://localhost/api/workspaces"));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" });
  });

  it("returns empty workspaces when user has no active memberships", async () => {
    mocks.getAuthSession.mockResolvedValue({ user: { id: "user-1" } });
    mocks.listUserWorkspaces.mockResolvedValue([]);

    const response = await GET(new Request("http://localhost/api/workspaces"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ workspaces: [] });
  });

  it("returns list of workspaces with role and logoUrl", async () => {
    mocks.getAuthSession.mockResolvedValue({ user: { id: "user-1" } });
    mocks.listUserWorkspaces.mockResolvedValue([
      { id: "ws-1", name: "MYC Ingeniería", role: "OWNER", logoUrl: null },
      { id: "ws-2", name: "Otra Empresa", role: "EDITOR", logoUrl: "/logos/other.png" },
    ]);

    const response = await GET(new Request("http://localhost/api/workspaces"));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.workspaces).toHaveLength(2);
    expect(body.workspaces[0]).toEqual({
      id: "ws-1",
      name: "MYC Ingeniería",
      role: "OWNER",
      logoUrl: null,
    });
    expect(body.workspaces[1].logoUrl).toBe("/logos/other.png");
    expect(mocks.listUserWorkspaces).toHaveBeenCalledWith("user-1");
  });
});

describe("POST /api/workspaces", () => {
  beforeEach(() => {
    mocks.getAuthSession.mockReset();
    mocks.setActiveWorkspaceId.mockReset();
  });

  it("returns 401 when the user is not authenticated", async () => {
    mocks.getAuthSession.mockResolvedValue(null);

    const response = await POST(
      new Request("http://localhost/api/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId: "ws-1" }),
      }),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" });
  });

  it("returns 400 when companyId is missing", async () => {
    mocks.getAuthSession.mockResolvedValue({ user: { id: "user-1" } });

    const response = await POST(
      new Request("http://localhost/api/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }),
    );

    expect(response.status).toBe(400);
  });

  it("returns 400 when companyId is empty", async () => {
    mocks.getAuthSession.mockResolvedValue({ user: { id: "user-1" } });

    const response = await POST(
      new Request("http://localhost/api/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId: "" }),
      }),
    );

    expect(response.status).toBe(400);
  });

  it("returns 400 when setActiveWorkspaceId throws (user not a member)", async () => {
    mocks.getAuthSession.mockResolvedValue({ user: { id: "user-1" } });
    mocks.setActiveWorkspaceId.mockRejectedValue(new Error("No perteneces a este workspace"));

    const response = await POST(
      new Request("http://localhost/api/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId: "ws-2" }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "No perteneces a este workspace" });
  });

  it("sets active workspace successfully and returns activeCompanyId", async () => {
    mocks.getAuthSession.mockResolvedValue({ user: { id: "user-1" } });
    mocks.setActiveWorkspaceId.mockResolvedValue(undefined);

    const response = await POST(
      new Request("http://localhost/api/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId: "ws-1" }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      activeCompanyId: "ws-1",
    });
    expect(mocks.setActiveWorkspaceId).toHaveBeenCalledWith("user-1", "ws-1");
  });
});
