import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const { getAuthSession, assertWorkspaceMembership, assertProjectInWorkspace, retrieveKnowledgeV1 } = vi.hoisted(() => ({ getAuthSession: vi.fn(), assertWorkspaceMembership: vi.fn(), assertProjectInWorkspace: vi.fn(), retrieveKnowledgeV1: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ getAuthSession }));
vi.mock("@/lib/workspace/access", () => ({ assertWorkspaceMembership, assertProjectInWorkspace }));
vi.mock("@/lib/knowledge/retrieval-v1", () => ({ retrieveKnowledgeV1 }));

describe("knowledge retrieval route", () => {
  beforeEach(() => vi.clearAllMocks());
  it("rejects unauthenticated access", async () => {
    getAuthSession.mockResolvedValueOnce(null);
    expect((await GET(new Request("http://localhost/api/knowledge/retrieval?q=cemento&companyId=c1"))).status).toBe(401);
  });

  it("checks workspace and project before retrieval", async () => {
    getAuthSession.mockResolvedValueOnce({ user: { id: "u1", activeCompanyId: "c1" } });
    retrieveKnowledgeV1.mockResolvedValueOnce({ items: [], resources: [], prices: [], yields: [], apuVersions: [], assertions: [] });
    const response = await GET(new Request("http://localhost/api/knowledge/retrieval?q=cemento&companyId=c1&projectId=p1"));
    expect(response.status).toBe(200);
    expect(assertWorkspaceMembership).toHaveBeenCalledWith({ userId: "u1", companyId: "c1", minimumRole: "VIEWER" });
    expect(assertProjectInWorkspace).toHaveBeenCalledWith({ companyId: "c1", projectId: "p1" });
    expect(retrieveKnowledgeV1).toHaveBeenCalledWith({ companyId: "c1", projectId: "p1", query: "cemento", limit: 20 });
  });

  it("validates retrieval filters before querying knowledge", async () => {
    getAuthSession.mockResolvedValueOnce({ user: { id: "u1", activeCompanyId: "c1" } });
    const response = await GET(new Request("http://localhost/api/knowledge/retrieval?q=cemento&status=UNKNOWN"));
    expect(response.status).toBe(400);
    expect(retrieveKnowledgeV1).not.toHaveBeenCalled();
  });
});
