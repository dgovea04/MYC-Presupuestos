import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAuthSession: vi.fn(),
  budgetFindFirst: vi.fn(),
  reviewRunFindMany: vi.fn(),
  reviewRunCount: vi.fn(),
  runReviewJob: vi.fn(),
  projectDocumentFindMany: vi.fn(),
  documentVersionFindMany: vi.fn(),
  budgetItemFindMany: vi.fn(),
  reviewEvidenceFindMany: vi.fn(),
  assertWorkspaceMembership: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({ getAuthSession: mocks.getAuthSession }));
vi.mock("@/lib/db/prisma", () => ({ prisma: {
  budget: { findFirst: mocks.budgetFindFirst },
  reviewRun: { findMany: mocks.reviewRunFindMany, count: mocks.reviewRunCount },
  projectDocument: { findMany: mocks.projectDocumentFindMany },
  documentVersion: { findMany: mocks.documentVersionFindMany },
  budgetItem: { findMany: mocks.budgetItemFindMany },
  reviewEvidence: { findMany: mocks.reviewEvidenceFindMany },
} }));
vi.mock("@/lib/review-intelligence/pipeline", () => ({ runReviewJob: mocks.runReviewJob }));
vi.mock("@/lib/workspace/access", () => ({ assertWorkspaceMembership: mocks.assertWorkspaceMembership }));

import { GET, POST } from "@/app/api/budgets/[id]/review-runs/route";

const configuration = { maxFiles: 1, maxPdfPages: 300, maxFileSizeMb: 50, maxXlsxSheets: 20, tolerancePercent: "1", findingTypes: ["QUANTITY_MISMATCH"] };

describe("review runs API", () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
    mocks.getAuthSession.mockResolvedValue({ user: { id: "user-1" } });
    mocks.budgetFindFirst.mockResolvedValue({ id: "budget-1", projectId: "project-1", project: { id: "project-1", companyId: "company-1" } });
    mocks.reviewRunFindMany.mockResolvedValue([]);
    mocks.reviewRunCount.mockResolvedValue(0);
    mocks.assertWorkspaceMembership.mockResolvedValue(undefined);
    mocks.documentVersionFindMany.mockResolvedValue([{ id: "version-1", projectDocumentId: "document-1" }]);
    mocks.budgetItemFindMany.mockResolvedValue([]);
    mocks.reviewEvidenceFindMany.mockResolvedValue([]);
  });

  it("returns 401 without a session", async () => {
    mocks.getAuthSession.mockResolvedValue(null);
    const response = await GET(new Request("http://localhost/api/budgets/budget-1/review-runs"), { params: Promise.resolve({ id: "budget-1" }) });
    expect(response.status).toBe(401);
  });

  it("returns 403 for a budget outside the session tenant", async () => {
    mocks.budgetFindFirst.mockResolvedValue({ id: "budget-1", projectId: "project-1", project: { id: "project-1", companyId: "other-company" } });
    mocks.assertWorkspaceMembership.mockRejectedValue(new Error("Workspace no disponible"));
    const response = await GET(new Request("http://localhost/api/budgets/budget-1/review-runs"), { params: Promise.resolve({ id: "budget-1" }) });
    expect(response.status).toBe(403);
  });

  it("rejects an invalid run configuration", async () => {
    const response = await POST(new Request("http://localhost/api/budgets/budget-1/review-runs", { method: "POST", body: JSON.stringify({ configuration: { ...configuration, maxFiles: 11 } }), headers: { "Content-Type": "application/json" } }), { params: Promise.resolve({ id: "budget-1" }) });
    expect(response.status).toBe(400);
    expect(mocks.runReviewJob).not.toHaveBeenCalled();
  });

  it("returns the idempotent run contract for a valid request", async () => {
    mocks.runReviewJob.mockResolvedValue({ reviewRunId: "review-1", status: "RUNNING", idempotencyKey: "key-1" });
    const response = await POST(new Request("http://localhost/api/budgets/budget-1/review-runs", { method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": "key-1" }, body: JSON.stringify({ configuration, documentVersionIds: ["version-1"] }) }), { params: Promise.resolve({ id: "budget-1" }) });
    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toEqual({ reviewRunId: "review-1", status: "RUNNING", idempotencyKey: "key-1" });
    expect(mocks.runReviewJob).toHaveBeenCalledWith(expect.objectContaining({ companyId: "company-1", projectId: "project-1", budgetId: "budget-1", createdById: "user-1", documentVersionIds: ["version-1"] }), expect.anything());
  });

  it("returns 409 when an active run already exists", async () => {
    mocks.runReviewJob.mockRejectedValue(new Error("An active review run already exists for this budget."));
    const response = await POST(new Request("http://localhost/api/budgets/budget-1/review-runs", { method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": "key-1" }, body: JSON.stringify({ configuration, documentVersionIds: ["version-1"] }) }), { params: Promise.resolve({ id: "budget-1" }) });
    expect(response.status).toBe(409);
  });
});
