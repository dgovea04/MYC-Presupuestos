import { describe, expect, it, vi } from "vitest";

const { requireAdminSession, retryKnowledgeIntegrationJob } = vi.hoisted(() => ({ requireAdminSession: vi.fn(), retryKnowledgeIntegrationJob: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ requireAdminSession }));
vi.mock("@/lib/knowledge/integration-jobs", () => ({ retryKnowledgeIntegrationJob }));
import { POST } from "./route";

describe("admin knowledge retry route", () => {
  it("requires knowledge management capability", async () => {
    requireAdminSession.mockResolvedValueOnce(null);
    expect((await POST(new Request("http://localhost", { method: "POST" }), { params: Promise.resolve({ id: "j1" }) })).status).toBe(403);
  });

  it("requeues the requested job explicitly", async () => {
    requireAdminSession.mockResolvedValueOnce({ user: { id: "admin-1" } });
    retryKnowledgeIntegrationJob.mockResolvedValueOnce({ id: "j1", status: "PENDING" });
    const response = await POST(new Request("http://localhost", { method: "POST" }), { params: Promise.resolve({ id: "j1" }) });
    expect(response.status).toBe(200);
    expect(retryKnowledgeIntegrationJob).toHaveBeenCalledWith("j1");
  });
});
