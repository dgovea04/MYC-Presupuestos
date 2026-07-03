import { describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  getAuthSession: vi.fn(),
}));

vi.mock("@/lib/data/work-schedule", () => ({
  getWorkScheduleOverviewSection: vi.fn(),
  generateWorkScheduleBase: vi.fn(),
  saveWorkScheduleItem: vi.fn(),
}));

vi.mock("@/lib/billing/entitlements", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/billing/entitlements")>();

  return {
    ...actual,
    assertFeatureAccess: vi.fn(),
  };
});

import { GET, PATCH, POST } from "@/app/api/budgets/[id]/work-schedule/route";
import { getAuthSession } from "@/lib/auth/session";
import { generateWorkScheduleBase, getWorkScheduleOverviewSection, saveWorkScheduleItem } from "@/lib/data/work-schedule";
import { assertFeatureAccess, FeatureAccessError } from "@/lib/billing/entitlements";

describe("budget work schedule route", () => {
  it("returns 401 when unauthenticated", async () => {
    vi.mocked(getAuthSession).mockResolvedValue(null);

    const response = await GET(new Request("http://localhost/api/budgets/budget-1/work-schedule"), {
      params: Promise.resolve({ id: "budget-1" }),
    });

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "No autenticado" });
  });

  it("returns an upgrade payload when the user does not have Pro access", async () => {
    vi.mocked(getAuthSession).mockResolvedValue({ expires: new Date().toISOString(), user: { id: "user-1" } });
    vi.mocked(assertFeatureAccess).mockRejectedValueOnce(new FeatureAccessError("work_schedule.intelligent"));

    const response = await GET(new Request("http://localhost/api/budgets/budget-1/work-schedule"), {
      params: Promise.resolve({ id: "budget-1" }),
    });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "Esta funcionalidad esta disponible en Pro.",
      feature: "work_schedule.intelligent",
      upgradeRequired: true,
      upgradeUrl: "/account",
    });
    expect(getWorkScheduleOverviewSection).not.toHaveBeenCalled();
  });

  it("returns the consolidated work schedule on GET", async () => {
    vi.mocked(getAuthSession).mockResolvedValue({ expires: new Date().toISOString(), user: { id: "user-1" } });
    vi.mocked(getWorkScheduleOverviewSection).mockResolvedValue({
      budgetId: "budget-1",
      budgetName: "Presupuesto General",
      projectName: "Proyecto demo",
      currency: "PEN",
      groups: [],
      valuationCalendar: null,
      resourceCalendar: null,
      curveSeries: null,
      timeline: { startDate: null, endDate: null },
      scale: {
        periodCount: 0,
        timelineDayCount: 0,
        canLoadDailyTimeline: true,
        canLoadDerivedCalendars: true,
      },
    });

    const response = await GET(new Request("http://localhost/api/budgets/budget-1/work-schedule"), {
      params: Promise.resolve({ id: "budget-1" }),
    });

    expect(response.status).toBe(200);
    expect(assertFeatureAccess).toHaveBeenCalledWith({ userId: "user-1", feature: "work_schedule.intelligent" });
    expect(getWorkScheduleOverviewSection).toHaveBeenCalledWith("budget-1", "user-1");
  });

  it("persists a scheduled partida payload on PATCH", async () => {
    vi.mocked(getAuthSession).mockResolvedValue({ expires: new Date().toISOString(), user: { id: "user-1" } });
    vi.mocked(saveWorkScheduleItem).mockResolvedValue({
      budgetId: "budget-1",
      budgetName: "Presupuesto General",
      projectName: "Proyecto demo",
      currency: "PEN",
      groups: [],
      valuationCalendar: null,
      resourceCalendar: null,
      curveSeries: null,
      timeline: { startDate: "2026-03-01", endDate: "2026-03-31" },
      scale: {
        periodCount: 1,
        timelineDayCount: 31,
        canLoadDailyTimeline: true,
        canLoadDerivedCalendars: true,
      },
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
    expect(assertFeatureAccess).toHaveBeenCalledWith({ userId: "user-1", feature: "work_schedule.intelligent" });
    expect(saveWorkScheduleItem).toHaveBeenCalledWith("budget-1", "user-1", payload);
  });

  it("generates the intelligent base gantt on POST", async () => {
    vi.mocked(getAuthSession).mockResolvedValue({ expires: new Date().toISOString(), user: { id: "user-1" } });
    vi.mocked(generateWorkScheduleBase).mockResolvedValue({
      budgetId: "budget-1",
      budgetName: "Presupuesto General",
      projectName: "Proyecto demo",
      currency: "PEN",
      groups: [],
      valuationCalendar: null,
      resourceCalendar: null,
      curveSeries: null,
      timeline: { startDate: "2026-06-01", endDate: "2026-06-30" },
      scale: {
        periodCount: 1,
        timelineDayCount: 30,
        canLoadDailyTimeline: true,
        canLoadDerivedCalendars: true,
      },
      generationSummary: {
        generatedCount: 4,
        pendingCount: 1,
        issues: [{ budgetItemId: "item-9", itemCode: "03.01", reason: "Pendiente" }],
      },
    });

    const payload = { baseStartDate: "2026-06-01" };

    const response = await POST(
      new Request("http://localhost/api/budgets/budget-1/work-schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }),
      { params: Promise.resolve({ id: "budget-1" }) },
    );

    expect(response.status).toBe(200);
    expect(assertFeatureAccess).toHaveBeenCalledWith({ userId: "user-1", feature: "work_schedule.intelligent" });
    expect(generateWorkScheduleBase).toHaveBeenCalledWith("budget-1", "user-1", payload);
  });
});
