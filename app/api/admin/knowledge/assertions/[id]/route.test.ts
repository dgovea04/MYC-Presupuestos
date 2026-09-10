import { beforeEach, describe, expect, it, vi } from "vitest";

const { getAuthSession, requireAdminSession, requireSuperAdminSession, transitionKnowledgeAssertion } = vi.hoisted(() => ({ getAuthSession: vi.fn().mockResolvedValue(null), requireAdminSession: vi.fn(), requireSuperAdminSession: vi.fn(), transitionKnowledgeAssertion: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ getAuthSession, requireAdminSession, requireSuperAdminSession }));
vi.mock("@/lib/knowledge/assertions", () => ({ transitionKnowledgeAssertion }));

import { PATCH } from "./route";

describe("admin knowledge assertion route", () => {
  beforeEach(() => vi.resetAllMocks());
  it("rejects unauthorized administrators", async () => {
    requireAdminSession.mockResolvedValueOnce(null);
    expect((await PATCH(new Request("http://localhost", { method: "PATCH", body: "{}" }), { params: Promise.resolve({ id: "a1" }) })).status).toBe(401);
  });

  it("delegates an explicit transition to the guarded service", async () => {
    requireAdminSession.mockResolvedValueOnce({ user: { id: "admin-1", isSuperAdmin: true } });
    transitionKnowledgeAssertion.mockResolvedValueOnce({ id: "a1", status: "CONFIRMED" });
    const response = await PATCH(new Request("http://localhost", { method: "PATCH", body: JSON.stringify({ nextStatus: "CONFIRMED", companyId: "c1", projectId: "p1", correlationId: "corr-1" }) }), { params: Promise.resolve({ id: "a1" }) });
    expect(response.status).toBe(200);
    expect(transitionKnowledgeAssertion).toHaveBeenCalledWith({ assertionId: "a1", nextStatus: "CONFIRMED", actorUserId: "admin-1", companyId: "c1", projectId: "p1", correlationId: "corr-1" });
  });

  it("blocks GLOBAL promotion without a verified MFA proof", async () => {
    requireAdminSession.mockResolvedValueOnce({ user: { id: "admin-1" } });
    requireSuperAdminSession.mockResolvedValueOnce(null);
    const response = await PATCH(new Request("http://localhost", { method: "PATCH", body: JSON.stringify({ nextStatus: "CANONICAL", companyId: "c1", projectId: "p1", correlationId: "corr-global" }) }), { params: Promise.resolve({ id: "a1" }) });
    expect(response.status).toBe(403);
    expect(transitionKnowledgeAssertion).not.toHaveBeenCalled();
  });

  it("passes explicit GLOBAL promotion authorization after superadmin MFA", async () => {
    requireAdminSession.mockResolvedValueOnce({ user: { id: "admin-1", isSuperAdmin: true } });
    requireSuperAdminSession.mockResolvedValueOnce({ user: { id: "admin-1" } });
    transitionKnowledgeAssertion.mockResolvedValueOnce({ id: "a1", status: "CANONICAL", scope: "GLOBAL" });
    const response = await PATCH(new Request("http://localhost", { method: "PATCH", body: JSON.stringify({ nextStatus: "CANONICAL", companyId: "c1", projectId: "p1", correlationId: "corr-global" }) }), { params: Promise.resolve({ id: "a1" }) });
    expect(response.status).toBe(200);
    expect(transitionKnowledgeAssertion).toHaveBeenCalledWith(expect.objectContaining({ allowGlobalPromotion: true, correlationId: "corr-global" }));
  });
});
