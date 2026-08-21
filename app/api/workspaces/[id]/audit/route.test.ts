import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth/session", () => ({ getAuthSession: vi.fn() }));
vi.mock("@/lib/workspace/entitlements", () => ({ assertWorkspaceFeatureAccess: vi.fn() }));
vi.mock("@/lib/workspace/authorization", () => ({ requireWorkspaceRole: vi.fn(), WorkspaceAuthorizationError: class WorkspaceAuthorizationError extends Error {} }));
vi.mock("@/lib/workspace/audit", () => ({ listWorkspaceAuditEvents: vi.fn() }));

import { GET } from "@/app/api/workspaces/[id]/audit/route";
import { getAuthSession } from "@/lib/auth/session";
import { listWorkspaceAuditEvents } from "@/lib/workspace/audit";

describe("GET /api/workspaces/[id]/audit", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns 401 without a session", async () => {
    vi.mocked(getAuthSession).mockResolvedValue(null);
    const response = await GET(new Request("http://localhost/api/workspaces/ws-1/audit"), { params: Promise.resolve({ id: "ws-1" }) });
    expect(response.status).toBe(401);
  });

  it("returns tenant-scoped events", async () => {
    vi.mocked(getAuthSession).mockResolvedValue({ expires: new Date().toISOString(), user: { id: "user-1" } });
    vi.mocked(listWorkspaceAuditEvents).mockResolvedValue([{ id: "event-1" }] as never);
    const response = await GET(new Request("http://localhost/api/workspaces/ws-1/audit?take=10"), { params: Promise.resolve({ id: "ws-1" }) });
    expect(response.status).toBe(200);
    expect(listWorkspaceAuditEvents).toHaveBeenCalledWith({ companyId: "ws-1", take: 10, cursor: undefined });
    await expect(response.json()).resolves.toMatchObject({ events: [{ id: "event-1" }] });
  });
});
