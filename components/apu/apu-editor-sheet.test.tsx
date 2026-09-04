/* @vitest-environment jsdom */

import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { fireEvent, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApuEditorSheet } from "@/components/apu/apu-editor-sheet";
import { BudgetViewModeProvider } from "@/components/budget/view-mode-provider";
import { AppViewModeProvider } from "@/components/view-mode/app-view-mode-provider";
import { FormattingSettingsProvider } from "@/components/providers/formatting-settings-provider";
import type { BudgetItemRecord } from "@/types/budget";
import type { CatalogPartidaRecord } from "@/types/partida";
import type { ResourceRecord } from "@/types/resource";
import type { UserSettingsRecord } from "@/types/settings";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));

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

  it("locks Khipu actions for Starter users", async () => {
    const { getTextByExactMatch } = await renderSheet(createBudgetItem(), { canUseKhipu: false });

    const getLockedButton = (label: string) => {
      const button = [...document.querySelectorAll<HTMLButtonElement>("button")].find((candidate) => candidate.textContent?.startsWith(label));
      if (!(button instanceof HTMLButtonElement)) throw new Error(`Missing locked button: ${label}`);
      return button;
    };

    expect(getLockedButton("Explicar partida").disabled).toBe(true);
    expect(getLockedButton("Generar con IA").disabled).toBe(true);
    expect(getLockedButton("Khipu").disabled).toBe(true);
    expect(getTextByExactMatch("Pro")).toBeTruthy();
    expect(getTextByExactMatch("Abrir en Khipu")).toBeNull();
  });

  it("renders category subtotal cards and colors row grips by category", async () => {
    const item = createBudgetItem();
    const { getByTestId, getButtonByText, getGripForRow, getLinkByText, getTextByExactMatch } = await renderSheet(item);

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
    const khipuHref = getLinkByText("Abrir en Khipu").getAttribute("href") ?? "";
    expect(explainHref).toContain("/ai?action=chat");
    expect(explainHref).toContain("selectedItem=Partida+demo");
    expect(explainHref).toContain("description=Partida+demo");
    expect(explainHref).toContain("module=Editor+APU+de+sub+presupuesto");
    expect(getButtonByText("Generar con IA")).toBeTruthy();
    await act(async () => {
      getButtonByText("Generador de partidas").click();
    });
    expect(getTextByExactMatch("Generar partida por similitud")).toBeTruthy();
    expect(khipuHref).toContain("/ai?action=apu");
    expect(khipuHref).toContain("selectedItem=Partida+demo");
    expect(khipuHref).toContain("description=Partida+demo");
    expect(khipuHref).toContain("apuUnit=m2");
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

  it("applies an embedded similarity-generated partida after confirming replacement", async () => {
    const onUpdate = vi.fn();
    const confirmMock = vi.spyOn(window, "confirm").mockReturnValue(true);
    const generatedResource = createCatalogResource();
    const generatedPartida = createCatalogPartidaWithResource(generatedResource);
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(createJsonResponse({
          candidates: [{ partida: createCatalogPartida(), score: 0.9, compositionSimilarity: 0.8, breakdown: {}, variables: {} }],
          sourceVariables: {},
        }))
        .mockResolvedValueOnce(createJsonResponse([
          {
            key: "resource-generated",
            resourceId: generatedResource.id,
            description: generatedResource.description,
            unit: generatedResource.unit,
            resourceType: generatedResource.category,
            frequency: 1,
            confidenceLevel: "auto",
            suggestedCrew: null,
            suggestedQuantity: 2,
            unitPrice: generatedResource.unitPrice,
            priceSource: "catalog",
            calculationMethod: "weighted_median",
            statistics: { average: 2, median: 2, minimum: 2, maximum: 2, standardDeviation: 0 },
            sourcePartidaIds: ["catalog-subpartida-1"],
          },
        ]))
        .mockResolvedValueOnce(createJsonResponse({ generatedPartidaId: "generated-partida-1", catalogPartida: generatedPartida })),
    );

    const { getButtonByText } = await renderSheet(createBudgetItem(), {
      onUpdate,
      catalogPartidas: [createCatalogPartida()],
      resourcesCatalog: [generatedResource],
    });

    await act(async () => {
      getButtonByText("Generador de partidas").click();
    });
    await act(async () => {
      getButtonByText("Siguiente").click();
    });
    await waitFor(() => expect(getButtonByText("Siguiente")).toBeTruthy());
    await act(async () => {
      getButtonByText("Siguiente").click();
    });
    await waitFor(() => expect(getButtonByText("Siguiente")).toBeTruthy());
    await act(async () => {
      getButtonByText("Siguiente").click();
    });
    await waitFor(() => expect(getButtonByText("Guardar partida")).toBeTruthy());
    await act(async () => {
      getButtonByText("Guardar partida").click();
    });

    expect(confirmMock).toHaveBeenCalledWith("Esta partida ya tiene un APU. ¿Quieres reemplazarlo con la partida generada?");
    expect(onUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        description: generatedPartida.description,
        unit: generatedPartida.unit,
        unitPrice: generatedPartida.unitPrice,
        apu: expect.objectContaining({
          name: generatedPartida.description,
          performance: generatedPartida.performance,
          totalUnitCost: generatedPartida.unitPrice,
          resources: [
            expect.objectContaining({
              resourceId: generatedResource.id,
              quantity: 2,
              unitPrice: generatedResource.unitPrice,
            }),
          ],
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
      fireEvent.focus(searchInput);
      fireEvent.change(searchInput, { target: { value: "excavacion" } });
    });

    const option = await waitFor(() => {
      const currentOption = document.querySelector("[data-testid='apu-add-subpartida-option-catalog-subpartida-1']");
      expect(currentOption).toBeInstanceOf(HTMLElement);
      return currentOption as HTMLElement;
    });
    expect(option).toBeInstanceOf(HTMLElement);

    await act(async () => {
      option.click();
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

  it("renders the docked presentation inline with Excel metadata and an independent scroll shell", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    activeContainer = container;
    const root = createRoot(container);
    (container as HTMLDivElement & { __root?: typeof root }).__root = root;

    await act(async () => {
      root.render(
        <FormattingSettingsProvider settings={createSettings()}>
          <AppViewModeProvider initialViewMode="excel">
            <ApuEditorSheet
              item={createBudgetItem()}
              open
              onClose={vi.fn()}
              onUpdate={vi.fn()}
              resourcesCatalog={[]}
              catalogPartidas={[]}
              densityMode="comfortable"
              presentation="docked"
            />
          </AppViewModeProvider>
        </FormattingSettingsProvider>,
      );
    });

    const panel = document.querySelector<HTMLElement>("[data-testid='apu-editor-sheet-panel']");
    expect(panel).not.toBeNull();
    expect(panel?.getAttribute("data-apu-presentation")).toBe("docked");
    expect(panel?.getAttribute("data-view-mode")).toBe("excel");
    expect(panel?.getAttribute("data-density-mode")).toBe("compact");
    expect(panel?.getAttribute("data-excel-field-border-scope")).toBe("apu-editor");
    const table = panel?.querySelector("table");
    expect(table?.className).toContain("table-fixed");
    const columns = [...(panel?.querySelectorAll("col") ?? [])].map((column) => column.className);
    expect(columns).toEqual(["w-[5%]", "w-[35%]", "w-[7%]", "w-[8%]", "w-[14%]", "w-[14%]", "w-[14%]", "w-[3%]"]);
    expect(panel?.querySelector("thead")?.textContent).toContain("PU");
    expect(panel?.querySelector("thead")?.textContent).toContain("Cant.");
    expect(panel?.querySelector("thead")?.querySelector("th")?.className).toContain("!text-[0.65rem]");
    expect(panel?.querySelector("thead")?.querySelector("th")?.className).not.toContain("text-[11px]");
    expect(panel?.querySelector("tbody")?.className).not.toContain("overflow-x-auto");

    const firstResourceRow = panel?.querySelector("tbody tr");
    expect(firstResourceRow).not.toBeNull();
    expect(firstResourceRow?.children[3]?.className).toContain("text-right");
    expect(firstResourceRow?.children[4]?.className).toContain("text-right");
    expect(firstResourceRow?.children[5]?.className).toContain("text-right");
    expect(firstResourceRow?.children[7]?.className).toContain("!p-0");
    const dockedInputs = [...(firstResourceRow?.querySelectorAll<HTMLInputElement>("input") ?? [])];
    expect(dockedInputs.length).toBeGreaterThan(0);
    expect(dockedInputs.every((input) => input.className.includes("!px-0"))).toBe(true);
    expect(document.querySelector("[data-radix-dialog-overlay]")).toBeNull();
    expect(panel?.textContent).toContain("Partida demo");
    expect(panel?.textContent).toContain("Insumo");

    const headerTitle = panel?.querySelector<HTMLElement>("[data-testid='apu-header-title']");
    expect(headerTitle?.className).toContain("text-sm");
    expect(headerTitle?.className).toContain("leading-tight");

    const headerActions = panel?.querySelector<HTMLElement>("[data-testid='apu-header-actions']");
    const headerButtons = [...(headerActions?.querySelectorAll<HTMLButtonElement>("button") ?? [])];
    expect(headerButtons).toHaveLength(4);
    expect(headerButtons.map((button) => button.getAttribute("title"))).toEqual([
      "Explicar partida",
      "Generar APU con IA",
      "Abrir generador de partidas",
      "Abrir en Khipu",
    ]);
    expect(headerButtons.every((button) => !button.textContent?.trim())).toBe(true);
  });

  it("inherits excel view-mode and apu-editor field border scope on the main sheet wrapper", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    activeContainer = container;
    const root = createRoot(container);
    (container as HTMLDivElement & { __root?: typeof root }).__root = root;

    const settings = createSettings();

    await act(async () => {
      root.render(
        <FormattingSettingsProvider settings={settings}>
          <AppViewModeProvider initialViewMode="excel">
            <ApuEditorSheet
              item={createBudgetItem()}
              open
              onClose={vi.fn()}
              onUpdate={vi.fn()}
              resourcesCatalog={[]}
              catalogPartidas={[]}
              densityMode="compact"
            />
          </AppViewModeProvider>
        </FormattingSettingsProvider>,
      );
    });

    const mainSheet = document.querySelector<HTMLElement>(
      '[data-excel-field-border-scope="apu-editor"][data-view-mode="excel"]',
    );
    expect(mainSheet).not.toBeNull();
    expect(mainSheet!.getAttribute("data-view-mode")).toBe("excel");
    expect(mainSheet!.getAttribute("data-excel-field-border-scope")).toBe("apu-editor");
    expect(mainSheet!.style.getPropertyValue("--excel-row-height")).toBe("52px");
    expect(mainSheet!.style.getPropertyValue("--excel-field-border-color")).toBe("#cbd5e1");
  });
});

async function renderSheet(
  item: BudgetItemRecord,
  overrides?: {
    onUpdate?: (item: BudgetItemRecord) => void;
    catalogPartidas?: CatalogPartidaRecord[];
    resourcesCatalog?: ResourceRecord[];
    canUseKhipu?: boolean;
    canUsePartidaGenerator?: boolean;
    canUseCollaboration?: boolean;
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
            resourcesCatalog={overrides?.resourcesCatalog ?? []}
            catalogPartidas={overrides?.catalogPartidas ?? []}
            canUseKhipu={overrides?.canUseKhipu}
            canUsePartidaGenerator={overrides?.canUsePartidaGenerator}
            canUseCollaboration={overrides?.canUseCollaboration}
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
      return element instanceof HTMLElement ? element : null;
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
    defaultSubBudgetNames: ["Estructuras"],
    floatingKhipuProvider: "ollama",
    floatingKhipuWidth: 600,
    floatingKhipuHeight: 500,
    floatingKhipuFontSize: "normal",
    floatingKhipuPosition: "bottom-right",
    floatingKhipuTheme: "light",
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

function createCatalogResource(): ResourceRecord {
  return {
    id: "resource-generated",
    code: "MAT-001",
    description: "Cemento Portland",
    category: "MATERIAL",
    unit: "bol",
    unitPrice: 32,
    currency: "PEN",
    source: "Catalogo",
  };
}

function createCatalogPartidaWithResource(resource: ResourceRecord): CatalogPartidaRecord {
  return {
    id: "generated-catalog-partida",
    description: "Partida generada por similitud",
    unit: "m2",
    unitPrice: 64,
    currency: "PEN",
    source: "Generada por similitud V1",
    performance: 4,
    performanceUnit: "m2",
    performanceRate: "4.0000 m2/DIA",
    apuRows: [
      {
        id: "generated-row-1",
        catalogPartidaId: "generated-catalog-partida",
        resourceId: resource.id,
        description: resource.description,
        unit: resource.unit,
        crew: null,
        quantity: 2,
        unitPrice: resource.unitPrice,
        subtotal: 64,
        resourceType: resource.category,
        groupLabel: "Materiales",
        sortOrder: 0,
      },
    ],
  };
}

function createJsonResponse(payload: unknown) {
  return {
    ok: true,
    json: async () => payload,
  };
}
