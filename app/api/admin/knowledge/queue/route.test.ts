import { describe, expect, it, vi } from "vitest";

const { requireAdminSession, getKnowledgeAdminQueue } = vi.hoisted(() => ({ requireAdminSession: vi.fn(), getKnowledgeAdminQueue: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ requireAdminSession }));
vi.mock("@/lib/knowledge/admin-queue", () => ({ getKnowledgeAdminQueue }));

import { GET } from "./route";

describe("admin knowledge queue route", () => {
  it("requires audit read capability", async () => {
    requireAdminSession.mockResolvedValueOnce(null);
    expect((await GET(new Request("http://localhost/api/admin/knowledge/queue"))).status).toBe(403);
  });

  it("passes validated queue filters to the service", async () => {
    requireAdminSession.mockResolvedValueOnce({ user: { id: "admin-1" } });
    getKnowledgeAdminQueue.mockResolvedValueOnce({ pendingAssertions: [], recentPrices: [], recentYields: [], retryableJobs: [] });
    const response = await GET(new Request("http://localhost/api/admin/knowledge/queue?companyId=c1&projectId=p1&status=RETRYABLE_FAILED"));
    expect(response.status).toBe(200);
    expect(getKnowledgeAdminQueue).toHaveBeenCalledWith({ companyId: "c1", projectId: "p1", status: "RETRYABLE_FAILED" });
  });
});
