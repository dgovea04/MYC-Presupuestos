import { describe, expect, it, vi } from "vitest";

const { getAuthSession, requireAdminSession, resolveKnowledgeAssertionConflict } = vi.hoisted(() => ({ getAuthSession: vi.fn().mockResolvedValue(null), requireAdminSession: vi.fn(), resolveKnowledgeAssertionConflict: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ getAuthSession, requireAdminSession }));
vi.mock("@/lib/knowledge/assertions", () => ({ resolveKnowledgeAssertionConflict }));

import { PATCH } from "./route";

describe("admin knowledge conflict route", () => {
  it("requires admin capability", async () => {
    requireAdminSession.mockResolvedValueOnce(null);
    expect((await PATCH(new Request("http://localhost", { method: "PATCH", body: "{}" }), { params: Promise.resolve({ id: "c1" }) })).status).toBe(401);
  });

  it("resolves a conflict with reason and correlation", async () => {
    requireAdminSession.mockResolvedValueOnce({ user: { id: "admin-1" } });
    resolveKnowledgeAssertionConflict.mockResolvedValueOnce({ id: "c1", status: "RESOLVED" });
    const response = await PATCH(new Request("http://localhost", { method: "PATCH", body: JSON.stringify({ companyId: "co-1", projectId: "p-1", resolution: "RESOLVED", reason: "Revisión completada", correlationId: "corr-1" }) }), { params: Promise.resolve({ id: "c1" }) });
    expect(response.status).toBe(200);
    expect(resolveKnowledgeAssertionConflict).toHaveBeenCalledWith(expect.objectContaining({ conflictId: "c1", actorUserId: "admin-1", resolution: "RESOLVED" }));
  });
});
