import { describe, expect, it, vi } from "vitest";

const { prismaMock, queueMock } = vi.hoisted(() => ({
  prismaMock: {
    canonicalItem: { count: vi.fn().mockResolvedValue(2), findMany: vi.fn().mockResolvedValue([]) },
    canonicalResource: { count: vi.fn().mockResolvedValue(3), findMany: vi.fn().mockResolvedValue([]) },
    priceObservation: { count: vi.fn().mockResolvedValue(4) },
    yieldObservation: { count: vi.fn().mockResolvedValue(5) },
    knowledgeEvent: { findMany: vi.fn().mockResolvedValue([]) },
    knowledgeEvidence: { findMany: vi.fn().mockResolvedValue([{ id: "e1", createdAt: new Date("2026-09-09") }]) },
    knowledgeAssertionConflict: { findMany: vi.fn().mockResolvedValue([{ id: "c1", status: "OPEN", createdAt: new Date("2026-09-09"), resolvedAt: null, assertion: { companyId: "company-a", projectId: "project-a" } }]) },
  },
  queueMock: vi.fn().mockResolvedValue({ pendingAssertions: [{ id: "a1", status: "VERIFIED", confidence: "HIGH", updatedAt: new Date("2026-09-09") }], recentPrices: [], recentYields: [], retryableJobs: [] }),
}));

vi.mock("@/lib/db/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/knowledge/admin-queue", () => ({ getKnowledgeAdminQueue: queueMock }));
import { getKnowledgeAdminDashboard } from "./admin-dashboard";

describe("knowledge admin dashboard", () => {
  it("centralizes tenant-scoped data and exposes promotion candidates", async () => {
    const result = await getKnowledgeAdminDashboard({ companyId: "company-a", projectId: "project-a", status: "VERIFIED" });
    expect(result.counts).toEqual({ items: 2, resources: 3, prices: 4, yields: 5 });
    expect(result.queue.promotionCandidates).toHaveLength(1);
    expect(result.evidence[0]?.createdAt).toBe("2026-09-09T00:00:00.000Z");
    expect(prismaMock.knowledgeEvidence.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { companyId: "company-a", projectId: "project-a" } }));
    expect(prismaMock.knowledgeAssertionConflict.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { assertion: { companyId: "company-a", projectId: "project-a" } } }));
    expect(queueMock).toHaveBeenCalledWith({ companyId: "company-a", projectId: "project-a", status: "VERIFIED" });
  });
});
