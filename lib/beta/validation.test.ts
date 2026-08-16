import { describe, expect, it } from "vitest";
import { betaCampaignInputSchema, betaEligibilityRulesSchema } from "@/lib/beta/validation";

describe("beta campaign validation", () => {
  it("accepts a 60-day campaign and normalizes its code", () => {
    const result = betaCampaignInputSchema.parse({
      name: "Piloto Pro",
      code: " PILOTO60 ",
      durationDays: 60,
      assignmentMode: "MIXED",
      startsAt: "2026-09-01T00:00:00.000Z",
      maxAssignments: 50,
      eligibilityRules: {},
    });

    expect(result.code).toBe("piloto60");
    expect(result.durationDays).toBe(60);
    expect(result.eligibilityRules.excludePaidSubscribers).toBe(true);
  });

  it("accepts a 90-day campaign", () => {
    expect(
      betaCampaignInputSchema.parse({
        name: "Piloto extendido",
        durationDays: 90,
        assignmentMode: "ADMIN",
        startsAt: "2026-09-01T00:00:00.000Z",
        eligibilityRules: {},
      }).durationDays,
    ).toBe(90);
  });

  it("rejects invalid durations and reversed dates", () => {
    expect(() =>
      betaCampaignInputSchema.parse({
        name: "Invalida",
        durationDays: 30,
        assignmentMode: "ADMIN",
        startsAt: "2026-09-02T00:00:00.000Z",
        endsAt: "2026-09-01T00:00:00.000Z",
        eligibilityRules: {},
      }),
    ).toThrow();
  });

  it("requires a code for code-based campaigns", () => {
    expect(() =>
      betaCampaignInputSchema.parse({
        name: "Por código",
        durationDays: 60,
        assignmentMode: "CODE",
        startsAt: "2026-09-01T00:00:00.000Z",
        eligibilityRules: {},
      }),
    ).toThrow();
  });

  it("rejects unknown eligibility rules", () => {
    expect(() => betaEligibilityRulesSchema.parse({ unknownRule: true })).toThrow();
  });
});
