import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdminSession: vi.fn(),
  getBetaCampaignDetail: vi.fn(),
  listBetaGrants: vi.fn(),
  transitionBetaCampaign: vi.fn(),
  recordAdminAudit: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/auth/session", () => ({ requireAdminSession: mocks.requireAdminSession }));
vi.mock("@/lib/beta/campaigns", () => ({
  getBetaCampaignDetail: mocks.getBetaCampaignDetail,
  listBetaGrants: mocks.listBetaGrants,
  transitionBetaCampaign: mocks.transitionBetaCampaign,
}));
vi.mock("@/lib/data/admin-audit", () => ({ recordAdminAudit: mocks.recordAdminAudit }));

import { GET, PATCH } from "@/app/api/admin/beta/campaigns/[id]/route";

describe("admin beta campaign detail route", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns campaign detail for users with beta read access", async () => {
    mocks.requireAdminSession.mockResolvedValue({ user: { id: "admin-1" } });
    const campaign = { id: "campaign-1", name: "Piloto Pro", grants: [] };
    mocks.getBetaCampaignDetail.mockResolvedValue(campaign);

    const response = await GET(new Request("http://localhost/api/admin/beta/campaigns/campaign-1"), {
      params: Promise.resolve({ id: "campaign-1" }),
    });

    expect(response.status).toBe(200);
    expect(mocks.getBetaCampaignDetail).toHaveBeenCalledWith("campaign-1");
    await expect(response.json()).resolves.toEqual({ campaign });
  });

  it("returns not found when the campaign does not exist", async () => {
    mocks.requireAdminSession.mockResolvedValue({ user: { id: "admin-1" } });
    mocks.getBetaCampaignDetail.mockResolvedValue(null);

    const response = await GET(new Request("http://localhost/api/admin/beta/campaigns/missing"), {
      params: Promise.resolve({ id: "missing" }),
    });

    expect(response.status).toBe(404);
  });

  it("returns filtered and paginated grants for a campaign", async () => {
    mocks.requireAdminSession.mockResolvedValue({ user: { id: "admin-1" } });
    mocks.getBetaCampaignDetail.mockResolvedValue({ id: "campaign-1", name: "Piloto Pro", grants: [] });
    mocks.listBetaGrants.mockResolvedValue({
      grants: [{ id: "grant-1", userId: "user-1" }],
      pagination: { page: 2, pageSize: 25, total: 30, totalPages: 2 },
      filters: { query: "ana", status: "ACTIVE", source: "ADMIN" },
    });

    const response = await GET(new Request("http://localhost/api/admin/beta/campaigns/campaign-1?q=ana&status=ACTIVE&source=ADMIN&page=2&pageSize=25"), {
      params: Promise.resolve({ id: "campaign-1" }),
    });

    expect(response.status).toBe(200);
    expect(mocks.listBetaGrants).toHaveBeenCalledWith({
      campaignId: "campaign-1",
      query: "ana",
      status: "ACTIVE",
      source: "ADMIN",
      page: 2,
      pageSize: 25,
    });
    await expect(response.json()).resolves.toMatchObject({ grantsPagination: { total: 30 } });
  });

  it("transitions a campaign and invalidates the admin page", async () => {
    mocks.requireAdminSession.mockResolvedValue({ user: { id: "admin-1", email: "admin@example.com" } });
    const campaign = { id: "campaign-1", name: "Piloto Pro", status: "PAUSED" };
    mocks.transitionBetaCampaign.mockResolvedValue(campaign);
    mocks.recordAdminAudit.mockResolvedValue(undefined);

    const response = await PATCH(new Request("http://localhost/api/admin/beta/campaigns/campaign-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "PAUSED" }),
    }), { params: Promise.resolve({ id: "campaign-1" }) });

    expect(response.status).toBe(200);
    expect(mocks.transitionBetaCampaign).toHaveBeenCalledWith("campaign-1", "PAUSED");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin");
    expect(response.headers.get("content-type")).toContain("application/json");
  });
});
