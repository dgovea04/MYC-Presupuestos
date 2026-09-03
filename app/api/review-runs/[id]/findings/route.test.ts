import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAuthSession: vi.fn(),
  assertWorkspaceMembership: vi.fn(),
  listFindings: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({ getAuthSession: mocks.getAuthSession }));
vi.mock("@/lib/workspace/access", () => ({ assertWorkspaceMembership: mocks.assertWorkspaceMembership }));
vi.mock("@/lib/review-intelligence/findings", () => ({ listFindings: mocks.listFindings }));

import { GET } from "@/app/api/review-runs/[id]/findings/route";

describe("review findings list API", () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
    mocks.getAuthSession.mockResolvedValue({ user: { id: "user-1", activeCompanyId: "company-1" } });
    mocks.assertWorkspaceMembership.mockResolvedValue(undefined);
    mocks.listFindings.mockResolvedValue({ findings: [], page: 1, pageSize: 25, hasNextPage: false });
  });

  it("requires authentication", async () => {
    mocks.getAuthSession.mockResolvedValue(null);
    const response = await GET(new Request("http://localhost/api/review-runs/run-1/findings"), { params: Promise.resolve({ id: "run-1" }) });
    expect(response.status).toBe(401);
  });

  it("passes validated filters and tenant scope to the service", async () => {
    const response = await GET(new Request("http://localhost/api/review-runs/run-1/findings?page=2&pageSize=10&status=PENDING&findingType=QUANTITY_MISMATCH&priority=0.75&discipline=Estructuras&subbudget=sub-1&document=doc-1"), { params: Promise.resolve({ id: "run-1" }) });
    expect(response.status).toBe(200);
    expect(mocks.listFindings).toHaveBeenCalledWith(expect.objectContaining({ reviewRunId: "run-1", companyId: "company-1", page: 2, pageSize: 10, status: "PENDING", findingType: "QUANTITY_MISMATCH", priority: 0.75, discipline: "Estructuras", subbudget: "sub-1", document: "doc-1" }));
  });

  it("rejects invalid pagination before querying", async () => {
    const response = await GET(new Request("http://localhost/api/review-runs/run-1/findings?page=0"), { params: Promise.resolve({ id: "run-1" }) });
    expect(response.status).toBe(400);
    expect(mocks.listFindings).not.toHaveBeenCalled();
  });
});
