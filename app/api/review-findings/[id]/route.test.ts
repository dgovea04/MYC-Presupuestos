import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getAuthSession: vi.fn(), assertWorkspaceMembership: vi.fn(), getFinding: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ getAuthSession: mocks.getAuthSession }));
vi.mock("@/lib/workspace/access", () => ({ assertWorkspaceMembership: mocks.assertWorkspaceMembership }));
vi.mock("@/lib/review-intelligence/findings", () => ({ getFinding: mocks.getFinding }));

import { GET } from "@/app/api/review-findings/[id]/route";

describe("finding detail API", () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
    mocks.getAuthSession.mockResolvedValue({ user: { id: "user-1", activeCompanyId: "company-1" } });
    mocks.assertWorkspaceMembership.mockResolvedValue(undefined);
    mocks.getFinding.mockResolvedValue({ id: "finding-1", evidence: { provenance: { sourceHash: "hash" }, viewUrl: "/api/review-evidence/evidence-1/view?token=temp" } });
  });

  it("returns comparison and provenance without a permanent storage URL", async () => {
    const response = await GET(new Request("http://localhost/api/review-findings/finding-1"), { params: Promise.resolve({ id: "finding-1" }) });
    expect(response.status).toBe(200);
    const body = await response.json() as { evidence: { viewUrl: string } };
    expect(body.evidence.viewUrl).toContain("token=");
    expect(body).not.toHaveProperty("storageKey");
  });
});
