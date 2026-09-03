import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAuthSession: vi.fn(),
  budgetFindFirst: vi.fn(),
  budgetFindMany: vi.fn(),
  reviewRunFindMany: vi.fn(),
  reviewRunCount: vi.fn(),
  runReviewJob: vi.fn(),
  projectDocumentFindMany: vi.fn(),
  documentVersionFindMany: vi.fn(),
  budgetItemFindMany: vi.fn(),
  reviewEvidenceFindMany: vi.fn(),
  reviewFindingDeleteMany: vi.fn(),
  findingDecisionDeleteMany: vi.fn(),
  reviewAuditEventDeleteMany: vi.fn(),
  reviewRunDocumentVersionDeleteMany: vi.fn(),
  reviewRunDeleteMany: vi.fn(),
  transaction: vi.fn(),
  assertWorkspaceMembership: vi.fn(),
  after: vi.fn(),
}));

vi.mock("next/server", async () => {
  const actual = await vi.importActual<typeof import("next/server")>("next/server");
  return { ...actual, after: mocks.after };
});
vi.mock("@/lib/auth/session", () => ({ getAuthSession: mocks.getAuthSession }));
vi.mock("@/lib/db/prisma", () => ({ prisma: {
  budget: { findFirst: mocks.budgetFindFirst, findMany: mocks.budgetFindMany },
  reviewRun: { findMany: mocks.reviewRunFindMany, count: mocks.reviewRunCount },
  projectDocument: { findMany: mocks.projectDocumentFindMany },
  documentVersion: { findMany: mocks.documentVersionFindMany },
  budgetItem: { findMany: mocks.budgetItemFindMany },
  reviewEvidence: { findMany: mocks.reviewEvidenceFindMany },
  reviewFinding: { deleteMany: mocks.reviewFindingDeleteMany },
  findingDecision: { deleteMany: mocks.findingDecisionDeleteMany },
  reviewAuditEvent: { deleteMany: mocks.reviewAuditEventDeleteMany },
  reviewRunDocumentVersion: { deleteMany: mocks.reviewRunDocumentVersionDeleteMany },
  $transaction: mocks.transaction,
} }));
vi.mock("@/lib/review-intelligence/pipeline", () => ({ runReviewJob: mocks.runReviewJob }));
vi.mock("@/lib/workspace/access", () => ({ assertWorkspaceMembership: mocks.assertWorkspaceMembership }));

import { DELETE, GET, POST } from "@/app/api/budgets/[id]/review-runs/route";

const configuration = { maxFiles: 1, maxPdfPages: 300, maxFileSizeMb: 50, maxXlsxSheets: 20, tolerancePercent: "1", findingTypes: ["QUANTITY_MISMATCH"] };

describe("review runs API", () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
    mocks.getAuthSession.mockResolvedValue({ user: { id: "user-1", activeCompanyId: "company-1" } });
    mocks.budgetFindFirst.mockResolvedValue({ id: "budget-1", projectId: "project-1", project: { id: "project-1", companyId: "company-1" } });
    mocks.budgetFindMany.mockResolvedValue([{ id: "budget-1", parentBudgetId: null }]);
    mocks.reviewRunFindMany.mockResolvedValue([]);
    mocks.reviewRunCount.mockResolvedValue(0);
    mocks.assertWorkspaceMembership.mockResolvedValue(undefined);
    mocks.after.mockImplementation((callback: () => void | Promise<void>) => { void callback(); });
    mocks.documentVersionFindMany.mockResolvedValue([{ id: "version-1", projectDocumentId: "document-1" }]);
    mocks.budgetItemFindMany.mockResolvedValue([]);
    mocks.reviewEvidenceFindMany.mockResolvedValue([]);
    mocks.transaction.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) => callback({
      reviewFinding: { deleteMany: mocks.reviewFindingDeleteMany },
      findingDecision: { deleteMany: mocks.findingDecisionDeleteMany },
      reviewAuditEvent: { deleteMany: mocks.reviewAuditEventDeleteMany },
      reviewRunDocumentVersion: { deleteMany: mocks.reviewRunDocumentVersionDeleteMany },
      reviewRun: { deleteMany: mocks.reviewRunDeleteMany },
    }));
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
    mocks.runReviewJob.mockImplementation(async (input: { defer?: boolean; idempotencyKey?: string }) => ({ reviewRunId: "review-1", status: input.defer ? "QUEUED" : "RUNNING", idempotencyKey: input.idempotencyKey ?? "key-1" }));
    const response = await POST(new Request("http://localhost/api/budgets/budget-1/review-runs", { method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": "key-1" }, body: JSON.stringify({ configuration, documentVersionIds: ["version-1"] }) }), { params: Promise.resolve({ id: "budget-1" }) });
    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toEqual({ reviewRunId: "review-1", status: "QUEUED", idempotencyKey: "key-1" });
    expect(mocks.runReviewJob).toHaveBeenCalledWith(expect.objectContaining({ companyId: "company-1", projectId: "project-1", budgetId: "budget-1", createdById: "user-1", documentVersionIds: ["version-1"], idempotencyKey: "key-1" }), expect.anything());
  });

  it("transports the persisted APU specification and resources into the review pipeline", async () => {
    mocks.budgetItemFindMany.mockResolvedValue([{ id: "item-1", budgetId: "budget-1", code: "A-1", description: "Concreto", unit: "m3", quantity: "10", unitPrice: "100", discipline: "Estructuras", apu: { name: "f'c 210 kg/cm2", resources: [{ quantity: "1", resource: { code: "MAT-1", description: "Cemento" }, catalogPartida: null }, { quantity: "2", resource: null, catalogPartida: { description: "Arena" } }] } }]);
    mocks.runReviewJob.mockImplementation(async (input: { defer?: boolean; idempotencyKey?: string }) => ({ reviewRunId: "review-technical", status: input.defer ? "QUEUED" : "RUNNING", idempotencyKey: input.idempotencyKey ?? "key-technical" }));
    await POST(new Request("http://localhost/api/budgets/budget-1/review-runs", { method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": "key-technical" }, body: JSON.stringify({ configuration, documentVersionIds: ["version-1"] }) }), { params: Promise.resolve({ id: "budget-1" }) });
    expect(mocks.runReviewJob).toHaveBeenCalledWith(expect.objectContaining({ budgetItems: [expect.objectContaining({ technicalSpecification: "f'c 210 kg/cm2", apuComponents: ["Cemento", "Arena"] })] }), expect.anything());
  });

  it("returns 409 when an active run already exists", async () => {
    mocks.runReviewJob.mockRejectedValue(new Error("An active review run already exists for this budget."));
    const response = await POST(new Request("http://localhost/api/budgets/budget-1/review-runs", { method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": "key-1" }, body: JSON.stringify({ configuration, documentVersionIds: ["version-1"] }) }), { params: Promise.resolve({ id: "budget-1" }) });
    expect(response.status).toBe(409);
  });

  it("clears all review history for the budget only with explicit confirmation", async () => {
    mocks.reviewRunFindMany.mockResolvedValue([{ id: "run-2" }, { id: "run-1" }]);
    const response = await DELETE(new Request("http://localhost/api/budgets/budget-1/review-runs", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirmation: "LIMPIAR REVISIONES" }) }), { params: Promise.resolve({ id: "budget-1" }) });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ deletedRuns: 2 });
    expect(mocks.reviewFindingDeleteMany).toHaveBeenCalledWith({ where: { reviewRunId: { in: ["run-2", "run-1"] }, companyId: "company-1", projectId: "project-1" } });
    expect(mocks.reviewRunDeleteMany).toHaveBeenCalledWith({ where: { id: { in: ["run-2", "run-1"] }, companyId: "company-1", projectId: "project-1", budgetId: "budget-1" } });
  });

  it("does not report a next page when the final page has exactly pageSize runs", async () => {
    mocks.reviewRunFindMany.mockResolvedValue([{ id: "run-2" }, { id: "run-1" }]);
    const response = await GET(new Request("http://localhost/api/budgets/budget-1/review-runs?pageSize=2"), { params: Promise.resolve({ id: "budget-1" }) });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(expect.objectContaining({ runs: [{ id: "run-2" }, { id: "run-1" }], hasNextPage: false }));
    expect(mocks.reviewRunFindMany).toHaveBeenCalledWith(expect.objectContaining({ take: 3, orderBy: [{ createdAt: "desc" }, { id: "desc" }] }));
  });

  it("returns before a long analysis finishes and schedules the runner", async () => {
    let release: (() => void) | undefined;
    mocks.runReviewJob.mockImplementation(async (input: { defer?: boolean }) => {
      if (!input.defer) await new Promise<void>((resolve) => { release = resolve; });
      return { reviewRunId: "review-queued", status: "QUEUED", idempotencyKey: "key-long" };
    });
    const responsePromise = POST(new Request("http://localhost/api/budgets/budget-1/review-runs", { method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": "key-long" }, body: JSON.stringify({ configuration, documentVersionIds: ["version-1"] }) }), { params: Promise.resolve({ id: "budget-1" }) });
    const response = await Promise.race([responsePromise, new Promise<never>((_, reject) => setTimeout(() => reject(new Error("route blocked")), 100))]);
    expect(response.status).toBe(202);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(mocks.runReviewJob).toHaveBeenCalledWith(expect.objectContaining({ idempotencyKey: "key-long" }), expect.anything());
    expect(mocks.after).toHaveBeenCalledTimes(1);
    release?.();
  });

  it("schedules the deferred worker with Next's response-lifetime hook", async () => {
    mocks.runReviewJob.mockResolvedValue({ reviewRunId: "review-queued", status: "QUEUED", idempotencyKey: "key-after" });
    await POST(new Request("http://localhost/api/budgets/budget-1/review-runs", { method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": "key-after" }, body: JSON.stringify({ configuration, documentVersionIds: ["version-1"] }) }), { params: Promise.resolve({ id: "budget-1" }) });
    expect(mocks.after).toHaveBeenCalledTimes(1);
  });
});
