/* @vitest-environment jsdom */

import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApuEditorSheet } from "@/components/apu/apu-editor-sheet";
import { BudgetViewModeProvider } from "@/components/budget/view-mode-provider";
import { FormattingSettingsProvider } from "@/components/providers/formatting-settings-provider";
import type { BudgetItemRecord } from "@/types/budget";
import type { CatalogPartidaRecord } from "@/types/partida";
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
    const { getByTestId, getButtonByText, getGripForRow, getLinkByText } = await renderSheet(item);

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
    const explainHref = getLinkByText("Explicar partida").getAttribute("href") ?? "";
    const copilotHref = getLinkByText("Abrir en Copiloto").getAttribute("href") ?? "";
    const generatorHref = getLinkByText("Generador de partidas").getAttribute("href") ?? "";
    expect(explainHref).toContain("/ai?action=chat");
    expect(explainHref).toContain("selectedItem=Partida+demo");
    expect(explainHref).toContain("description=Partida+demo");
    expect(explainHref).toContain("module=Editor+APU+de+sub+presupuesto");
    expect(getButtonByText("Generar con IA")).toBeTruthy();
    expect(generatorHref).toContain("/partidas/generar?");
    expect(generatorHref).toContain("sourceText=Partida+demo");
    expect(generatorHref).toContain("generatedName=Partida+demo");
    expect(generatorHref).toContain("unit=m2");
    expect(copilotHref).toContain("/ai?action=apu");
    expect(copilotHref).toContain("selectedItem=Partida+demo");
    expect(copilotHref).toContain("description=Partida+demo");
    expect(copilotHref).toContain("apuUnit=m2");
  });

  it("allows crew input for equipment rows", async () => {
    const { getByTestId } = await renderSheet(createBudgetItem());

    expect(getByTestId("apu-row-crew-resource-labor")).toBeInstanceOf(HTMLInputElement);
    expect(getByTestId("apu-row-crew-resource-equipment")).toBeInstanceOf(HTMLInputElement);
    expect(document.querySelector("[data-testid='apu-row-crew-resource-material']")).toBeNull();
  });

  it("generates an AI APU preview and applies it to the budget APU draft", async () => {
    const onUpdate = vi.fn();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        answer: "Propuesta APU",
        model: "llama3.1",
        requestedModel: "mistral",
        fallbackUsed: true,
        warnings: ["mistral no instalado"],
        structuredData: {
          answer: "Propuesta APU",
          unit: "m2",
          performance: "12 m2/dia",
          crew: "1 operario + 1 peon",
          materials: [{ description: "Cemento", unit: "bol", quantity: "0,25" }],
          labor: [{ description: "Operario", unit: "hh", quantity: "1.5" }],
          equipment: [{ description: "Mezcladora", unit: "hm", quantity: "0.2" }],
          observations: ["Validar precios."],
          assumptions: ["Rendimiento referencial."],
        },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { getButtonByText, getTextByExactMatch } = await renderSheet(createBudgetItem(), { onUpdate });

    await act(async () => {
      getButtonByText("Generar con IA").click();
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/ai/apu/generate",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining('"query":"Partida demo"'),
      }),
    );
    expect(getTextByExactMatch("Vista previa IA")).toBeTruthy();
    expect(getTextByExactMatch("Cemento")).toBeTruthy();

    await act(async () => {
      getButtonByText("Aplicar propuesta").click();
    });

    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(onUpdate.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        apu: expect.objectContaining({
          performance: 12,
          resources: expect.arrayContaining([
            expect.objectContaining({ resourceType: "MATERIAL", quantity: 0.25, unitPrice: 0 }),
            expect.objectContaining({ resourceType: "LABOR", quantity: 1.5, unitPrice: 0 }),
            expect.objectContaining({ resourceType: "EQUIPMENT", quantity: 0.2, unitPrice: 0 }),
          ]),
        }),
      }),
    );
  });

  it("adds a catalog partida as a subpartida with editable nested APU rows", async () => {
    const onUpdate = vi.fn();
    const catalogPartida = createCatalogPartida();
    const { getButtonByText, getByTestId, getTextByExactMatch } = await renderSheet(createBudgetItem(), {
      onUpdate,
      catalogPartidas: [catalogPartida],
    });

    await act(async () => {
      getButtonByText("Agregar subpartida").click();
    });

    const searchInput = getByTestId("apu-add-subpartida-search") as HTMLInputElement;
    await act(async () => {
      searchInput.value = "excavacion";
      searchInput.dispatchEvent(new Event("input", { bubbles: true }));
    });

    await act(async () => {
      getByTestId("apu-add-subpartida-option-catalog-subpartida-1").click();
    });

    expect(getTextByExactMatch("EXCAVACION MANUAL")).toBeTruthy();
    expect(getTextByExactMatch("Unidad: M3")).toBeTruthy();

    await act(async () => {
      getButtonByText("Agregar al APU").click();
    });

    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(onUpdate.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        apu: expect.objectContaining({
          resources: expect.arrayContaining([
            expect.objectContaining({
              catalogPartidaId: "catalog-subpartida-1",
              resourceId: null,
              resourceType: "SUBPARTIDA",
              quantity: 1,
              unitPrice: 16.48,
              nestedApuRows: expect.arrayContaining([
                expect.objectContaining({ description: "PEON", catalogPartidaId: "catalog-subpartida-1" }),
                expect.objectContaining({ description: "HERRAMIENTAS MANUALES", catalogPartidaId: "catalog-subpartida-1" }),
              ]),
              catalogPartida,
            }),
          ]),
        }),
      }),
    );
  });
});

async function renderSheet(
  item: BudgetItemRecord,
  overrides?: {
    onUpdate?: (item: BudgetItemRecord) => void;
    catalogPartidas?: CatalogPartidaRecord[];
  },
) {
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
            onUpdate={overrides?.onUpdate ?? (() => undefined)}
            resourcesCatalog={[]}
            catalogPartidas={overrides?.catalogPartidas ?? []}
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
    getButtonByText: (text: string) => {
      const element = [...document.querySelectorAll("button")].find((candidate) => candidate.textContent?.trim() === text);
      if (!(element instanceof HTMLButtonElement)) {
        throw new Error(`Missing button: ${text}`);
      }

      return element;
    },
    getLinkByText: (text: string) => {
      const element = [...document.querySelectorAll("a")].find((candidate) => candidate.textContent?.trim() === text);
      if (!(element instanceof HTMLAnchorElement)) {
        throw new Error(`Missing link: ${text}`);
      }

      return element;
    },
    getTextByExactMatch: (text: string) => {
      const element = [...document.querySelectorAll("*")].find((candidate) => candidate.textContent?.trim() === text);
      if (!(element instanceof HTMLElement)) {
        throw new Error(`Missing text: ${text}`);
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
      unit: resourceType === "EQUIPMENT" ? "HM" : "glb",
      unitPrice,
      currency: "PEN",
    },
  };
}

function createCatalogPartida(): CatalogPartidaRecord {
  return {
    id: "catalog-subpartida-1",
    description: "EXCAVACION MANUAL",
    unit: "M3",
    unitPrice: 42.5,
    currency: "PEN",
    source: "Catalogo de partidas precargado",
    performance: 10,
    performanceUnit: "M3",
    performanceRate: "10.0000 M3/DIA",
    apuRows: [
      {
        id: "catalog-row-1",
        catalogPartidaId: "catalog-subpartida-1",
        description: "PEON",
        unit: "HH",
        crew: null,
        quantity: 0.8,
        unitPrice: 20,
        subtotal: 16,
        resourceType: "LABOR",
        groupLabel: "Mano de obra",
        sortOrder: 0,
      },
      {
        id: "catalog-row-2",
        catalogPartidaId: "catalog-subpartida-1",
        description: "HERRAMIENTAS MANUALES",
        unit: "%MO",
        crew: null,
        quantity: 3,
        unitPrice: 16,
        subtotal: 0.48,
        resourceType: "TOOLS",
        groupLabel: "Equipo",
        sortOrder: 1,
      },
    ],
  };
}
