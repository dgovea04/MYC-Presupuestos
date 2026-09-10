import { describe, expect, it, vi } from "vitest";
import { apuContentHash, buildReviewApuCorrection, createApuVersionFromExistingApu } from "./apu";

const { findFirst, create, upsert } = vi.hoisted(() => ({ findFirst: vi.fn().mockResolvedValue({ versionNumber: 2 }), create: vi.fn().mockResolvedValue({ id: "v3", versionNumber: 3 }), upsert: vi.fn().mockResolvedValue({ id: "v3", versionNumber: 3 }) }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { knowledgeApuVersion: { findFirst, create, upsert } } }));
vi.mock("@/lib/workspace/access", () => ({ assertWorkspaceMembership: vi.fn().mockResolvedValue({ companyId: "c1", role: "EDITOR" }), assertProjectInWorkspace: vi.fn().mockResolvedValue(undefined) }));

const input = { scope: "PROJECT" as const, companyId: "c1", projectId: "p1", apuId: "a1", name: "Concreto", unit: "M3", performance: "8.12345", resources: [{ description: "Cemento", unit: "BOL", quantity: "4.2", unitPrice: "31.5", resourceType: "MATERIAL", sortOrder: 0 }] };

describe("knowledge APU versions", () => {
  it("creates the next version with a stable Decimal-safe content hash", async () => {
    expect(apuContentHash(input)).toBe(apuContentHash({ ...input, performance: "8.12349" }));
    await expect(createApuVersionFromExistingApu(input)).resolves.toMatchObject({ versionNumber: 3 });
  });

  it("builds a corrected APU with immutable before/after snapshots", () => {
    const result = buildReviewApuCorrection({
      findingId: "finding-1", decisionId: "decision-1", correctionVersionId: "budget-version-2", sourceId: "source-1", evidenceId: "evidence-1",
      before: input,
      after: { ...input, performance: "7.5000", resources: [{ ...input.resources[0], quantity: "4.5" }] },
    });
    expect(result.idempotencyKey).toBe("review-apu:decision-1:budget-version-2");
    expect(result.beforeSnapshot).toEqual(expect.objectContaining({ performance: "8.1235", resources: [expect.objectContaining({ quantity: "4.2000" })] }));
    expect(result.afterSnapshot).toEqual(expect.objectContaining({ performance: "7.5000", resources: [expect.objectContaining({ quantity: "4.5000" })] }));
    expect(result.beforeSnapshot).not.toBe(result.afterSnapshot);
  });

  it("rejects a corrected APU without a changed before/after snapshot", () => {
    expect(() => buildReviewApuCorrection({ findingId: "f1", decisionId: "d1", correctionVersionId: "v2", sourceId: "s1", evidenceId: "e1", before: input, after: input })).toThrow("must differ");
  });

  it("persists corrected APU provenance idempotently without touching the budget", async () => {
    const correction = buildReviewApuCorrection({ findingId: "finding-1", decisionId: "decision-1", correctionVersionId: "budget-version-2", sourceId: "source-1", evidenceId: "evidence-1", before: input, after: { ...input, performance: "7.5000" } });
    const { persistReviewApuCorrection } = await import("./apu");
    await expect(persistReviewApuCorrection({ ...correction, scope: "PROJECT", companyId: "c1", projectId: "p1", actorUserId: "u1" })).resolves.toMatchObject({ id: "v3" });
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({ where: { idempotencyKey: "review-apu:decision-1:budget-version-2" }, create: expect.objectContaining({ beforeSnapshot: expect.anything(), afterSnapshot: expect.anything(), reviewFindingId: "finding-1", reviewDecisionId: "decision-1", createdById: "u1" }) }));
  });
});
