import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/session", () => ({ getAuthSession: vi.fn() }));
vi.mock("@/lib/workspace/entitlements", () => ({ assertWorkspaceFeatureAccess: vi.fn() }));
vi.mock("@/lib/workspace/authorization", () => ({
  requireWorkspaceRole: vi.fn(),
  WorkspaceAuthorizationError: class WorkspaceAuthorizationError extends Error {},
}));
vi.mock("@/lib/workspace/roles", () => ({
  listWorkspaceRoles: vi.fn(),
  createWorkspaceRole: vi.fn(),
  updateWorkspaceRole: vi.fn(),
  deleteWorkspaceRole: vi.fn(),
}));

import { DELETE, GET, POST } from "@/app/api/workspaces/[id]/roles/route";
import { getAuthSession } from "@/lib/auth/session";
import { createWorkspaceRole, listWorkspaceRoles } from "@/lib/workspace/roles";

function makeSession() {
  return { expires: new Date().toISOString(), user: { id: "user-1" } };
}

describe("workspace roles routes", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns 401 without a session", async () => {
    vi.mocked(getAuthSession).mockResolvedValue(null);
    const response = await GET(new Request("http://localhost/api/workspaces/ws-1/roles"), { params: Promise.resolve({ id: "ws-1" }) });
    expect(response.status).toBe(401);
  });

  it("returns the role list scoped to the workspace", async () => {
    vi.mocked(getAuthSession).mockResolvedValue(makeSession());
    vi.mocked(listWorkspaceRoles).mockResolvedValue([{ id: "r1", name: "Contador" }] as never);
    const response = await GET(new Request("http://localhost/api/workspaces/ws-1/roles"), { params: Promise.resolve({ id: "ws-1" }) });
    expect(response.status).toBe(200);
    expect(listWorkspaceRoles).toHaveBeenCalledWith("ws-1");
    await expect(response.json()).resolves.toMatchObject({ roles: [{ id: "r1" }] });
  });

  it("creates a role with validated payload", async () => {
    vi.mocked(getAuthSession).mockResolvedValue(makeSession());
    vi.mocked(createWorkspaceRole).mockResolvedValue({ id: "r1", name: "Contador" } as never);
    const response = await POST(new Request("http://localhost/api/workspaces/ws-1/roles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Contador", permissions: ["budgets.read"] }),
    }), { params: Promise.resolve({ id: "ws-1" }) });
    expect(response.status).toBe(201);
    expect(createWorkspaceRole).toHaveBeenCalledWith(expect.objectContaining({ companyId: "ws-1", name: "Contador", permissions: ["budgets.read"] }));
  });

  it("rejects invalid create payloads", async () => {
    vi.mocked(getAuthSession).mockResolvedValue(makeSession());
    const response = await POST(new Request("http://localhost/api/workspaces/ws-1/roles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "" }),
    }), { params: Promise.resolve({ id: "ws-1" }) });
    expect(response.status).toBe(400);
  });

  it("rejects delete without roleId", async () => {
    vi.mocked(getAuthSession).mockResolvedValue(makeSession());
    const response = await DELETE(new Request("http://localhost/api/workspaces/ws-1/roles", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    }), { params: Promise.resolve({ id: "ws-1" }) });
    expect(response.status).toBe(400);
  });
});
