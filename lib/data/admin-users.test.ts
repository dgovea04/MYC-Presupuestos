import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    $transaction: vi.fn(),
    billingSubscription: {
      create: vi.fn(),
      updateMany: vi.fn(),
    },
    membershipPlan: {
      findUnique: vi.fn(),
    },
    user: {
      update: vi.fn(),
    },
  },
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: prismaMock,
}));

import { updateUserAdminAccess } from "@/lib/data/admin-users";

describe("admin users data", () => {
  beforeEach(() => {
    prismaMock.$transaction.mockReset();
    prismaMock.billingSubscription.create.mockReset();
    prismaMock.billingSubscription.updateMany.mockReset();
    prismaMock.membershipPlan.findUnique.mockReset();
    prismaMock.user.update.mockReset();
    prismaMock.$transaction.mockImplementation(async (callback: (tx: AdminUserTransaction) => Promise<unknown>) =>
      callback({
        billingSubscription: prismaMock.billingSubscription,
        user: prismaMock.user,
      }),
    );
  });

  it("updates role, status, membership plan, and monthly extra tokens", async () => {
    prismaMock.membershipPlan.findUnique.mockResolvedValue({ id: "plan-pro", slug: "pro" });
    prismaMock.user.update.mockResolvedValue({});

    await updateUserAdminAccess("user-1", {
      role: "ADMIN",
      status: "ACTIVE",
      membershipPlanSlug: "pro",
      aiTokenExtraMonthly: 500,
    });

    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: {
        role: "ADMIN",
        status: "ACTIVE",
        membershipPlanId: "plan-pro",
        aiTokenExtraMonthly: 500,
      },
    });
    expect(prismaMock.billingSubscription.updateMany).toHaveBeenCalledWith({
      where: { userId: "user-1", provider: "MANUAL", status: "INCOMPLETE" },
      data: { status: "CANCELED", cancelAtPeriodEnd: true },
    });
    expect(prismaMock.billingSubscription.create).toHaveBeenCalledWith({
      data: {
        provider: "MANUAL",
        status: "ACTIVE",
        userId: "user-1",
        currentPeriodStart: expect.any(Date) as Date,
      },
    });
  });
});

type AdminUserTransaction = {
  billingSubscription: typeof prismaMock.billingSubscription;
  user: typeof prismaMock.user;
};
