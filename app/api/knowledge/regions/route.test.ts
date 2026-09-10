import { describe, expect, it, vi } from "vitest";
import { GET, POST } from "./route";

const { getAuthSession, requireAdminSession, createKnowledgeRegion, listKnowledgeRegions } = vi.hoisted(() => ({ getAuthSession: vi.fn().mockResolvedValue(null), requireAdminSession: vi.fn(), createKnowledgeRegion: vi.fn(), listKnowledgeRegions: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ getAuthSession, requireAdminSession }));
vi.mock("@/lib/knowledge/regions", () => ({ createKnowledgeRegion, listKnowledgeRegions }));

describe("knowledge regions route", () => {
  it("rejects unauthorised reads", async () => {
    requireAdminSession.mockResolvedValueOnce(null);
    const response = await GET(new Request("http://localhost/api/knowledge/regions"));
    expect(response.status).toBe(401);
  });

  it("creates a region after admin authorization", async () => {
    requireAdminSession.mockResolvedValueOnce({ user: { id: "admin" } });
    createKnowledgeRegion.mockResolvedValueOnce({ id: "r1" });
    const response = await POST(new Request("http://localhost/api/knowledge/regions", { method: "POST", body: JSON.stringify({ level: "DEPARTMENT", name: "Cusco" }) }));
    expect(response.status).toBe(201);
    expect(createKnowledgeRegion).toHaveBeenCalledWith({ level: "DEPARTMENT", name: "Cusco" });
    expect(requireAdminSession).toHaveBeenCalledWith("knowledge.manage", expect.any(Request));
  });
});
