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

const refreshMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: refreshMock,
  }),
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
    refreshMock.mockReset();
    vi.restoreAllMocks();
  });

  it("shows the consolidated general budget tab by default and lets the user switch back to a sub budget detail", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        partida: {
          id: "catalog-created-agua",
          description: "AGUA PARA LA OBRA",
          unit: "M3",
          unitPrice: 15.09,
          currency: "PEN",
          performance: 1,
          apuRows: [],
        },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { clickButton, getByText, queryByText, getByTestId, getLinkByText } = await renderOverview();

    expect(getByText("Presupuesto general")).toBeTruthy();
    expect(getByText("Consolidado activo")).toBeTruthy();
    expect(getByText("Trazabilidad del consolidado")).toBeTruthy();
    expect(getByText("2 Sub Presupuestos conectados")).toBeTruthy();
    expect(getByText("Detalle completo para recalculo")).toBeTruthy();
    expect(getByText("Mostrar detalle consolidado")).toBeTruthy();
    expect(queryByText("Movimiento de tierras")).toBeNull();

    await act(async () => {
      clickButton("Mostrar detalle consolidado");
    });

    expect(getByText("Movimiento de tierras")).toBeTruthy();
    expect(getByText("Acero fy=4200")).toBeTruthy();
    expect(document.querySelector('[aria-label="Metrado de Movimiento de tierras"]')).toBeTruthy();
    expect(document.querySelector('a[href*="/metrados-avanzados"]')).toBeTruthy();
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
      clickButton("Subpartidas");
    });

    const subpartidasTableText = getByTestId("active-sub-budget-subpartidas-table").textContent ?? "";
    expect(subpartidasTableText).toContain("Tarrajeo en interiores");
    expect(subpartidasTableText).toContain("m2");
    expect(subpartidasTableText).toContain("S/ 45.00");
    expect(subpartidasTableText).toContain("Con APU");
    expect(subpartidasTableText).toContain("Agua para la obra");
    expect(subpartidasTableText).toContain("APU vacio");
    expect(subpartidasTableText).toContain("S/ 15.09");
    expect(subpartidasTableText).toContain("AGUA PARA LA OBRA");
    expect(subpartidasTableText).toContain("Sin partida");
    expect(subpartidasTableText).toContain("Crear partida/APU");
    expect(subpartidasTableText).not.toContain("Subpartida sin nombre");
    expect(getLinkByText("Abrir catalogo").getAttribute("href")).toBe("/partidas?q=Agua%20para%20la%20obra");

    await act(async () => {
      clickButton("Crear partida/APU");
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/budgets/sub-2/subpartidas/catalog",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining('"description":"AGUA PARA LA OBRA"'),
      }),
    );
    expect(refreshMock).toHaveBeenCalled();

    await act(async () => {
      clickButton("Presupuesto general");
    });

    expect(getByText("Consolidado activo")).toBeTruthy();
    expect(getByText("Acero fy=4200")).toBeTruthy();
  });

  it("shows a budget-detail table skeleton while loading consolidated details", async () => {
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(new Promise(() => {})));

    const { clickButton } = await renderOverview({ subBudgetDetails: [] });

    await act(async () => {
      clickButton("Mostrar detalle consolidado");
    });

    const loadingRegion = document.querySelector('[role="status"][aria-label="Cargando detalle consolidado"]');
    expect(loadingRegion?.getAttribute("aria-busy")).toBe("true");
    expect(document.querySelector('table[aria-label="Cargando detalle consolidado"]')).toBeTruthy();
    expect(document.body.textContent).not.toContain("Cargando detalle consolidado...");
  });

  it("marks advanced metrados in sub budget detail and asks confirmation before manual override", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ quantity: 18, budgetId: "sub-1" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { clickButton } = await renderOverview();

    await act(async () => {
      clickButton("Estructuras");
    });

    const input = document.querySelector('[aria-label="Metrado de Movimiento de tierras"]');
    expect(input).toBeInstanceOf(HTMLButtonElement);
    expect(input?.getAttribute("title")).toBe("Haz clic para cambiar a metrado manual");
    expect(document.body.textContent).not.toContain("ADV");

    await act(async () => {
      input?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(document.body.textContent).toContain("Cambiar a metrado manual");
    expect(fetchMock).not.toHaveBeenCalledWith(
      "/api/budget-items/item-1/quantity",
      expect.objectContaining({ method: "PATCH" }),
    );
  });

  it("asks confirmation from the initial sub budget overview", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const { clickButton } = await renderOverview();

    await act(async () => {
      clickButton("Mostrar detalle consolidado");
    });

    const input = document.querySelector('[aria-label="Metrado de Movimiento de tierras"]');
    expect(input).toBeInstanceOf(HTMLButtonElement);

    await act(async () => {
      input?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(document.body.textContent).toContain("Cambiar a metrado manual");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

async function renderOverview({ subBudgetDetails = createSubBudgetDetails() }: { subBudgetDetails?: BudgetRecord[] } = {}) {
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
            subBudgetDetails={subBudgetDetails}
            metradoItems={[
              { itemId: "item-1", projectId: "project-1", budgetId: "sub-1", totalQuantity: 12.5 },
            ]}
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
    defaultSubBudgetNames: ["Estructuras", "Arquitectura"],
    floatingKhipuProvider: "openai",
    floatingKhipuWidth: 420,
    floatingKhipuHeight: 620,
    floatingKhipuFontSize: "normal",
    floatingKhipuPosition: "bottom-right",
    floatingKhipuTheme: "light",
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
          apu: {
            id: "apu-item-2",
            budgetItemId: "item-2",
            name: "APU Acero",
            unit: "kg",
            performance: 10,
            totalUnitCost: 25,
            resources: [
              {
                id: "apu-resource-sub-1",
                apuId: "apu-item-2",
                resourceId: null,
                catalogPartidaId: "catalog-partida-1",
                resourceType: "SUBPARTIDA",
                crew: null,
                quantity: 1,
                unitPrice: 45,
                subtotal: 45,
                nestedApuRows: [
                  {
                    id: "nested-row-1",
                    catalogPartidaId: "catalog-partida-1",
                    description: "PEON",
                    unit: "hh",
                    crew: null,
                    quantity: 1,
                    unitPrice: 20,
                    subtotal: 20,
                    resourceType: "LABOR",
                    sortOrder: 0,
                  },
                ],
                catalogPartida: {
                  id: "catalog-partida-1",
                  description: "Tarrajeo en interiores",
                  unit: "m2",
                  unitPrice: 45,
                  currency: "PEN",
                  performance: 12,
                  apuRows: [],
                },
              },
              {
                id: "apu-resource-sub-2",
                apuId: "apu-item-2",
                resourceId: null,
                catalogPartidaId: null,
                resourceType: "SUBPARTIDA",
                description: "AGUA PARA LA OBRA",
                unit: "M3",
                crew: null,
                quantity: 1,
                unitPrice: 8,
                subtotal: 8,
                nestedApuRows: [],
                catalogPartida: {
                  id: "catalog-partida-2",
                  description: "Agua para la obra",
                  unit: "glb",
                  unitPrice: 8,
                  currency: "PEN",
                  performance: 1,
                  apuRows: [],
                },
              },
              {
                id: "apu-resource-sub-3",
                apuId: "apu-item-2",
                resourceId: null,
                catalogPartidaId: null,
                resourceType: "SUBPARTIDA",
                description: "AGUA PARA LA OBRA",
                unit: "M3",
                crew: null,
                quantity: 1,
                unitPrice: 15.09,
                subtotal: 15.09,
                nestedApuRows: [],
                catalogPartida: null,
              },
            ],
          },
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
