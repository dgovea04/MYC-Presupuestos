import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const { getAuthSession, requireSuperAdminSession, assertKnowledgeWriteAccess, recordKnowledgeEvent } = vi.hoisted(() => ({ getAuthSession: vi.fn(), requireSuperAdminSession: vi.fn(), assertKnowledgeWriteAccess: vi.fn(), recordKnowledgeEvent: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ getAuthSession, requireSuperAdminSession }));
vi.mock("@/lib/knowledge/api-access", () => ({ assertKnowledgeWriteAccess }));
vi.mock("@/lib/knowledge/events", () => ({ recordKnowledgeEvent }));

const body = { eventType: "ITEM_CONFIRMED", scope: "COMPANY", entityType: "CanonicalItem", entityId: "i1", sourceType: "HUMAN", idempotencyKey: "event-1" };

describe("knowledge events route", () => {
  beforeEach(() => vi.clearAllMocks());

  it("requires authentication", async () => {
    getAuthSession.mockResolvedValueOnce(null);
    expect((await POST(new Request("http://localhost", { method: "POST", body: JSON.stringify(body) }))).status).toBe(401);
  });

  it("rejects global events without superadmin authorization", async () => {
    getAuthSession.mockResolvedValueOnce({ user: { id: "u1" } });
    requireSuperAdminSession.mockResolvedValueOnce(null);
    const response = await POST(new Request("http://localhost", { method: "POST", body: JSON.stringify({ ...body, scope: "GLOBAL" }) }));
    expect(response.status).toBe(403);
    expect(recordKnowledgeEvent).not.toHaveBeenCalled();
  });

  it("records scoped events as the authenticated actor", async () => {
    getAuthSession.mockResolvedValueOnce({ user: { id: "u1", activeCompanyId: "c1" } });
    recordKnowledgeEvent.mockResolvedValueOnce({ created: true, event: { id: "e1" } });
    const response = await POST(new Request("http://localhost", { method: "POST", body: JSON.stringify(body) }));
    expect(response.status).toBe(201);
    expect(recordKnowledgeEvent).toHaveBeenCalledWith(expect.objectContaining({ userId: "u1", companyId: "c1" }));
  });

  it("rejects client-provided company ownership fields", async () => {
    getAuthSession.mockResolvedValueOnce({ user: { id: "u1", activeCompanyId: "c1" } });
    const response = await POST(new Request("http://localhost", { method: "POST", body: JSON.stringify({ ...body, companyId: "company-b" }) }));
    expect(response.status).toBe(400);
    expect(recordKnowledgeEvent).not.toHaveBeenCalled();
  });
});
