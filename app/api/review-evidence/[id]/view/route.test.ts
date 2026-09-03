import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getAuthSession: vi.fn(), assertWorkspaceMembership: vi.fn(), viewReviewEvidence: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ getAuthSession: mocks.getAuthSession }));
vi.mock("@/lib/workspace/access", () => ({ assertWorkspaceMembership: mocks.assertWorkspaceMembership }));
vi.mock("@/lib/review-intelligence/findings", () => ({ viewReviewEvidence: mocks.viewReviewEvidence }));

import { GET } from "@/app/api/review-evidence/[id]/view/route";

describe("review evidence view API", () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
    mocks.getAuthSession.mockResolvedValue({ user: { id: "user-1", activeCompanyId: "company-1" } });
    mocks.assertWorkspaceMembership.mockResolvedValue(undefined);
    mocks.viewReviewEvidence.mockResolvedValue({ evidenceId: "evidence-1", originalText: "Texto fuente", expiresAt: "2026-09-02T12:05:00.000Z" });
  });

  it("returns only an authorized temporary evidence view", async () => {
    const response = await GET(new Request("http://localhost/api/review-evidence/evidence-1/view?token=temp"), { params: Promise.resolve({ id: "evidence-1" }) });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(expect.objectContaining({ evidenceId: "evidence-1", expiresAt: expect.any(String) }));
    expect(mocks.viewReviewEvidence).toHaveBeenCalledWith(expect.objectContaining({ evidenceId: "evidence-1", companyId: "company-1", userId: "user-1", token: "temp" }));
  });
});
