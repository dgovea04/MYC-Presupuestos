import { describe, expect, it, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => ({ prismaMock: { knowledgeAssertion: { findMany: vi.fn().mockResolvedValue([{ id: "a1", status: "OBSERVED" }]), count: vi.fn() }, priceObservation: { findMany: vi.fn().mockResolvedValue([]) }, yieldObservation: { findMany: vi.fn().mockResolvedValue([]) }, knowledgeIntegrationJob: { findMany: vi.fn().mockResolvedValue([{ id: "j1", status: "RETRYABLE_FAILED" }]) } } }));
vi.mock("@/lib/db/prisma", () => ({ prisma: prismaMock }));
import { getKnowledgeAdminQueue } from "./admin-queue";

describe("knowledge admin queue", () => {
  it("returns pending assertions, observations and retryable jobs", async () => {
    const result = await getKnowledgeAdminQueue();
    expect(result.pendingAssertions).toEqual([{ id: "a1", status: "OBSERVED" }]);
    expect(result.retryableJobs).toEqual([{ id: "j1", status: "RETRYABLE_FAILED" }]);
    expect(prismaMock.knowledgeAssertion.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { status: "OBSERVED" } }));
  });
});
