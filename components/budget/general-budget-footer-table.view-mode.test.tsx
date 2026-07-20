// @vitest-environment jsdom

import React from "react";
import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { GeneralBudgetFooterTable } from "@/components/budget/general-budget-footer-table";
import type { BudgetFooterStructure } from "@/types/budget-sections";

vi.mock("next/dynamic", () => ({
  default: () => () => null,
}));

const viewModeState: { isExcelMode: boolean } = { isExcelMode: false };
const formattingSettingsState: { excelRowHeight: number; excelShowFieldBorders: boolean } = {
  excelRowHeight: 74,
  excelShowFieldBorders: true,
};

vi.mock("@/components/view-mode/app-view-mode-provider", () => ({
  useAppViewMode: () => ({ isExcelMode: viewModeState.isExcelMode, setExcelMode: vi.fn() }),
}));

vi.mock("@/components/providers/formatting-settings-provider", () => ({
  useFormattingSettings: () => ({
    excelRowHeight: formattingSettingsState.excelRowHeight,
    excelShowFieldBorders: formattingSettingsState.excelShowFieldBorders,
  }),
}));

afterEach(() => {
  viewModeState.isExcelMode = false;
  formattingSettingsState.excelRowHeight = 74;
  formattingSettingsState.excelShowFieldBorders = true;
});

function createSampleStructure(): BudgetFooterStructure {
  return {
    amountInWords: "CERO CON 00/100 SOLES",
    rows: [
      {
        id: "row-igv",
        variable: "IGV",
        description: "IGV",
        formula: "",
        manualValue: 0,
        value: 0,
        iu: "",
        highlight: false,
        sortOrder: 0,
        error: null,
        isCalculated: true,
      },
      {
        id: "row-cd",
        variable: "CD",
        description: "COSTO DIRECTO",
        formula: "",
        manualValue: 1000,
        value: 1000,
        iu: "",
        highlight: false,
        sortOrder: 1,
        error: null,
        isCalculated: true,
      },
    ],
  };
}

describe("GeneralBudgetFooterTable — Excel mode density contract (Task 9)", () => {
  it("applies data-view-mode=excel and the excel row-height CSS variable in Excel mode", () => {
    viewModeState.isExcelMode = true;
    formattingSettingsState.excelRowHeight = 52;

    const { container } = render(
      <GeneralBudgetFooterTable
        budgetId="budget-1"
        currency="PEN"
        currencyDecimals={2}
        generalExpensesRate={0.1}
        utilityRate={0.075}
        igvRate={0.18}
        initialStructure={createSampleStructure()}
      />,
    );

    const root = container.querySelector("[data-view-mode=\"excel\"]");
    expect(root).not.toBeNull();
    const inlineStyle = root?.getAttribute("style") ?? "";
    expect(inlineStyle).toMatch(/--excel-row-height:\s*52px/);
  });

  it("renders data-view-mode=modern with rounded frame in modern mode", () => {
    viewModeState.isExcelMode = false;

    const { container } = render(
      <GeneralBudgetFooterTable
        budgetId="budget-1"
        currency="PEN"
        currencyDecimals={2}
        generalExpensesRate={0.1}
        utilityRate={0.075}
        igvRate={0.18}
        initialStructure={createSampleStructure()}
      />,
    );

    const root = container.querySelector("[data-view-mode=\"modern\"]");
    expect(root).not.toBeNull();
    const className = root?.getAttribute("class") ?? "";
    expect(className.split(/\s+/)).toContain("rounded-2xl");
  });

  it("applies the Excel control height to the IGV system-formula placeholder in Excel mode", () => {
    viewModeState.isExcelMode = true;

    const { container } = render(
      <GeneralBudgetFooterTable
        budgetId="budget-1"
        currency="PEN"
        currencyDecimals={2}
        generalExpensesRate={0.1}
        utilityRate={0.075}
        igvRate={0.18}
        initialStructure={createSampleStructure()}
      />,
    );

    const placeholderText = container.textContent?.includes("ST*0.18");
    expect(placeholderText).toBe(true);

    const html = container.innerHTML;
    const densityMatches = html.match(/h-\[var\(--excel-control-height\)\]/g);
    expect(densityMatches && densityMatches.length).toBeGreaterThan(0);
  });
});
