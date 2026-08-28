import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    betaGrant: {
      findFirst: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/db/prisma";
import { getActiveBetaAccess, isBetaAccessActive } from "@/lib/beta/access";

const mockPrisma = prisma as unknown as {
  betaGrant: { findFirst: ReturnType<typeof vi.fn> };
};

describe("beta access", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns the active Pro grant and calendar days remaining", async () => {
    const now = new Date("2026-09-01T00:00:00.000Z");
    mockPrisma.betaGrant.findFirst.mockResolvedValue({
      id: "grant-1",
      campaignId: "campaign-1",
      planSlug: "pro",
      status: "ACTIVE",
      startsAt: now,
      expiresAt: new Date("2026-10-31T00:00:00.000Z"),
      campaign: { name: "Piloto Pro", aiTokenLimit: 500000 },
    });

    await expect(getActiveBetaAccess({ userId: "user-1", companyId: "company-1", now })).resolves.toMatchObject({
      grantId: "grant-1",
      campaignName: "Piloto Pro",
      planSlug: "pro",
      daysRemaining: 60,
      aiTokenLimit: 500000,
    });
  });

  it("returns null when there is no active grant", async () => {
    mockPrisma.betaGrant.findFirst.mockResolvedValue(null);

    await expect(getActiveBetaAccess({ userId: "user-1", companyId: null })).resolves.toBeNull();
  });

  it("denies cached beta access after its exact expiry", () => {
    expect(
      isBetaAccessActive(
        { accessSource: "BETA", betaExpiresAt: "2026-10-01T00:00:00.000Z" },
        new Date("2026-10-01T00:00:00.000Z"),
      ),
    ).toBe(false);
  });

  it("keeps non-beta licenses active without beta metadata", () => {
    expect(isBetaAccessActive({ accessSource: "STRIPE", betaExpiresAt: null })).toBe(true);
  });
});
