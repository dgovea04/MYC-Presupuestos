import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  assertWorkspaceMembership: vi.fn(),
  getReviewProgress: vi.fn(),
  listFindings: vi.fn(),
  getFinding: vi.fn(),
  getReviewEvidence: vi.fn(),
  recordFindingDecision: vi.fn(),
  searchProjectEvidence: vi.fn(),
}));

vi.mock("@/lib/workspace/access", () => ({
  assertWorkspaceMembership: mocks.assertWorkspaceMembership,
}));

vi.mock("@/lib/review-intelligence/jobs", () => ({
  getReviewProgress: mocks.getReviewProgress,
}));

vi.mock("@/lib/review-intelligence/findings", () => ({
  listFindings: mocks.listFindings,
  getFinding: mocks.getFinding,
  getReviewEvidence: mocks.getReviewEvidence,
  recordFindingDecision: mocks.recordFindingDecision,
  searchProjectEvidence: mocks.searchProjectEvidence,
}));

vi.mock("@/lib/db/prisma", () => ({ prisma: {} }));

import {
  calculateReviewFindingImpact,
  getReviewEvidence,
  getReviewFinding,
  getReviewSummary,
  listReviewFindings,
  searchProjectEvidence,
  recordReviewFindingDecision,
  reviewIntelligenceTools,
} from "./review-intelligence-tools";
import { allTools } from "./agent/tools";

const viewerSession = { userId: "user-1", companyId: "company-1" } as const;

describe("review intelligence tools", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.assertWorkspaceMembership.mockResolvedValue({ companyId: "company-1", role: "VIEWER" });
  });

  it("lee un resumen persistido sin necesitar proveedor IA", async () => {
    mocks.getReviewProgress.mockResolvedValue({
      reviewRunId: "run-1",
      status: "COMPLETED",
      progress: { stage: "completed", completed: 8, total: 8, percent: 100, metrics: { analyzedItems: 2 } },
      warnings: [],
    });

    await expect(getReviewSummary("run-1", viewerSession)).resolves.toMatchObject({
      reviewRunId: "run-1",
      status: "COMPLETED",
    });
    expect(mocks.getReviewProgress).toHaveBeenCalledWith("run-1", "company-1", expect.anything());
  });

  it("valida filtros con Zod y lista hallazgos del tenant", async () => {
    mocks.listFindings.mockResolvedValue({ findings: [], page: 1, pageSize: 20, hasNextPage: false });

    await listReviewFindings({ reviewRunId: "run-1", page: 1, pageSize: 20, findingType: "QUANTITY_MISMATCH" }, viewerSession);

    expect(mocks.listFindings).toHaveBeenCalledWith(expect.objectContaining({
      reviewRunId: "run-1",
      companyId: "company-1",
      findingType: "QUANTITY_MISMATCH",
    }));
    await expect(listReviewFindings({ reviewRunId: "run-1", page: 0, pageSize: 20 }, viewerSession)).rejects.toThrow();
  });

  it("rechaza cross-tenant y no ejecuta servicios con una sesión inválida", async () => {
    await expect(getReviewFinding("finding-1", { userId: "user-1", companyId: "company-2" })).rejects.toThrow();
    expect(mocks.getFinding).not.toHaveBeenCalled();
  });

  it("calcula impacto desde la comparación persistida con Decimal", async () => {
    mocks.getFinding.mockResolvedValue({
      id: "finding-1",
      findingType: "QUANTITY_MISMATCH",
      comparison: { documentValue: "10.800", budgetValue: "10.000", potentialImpact: "80.00" },
    });

    await expect(calculateReviewFindingImpact("finding-1", viewerSession)).resolves.toMatchObject({
      findingId: "finding-1",
      difference: "0.8",
      potentialImpact: "80",
      source: "persisted-comparison",
    });
  });

  it("registra una decisión explícita sólo con rol editor", async () => {
    mocks.assertWorkspaceMembership.mockResolvedValue({ companyId: "company-1", role: "EDITOR" });
    mocks.recordFindingDecision.mockResolvedValue({ id: "decision-1", findingId: "finding-1", resolution: "CONFIRMED_ISSUE" });

    await recordReviewFindingDecision({
      findingId: "finding-1",
      resolution: "CONFIRMED_ISSUE",
      expectedUpdatedAt: "2026-09-03T12:00:00.000Z",
      note: "Confirmado por revisión humana",
    }, viewerSession);

    expect(mocks.recordFindingDecision).toHaveBeenCalledWith(expect.objectContaining({
      findingId: "finding-1",
      companyId: "company-1",
      userId: "user-1",
      resolution: "CONFIRMED_ISSUE",
      expectedUpdatedAt: new Date("2026-09-03T12:00:00.000Z"),
    }));
  });

  it("no cierra ni muta automáticamente y registra las seis tools", () => {
    expect(reviewIntelligenceTools.map((tool) => tool.name)).toEqual([
      "getReviewSummary",
      "listReviewFindings",
      "getReviewFinding",
      "getReviewEvidence",
      "searchProjectEvidence",
      "calculateReviewFindingImpact",
      "recordReviewFindingDecision",
    ]);
    expect(reviewIntelligenceTools.find((tool) => tool.name === "recordReviewFindingDecision")?.risk).toBe("write");
    expect(allTools.map((tool) => tool.name)).toEqual(expect.arrayContaining([
      "getReviewSummary",
      "listReviewFindings",
      "getReviewFinding",
      "getReviewEvidence",
      "searchProjectEvidence",
      "calculateReviewFindingImpact",
      "recordReviewFindingDecision",
    ]));
  });
});
