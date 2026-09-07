import { describe, expect, it, vi } from "vitest";
import { GET, POST } from "./route";

const { requireAdminSession, createKnowledgeSupplier, listKnowledgeSuppliers } = vi.hoisted(() => ({ requireAdminSession: vi.fn(), createKnowledgeSupplier: vi.fn(), listKnowledgeSuppliers: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ requireAdminSession }));
vi.mock("@/lib/knowledge/suppliers", () => ({ createKnowledgeSupplier, listKnowledgeSuppliers }));

describe("knowledge suppliers route", () => {
  it("filters supplier reads by region", async () => {
    requireAdminSession.mockResolvedValueOnce({ user: { id: "admin" } });
    listKnowledgeSuppliers.mockResolvedValueOnce([{ id: "s1" }]);
    const response = await GET(new Request("http://localhost/api/knowledge/suppliers?regionId=r1"));
    expect(response.status).toBe(200);
    expect(listKnowledgeSuppliers).toHaveBeenCalledWith("r1");
  });

  it("rejects unauthorised writes", async () => {
    requireAdminSession.mockResolvedValueOnce(null);
    const response = await POST(new Request("http://localhost/api/knowledge/suppliers", { method: "POST", body: JSON.stringify({ name: "Proveedor" }) }));
    expect(response.status).toBe(403);
  });
});
