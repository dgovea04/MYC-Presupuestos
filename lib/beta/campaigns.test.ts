import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  campaignFindUnique: vi.fn(),
  campaignFindMany: vi.fn(),
  campaignCount: vi.fn(),
  campaignUpdate: vi.fn(),
  grantFindMany: vi.fn(),
  grantCount: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    betaCampaign: {
      findUnique: mocks.campaignFindUnique,
      findMany: mocks.campaignFindMany,
      count: mocks.campaignCount,
      update: mocks.campaignUpdate,
    },
    betaGrant: {
      findMany: mocks.grantFindMany,
      count: mocks.grantCount,
    },
  },
}));

import { getBetaCampaignDetail, listBetaCampaigns, listBetaGrants, transitionBetaCampaign } from "@/lib/beta/campaigns";

describe("beta campaigns service", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("loads a campaign with its most recent grants", async () => {
    const campaign = { id: "campaign-1", name: "Piloto Pro", grants: [] };
    mocks.campaignFindUnique.mockResolvedValue(campaign);

    await expect(getBetaCampaignDetail("campaign-1")).resolves.toEqual(campaign);
    expect(mocks.campaignFindUnique).toHaveBeenCalledWith({
      where: { id: "campaign-1" },
      include: expect.objectContaining({
        grants: expect.objectContaining({ orderBy: { createdAt: "desc" }, take: 100 }),
      }),
    });
  });

  it("returns paginated campaigns with assigned counts", async () => {
    mocks.campaignFindMany.mockResolvedValue([
      { id: "campaign-1", name: "Piloto Pro", _count: { grants: 3 } },
    ]);
    mocks.campaignCount.mockResolvedValue(4);

    await expect(listBetaCampaigns({ status: "ACTIVE", page: 2, pageSize: 2 })).resolves.toMatchObject({
      campaigns: [{ id: "campaign-1", assignedCount: 3 }],
      pagination: { page: 2, pageSize: 2, total: 4, totalPages: 2 },
    });
    expect(mocks.campaignFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { status: "ACTIVE" },
      skip: 2,
      take: 2,
    }));
  });

  it("filters and paginates campaign grants", async () => {
    const grant = {
      id: "grant-1",
      userId: "user-1",
      companyId: null,
      status: "ACTIVE",
      source: "ADMIN",
      startsAt: new Date("2026-08-15T00:00:00.000Z"),
      expiresAt: new Date("2026-10-14T00:00:00.000Z"),
      revokedAt: null,
      user: { name: "Ana", email: "ana@example.com" },
    };
    mocks.grantFindMany.mockResolvedValue([grant]);
    mocks.grantCount.mockResolvedValue(30);

    await expect(listBetaGrants({
      campaignId: "campaign-1",
      query: "ana@example.com",
      status: "ACTIVE",
      source: "ADMIN",
      page: 2,
      pageSize: 25,
    })).resolves.toMatchObject({
      grants: [grant],
      pagination: { page: 2, pageSize: 25, total: 30, totalPages: 2 },
      filters: { query: "ana@example.com", status: "ACTIVE", source: "ADMIN" },
    });
    expect(mocks.grantFindMany).toHaveBeenCalledWith(expect.objectContaining({
      skip: 25,
      take: 25,
      where: expect.objectContaining({ campaignId: "campaign-1", status: "ACTIVE", source: "ADMIN" }),
    }));
  });

  it("allows only valid status transitions", async () => {
    mocks.campaignFindUnique.mockResolvedValue({ id: "campaign-1", status: "DRAFT" });
    mocks.campaignUpdate.mockResolvedValue({ id: "campaign-1", status: "ACTIVE" });

    await expect(transitionBetaCampaign("campaign-1", "ACTIVE")).resolves.toEqual({ id: "campaign-1", status: "ACTIVE" });
    expect(mocks.campaignUpdate).toHaveBeenCalledWith({
      where: { id: "campaign-1" },
      data: { status: "ACTIVE" },
    });
  });

  it("rejects reverting a finished campaign", async () => {
    mocks.campaignFindUnique.mockResolvedValue({ id: "campaign-1", status: "FINISHED" });

    await expect(transitionBetaCampaign("campaign-1", "ACTIVE")).rejects.toThrow("No se puede cambiar");
    expect(mocks.campaignUpdate).not.toHaveBeenCalled();
  });
});
