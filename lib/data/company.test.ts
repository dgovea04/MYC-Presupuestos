import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  companyFindFirst: vi.fn(),
  companyUpdate: vi.fn(),
  membershipFindFirst: vi.fn(),
  membershipUpsert: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    company: {
      findFirst: mocks.companyFindFirst,
      update: mocks.companyUpdate,
    },
    companyMembership: {
      findFirst: mocks.membershipFindFirst,
      upsert: mocks.membershipUpsert,
    },
    $transaction: mocks.transaction,
  },
}));

import { upsertPrimaryCompany } from "@/lib/data/company";

describe("company data", () => {
  beforeEach(() => {
    mocks.companyFindFirst.mockReset();
    mocks.companyUpdate.mockReset();
    mocks.membershipFindFirst.mockReset();
    mocks.membershipUpsert.mockReset();
    mocks.transaction.mockReset();
  });

  it("repairs legacy company memberships idempotently before updating the company", async () => {
    mocks.membershipFindFirst.mockResolvedValue(null);
    mocks.companyFindFirst.mockResolvedValue({ id: "company-legacy" });
    mocks.membershipUpsert.mockResolvedValue({
      companyId: "company-legacy",
      userId: "user-1",
      role: "OWNER",
      status: "ACTIVE",
    });
    mocks.companyUpdate.mockResolvedValue({
      id: "company-legacy",
      name: "Constructora Andina SAC",
      ruc: "20123456789",
    });

    const company = await upsertPrimaryCompany("user-1", {
      name: "Constructora Andina SAC",
      ruc: "20123456789",
    });

    expect(mocks.membershipUpsert).toHaveBeenCalledWith({
      where: {
        companyId_userId: {
          companyId: "company-legacy",
          userId: "user-1",
        },
      },
      update: {
        role: "OWNER",
        status: "ACTIVE",
        suspendedUntil: null,
      },
      create: {
        companyId: "company-legacy",
        userId: "user-1",
        role: "OWNER",
        status: "ACTIVE",
      },
    });
    expect(company).toEqual(
      expect.objectContaining({
        id: "company-legacy",
        name: "Constructora Andina SAC",
      }),
    );
  });
});
