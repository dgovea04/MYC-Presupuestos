import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAuthSession: vi.fn(),
  assertWorkspaceMembership: vi.fn(),
  readReviewRunStatus: vi.fn(),
  markReviewRunStatus: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({ getAuthSession: mocks.getAuthSession }));
vi.mock("@/lib/workspace/access", () => ({ assertWorkspaceMembership: mocks.assertWorkspaceMembership }));
vi.mock("@/lib/review-intelligence/lifecycle", () => ({ readReviewRunStatus: mocks.readReviewRunStatus, markReviewRunStatus: mocks.markReviewRunStatus }));
vi.mock("@/lib/db/prisma", () => ({ prisma: {} }));

import { GET, POST } from "@/app/api/review-runs/[id]/review-status/route";

describe("review status API", () => {
  it("allows VIEWER to read lifecycle status", async () => {
    mocks.getAuthSession.mockResolvedValue({ user: { id: "user-1", activeCompanyId: "company-1" } });
    mocks.assertWorkspaceMembership.mockResolvedValue({ role: "VIEWER" });
    mocks.readReviewRunStatus.mockResolvedValue({ id: "run-1", status: "UNDER_REVIEW", pendingFindingCount: 1 });
    const response = await GET(new Request("http://localhost/api/review-runs/run-1/review-status"), { params: Promise.resolve({ id: "run-1" }) });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ status: "UNDER_REVIEW" });
    expect(mocks.assertWorkspaceMembership).toHaveBeenCalledWith({ userId: "user-1", companyId: "company-1", minimumRole: "VIEWER" });
  });

  it("requires EDITOR and transports expectedUpdatedAt, role, and correlationId for action", async () => {
    mocks.getAuthSession.mockResolvedValue({ user: { id: "user-1", activeCompanyId: "company-1" } });
    mocks.assertWorkspaceMembership.mockResolvedValue({ role: "EDITOR" });
    mocks.markReviewRunStatus.mockResolvedValue({ id: "run-1", status: "REVIEWED", pendingFindingCount: 0 });
    const response = await POST(new Request("http://localhost/api/review-runs/run-1/review-status", { method: "POST", headers: { "Content-Type": "application/json", "X-Correlation-Id": "corr-1" }, body: JSON.stringify({ targetStatus: "REVIEWED", expectedUpdatedAt: "2026-09-03T12:00:00.000Z" }) }), { params: Promise.resolve({ id: "run-1" }) });
    expect(response.status).toBe(200);
    expect(mocks.assertWorkspaceMembership).toHaveBeenCalledWith({ userId: "user-1", companyId: "company-1", minimumRole: "EDITOR" });
    expect(mocks.markReviewRunStatus).toHaveBeenCalledWith(expect.objectContaining({ runId: "run-1", role: "EDITOR", correlationId: "corr-1", expectedUpdatedAt: new Date("2026-09-03T12:00:00.000Z") }), expect.anything());
  });
});
