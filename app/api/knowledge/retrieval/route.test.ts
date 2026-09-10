import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const { getAuthSession, assertKnowledgeReadAccess, isKnowledgeFeatureEnabled, retrieveKnowledgeV1 } = vi.hoisted(() => ({ getAuthSession: vi.fn(), assertKnowledgeReadAccess: vi.fn(), isKnowledgeFeatureEnabled: vi.fn(), retrieveKnowledgeV1: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ getAuthSession }));
vi.mock("@/lib/knowledge/api-access", () => ({ assertKnowledgeReadAccess }));
vi.mock("@/lib/knowledge/feature-flags", () => ({ isKnowledgeFeatureEnabled }));
vi.mock("@/lib/knowledge/retrieval-v1", () => ({ retrieveKnowledgeV1 }));

describe("knowledge retrieval route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isKnowledgeFeatureEnabled.mockReturnValue(true);
  });
  it("rejects unauthenticated access", async () => {
    getAuthSession.mockResolvedValueOnce(null);
    expect((await GET(new Request("http://localhost/api/knowledge/retrieval?q=cemento&companyId=c1"))).status).toBe(401);
  });

  it("checks workspace and project before retrieval", async () => {
    getAuthSession.mockResolvedValueOnce({ user: { id: "u1", activeCompanyId: "c1" } });
    retrieveKnowledgeV1.mockResolvedValueOnce({ items: [], resources: [], prices: [], yields: [], apuVersions: [], assertions: [] });
    const response = await GET(new Request("http://localhost/api/knowledge/retrieval?q=cemento&companyId=c1&projectId=p1"));
    expect(response.status).toBe(200);
    expect(assertKnowledgeReadAccess).toHaveBeenCalledWith({ actorUserId: "u1", companyId: "c1", projectId: "p1", scope: "PROJECT" });
    expect(retrieveKnowledgeV1).toHaveBeenCalledWith({ companyId: "c1", projectId: "p1", query: "cemento", limit: 20 });
    expect(isKnowledgeFeatureEnabled).toHaveBeenCalledWith("retrievalV1", { companyId: "c1", projectId: "p1" });
  });

  it("returns a controlled outage without querying when retrieval rollout is disabled", async () => {
    getAuthSession.mockResolvedValueOnce({ user: { id: "u1", activeCompanyId: "c1" } });
    isKnowledgeFeatureEnabled.mockReturnValueOnce(false);

    const response = await GET(new Request("http://localhost/api/knowledge/retrieval?q=cemento&projectId=p1"));

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ error: "Knowledge retrieval disabled", feature: "retrievalV1" });
    expect(assertKnowledgeReadAccess).toHaveBeenCalledWith({ actorUserId: "u1", companyId: "c1", projectId: "p1", scope: "PROJECT" });
    expect(retrieveKnowledgeV1).not.toHaveBeenCalled();
  });

  it("validates retrieval filters before querying knowledge", async () => {
    getAuthSession.mockResolvedValueOnce({ user: { id: "u1", activeCompanyId: "c1" } });
    const response = await GET(new Request("http://localhost/api/knowledge/retrieval?q=cemento&status=UNKNOWN"));
    expect(response.status).toBe(400);
    expect(retrieveKnowledgeV1).not.toHaveBeenCalled();
  });

  it("hides retrieval service errors behind a safe 500", async () => {
    getAuthSession.mockResolvedValueOnce({ user: { id: "u1", activeCompanyId: "c1" } });
    retrieveKnowledgeV1.mockRejectedValueOnce(new Error("database password leaked"));

    const response = await GET(new Request("http://localhost/api/knowledge/retrieval?q=cemento"));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: "No se pudo recuperar conocimiento" });
  });
});
