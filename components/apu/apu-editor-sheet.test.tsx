/* @vitest-environment jsdom */

import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApuEditorSheet } from "@/components/apu/apu-editor-sheet";
import { BudgetViewModeProvider } from "@/components/budget/view-mode-provider";
import { FormattingSettingsProvider } from "@/components/providers/formatting-settings-provider";
import type { BudgetItemRecord } from "@/types/budget";
import type { UserSettingsRecord } from "@/types/settings";

let activeContainer: HTMLDivElement | null = null;

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe("ApuEditorSheet", () => {
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

  it("renders category subtotal cards and colors row grips by category", async () => {
    const item = createBudgetItem();
    const { getByTestId, getGripForRow } = await renderSheet(item);

    expect(getByTestId("apu-summary-card-LABOR").textContent).toContain("S/ 30.00");
    expect(getByTestId("apu-summary-card-MATERIAL").textContent).toContain("S/ 31.00");
    expect(getByTestId("apu-summary-card-EQUIPMENT").textContent).toContain("S/ 45.00");
    expect(getByTestId("apu-summary-card-SUBCONTRACT").textContent).toContain("S/ 200.00");
    expect(getByTestId("apu-summary-card-SUBPARTIDA").textContent).toContain("S/ 125.00");

    expect(getGripForRow("resource-tools").dataset.apuCategory).toBe("EQUIPMENT");
    expect(getGripForRow("resource-tools").className).toContain("text-amber-600");
    expect(getGripForRow("resource-subpartida").dataset.apuCategory).toBe("SUBPARTIDA");
    expect(getGripForRow("resource-subpartida").className).toContain("text-violet-600");
    expect(getByTestId("apu-add-resource-search").getAttribute("data-excel-field-border-opt-out")).toBe("true");
  });
});

async function renderSheet(item: BudgetItemRecord) {
  const nextContainer = document.createElement("div");
  document.body.appendChild(nextContainer);
  activeContainer = nextContainer;

  const root = createRoot(nextContainer);
  (nextContainer as HTMLDivElement & { __root?: typeof root }).__root = root;

  await act(async () => {
    root.render(
      <FormattingSettingsProvider settings={createSettings()}>
        <BudgetViewModeProvider>
          <ApuEditorSheet
            item={item}
            open
            onClose={() => undefined}
            onUpdate={() => undefined}
            resourcesCatalog={[]}
            densityMode="comfortable"
          />
        </BudgetViewModeProvider>
      </FormattingSettingsProvider>,
    );
  });

  return {
    getByTestId: (testId: string) => {
      const element = document.querySelector(`[data-testid='${testId}']`);
      if (!(element instanceof HTMLElement)) {
        throw new Error(`Missing element: ${testId}`);
      }

      return element;
    },
    getGripForRow: (rowId: string) => {
      const element = document.querySelector(`[data-testid='apu-row-grip-${rowId}']`);
      if (!(element instanceof HTMLElement)) {
        throw new Error(`Missing grip: ${rowId}`);
      }

      return element;
    },
  };
}

function createSettings(): UserSettingsRecord {
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
  };
}

function createBudgetItem(): BudgetItemRecord {
  return {
    id: "item-1",
    budgetId: "budget-1",
    code: "01.01",
    description: "Partida demo",
    unit: "m2",
    quantity: 1,
    unitPrice: 0,
    partial: 0,
    sortOrder: 0,
    apu: {
      id: "apu-1",
      budgetItemId: "item-1",
      name: "APU demo",
      unit: "m2",
      performance: 8,
      totalUnitCost: 0,
      resources: [
        createResourceRow("resource-labor", "LABOR", "LABOR", 1.5, 20),
        createResourceRow("resource-material", "MATERIAL", "MATERIAL", 2, 15.5),
        createResourceRow("resource-equipment", "EQUIPMENT", "EQUIPMENT", 0.5, 80),
        createResourceRow("resource-tools", "TOOLS", "TOOLS", 0.1, 50),
        createResourceRow("resource-subcontract", "SUBCONTRACT", "EQUIPMENT", 1, 200),
        createResourceRow("resource-subpartida", "SUBPARTIDA", "MATERIAL", 1, 125),
      ],
    },
  };
}

function createResourceRow(
  id: string,
  resourceType: string,
  category: "MATERIAL" | "LABOR" | "EQUIPMENT" | "TOOLS",
  quantity: number,
  unitPrice: number,
) {
  return {
    id,
    apuId: "apu-1",
    resourceId: `${id}-resource`,
    resourceType,
    crew: null,
    quantity,
    unitPrice,
    subtotal: 0,
    resource: {
      id: `${id}-resource`,
      code: id.toUpperCase(),
      description: id,
      category,
      unit: "glb",
      unitPrice,
      currency: "PEN",
    },
  };
}
