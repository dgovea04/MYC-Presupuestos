import { describe, expect, it } from "vitest";
import { mergeKhipuFields } from "@/lib/settings/khipu-fields";
import type { UserSettingsRecord } from "@/types/settings";

function base(): UserSettingsRecord {
  return {
    defaultCurrency: "PEN",
    currencyDecimals: 2,
    dateFormat: "DD_MMM_YYYY",
    defaultViewMode: "modern",
    excelShowFieldBorders: true,
    excelRowHeight: 52,
    defaultIgvRate: 0.18,
    defaultGeneralExpensesRate: 0.1,
    defaultUtilityRate: 0.08,
    defaultSubBudgetNames: ["Estructuras"],
    aiProviderPreference: "auto",
    floatingKhipuProvider: "ollama",
    floatingKhipuWidth: 600,
    floatingKhipuHeight: 500,
    floatingKhipuFontSize: "normal",
    floatingKhipuPosition: "bottom-right",
    floatingKhipuTheme: "light",
  };
}

describe("mergeKhipuFields", () => {
  it("returns the previous record unchanged when source is empty", () => {
    const prev = base();
    const result = mergeKhipuFields(prev, {});
    expect(result).toEqual(prev);
  });

  it("returns the same reference when no Khipu field changes", () => {
    const prev = base();
    // Source has same values as prev for all Khipu fields
    const result = mergeKhipuFields(prev, {
      floatingKhipuProvider: "ollama",
      floatingKhipuTheme: "light",
      floatingKhipuFontSize: "normal",
      floatingKhipuPosition: "bottom-right",
    });
    expect(result).toBe(prev);
  });

  it("returns the same reference when source has only non-Khipu fields", () => {
    const prev = base();
    const result = mergeKhipuFields(prev, {
      defaultCurrency: "USD",
      currencyDecimals: 3,
    });
    expect(result).toBe(prev);
  });

  it("returns a new reference when a Khipu field actually changes", () => {
    const prev = base();
    const result = mergeKhipuFields(prev, { floatingKhipuTheme: "dark" });
    expect(result).not.toBe(prev);
    expect(result.floatingKhipuTheme).toBe("dark");
  });

  it("merges floatingKhipuTheme from source", () => {
    const prev = base();
    const result = mergeKhipuFields(prev, { floatingKhipuTheme: "dark" });
    expect(result.floatingKhipuTheme).toBe("dark");
    // Other fields unchanged
    expect(result.floatingKhipuProvider).toBe(prev.floatingKhipuProvider);
  });

  it("merges floatingKhipuProvider from source", () => {
    const prev = base();
    const result = mergeKhipuFields(prev, { floatingKhipuProvider: "openai" });
    expect(result.floatingKhipuProvider).toBe("openai");
  });

  it("merges floatingKhipuFontSize from source", () => {
    const prev = base();
    const result = mergeKhipuFields(prev, { floatingKhipuFontSize: "compact" });
    expect(result.floatingKhipuFontSize).toBe("compact");
  });

  it("merges floatingKhipuPosition from source", () => {
    const prev = base();
    const result = mergeKhipuFields(prev, { floatingKhipuPosition: "top-left" });
    expect(result.floatingKhipuPosition).toBe("top-left");
  });

  it("merges floatingKhipuWidth from source", () => {
    const prev = base();
    const result = mergeKhipuFields(prev, { floatingKhipuWidth: 400 });
    expect(result.floatingKhipuWidth).toBe(400);
  });

  it("merges floatingKhipuHeight from source", () => {
    const prev = base();
    const result = mergeKhipuFields(prev, { floatingKhipuHeight: 350 });
    expect(result.floatingKhipuHeight).toBe(350);
  });

  it("merges multiple Khipu fields at once", () => {
    const prev = base();
    const result = mergeKhipuFields(prev, {
      floatingKhipuTheme: "dark",
      floatingKhipuProvider: "openai",
      floatingKhipuPosition: "top-right",
    });
    expect(result.floatingKhipuTheme).toBe("dark");
    expect(result.floatingKhipuProvider).toBe("openai");
    expect(result.floatingKhipuPosition).toBe("top-right");
    // Unchanged fields stay
    expect(result.floatingKhipuFontSize).toBe(prev.floatingKhipuFontSize);
    expect(result.floatingKhipuWidth).toBe(prev.floatingKhipuWidth);
    expect(result.floatingKhipuHeight).toBe(prev.floatingKhipuHeight);
  });

  it("ignores non-Khipu fields entirely", () => {
    const prev = base();
    const result = mergeKhipuFields(prev, {
      defaultCurrency: "USD",
      currencyDecimals: 3,
      dateFormat: "DD_MM_YYYY",
      defaultViewMode: "excel",
      defaultIgvRate: 0.16,
      defaultGeneralExpensesRate: 0.12,
      defaultUtilityRate: 0.05,
      defaultSubBudgetNames: ["Otro"],
      aiProviderPreference: "gemini",
    });
    // All fields should equal the original base
    expect(result).toEqual(prev);
  });

  it("ignores non-Khipu fields even when mixed with Khipu fields", () => {
    const prev = base();
    const result = mergeKhipuFields(prev, {
      defaultCurrency: "USD",
      floatingKhipuTheme: "dark",
      currencyDecimals: 3,
    });
    expect(result.floatingKhipuTheme).toBe("dark");
    expect(result.defaultCurrency).toBe(prev.defaultCurrency);
    expect(result.currencyDecimals).toBe(prev.currencyDecimals);
  });

  it("ignores Khipu fields with wrong types in source", () => {
    const prev = base();
    const result = mergeKhipuFields(prev, {
      floatingKhipuTheme: 123,       // should be string
      floatingKhipuFontSize: true,    // should be string
      floatingKhipuPosition: null,    // should be string
      floatingKhipuWidth: "abc",      // should be number
      floatingKhipuHeight: undefined, // should be number
    });
    // None of the invalid-typed fields should have been applied
    expect(result.floatingKhipuTheme).toBe(prev.floatingKhipuTheme);
    expect(result.floatingKhipuFontSize).toBe(prev.floatingKhipuFontSize);
    expect(result.floatingKhipuPosition).toBe(prev.floatingKhipuPosition);
    expect(result.floatingKhipuWidth).toBe(prev.floatingKhipuWidth);
    expect(result.floatingKhipuHeight).toBe(prev.floatingKhipuHeight);
  });

  it("does not mutate the previous record", () => {
    const prev = base();
    const prevClone = { ...prev };
    mergeKhipuFields(prev, { floatingKhipuTheme: "dark" });
    expect(prev).toEqual(prevClone);
  });
});
