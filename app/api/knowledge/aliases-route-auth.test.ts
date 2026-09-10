import { beforeEach, describe, expect, it, vi } from "vitest";
import { WorkspaceAuthorizationError } from "@/lib/workspace/authorization";
import { POST as postItemAlias } from "./items/[id]/aliases/route";
import { POST as postResourceAlias } from "./resources/[id]/aliases/route";

const { getAuthSession, requireSuperAdminSession, assertKnowledgeWriteAccess, addItemAlias, addResourceAlias } = vi.hoisted(() => ({
  getAuthSession: vi.fn(),
  requireSuperAdminSession: vi.fn(),
  assertKnowledgeWriteAccess: vi.fn(),
  addItemAlias: vi.fn(),
  addResourceAlias: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({ getAuthSession, requireSuperAdminSession }));
vi.mock("@/lib/knowledge/api-access", () => ({ assertKnowledgeWriteAccess }));
vi.mock("@/lib/knowledge/canonical-items", () => ({ addItemAlias }));
vi.mock("@/lib/knowledge/canonical-resources", () => ({ addResourceAlias }));

describe("knowledge aliases route tenant authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAuthSession.mockResolvedValue({ user: { id: "u1", activeCompanyId: "company-a" } });
    requireSuperAdminSession.mockResolvedValue(null);
    assertKnowledgeWriteAccess.mockRejectedValue(new WorkspaceAuthorizationError("Knowledge tenant access denied"));
  });

  it("does not write an item alias when the item belongs to another company", async () => {
    const response = await postItemAlias(new Request("http://localhost", { method: "POST", body: JSON.stringify({ alias: "alias" }) }), { params: Promise.resolve({ id: "item-b" }) });
    expect(response.status).toBe(403);
    expect(assertKnowledgeWriteAccess).toHaveBeenCalledWith({ actorUserId: "u1", entityType: "CanonicalItem", entityId: "item-b", companyId: "company-a", minimumRole: "EDITOR", capability: undefined });
    expect(addItemAlias).not.toHaveBeenCalled();
  });

  it("does not write a resource alias when the resource belongs to another company", async () => {
    const response = await postResourceAlias(new Request("http://localhost", { method: "POST", body: JSON.stringify({ alias: "alias" }) }), { params: Promise.resolve({ id: "resource-b" }) });
    expect(response.status).toBe(403);
    expect(assertKnowledgeWriteAccess).toHaveBeenCalledWith({ actorUserId: "u1", entityType: "CanonicalResource", entityId: "resource-b", companyId: "company-a", minimumRole: "EDITOR", capability: undefined });
    expect(addResourceAlias).not.toHaveBeenCalled();
  });

  it("allows a superadmin to authorize a GLOBAL item without an active company", async () => {
    getAuthSession.mockResolvedValue({ user: { id: "admin-1" } });
    requireSuperAdminSession.mockResolvedValue({ user: { id: "admin-1" } });
    assertKnowledgeWriteAccess.mockResolvedValue({ scope: "GLOBAL", companyId: null, projectId: null });
    addItemAlias.mockResolvedValue({ id: "alias-1" });

    const response = await postItemAlias(new Request("http://localhost", { method: "POST", body: JSON.stringify({ alias: "global alias" }) }), { params: Promise.resolve({ id: "global-item" }) });

    expect(response.status).toBe(201);
    expect(assertKnowledgeWriteAccess).toHaveBeenCalledWith({ actorUserId: "admin-1", entityType: "CanonicalItem", entityId: "global-item", companyId: undefined, minimumRole: "EDITOR", capability: "knowledge.manage" });
  });

  it.each([
    ["item", postItemAlias, "item-1"],
    ["resource", postResourceAlias, "resource-1"],
  ] as const)("returns 400 for an invalid %s alias payload", async (_entity, postAlias, id) => {
    assertKnowledgeWriteAccess.mockResolvedValue({ scope: "COMPANY", companyId: "company-a", projectId: null });

    const response = await postAlias(new Request("http://localhost", { method: "POST", body: JSON.stringify({ alias: "" }) }), { params: Promise.resolve({ id }) });

    expect(response.status).toBe(400);
  });

  it.each([
    ["item", postItemAlias, addItemAlias, "item-1"],
    ["resource", postResourceAlias, addResourceAlias, "resource-1"],
  ] as const)("returns 500 instead of 403 when the %s alias service fails", async (_entity, postAlias, addAlias, id) => {
    assertKnowledgeWriteAccess.mockResolvedValue({ scope: "COMPANY", companyId: "company-a", projectId: null });
    addAlias.mockRejectedValue(new Error("database unavailable"));

    const response = await postAlias(new Request("http://localhost", { method: "POST", body: JSON.stringify({ alias: "alias" }) }), { params: Promise.resolve({ id }) });

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: "No se pudo confirmar el alias" });
  });
});
