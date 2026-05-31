/* @vitest-environment jsdom */

import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GeneralBudgetOverview } from "@/components/budget/general-budget-overview";
import { FormattingSettingsProvider } from "@/components/providers/formatting-settings-provider";
import { AppViewModeProvider } from "@/components/view-mode/app-view-mode-provider";
import type { BudgetRecord } from "@/types/budget";
import type { UserSettingsRecord } from "@/types/settings";

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}));

let activeContainer: HTMLDivElement | null = null;

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe("GeneralBudgetOverview", () => {
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
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it("shows the consolidated general budget tab by default and lets the user switch back to a sub budget detail", async () => {
    const { clickButton, getByText, queryByText, getByTestId, getLinkByText } = await renderOverview();

    expect(getByText("Presupuesto general")).toBeTruthy();
    expect(getByText("Consolidado activo")).toBeTruthy();
    expect(getByText("Trazabilidad del consolidado")).toBeTruthy();
    expect(getByText("2 Sub Presupuestos conectados")).toBeTruthy();
    expect(getByText("Detalle completo para recalculo")).toBeTruthy();
    expect(getByText("Movimiento de tierras")).toBeTruthy();
    expect(getByText("Acero fy=4200")).toBeTruthy();
    expect(getLinkByText("Revisar con IA").getAttribute("href")).toContain("/ai?action=review");
    const generalTableText = getByTestId("general-budget-tab-table").textContent ?? "";
    expect(generalTableText).not.toContain("Sub presupuesto");
    expect(generalTableText).not.toContain("Acciones");
    expect(generalTableText).not.toContain("Abrir Sub Presupuesto");

    const generalViewText = document.body.textContent ?? "";
    expect(generalViewText.indexOf("Estructuras")).toBeLessThan(generalViewText.indexOf("Arquitectura"));

    await act(async () => {
      clickButton("Arquitectura");
    });

    expect(getByText("Sub Presupuesto activo")).toBeTruthy();
    expect(getByText("Acero fy=4200")).toBeTruthy();
    expect(queryByText("Consolidado activo")).toBeNull();
    const activeTableText = getByTestId("active-sub-budget-table").textContent ?? "";
    expect(activeTableText).not.toContain("Acciones");
    expect(activeTableText).not.toContain("Abrir Sub Presupuesto");

    await act(async () => {
      clickButton("Presupuesto general");
    });

    expect(getByText("Consolidado activo")).toBeTruthy();
    expect(getByText("Acero fy=4200")).toBeTruthy();
  });
});

async function renderOverview() {
  const nextContainer = document.createElement("div");
  document.body.appendChild(nextContainer);
  activeContainer = nextContainer;

  const root = createRoot(nextContainer);
  (nextContainer as HTMLDivElement & { __root?: typeof root }).__root = root;

  await act(async () => {
    root.render(
      <FormattingSettingsProvider settings={createSettings()}>
        <AppViewModeProvider initialViewMode="modern">
          <GeneralBudgetOverview
            projectId="project-1"
            generalBudgetId="general-1"
            subBudgets={createSubBudgetOverview()}
            subBudgetDetails={createSubBudgetDetails()}
          />
        </AppViewModeProvider>
      </FormattingSettingsProvider>,
    );
  });

  return {
    clickButton: (label: string) => {
      const button = Array.from(document.querySelectorAll("button")).find((element) => element.textContent?.includes(label));

      if (!(button instanceof HTMLButtonElement)) {
        throw new Error(`Missing button: ${label}`);
      }

      button.click();
    },
    getByText: (text: string) => {
      const matcher = text.toLowerCase();
      const element = Array.from(document.querySelectorAll("body *")).find((node) =>
        node.textContent?.toLowerCase().includes(matcher),
      );

      if (!(element instanceof HTMLElement)) {
        throw new Error(`Missing text: ${text}`);
      }

      return element;
    },
    queryByText: (text: string) => {
      const matcher = text.toLowerCase();
      const element = Array.from(document.querySelectorAll("body *")).find((node) =>
        node.textContent?.toLowerCase().includes(matcher),
      );

      return element instanceof HTMLElement ? element : null;
    },
    getByTestId: (testId: string) => {
      const element = document.querySelector(`[data-testid='${testId}']`);

      if (!(element instanceof HTMLElement)) {
        throw new Error(`Missing test id: ${testId}`);
      }

      return element;
    },
    getLinkByText: (text: string) => {
      const element = Array.from(document.querySelectorAll("a")).find((node) => node.textContent?.includes(text));
      if (!(element instanceof HTMLAnchorElement)) {
        throw new Error(`Missing link: ${text}`);
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
    defaultSubBudgetNames: ["Estructuras", "Arquitectura"],
  };
}

function createSubBudgetOverview() {
  return [
    {
      id: "sub-1",
      projectId: "project-1",
      parentBudgetId: "general-1",
      name: "Estructuras",
      currency: "PEN",
      totalDirectCost: 1000,
      totalGeneralExpenses: 100,
      totalUtility: 80,
      totalTax: 212.4,
      totalAmount: 1392.4,
      updatedAt: "2026-05-20T10:00:00.000Z",
      levelsCount: 1,
      itemsCount: 1,
    },
    {
      id: "sub-2",
      projectId: "project-1",
      parentBudgetId: "general-1",
      name: "Arquitectura",
      currency: "PEN",
      totalDirectCost: 500,
      totalGeneralExpenses: 50,
      totalUtility: 40,
      totalTax: 106.2,
      totalAmount: 696.2,
      updatedAt: "2026-05-21T10:00:00.000Z",
      levelsCount: 1,
      itemsCount: 1,
    },
  ];
}

function createSubBudgetDetails(): BudgetRecord[] {
  return [
    {
      id: "sub-2",
      projectId: "project-1",
      parentBudgetId: "general-1",
      kind: "SUB_BUDGET",
      name: "Arquitectura",
      currency: "PEN",
      igvRate: 0.18,
      generalExpensesRate: 0.1,
      utilityRate: 0.08,
      totalDirectCost: 0,
      totalGeneralExpenses: 0,
      totalUtility: 0,
      totalTax: 0,
      totalAmount: 0,
      levels: [
        {
          id: "level-2",
          budgetId: "sub-2",
          parentId: null,
          type: "TITLE",
          code: "02",
          name: "Acabados",
          sortOrder: 1,
        },
      ],
      items: [
        {
          id: "item-2",
          budgetId: "sub-2",
          levelId: "level-2",
          code: "02.01",
          description: "Acero fy=4200",
          unit: "kg",
          quantity: 20,
          unitPrice: 25,
          partial: 0,
          sortOrder: 1,
        },
      ],
    },
    {
      id: "sub-1",
      projectId: "project-1",
      parentBudgetId: "general-1",
      kind: "SUB_BUDGET",
      name: "Estructuras",
      currency: "PEN",
      igvRate: 0.18,
      generalExpensesRate: 0.1,
      utilityRate: 0.08,
      totalDirectCost: 0,
      totalGeneralExpenses: 0,
      totalUtility: 0,
      totalTax: 0,
      totalAmount: 0,
      levels: [
        {
          id: "level-1",
          budgetId: "sub-1",
          parentId: null,
          type: "TITLE",
          code: "01",
          name: "Obras preliminares",
          sortOrder: 1,
        },
      ],
      items: [
        {
          id: "item-1",
          budgetId: "sub-1",
          levelId: "level-1",
          code: "01.01",
          description: "Movimiento de tierras",
          unit: "m3",
          quantity: 10,
          unitPrice: 100,
          partial: 0,
          sortOrder: 1,
        },
      ],
    },
  ];
}
