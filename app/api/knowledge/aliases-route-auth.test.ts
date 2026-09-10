import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST as postItemAlias } from "./items/[id]/aliases/route";
import { POST as postResourceAlias } from "./resources/[id]/aliases/route";

const { getAuthSession, requireSuperAdminSession, assertKnowledgeEntityAccess, itemFindUnique, resourceFindUnique, addItemAlias, addResourceAlias } = vi.hoisted(() => ({
  getAuthSession: vi.fn(),
  requireSuperAdminSession: vi.fn(),
  assertKnowledgeEntityAccess: vi.fn(),
  itemFindUnique: vi.fn(),
  resourceFindUnique: vi.fn(),
  addItemAlias: vi.fn(),
  addResourceAlias: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({ getAuthSession, requireSuperAdminSession }));
vi.mock("@/lib/knowledge/api-access", () => ({ assertKnowledgeEntityAccess }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { canonicalItem: { findUnique: itemFindUnique }, canonicalResource: { findUnique: resourceFindUnique } } }));
vi.mock("@/lib/knowledge/canonical-items", () => ({ addItemAlias }));
vi.mock("@/lib/knowledge/canonical-resources", () => ({ addResourceAlias }));

describe("knowledge aliases route tenant authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAuthSession.mockResolvedValue({ user: { id: "u1", activeCompanyId: "company-a" } });
    requireSuperAdminSession.mockResolvedValue(null);
    assertKnowledgeEntityAccess.mockRejectedValue(new Error("Knowledge tenant access denied"));
  });

  it("does not write an item alias when the item belongs to another company", async () => {
    itemFindUnique.mockResolvedValue({ id: "item-b", scope: "COMPANY", companyId: "company-b" });
    const response = await postItemAlias(new Request("http://localhost", { method: "POST", body: JSON.stringify({ alias: "alias" }) }), { params: Promise.resolve({ id: "item-b" }) });
    expect(response.status).toBe(400);
    expect(assertKnowledgeEntityAccess).toHaveBeenCalledWith({ actorUserId: "u1", entityType: "CanonicalItem", entityId: "item-b", companyId: "company-a", minimumRole: "EDITOR" });
    expect(addItemAlias).not.toHaveBeenCalled();
  });

  it("does not write a resource alias when the resource belongs to another company", async () => {
    resourceFindUnique.mockResolvedValue({ id: "resource-b", scope: "COMPANY", companyId: "company-b" });
    const response = await postResourceAlias(new Request("http://localhost", { method: "POST", body: JSON.stringify({ alias: "alias" }) }), { params: Promise.resolve({ id: "resource-b" }) });
    expect(response.status).toBe(400);
    expect(assertKnowledgeEntityAccess).toHaveBeenCalledWith({ actorUserId: "u1", entityType: "CanonicalResource", entityId: "resource-b", companyId: "company-a", minimumRole: "EDITOR" });
    expect(addResourceAlias).not.toHaveBeenCalled();
  });
});
