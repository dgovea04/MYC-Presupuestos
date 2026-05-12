import { describe, expect, it } from "vitest";

import {
  formatBudgetRatePercentageInput,
  parseBudgetRatePercentageInput,
} from "@/lib/settings/budget-rate-percentages";

describe("budget rate percentage helpers", () => {
  it("converts stored decimal rates into percentage input strings", () => {
    expect(formatBudgetRatePercentageInput(0)).toBe("0");
    expect(formatBudgetRatePercentageInput(0.18)).toBe("18");
    expect(formatBudgetRatePercentageInput(0.125)).toBe("12.5");
    expect(formatBudgetRatePercentageInput("0.333")).toBe("33.3");
    expect(formatBudgetRatePercentageInput(1)).toBe("100");
  });

  it("converts percentage input strings into stored decimal rates", () => {
    expect(parseBudgetRatePercentageInput("0")).toBe(0);
    expect(parseBudgetRatePercentageInput("18")).toBe(0.18);
    expect(parseBudgetRatePercentageInput("12.5")).toBe(0.125);
    expect(parseBudgetRatePercentageInput(" 33.3 ")).toBe(0.333);
    expect(parseBudgetRatePercentageInput("100")).toBe(1);
  });

  it("rejects percentages outside the supported 0 to 100 range", () => {
    expect(() => parseBudgetRatePercentageInput("-0.01")).toThrow(
      "Budget rate percentage must be between 0 and 100",
    );
    expect(() => parseBudgetRatePercentageInput("100.01")).toThrow(
      "Budget rate percentage must be between 0 and 100",
    );
  });

  it("rejects malformed percentage inputs instead of coercing them", () => {
    expect(() => parseBudgetRatePercentageInput("")).toThrow(
      "Budget rate percentage must be a valid number",
    );
    expect(() => parseBudgetRatePercentageInput("   ")).toThrow(
      "Budget rate percentage must be a valid number",
    );
    expect(() => parseBudgetRatePercentageInput("12.5%")).toThrow(
      "Budget rate percentage must be a valid number",
    );
    expect(() => parseBudgetRatePercentageInput("abc")).toThrow(
      "Budget rate percentage must be a valid number",
    );
  });

  it("rejects invalid stored decimal rates instead of formatting them", () => {
    expect(() => formatBudgetRatePercentageInput(-0.001)).toThrow(
      "Budget rate must be between 0 and 1",
    );
    expect(() => formatBudgetRatePercentageInput("1.001")).toThrow(
      "Budget rate must be between 0 and 1",
    );
    expect(() => formatBudgetRatePercentageInput("")).toThrow(
      "Budget rate must be a valid decimal",
    );
    expect(() => formatBudgetRatePercentageInput("   ")).toThrow(
      "Budget rate must be a valid decimal",
    );
    expect(() => formatBudgetRatePercentageInput("abc")).toThrow(
      "Budget rate must be a valid decimal",
    );
  });
});
