import { describe, expect, it, vi } from "vitest";

const { requireAdminSession, getKnowledgeEvidenceProvenance, assertKnowledgeReadAccess } = vi.hoisted(() => ({ requireAdminSession: vi.fn(), getKnowledgeEvidenceProvenance: vi.fn(), assertKnowledgeReadAccess: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ requireAdminSession }));
vi.mock("@/lib/knowledge/provenance-explorer", () => ({ getKnowledgeEvidenceProvenance }));
vi.mock("@/lib/knowledge/api-access", () => ({ assertKnowledgeReadAccess }));
import { GET } from "./route";

describe("admin knowledge evidence route", () => {
  it("requires audit permission", async () => { requireAdminSession.mockResolvedValueOnce(null); expect((await GET(new Request("http://localhost"), { params: Promise.resolve({ id: "e1" }) })).status).toBe(403); });
  it("returns provenance for an authorized administrator in the active tenant", async () => { requireAdminSession.mockResolvedValueOnce({ user: { id: "admin-1", activeCompanyId: "c1" } }); getKnowledgeEvidenceProvenance.mockResolvedValueOnce({ id: "e1", source: { id: "s1" } }); const response = await GET(new Request("http://localhost"), { params: Promise.resolve({ id: "e1" }) }); expect(response.status).toBe(200); expect(assertKnowledgeReadAccess).toHaveBeenCalledWith({ actorUserId: "admin-1", companyId: "c1", projectId: undefined, scope: "COMPANY" }); expect(getKnowledgeEvidenceProvenance).toHaveBeenCalledWith("e1", { companyId: "c1", projectId: undefined }); });
});
