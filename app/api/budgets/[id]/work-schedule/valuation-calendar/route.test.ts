import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/auth/session", () => ({
  getAuthSession: vi.fn(),
}));

vi.mock("@/lib/data/work-schedule", () => ({
  getWorkScheduleValuationCalendarSection: vi.fn(),
}));

vi.mock("@/lib/billing/entitlements", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/billing/entitlements")>();

  return {
    ...actual,
    assertFeatureAccess: vi.fn(),
  };
});

import { GET } from "@/app/api/budgets/[id]/work-schedule/valuation-calendar/route";
import { getAuthSession } from "@/lib/auth/session";
import { getWorkScheduleValuationCalendarSection } from "@/lib/data/work-schedule";
import { assertFeatureAccess } from "@/lib/billing/entitlements";

describe("valuation calendar route", () => {
  it("passes the requested monthly slice to the valuation loader", async () => {
    vi.mocked(getAuthSession).mockResolvedValue({ expires: new Date().toISOString(), user: { id: "user-1" } });
    vi.mocked(getWorkScheduleValuationCalendarSection).mockResolvedValue({
      periods: [{ year: 2026, month: 4, key: "2026-04" }],
      rows: [],
      availableRange: { fromPeriodKey: "2026-03", toPeriodKey: "2026-05" },
      selectedRange: { fromPeriodKey: "2026-04", toPeriodKey: "2026-04" },
      isPartial: true,
    });

    const response = await GET(new NextRequest("http://localhost/api/budgets/budget-1/work-schedule/valuation-calendar?from=2026-04&to=2026-04"), {
      params: Promise.resolve({ id: "budget-1" }),
    });

    expect(response.status).toBe(200);
    expect(assertFeatureAccess).toHaveBeenCalledWith({ userId: "user-1", feature: "work_schedule.intelligent" });
    expect(getWorkScheduleValuationCalendarSection).toHaveBeenCalledWith("budget-1", "user-1", {
      fromPeriodKey: "2026-04",
      toPeriodKey: "2026-04",
    });
  });
});
