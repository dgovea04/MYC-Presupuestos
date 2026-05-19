import { describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  getAuthSession: vi.fn(),
}));

vi.mock("@/lib/data/work-schedule", () => ({
  getWorkScheduleSection: vi.fn(),
  saveWorkScheduleItem: vi.fn(),
}));

import { GET, PATCH } from "@/app/api/budgets/[id]/work-schedule/route";
import { getAuthSession } from "@/lib/auth/session";
import { getWorkScheduleSection, saveWorkScheduleItem } from "@/lib/data/work-schedule";

describe("budget work schedule route", () => {
  it("returns 401 when unauthenticated", async () => {
    vi.mocked(getAuthSession).mockResolvedValue(null);

    const response = await GET(new Request("http://localhost/api/budgets/budget-1/work-schedule"), {
      params: Promise.resolve({ id: "budget-1" }),
    });

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "No autenticado" });
  });

  it("returns the consolidated work schedule on GET", async () => {
    vi.mocked(getAuthSession).mockResolvedValue({ user: { id: "user-1" } });
    vi.mocked(getWorkScheduleSection).mockResolvedValue({
      budgetId: "budget-1",
      budgetName: "Presupuesto General",
      projectName: "Proyecto demo",
      currency: "PEN",
      groups: [],
      valuationCalendar: { periods: [], rows: [] },
      resourceCalendar: { periods: [], rows: [] },
      curveSeries: [],
      timeline: { startDate: null, endDate: null },
    });

    const response = await GET(new Request("http://localhost/api/budgets/budget-1/work-schedule"), {
      params: Promise.resolve({ id: "budget-1" }),
    });

    expect(response.status).toBe(200);
    expect(getWorkScheduleSection).toHaveBeenCalledWith("budget-1", "user-1");
  });

  it("persists a scheduled partida payload on PATCH", async () => {
    vi.mocked(getAuthSession).mockResolvedValue({ user: { id: "user-1" } });
    vi.mocked(saveWorkScheduleItem).mockResolvedValue({
      budgetId: "budget-1",
      budgetName: "Presupuesto General",
      projectName: "Proyecto demo",
      currency: "PEN",
      groups: [],
      valuationCalendar: { periods: [], rows: [] },
      resourceCalendar: { periods: [], rows: [] },
      curveSeries: [],
      timeline: { startDate: "2026-03-01", endDate: "2026-03-31" },
    });

    const payload = {
      budgetItemId: "item-1",
      startDate: "2026-03-01",
      endDate: "2026-03-31",
      durationDays: 31,
      predecessor: "3CC+5d",
      crew: 2,
      monthlyDistributions: [
        { year: 2026, month: 3, percentage: 100 },
      ],
    };

    const response = await PATCH(
      new Request("http://localhost/api/budgets/budget-1/work-schedule", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }),
      { params: Promise.resolve({ id: "budget-1" }) },
    );

    expect(response.status).toBe(200);
    expect(saveWorkScheduleItem).toHaveBeenCalledWith("budget-1", "user-1", payload);
  });
});
