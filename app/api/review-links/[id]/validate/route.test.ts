import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAuthSession: vi.fn(),
  assertWorkspaceMembership: vi.fn(),
  validateReviewLink: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({ getAuthSession: mocks.getAuthSession }));
vi.mock("@/lib/workspace/access", () => ({ assertWorkspaceMembership: mocks.assertWorkspaceMembership }));
vi.mock("@/lib/review-intelligence/findings", () => ({ validateReviewLink: mocks.validateReviewLink }));

import { POST } from "@/app/api/review-links/[id]/validate/route";

describe("review link validation API", () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
    mocks.getAuthSession.mockResolvedValue({ user: { id: "user-1", activeCompanyId: "company-1" } });
    mocks.assertWorkspaceMembership.mockResolvedValue(undefined);
    mocks.validateReviewLink.mockResolvedValue({ id: "link-1", validationStatus: "VALIDATED" });
  });

  it("requires an explicit human validation status", async () => {
    const response = await POST(new Request("http://localhost/api/review-links/link-1/validate", { method: "POST", headers: { "Content-Type": "application/json", "X-Correlation-Id": "corr-link" }, body: JSON.stringify({ validationStatus: "CONFIRMED" }) }), { params: Promise.resolve({ id: "link-1" }) });
    expect(response.status).toBe(200);
    expect(mocks.validateReviewLink).toHaveBeenCalledWith({ linkId: "link-1", companyId: "company-1", userId: "user-1", validationStatus: "CONFIRMED", correlationId: "corr-link", role: "EDITOR" });
  });
});
