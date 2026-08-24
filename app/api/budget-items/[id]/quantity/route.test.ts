import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAuthSession: vi.fn(),
  updateBudgetItemQuantityFromMetrados: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({ getAuthSession: mocks.getAuthSession }));
vi.mock("@/lib/billing/route-access", () => ({ getFeatureAccessResponse: vi.fn().mockResolvedValue(null) }));
vi.mock("@/lib/data/metrados", () => ({ updateBudgetItemQuantityFromMetrados: mocks.updateBudgetItemQuantityFromMetrados }));

import { PATCH } from "@/app/api/budget-items/[id]/quantity/route";

describe("PATCH /api/budget-items/[id]/quantity", () => {
  beforeEach(() => {
    mocks.getAuthSession.mockReset();
    mocks.updateBudgetItemQuantityFromMetrados.mockReset();
  });

  it("requires authentication", async () => {
    mocks.getAuthSession.mockResolvedValue(null);
    const response = await PATCH(new Request("http://localhost"), { params: Promise.resolve({ id: "item-1" }) });
    expect(response.status).toBe(401);
    expect(mocks.updateBudgetItemQuantityFromMetrados).not.toHaveBeenCalled();
  });

  it("normalizes decimal input before updating", async () => {
    mocks.getAuthSession.mockResolvedValue({ user: { id: "user-1" } });
    mocks.updateBudgetItemQuantityFromMetrados.mockResolvedValue({ itemId: "item-1", budgetId: "budget-1", projectId: "project-1", quantity: 12.5 });

    const response = await PATCH(
      new Request("http://localhost", { method: "PATCH", body: JSON.stringify({ quantity: "12.5009" }) }),
      { params: Promise.resolve({ id: "item-1" }) },
    );

    expect(response.status).toBe(200);
    expect(mocks.updateBudgetItemQuantityFromMetrados).toHaveBeenCalledWith({
      itemId: "item-1",
      userId: "user-1",
      quantity: 12.501,
      deactivateAdvancedSheets: true,
    });
  });

  it("rejects negative quantities", async () => {
    mocks.getAuthSession.mockResolvedValue({ user: { id: "user-1" } });
    const response = await PATCH(
      new Request("http://localhost", { method: "PATCH", body: JSON.stringify({ quantity: -1 }) }),
      { params: Promise.resolve({ id: "item-1" }) },
    );
    expect(response.status).toBe(400);
    expect(mocks.updateBudgetItemQuantityFromMetrados).not.toHaveBeenCalled();
  });
});
