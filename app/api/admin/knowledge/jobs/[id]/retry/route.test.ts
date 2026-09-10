import { describe, expect, it, vi } from "vitest";

const { requireAdminSession, retryKnowledgeIntegrationJob, assertKnowledgeWriteAccess } = vi.hoisted(() => ({ requireAdminSession: vi.fn(), retryKnowledgeIntegrationJob: vi.fn(), assertKnowledgeWriteAccess: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ requireAdminSession }));
vi.mock("@/lib/knowledge/integration-jobs", () => ({ retryKnowledgeIntegrationJob }));
vi.mock("@/lib/knowledge/api-access", () => ({ assertKnowledgeWriteAccess }));
import { POST } from "./route";

describe("admin knowledge retry route", () => {
  it("requires knowledge management capability", async () => {
    requireAdminSession.mockResolvedValueOnce(null);
    expect((await POST(new Request("http://localhost", { method: "POST" }), { params: Promise.resolve({ id: "j1" }) })).status).toBe(403);
  });

  it("requeues the requested job explicitly", async () => {
    requireAdminSession.mockResolvedValueOnce({ user: { id: "admin-1", activeCompanyId: "c1" } });
    retryKnowledgeIntegrationJob.mockResolvedValueOnce({ id: "j1", status: "PENDING" });
    const response = await POST(new Request("http://localhost", { method: "POST" }), { params: Promise.resolve({ id: "j1" }) });
    expect(response.status).toBe(200);
    expect(assertKnowledgeWriteAccess).toHaveBeenCalledWith({ actorUserId: "admin-1", companyId: "c1", projectId: undefined, scope: "COMPANY" });
    expect(retryKnowledgeIntegrationJob).toHaveBeenCalledWith("j1", { companyId: "c1", projectId: undefined });
  });
});
