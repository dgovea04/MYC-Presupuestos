import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
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
    prismaMock.membershipPlan.findUnique.mockReset();
    prismaMock.user.update.mockReset();
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
  });
});
