import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/session", () => ({ getAuthSession: vi.fn() }));
vi.mock("@/lib/workspace/authorization", () => ({
  WorkspaceAuthorizationError: class WorkspaceAuthorizationError extends Error {},
}));
vi.mock("@/lib/workspace/project-access", () => ({
  listProjectAccess: vi.fn(),
  shareProjectAccess: vi.fn(),
  revokeProjectAccess: vi.fn(),
}));

import { DELETE, GET, POST } from "@/app/api/projects/[id]/shares/route";
import { getAuthSession } from "@/lib/auth/session";
import { listProjectAccess, shareProjectAccess } from "@/lib/workspace/project-access";
import { WorkspaceAuthorizationError } from "@/lib/workspace/authorization";

function makeSession() {
  return { expires: new Date().toISOString(), user: { id: "user-1" } };
}

describe("project shares routes", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns 401 without a session", async () => {
    vi.mocked(getAuthSession).mockResolvedValue(null);
    const response = await GET(new Request("http://localhost/api/projects/project-1/shares"), {
      params: Promise.resolve({ id: "project-1" }),
    });
    expect(response.status).toBe(401);
  });

  it("lists shares for the project", async () => {
    vi.mocked(getAuthSession).mockResolvedValue(makeSession());
    vi.mocked(listProjectAccess).mockResolvedValue([{ id: "pm-1", userId: "user-2", role: "VIEWER" }] as never);

    const response = await GET(new Request("http://localhost/api/projects/project-1/shares"), {
      params: Promise.resolve({ id: "project-1" }),
    });

    expect(response.status).toBe(200);
    expect(listProjectAccess).toHaveBeenCalledWith({ actorUserId: "user-1", projectId: "project-1" });
    await expect(response.json()).resolves.toMatchObject({ shares: [{ id: "pm-1" }] });
  });

  it("maps authorization errors to 403", async () => {
    vi.mocked(getAuthSession).mockResolvedValue(makeSession());
    vi.mocked(listProjectAccess).mockRejectedValue(new WorkspaceAuthorizationError("No tienes acceso"));

    const response = await GET(new Request("http://localhost/api/projects/project-1/shares"), {
      params: Promise.resolve({ id: "project-1" }),
    });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ error: "No tienes acceso" });
  });

  it("shares a project with a validated payload", async () => {
    vi.mocked(getAuthSession).mockResolvedValue(makeSession());
    vi.mocked(shareProjectAccess).mockResolvedValue({ id: "pm-1", userId: "user-2", role: "EDITOR" } as never);

    const response = await POST(
      new Request("http://localhost/api/projects/project-1/shares", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: "user-2", role: "EDITOR" }),
      }),
      { params: Promise.resolve({ id: "project-1" }) },
    );

    expect(response.status).toBe(201);
    expect(shareProjectAccess).toHaveBeenCalledWith({ actorUserId: "user-1", projectId: "project-1", userId: "user-2", role: "EDITOR" });
  });

  it("rejects invalid share payloads", async () => {
    vi.mocked(getAuthSession).mockResolvedValue(makeSession());

    const response = await POST(
      new Request("http://localhost/api/projects/project-1/shares", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "OWNER" }),
      }),
      { params: Promise.resolve({ id: "project-1" }) },
    );

    expect(response.status).toBe(400);
    expect(shareProjectAccess).not.toHaveBeenCalled();
  });

  it("rejects revoke without userId", async () => {
    vi.mocked(getAuthSession).mockResolvedValue(makeSession());

    const response = await DELETE(
      new Request("http://localhost/api/projects/project-1/shares", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }),
      { params: Promise.resolve({ id: "project-1" }) },
    );

    expect(response.status).toBe(400);
  });
});
