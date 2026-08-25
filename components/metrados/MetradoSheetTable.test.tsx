/* @vitest-environment jsdom */

import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MetradoSheetTable } from "@/components/metrados/MetradoSheetTable";
import { AppViewModeProvider } from "@/components/view-mode/app-view-mode-provider";
import { FormattingSettingsProvider } from "@/components/providers/formatting-settings-provider";
import type {
  MetradoFormulaInputKey,
  MetradoFormulaRecord,
  MetradoRowRecord,
} from "@/types/metrado";
import type { UserSettingsRecord } from "@/types/settings";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let activeContainer: HTMLDivElement | null = null;

describe("MetradoSheetTable in Excel mode", () => {
  afterEach(async () => {
    if (activeContainer) {
      const root = (activeContainer as HTMLDivElement & { __root?: ReturnType<typeof createRoot> }).__root;
      if (root) {
        await act(async () => {
          root.unmount();
        });
      }
      activeContainer.remove();
      activeContainer = null;
    }
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("marks active and selected metrado cells in Excel mode", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    activeContainer = container;
    const root = createRoot(container);
    (container as HTMLDivElement & { __root?: typeof root }).__root = root;

    await act(async () => {
      root.render(
        <FormattingSettingsProvider settings={createSettings()}>
          <AppViewModeProvider initialViewMode="excel">
            <MetradoSheetTable
              rows={[createNormalRow()]}
              formulas={createFormulas()}
              inputColumns={["largo", "ancho", "alto"]}
              activeCell={null}
              selectedRowIds={new Set()}
              onActiveCellChange={vi.fn()}
              onAddRow={vi.fn()}
              onDuplicateRow={vi.fn()}
              onDeleteRow={vi.fn()}
              onPatchRow={vi.fn()}
              onInputChange={vi.fn()}
              onAddGroupRow={vi.fn()}
              onSelectionChange={vi.fn()}
              onBatchAction={vi.fn()}
            />
          </AppViewModeProvider>
        </FormattingSettingsProvider>,
      );
    });

    const sectorInput = container.querySelector<HTMLInputElement>('input[aria-label="Sector fila 1"]');
    expect(sectorInput).not.toBeNull();
    expect(sectorInput!.className).toContain("border-transparent");

    await act(async () => {
      sectorInput!.focus();
    });

    const cell = sectorInput!.closest("td");
    expect(cell).not.toBeNull();
    expect(cell!.getAttribute("data-spreadsheet-key")).toBe("row-1::sector");
    expect(cell!.getAttribute("data-spreadsheet-row")).toBe("row-1");
    expect(cell!.getAttribute("data-spreadsheet-col")).toBe("sector");
    expect(cell!.getAttribute("data-spreadsheet-active")).toBe("true");
    expect(cell!.getAttribute("data-spreadsheet-selected")).toBe("true");
    expect(sectorInput!.className).not.toContain("bg-sky-50");
  });

  it("uses soft input borders in modern mode", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    activeContainer = container;
    const root = createRoot(container);
    (container as HTMLDivElement & { __root?: typeof root }).__root = root;

    await act(async () => {
      root.render(
        <FormattingSettingsProvider settings={createSettings()}>
          <AppViewModeProvider initialViewMode="modern">
            <MetradoSheetTable
              rows={[createNormalRow()]}
              formulas={createFormulas()}
              inputColumns={["largo"]}
              activeCell={null}
              selectedRowIds={new Set()}
              onActiveCellChange={vi.fn()}
              onAddRow={vi.fn()}
              onDuplicateRow={vi.fn()}
              onDeleteRow={vi.fn()}
              onPatchRow={vi.fn()}
              onInputChange={vi.fn()}
              onAddGroupRow={vi.fn()}
              onSelectionChange={vi.fn()}
              onBatchAction={vi.fn()}
            />
          </AppViewModeProvider>
        </FormattingSettingsProvider>,
      );
    });

    const sectorInput = container.querySelector<HTMLInputElement>('input[aria-label="Sector fila 1"]');
    const numericInput = container.querySelector<HTMLInputElement>('input[aria-label="largo fila 1"]');
    expect(sectorInput!.className).toContain("border-[var(--app-border-soft)]");
    expect(numericInput!.className).toContain("border-[var(--app-border-soft)]");
    expect(sectorInput!.className).not.toContain("border-transparent");
  });
});

function createNormalRow(overrides: Partial<MetradoRowRecord> = {}): MetradoRowRecord {
  return {
    id: "row-1",
    sortOrder: 1,
    groupLabel: null,
    sector: "A",
    eje: "X",
    nivel: "1",
    description: "",
    unit: "m",
    formulaKey: "manual",
    inputs: {} as Record<MetradoFormulaInputKey, number | undefined>,
    partial: 0,
    ...overrides,
  } as unknown as MetradoRowRecord;
}

function createFormulas(): MetradoFormulaRecord[] {
  return [
    {
      key: "manual",
      label: "Manual",
      inputs: [] as MetradoFormulaInputKey[],
      compute: () => 0,
    },
  ] as unknown as MetradoFormulaRecord[];
}

function createSettings(): UserSettingsRecord {
  return {
    aiProviderPreference: "auto",
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
    floatingKhipuProvider: "ollama",
    floatingKhipuWidth: 600,
    floatingKhipuHeight: 500,
    floatingKhipuFontSize: "normal",
    floatingKhipuPosition: "bottom-right",
    floatingKhipuTheme: "light",
  };
}
