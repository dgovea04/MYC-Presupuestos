import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  resolveBudgetOwnership: vi.fn(),
  deleteMany: vi.fn(),
  findFirst: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  publishBudgetEvent: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({ prisma: { collaborationEditSession: { deleteMany: mocks.deleteMany, findFirst: mocks.findFirst, create: mocks.create, update: mocks.update } } }));
vi.mock("./authorization", () => ({ resolveBudgetOwnership: mocks.resolveBudgetOwnership }));
vi.mock("./events", () => ({ publishBudgetEvent: mocks.publishBudgetEvent }));

import { startEditSession } from "./edit-sessions";

describe("edit session concurrency", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolveBudgetOwnership.mockResolvedValue({ companyId: "company-1", projectId: "project-1" });
  });

  it("rejects a second active editor for the same field", async () => {
    mocks.deleteMany.mockResolvedValue({ count: 0 });
    mocks.findFirst.mockResolvedValue({ id: "session-1", userId: "user-1" });

    await expect(startEditSession("budget-1", "user-2", { entityType: "BUDGET_ITEM", entityId: "item-1", field: "quantity" })).rejects.toThrow("EDIT_SESSION_CONFLICT");
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("renews the existing session for the same editor", async () => {
    mocks.deleteMany.mockResolvedValue({ count: 0 });
    mocks.findFirst.mockResolvedValue({ id: "session-1", userId: "user-1" });
    mocks.update.mockResolvedValue({ id: "session-1", userId: "user-1", budgetId: "budget-1", entityType: "BUDGET_ITEM", entityId: "item-1", field: "quantity", startedAt: new Date(), lastHeartbeatAt: new Date(), expiresAt: new Date(), user: { name: "User" } });

    const result = await startEditSession("budget-1", "user-1", { entityType: "BUDGET_ITEM", entityId: "item-1", field: "quantity" });
    expect(result.id).toBe("session-1");
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "session-1" } }));
    expect(mocks.create).not.toHaveBeenCalled();
  });
});
