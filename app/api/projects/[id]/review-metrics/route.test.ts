import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getAuthSession: vi.fn(), membership: vi.fn(), projectFind: vi.fn(), findMany: vi.fn(), calculate: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ getAuthSession: mocks.getAuthSession }));
vi.mock("@/lib/workspace/access", () => ({ assertWorkspaceMembership: mocks.membership }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { project: { findFirst: mocks.projectFind }, reviewRun: { findMany: mocks.findMany }, reviewFinding: { findMany: mocks.findMany }, findingDecision: { findMany: mocks.findMany } } }));
vi.mock("@/lib/review-intelligence/pilot-metrics", () => ({ calculateReviewPilotMetrics: mocks.calculate }));

import { GET } from "@/app/api/projects/[id]/review-metrics/route";

describe("review metrics route", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.getAuthSession.mockResolvedValue({ user: { id: "user-1", companyId: "company-1", activeCompanyId: "company-1" } });
    mocks.membership.mockResolvedValue({ role: "VIEWER" });
    mocks.projectFind.mockResolvedValue({ id: "project-1" });
    mocks.findMany.mockResolvedValue([]);
    mocks.calculate.mockReturnValue({ runs: { total: 0 } });
  });

  it("scopea por proyecto y pasa la ventana al calculador", async () => {
    const response = await GET(new Request("http://localhost/api/projects/project-1/review-metrics?from=2026-09-01&to=2026-09-05"), { params: Promise.resolve({ id: "project-1" }) });
    expect(response.status).toBe(200);
    expect(mocks.membership).toHaveBeenCalledWith({ userId: "user-1", companyId: "company-1", minimumRole: "VIEWER" });
    expect(mocks.calculate).toHaveBeenCalledWith(expect.objectContaining({ window: { from: new Date("2026-09-01T00:00:00.000Z"), to: new Date("2026-09-05T23:59:59.999Z") } }));
  });
});
