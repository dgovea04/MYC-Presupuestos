import { beforeEach, describe, expect, it, vi } from "vitest";
import { WorkspaceAuthorizationError } from "@/lib/workspace/authorization";

const { requireAdminSession, assertKnowledgeReadAccess, isKnowledgeFeatureEnabled, getKnowledgeAdminQueue } = vi.hoisted(() => ({ requireAdminSession: vi.fn(), assertKnowledgeReadAccess: vi.fn(), isKnowledgeFeatureEnabled: vi.fn(), getKnowledgeAdminQueue: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ requireAdminSession }));
vi.mock("@/lib/knowledge/api-access", () => ({ assertKnowledgeReadAccess }));
vi.mock("@/lib/knowledge/feature-flags", () => ({ isKnowledgeFeatureEnabled }));
vi.mock("@/lib/knowledge/admin-queue", () => ({ getKnowledgeAdminQueue }));

import { GET } from "./route";

describe("admin knowledge queue route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isKnowledgeFeatureEnabled.mockReturnValue(true);
  });

  it("requires audit read capability", async () => {
    requireAdminSession.mockResolvedValueOnce(null);
    expect((await GET(new Request("http://localhost/api/admin/knowledge/queue"))).status).toBe(403);
  });

  it("passes validated queue filters to the service", async () => {
    requireAdminSession.mockResolvedValueOnce({ user: { id: "admin-1" } });
    getKnowledgeAdminQueue.mockResolvedValueOnce({ pendingAssertions: [], recentPrices: [], recentYields: [], retryableJobs: [] });
    const response = await GET(new Request("http://localhost/api/admin/knowledge/queue?companyId=c1&projectId=p1&status=RETRYABLE_FAILED"));
    expect(response.status).toBe(200);
    expect(assertKnowledgeReadAccess).toHaveBeenCalledWith({ actorUserId: "admin-1", companyId: "c1", projectId: "p1", scope: "PROJECT" });
    expect(isKnowledgeFeatureEnabled).toHaveBeenCalledWith("retrievalV1", { companyId: "c1", projectId: "p1" });
    expect(getKnowledgeAdminQueue).toHaveBeenCalledWith({ companyId: "c1", projectId: "p1", status: "RETRYABLE_FAILED" });
  });

  it("returns a controlled outage after scope validation when retrieval rollout is disabled", async () => {
    requireAdminSession.mockResolvedValueOnce({ user: { id: "admin-1" } });
    isKnowledgeFeatureEnabled.mockReturnValueOnce(false);

    const response = await GET(new Request("http://localhost/api/admin/knowledge/queue?companyId=c1&projectId=p1"));

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ error: "Knowledge retrieval disabled", feature: "retrievalV1" });
    expect(assertKnowledgeReadAccess).toHaveBeenCalledWith({ actorUserId: "admin-1", companyId: "c1", projectId: "p1", scope: "PROJECT" });
    expect(getKnowledgeAdminQueue).not.toHaveBeenCalled();
  });

  it("requires a company scope before querying the queue", async () => {
    requireAdminSession.mockResolvedValueOnce({ user: { id: "admin-1" } });

    const response = await GET(new Request("http://localhost/api/admin/knowledge/queue"));

    expect(response.status).toBe(400);
    expect(assertKnowledgeReadAccess).not.toHaveBeenCalled();
    expect(getKnowledgeAdminQueue).not.toHaveBeenCalled();
  });

  it("returns 403 when queue scope authorization is denied", async () => {
    requireAdminSession.mockResolvedValueOnce({ user: { id: "admin-1" } });
    assertKnowledgeReadAccess.mockRejectedValueOnce(new WorkspaceAuthorizationError("No tienes acceso a este proyecto"));

    const response = await GET(new Request("http://localhost/api/admin/knowledge/queue?companyId=c1&projectId=foreign-project"));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "No tienes acceso a este proyecto" });
    expect(isKnowledgeFeatureEnabled).not.toHaveBeenCalled();
    expect(getKnowledgeAdminQueue).not.toHaveBeenCalled();
  });

  it("does not turn an internal queue failure into a forbidden response", async () => {
    requireAdminSession.mockResolvedValueOnce({ user: { id: "admin-1" } });
    getKnowledgeAdminQueue.mockRejectedValueOnce(new Error("database unavailable"));

    const response = await GET(new Request("http://localhost/api/admin/knowledge/queue?companyId=c1"));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: "No se pudo cargar la cola de conocimiento" });
  });
});
