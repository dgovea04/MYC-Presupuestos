import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAuthSession: vi.fn(),
  assertWorkspaceMembership: vi.fn(),
  recordFindingDecision: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({ getAuthSession: mocks.getAuthSession }));
vi.mock("@/lib/workspace/access", () => ({ assertWorkspaceMembership: mocks.assertWorkspaceMembership }));
vi.mock("@/lib/review-intelligence/findings", () => ({ recordFindingDecision: mocks.recordFindingDecision }));

import { POST } from "@/app/api/review-findings/[id]/decisions/route";

describe("finding decisions API", () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
    mocks.getAuthSession.mockResolvedValue({ user: { id: "user-1", activeCompanyId: "company-1" } });
    mocks.assertWorkspaceMembership.mockResolvedValue(undefined);
    mocks.recordFindingDecision.mockResolvedValue({ id: "decision-1", resolution: "ACCEPTED" });
  });

  it("requires editor access and records the expected version", async () => {
    const response = await POST(new Request("http://localhost/api/review-findings/finding-1/decisions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ resolution: "ACCEPTED", expectedUpdatedAt: "2026-09-02T12:00:00.000Z", note: "Verificado" }) }), { params: Promise.resolve({ id: "finding-1" }) });
    expect(response.status).toBe(201);
    expect(mocks.assertWorkspaceMembership).toHaveBeenCalledWith({ userId: "user-1", companyId: "company-1", minimumRole: "EDITOR" });
    expect(mocks.recordFindingDecision).toHaveBeenCalledWith(expect.objectContaining({ findingId: "finding-1", companyId: "company-1", userId: "user-1", expectedUpdatedAt: new Date("2026-09-02T12:00:00.000Z") }));
  });

  it("returns conflict when optimistic concurrency requires reconfirmation", async () => {
    mocks.recordFindingDecision.mockRejectedValue(new Error("Finding changed; reconfirmation required."));
    const response = await POST(new Request("http://localhost/api/review-findings/finding-1/decisions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ resolution: "CORRECTED", expectedUpdatedAt: "2026-09-02T12:00:00.000Z" }) }), { params: Promise.resolve({ id: "finding-1" }) });
    expect(response.status).toBe(409);
  });
});
