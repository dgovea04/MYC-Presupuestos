import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAuthSession: vi.fn(),
  restoreWorkspace: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({ getAuthSession: mocks.getAuthSession }));
vi.mock("@/lib/workspace/company-settings", () => ({ restoreWorkspace: mocks.restoreWorkspace }));

import { POST } from "@/app/api/workspaces/[id]/restore/route";

function post() {
  return POST(new Request("http://localhost/api/workspaces/company-1/restore", { method: "POST" }), {
    params: Promise.resolve({ id: "company-1" }),
  });
}

describe("workspace restore route", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.getAuthSession.mockResolvedValue({ user: { id: "user-1" } });
    mocks.restoreWorkspace.mockResolvedValue({ id: "company-1", name: "Mi Empresa" });
  });

  it("requires a session", async () => {
    mocks.getAuthSession.mockResolvedValue(null);
    const response = await post();
    expect(response.status).toBe(401);
    expect(mocks.restoreWorkspace).not.toHaveBeenCalled();
  });

  it("restores the workspace", async () => {
    const response = await post();
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body).toEqual({ ok: true, workspace: { id: "company-1", name: "Mi Empresa" } });
    expect(mocks.restoreWorkspace).toHaveBeenCalledWith({ companyId: "company-1", actorUserId: "user-1" });
  });

  it("returns 403 when restore is rejected", async () => {
    mocks.restoreWorkspace.mockRejectedValue(new Error("Solo el Owner puede restaurar el workspace"));
    const response = await post();
    expect(response.status).toBe(403);
  });
});
