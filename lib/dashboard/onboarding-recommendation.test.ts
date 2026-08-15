import { describe, expect, it } from "vitest";
import { getOnboardingRecommendation } from "@/lib/dashboard/onboarding-recommendation";

describe("getOnboardingRecommendation", () => {
  it("maps the leading activation action to a product flow", () => {
    expect(getOnboardingRecommendation({
      eventName: "budget_imported",
      users: 8,
      activationRate: 40,
      shareOfActivated: 80,
    })).toEqual({
      title: "Prioriza importar un presupuesto",
      description: "La importación puede llevar más rápido a los usuarios al valor técnico del producto.",
      href: "/imports/mcp",
    });
  });

  it("returns null when there is no measured or supported aha moment", () => {
    expect(getOnboardingRecommendation(undefined)).toBeNull();
    expect(getOnboardingRecommendation({ eventName: "unknown_event", users: 1, activationRate: 1, shareOfActivated: 1 })).toBeNull();
  });
});
