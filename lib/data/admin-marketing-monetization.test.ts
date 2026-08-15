import { describe, expect, it } from "vitest";
import { calculateMonetization } from "@/lib/data/admin-marketing-monetization";

describe("admin marketing monetization", () => {
  const range = {
    from: new Date("2026-08-01T00:00:00.000Z"),
    to: new Date("2026-08-08T00:00:00.000Z"),
  };

  it("calculates Activated to Pro using unique users", () => {
    const result = calculateMonetization(
      range,
      [
        { name: "project_created", userId: "user-1", isDemo: false },
        { name: "apu_created", userId: "user-1", isDemo: false },
        { name: "budget_created", userId: "user-2", isDemo: false },
        { name: "project_created", userId: "demo-user", isDemo: true },
      ],
      [
        subscription("sub-1", "user-1", "ACTIVE", "2026-08-02", "2026-08-02"),
        subscription("sub-2", "user-1", "ACTIVE", "2026-08-03", "2026-08-03"),
      ],
      18900,
    );

    expect(result.metrics).toMatchObject({
      activated: 2,
      newPro: 1,
      activatedPro: 1,
      activeProUsers: 1,
      activeSubscriptions: 2,
    });
    expect(result.rates.activatedToProRate).toBe(50);
    expect(result.mrr).toEqual({ cents: 37800, currency: "PEN" });
  });

  it("counts cancellations and pending cancellation in the selected period", () => {
    const result = calculateMonetization(
      range,
      [],
      [
        subscription("active", "user-active", "ACTIVE", "2026-07-01", "2026-07-01", true),
        subscription("canceled", "user-canceled", "CANCELED", "2026-07-01", "2026-08-04"),
        subscription("past-due", "user-past-due", "PAST_DUE", "2026-07-01", "2026-08-04"),
      ],
      null,
    );

    expect(result.metrics).toMatchObject({
      activeSubscriptions: 1,
      pendingCancellation: 1,
      canceledSubscriptions: 1,
      pastDueSubscriptions: 1,
    });
    expect(result.rates.observedCancellationRate).toBe(50);
    expect(result.mrr).toBeNull();
    expect(result.mrrConfigured).toBe(false);
  });
});

function subscription(
  id: string,
  userId: string,
  status: string,
  createdAt: string,
  updatedAt: string,
  cancelAtPeriodEnd = false,
) {
  return {
    id,
    userId,
    provider: "STRIPE",
    status,
    createdAt: new Date(`${createdAt}T10:00:00.000Z`),
    updatedAt: new Date(`${updatedAt}T10:00:00.000Z`),
    cancelAtPeriodEnd,
  };
}
