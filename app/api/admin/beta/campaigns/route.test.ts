import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdminSession: vi.fn(),
  createBetaCampaign: vi.fn(),
  listBetaCampaigns: vi.fn(),
  recordAdminAudit: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({ requireAdminSession: mocks.requireAdminSession }));
vi.mock("@/lib/beta/campaigns", () => ({
  createBetaCampaign: mocks.createBetaCampaign,
  listBetaCampaigns: mocks.listBetaCampaigns,
}));
vi.mock("@/lib/data/admin-audit", () => ({ recordAdminAudit: mocks.recordAdminAudit }));

import { GET, POST } from "@/app/api/admin/beta/campaigns/route";

describe("admin beta campaigns route", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("rejects campaign reads without beta permission", async () => {
    mocks.requireAdminSession.mockResolvedValue(null);

    const response = await GET(new Request("http://localhost/api/admin/beta/campaigns"));

    expect(response.status).toBe(403);
    expect(mocks.listBetaCampaigns).not.toHaveBeenCalled();
  });

  it("normalizes list filters before calling the service", async () => {
    mocks.requireAdminSession.mockResolvedValue({ user: { id: "admin-1" } });
    mocks.listBetaCampaigns.mockResolvedValue({ campaigns: [], pagination: { page: 2, pageSize: 10, total: 0, totalPages: 1 } });

    const response = await GET(new Request("http://localhost/api/admin/beta/campaigns?status=ACTIVE&page=2&pageSize=10"));

    expect(response.status).toBe(200);
    expect(mocks.listBetaCampaigns).toHaveBeenCalledWith({ status: "ACTIVE", page: 2, pageSize: 10 });
    await expect(response.json()).resolves.toMatchObject({ campaigns: [] });
  });

  it("creates a campaign through the domain service and audits it", async () => {
    mocks.requireAdminSession.mockResolvedValue({ user: { id: "admin-1", email: "admin@example.com" } });
    const campaign = { id: "campaign-1", name: "Piloto Pro", durationDays: 60, assignmentMode: "ADMIN" };
    mocks.createBetaCampaign.mockResolvedValue(campaign);
    mocks.recordAdminAudit.mockResolvedValue(undefined);

    const input = {
      name: "Piloto Pro",
      durationDays: 60,
      assignmentMode: "ADMIN",
      startsAt: "2026-09-01T00:00:00.000Z",
      eligibilityRules: {},
    };
    const response = await POST(new Request("http://localhost/api/admin/beta/campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }));

    expect(response.status).toBe(201);
    expect(mocks.createBetaCampaign).toHaveBeenCalledWith(input, "admin-1");
    expect(mocks.recordAdminAudit).toHaveBeenCalledWith(expect.objectContaining({
      actorUserId: "admin-1",
      action: "BETA_CAMPAIGN_CREATED",
      metadata: expect.objectContaining({ campaignId: "campaign-1" }),
    }));
  });
});
