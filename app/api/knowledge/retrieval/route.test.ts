import { describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const { getAuthSession, assertWorkspaceMembership, assertProjectInWorkspace, retrieveCanonicalItems } = vi.hoisted(() => ({ getAuthSession: vi.fn(), assertWorkspaceMembership: vi.fn(), assertProjectInWorkspace: vi.fn(), retrieveCanonicalItems: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ getAuthSession }));
vi.mock("@/lib/workspace/access", () => ({ assertWorkspaceMembership, assertProjectInWorkspace }));
vi.mock("@/lib/knowledge/retrieval", () => ({ retrieveCanonicalItems }));

describe("knowledge retrieval route", () => {
  it("rejects unauthenticated access", async () => {
    getAuthSession.mockResolvedValueOnce(null);
    expect((await GET(new Request("http://localhost/api/knowledge/retrieval?q=cemento&companyId=c1"))).status).toBe(401);
  });

  it("checks workspace and project before retrieval", async () => {
    getAuthSession.mockResolvedValueOnce({ user: { id: "u1" } });
    retrieveCanonicalItems.mockResolvedValueOnce([]);
    const response = await GET(new Request("http://localhost/api/knowledge/retrieval?q=cemento&companyId=c1&projectId=p1"));
    expect(response.status).toBe(200);
    expect(assertWorkspaceMembership).toHaveBeenCalledWith({ userId: "u1", companyId: "c1", minimumRole: "VIEWER" });
    expect(assertProjectInWorkspace).toHaveBeenCalledWith({ companyId: "c1", projectId: "p1" });
  });
});
