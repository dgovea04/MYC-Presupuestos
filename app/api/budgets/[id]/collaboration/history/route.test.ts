import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/session", () => ({
  getAuthSession: vi.fn(),
}));

vi.mock("@/lib/collaboration/audit", () => ({
  listBudgetChangeEvents: vi.fn(),
}));

import { GET } from "@/app/api/budgets/[id]/collaboration/history/route";
import { getAuthSession } from "@/lib/auth/session";
import { listBudgetChangeEvents } from "@/lib/collaboration/audit";

const defaultEvent = {
  id: "event-1",
  companyId: "company-1",
  projectId: "project-1",
  budgetId: "budget-1",
  entityType: "BUDGET_ITEM" as const,
  entityId: "item-1",
  action: "update",
  field: "quantity",
  oldValue: "100",
  newValue: "120",
  diffSummary: "quantity: 100 → 120",
  source: "USER" as const,
  userId: "user-1",
  userName: "Juan Perez",
  requestId: null,
  createdAt: "2026-07-07T12:00:00.000Z",
};

describe("collaboration history route", () => {
  it("returns 401 when unauthenticated", async () => {
    vi.mocked(getAuthSession).mockResolvedValue(null);

    const response = await GET(
      new Request("http://localhost/api/budgets/budget-1/collaboration/history"),
      { params: Promise.resolve({ id: "budget-1" }) },
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" });
  });

  it("lists change events with defaults (no filters)", async () => {
    vi.mocked(getAuthSession).mockResolvedValue({
      expires: new Date().toISOString(),
      user: { id: "user-1" },
    });
    vi.mocked(listBudgetChangeEvents).mockResolvedValue([defaultEvent]);

    const response = await GET(
      new Request("http://localhost/api/budgets/budget-1/collaboration/history"),
      { params: Promise.resolve({ id: "budget-1" }) },
    );

    expect(response.status).toBe(200);
    expect(listBudgetChangeEvents).toHaveBeenCalledWith("budget-1", "user-1", {
      entityType: undefined,
      entityId: undefined,
      source: undefined,
      cursor: undefined,
      limit: 50,
    });
    await expect(response.json()).resolves.toEqual({ events: [defaultEvent] });
  });

  it("forwards limit and cursor params", async () => {
    vi.mocked(getAuthSession).mockResolvedValue({
      expires: new Date().toISOString(),
      user: { id: "user-1" },
    });
    vi.mocked(listBudgetChangeEvents).mockResolvedValue([]);

    const response = await GET(
      new Request(
        "http://localhost/api/budgets/budget-1/collaboration/history?limit=10&cursor=2026-01-01T00:00:00.000Z",
      ),
      { params: Promise.resolve({ id: "budget-1" }) },
    );

    expect(response.status).toBe(200);
    expect(listBudgetChangeEvents).toHaveBeenCalledWith("budget-1", "user-1", {
      entityType: undefined,
      entityId: undefined,
      source: undefined,
      cursor: "2026-01-01T00:00:00.000Z",
      limit: 10,
    });
  });

  it("forwards entityType, entityId, and source filters", async () => {
    vi.mocked(getAuthSession).mockResolvedValue({
      expires: new Date().toISOString(),
      user: { id: "user-1" },
    });
    vi.mocked(listBudgetChangeEvents).mockResolvedValue([defaultEvent]);

    const response = await GET(
      new Request(
        "http://localhost/api/budgets/budget-1/collaboration/history?entityType=BUDGET_ITEM&entityId=item-1&source=KHIPU",
      ),
      { params: Promise.resolve({ id: "budget-1" }) },
    );

    expect(response.status).toBe(200);
    expect(listBudgetChangeEvents).toHaveBeenCalledWith("budget-1", "user-1", {
      entityType: "BUDGET_ITEM",
      entityId: "item-1",
      source: "KHIPU",
      cursor: undefined,
      limit: 50,
    });
  });

  it("returns an empty events array when no changes exist", async () => {
    vi.mocked(getAuthSession).mockResolvedValue({
      expires: new Date().toISOString(),
      user: { id: "user-1" },
    });
    vi.mocked(listBudgetChangeEvents).mockResolvedValue([]);

    const response = await GET(
      new Request("http://localhost/api/budgets/budget-1/collaboration/history"),
      { params: Promise.resolve({ id: "budget-1" }) },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ events: [] });
  });

  it("returns 400 when listBudgetChangeEvents throws", async () => {
    vi.mocked(getAuthSession).mockResolvedValue({
      expires: new Date().toISOString(),
      user: { id: "user-1" },
    });
    vi.mocked(listBudgetChangeEvents).mockRejectedValue(
      new Error("No tienes permisos para acceder a este presupuesto"),
    );

    const response = await GET(
      new Request("http://localhost/api/budgets/budget-1/collaboration/history"),
      { params: Promise.resolve({ id: "budget-1" }) },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "No tienes permisos para acceder a este presupuesto",
    });
  });

  it("handles multiple events in response", async () => {
    vi.mocked(getAuthSession).mockResolvedValue({
      expires: new Date().toISOString(),
      user: { id: "user-1" },
    });
    const events = [
      defaultEvent,
      {
        ...defaultEvent,
        id: "event-2",
        field: "unitPrice",
        oldValue: "20.50",
        newValue: "21.30",
        diffSummary: "unitPrice: 20.50 → 21.30",
      },
    ];
    vi.mocked(listBudgetChangeEvents).mockResolvedValue(events);

    const response = await GET(
      new Request("http://localhost/api/budgets/budget-1/collaboration/history"),
      { params: Promise.resolve({ id: "budget-1" }) },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ events });
  });
});
