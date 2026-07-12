import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  updateMany: vi.fn(),
  createMany: vi.fn(),
  findUnique: vi.fn(),
  deleteMany: vi.fn(),
  findMany: vi.fn(),
  resolveBudgetOwnership: vi.fn(),
  publishBudgetEvent: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    collaborationPresence: {
      updateMany: mocks.updateMany,
      createMany: mocks.createMany,
      findUnique: mocks.findUnique,
      deleteMany: mocks.deleteMany,
      findMany: mocks.findMany,
    },
  },
}));

vi.mock("@/lib/collaboration/authorization", () => ({
  resolveBudgetOwnership: mocks.resolveBudgetOwnership,
}));

vi.mock("@/lib/collaboration/events", () => ({
  publishBudgetEvent: mocks.publishBudgetEvent,
}));

import { upsertPresenceHeartbeat } from "@/lib/collaboration/presence";

const presenceRow = {
  id: "presence-1",
  companyId: "company-1",
  projectId: "project-1",
  budgetId: "budget-1",
  userId: "user-1",
  route: "/budgets/budget-1",
  module: "budget",
  status: "ACTIVE",
  lastSeenAt: new Date("2026-07-12T10:00:00.000Z"),
  expiresAt: new Date("2026-07-12T10:01:00.000Z"),
  user: { name: "Juan Perez", avatarUrl: null },
};

describe("collaboration presence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolveBudgetOwnership.mockResolvedValue({
      companyId: "company-1",
      projectId: "project-1",
    });
  });

  it("updates existing presence without attempting a conflicting create", async () => {
    mocks.updateMany.mockResolvedValueOnce({ count: 1 });
    mocks.findUnique.mockResolvedValueOnce(presenceRow);

    const result = await upsertPresenceHeartbeat(
      "budget-1",
      "user-1",
      "/budgets/budget-1",
      "budget",
      "ACTIVE",
    );

    expect(mocks.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { budgetId: "budget-1", userId: "user-1" },
        data: expect.objectContaining({
          route: "/budgets/budget-1",
          module: "budget",
          status: "ACTIVE",
        }),
      }),
    );
    expect(mocks.createMany).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      id: "presence-1",
      budgetId: "budget-1",
      userId: "user-1",
      userName: "Juan Perez",
      status: "ACTIVE",
    });
    expect(mocks.publishBudgetEvent).toHaveBeenCalledWith(
      "budget-1",
      "presence.updated",
      expect.objectContaining({ userId: "user-1" }),
    );
  });

  it("creates presence with skipDuplicates when no row exists yet", async () => {
    mocks.updateMany.mockResolvedValueOnce({ count: 0 });
    mocks.createMany.mockResolvedValueOnce({ count: 1 });
    mocks.findUnique.mockResolvedValueOnce(presenceRow);

    await upsertPresenceHeartbeat(
      "budget-1",
      "user-1",
      "/budgets/budget-1",
      "budget",
      "ACTIVE",
    );

    expect(mocks.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          budgetId: "budget-1",
          userId: "user-1",
          route: "/budgets/budget-1",
          module: "budget",
          status: "ACTIVE",
        }),
        skipDuplicates: true,
      }),
    );
  });
});
