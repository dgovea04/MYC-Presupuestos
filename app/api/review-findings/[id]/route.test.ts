import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getAuthSession: vi.fn(), assertWorkspaceMembership: vi.fn(), getFinding: vi.fn(), enrichPersistedReviewFinding: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ getAuthSession: mocks.getAuthSession }));
vi.mock("@/lib/workspace/access", () => ({ assertWorkspaceMembership: mocks.assertWorkspaceMembership }));
vi.mock("@/lib/review-intelligence/findings", () => ({ getFinding: mocks.getFinding }));
vi.mock("@/lib/knowledge/review-enrichment", () => ({ enrichPersistedReviewFinding: mocks.enrichPersistedReviewFinding }));

import { GET } from "@/app/api/review-findings/[id]/route";

describe("finding detail API", () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
    mocks.getAuthSession.mockResolvedValue({ user: { id: "user-1", activeCompanyId: "company-1" } });
    mocks.assertWorkspaceMembership.mockResolvedValue(undefined);
    mocks.getFinding.mockResolvedValue({ id: "finding-1", evidence: { provenance: { sourceHash: "hash" }, viewUrl: "/api/review-evidence/evidence-1/view?token=temp" } });
    mocks.enrichPersistedReviewFinding.mockImplementation(async (finding: Record<string, unknown>) => ({ ...finding, knowledge: [], knowledgeTelemetry: { enabled: false, fallback: false, latencyMs: 0 } }));
  });

  it("returns comparison and provenance without a permanent storage URL", async () => {
    const response = await GET(new Request("http://localhost/api/review-findings/finding-1"), { params: Promise.resolve({ id: "finding-1" }) });
    expect(response.status).toBe(200);
    const body = await response.json() as { evidence: { viewUrl: string } };
    expect(body.evidence.viewUrl).toContain("token=");
    expect(body).not.toHaveProperty("storageKey");
  });

  it("connects persisted finding details to Knowledge enrichment", async () => {
    mocks.getFinding.mockResolvedValueOnce({ id: "finding-1", projectId: "project-1", budgetItem: { description: "Cemento" }, evidence: { viewUrl: "/api/review-evidence/e1/view?token=temp" } });
    mocks.enrichPersistedReviewFinding.mockResolvedValueOnce({ id: "finding-1", projectId: "project-1", knowledge: [{ id: "resource-1", scope: "PROJECT", confidence: "HIGH", evidenceId: "knowledge-evidence-1", observedAt: "2026-09-09" }], knowledgeTelemetry: { enabled: true, fallback: false, latencyMs: 4 } });
    const response = await GET(new Request("http://localhost/api/review-findings/finding-1"), { params: Promise.resolve({ id: "finding-1" }) });
    expect(response.status).toBe(200);
    expect(mocks.enrichPersistedReviewFinding).toHaveBeenCalledWith(expect.objectContaining({ projectId: "project-1" }), { companyId: "company-1", projectId: "project-1", correlationId: "review-enrichment:finding-1" });
    await expect(response.json()).resolves.toMatchObject({ knowledge: [{ id: "resource-1", scope: "PROJECT" }], knowledgeTelemetry: { fallback: false } });
  });
});
