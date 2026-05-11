/* @vitest-environment jsdom */

import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { BudgetEditor } from "@/components/budget/budget-editor";
import { BudgetViewModeProvider } from "@/components/budget/view-mode-provider";
import type { BudgetRecord } from "@/types/budget";
import type { ResourceRecord } from "@/types/resource";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: vi.fn(),
  }),
}));

let activeContainer: HTMLDivElement | null = null;
let originalScrollIntoView: typeof HTMLElement.prototype.scrollIntoView | undefined;

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe("BudgetEditor view mode integration", () => {
  beforeAll(() => {
    originalScrollIntoView = HTMLElement.prototype.scrollIntoView;
    HTMLElement.prototype.scrollIntoView = () => undefined;
  });

  beforeEach(() => {
    window.localStorage.clear();
  });

  afterAll(() => {
    if (originalScrollIntoView) {
      HTMLElement.prototype.scrollIntoView = originalScrollIntoView;
      return;
    }

    Reflect.deleteProperty(HTMLElement.prototype, "scrollIntoView");
  });

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

    document.querySelector("[data-testid='outside-focus-target']")?.remove();
    vi.restoreAllMocks();
  });

  it("renders the editor inside the provider path and updates mode-aware editor UI", async () => {
    const { host, getButtonByText, getByText, getEditorRoot } = await renderEditor();

    expect(host.dataset.viewMode).toBe("modern");
    expect(getByText("Vista moderna activa")).toBeTruthy();
    expect(getEditorRoot().className).toContain("budget-modern-flow");
    expect(countViewModeAnchors(host)).toBe(1);

    await act(async () => {
      getButtonByText("Tipo Excel").click();
    });

    expect(host.dataset.viewMode).toBe("excel");
    expect(getByText("Modo Excel activo")).toBeTruthy();
    expect(getEditorRoot().className).toContain("budget-excel-flow");
    expect(countViewModeAnchors(host)).toBe(1);
  });

  it("opens the active item APU with Ctrl+Enter and tightens the table in excel mode", async () => {
    const { getButtonByText, getByText, getHeaderByText, getInputByValue, getTableSurface } = await renderEditor({
      budget: createBudgetWithItem(),
    });

    await act(async () => {
      getButtonByText("Tipo Excel").click();
    });

    expect(getTableSurface().className).toContain("rounded-md");
    expect(getHeaderByText("Codigo").className).toContain("budget-sticky-header");

    await act(async () => {
      getInputByValue("Partida demo").focus();
    });

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, ctrlKey: true, key: "Enter" }));
    });

    expect(getByText("Editor APU")).toBeTruthy();
  });

  it("opens the active item APU with Ctrl+Enter even when the item has no apu yet", async () => {
    const { getByText, getInputByValue } = await renderEditor({
      budget: createBudgetWithItemWithoutApu(),
    });

    await act(async () => {
      getInputByValue("Partida sin APU").focus();
    });

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, ctrlKey: true, key: "Enter" }));
    });

    expect(getByText("Editor APU")).toBeTruthy();
    expect(getByText("Partida sin APU")).toBeTruthy();
  });

  it("passes effective compact density to the APU sheet when excel mode forces compact", async () => {
    const { getApuSheetPanel, getButtonByText, getInputByValue } = await renderEditor({
      budget: createBudgetWithItem(),
    });

    await act(async () => {
      getButtonByText("Comodo").click();
    });

    await act(async () => {
      getButtonByText("Tipo Excel").click();
    });

    await act(async () => {
      getInputByValue("Partida demo").focus();
    });

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, ctrlKey: true, key: "Enter" }));
    });

    expect(getApuSheetPanel().dataset.densityMode).toBe("compact");
  });

  it("moves focus into the APU sheet, keeps excel density, and closes it with Escape", async () => {
    const { getApuHeaderByText, getApuSheetPanel, getButtonByText, getInputByValue, queryByText } = await renderEditor({
      budget: createBudgetWithItem(),
    });

    await act(async () => {
      getButtonByText("Tipo Excel").click();
    });

    await act(async () => {
      getInputByValue("Partida demo").focus();
    });

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, ctrlKey: true, key: "Enter" }));
    });

    expect(getApuSheetPanel().dataset.densityMode).toBe("compact");
    expect(getApuSheetPanel().contains(document.activeElement)).toBe(true);
    expect(getApuHeaderByText("Insumo").className).toContain("budget-sticky-header");

    await act(async () => {
      dispatchKey(document.activeElement, "Escape");
    });

    expect(queryByText("Editor APU")).toBeNull();
  });

  it("restores focus to the prior budget editor control after the APU sheet closes", async () => {
    const { getInputByValue } = await renderEditor({
      budget: createBudgetWithItem(),
    });

    const budgetDescriptionInput = getInputByValue("Partida demo");

    await act(async () => {
      budgetDescriptionInput.focus();
    });

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, ctrlKey: true, key: "Enter" }));
    });

    await act(async () => {
      dispatchKey(document.activeElement, "Escape");
    });

    expect(document.activeElement).toBe(budgetDescriptionInput);
  });

  it("traps tab navigation within the APU sheet while it is open", async () => {
    const { getButtonByText, getInputByValue } = await renderEditor({
      budget: createBudgetWithItem(),
      resourcesCatalog: [createResource()],
    });

    await act(async () => {
      getInputByValue("Partida demo").focus();
    });

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, ctrlKey: true, key: "Enter" }));
    });

    const addManualRowButton = getButtonByText("Agregar fila manual");

    await act(async () => {
      addManualRowButton.focus();
    });

    expect(document.activeElement).toBe(addManualRowButton);

    await act(async () => {
      dispatchKey(document.activeElement, "Tab");
    });

    expect(document.activeElement).toBe(getButtonByText("Cerrar"));

    await act(async () => {
      dispatchKey(document.activeElement, "Tab", { shiftKey: true });
    });

    expect(document.activeElement).toBe(addManualRowButton);
  });

  it("keeps focus on the active APU field after an in-sheet update rerenders the editor", async () => {
    const { getApuPerformanceInput, getButtonByText, getInputByValue } = await renderEditor({
      budget: createBudgetWithItem(),
    });

    await act(async () => {
      getButtonByText("Tipo Excel").click();
    });

    await act(async () => {
      getInputByValue("Partida demo").focus();
    });

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, ctrlKey: true, key: "Enter" }));
    });

    const performanceInput = getApuPerformanceInput();

    await act(async () => {
      performanceInput.focus();
    });

    expect(document.activeElement).toBe(performanceInput);

    await act(async () => {
      setInputValue(performanceInput, "2");
    });

    const updatedPerformanceInput = getApuPerformanceInput();
    expect(updatedPerformanceInput.value).toBe("2");
    expect(document.activeElement).toBe(updatedPerformanceInput);
  });

  it("suppresses background budget shortcuts while the APU sheet is open", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ optimisticBudgets: [] }),
    } as Response);

    const { getByText, getInputByValue, getOrderedItemDescriptions } = await renderEditor({
      budget: createBudgetWithTwoItems(),
    });
    const orderedDescriptionsBeforeOpen = getOrderedItemDescriptions();

    await act(async () => {
      getInputByValue("Partida demo").focus();
    });

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, ctrlKey: true, key: "Enter" }));
    });

    expect(getByText("Editor APU")).toBeTruthy();
    expect(getOrderedItemDescriptions()).toEqual(orderedDescriptionsBeforeOpen);

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, ctrlKey: true, key: "s" }));
      window.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, altKey: true, key: "ArrowDown" }));
    });

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(getOrderedItemDescriptions()).toEqual(orderedDescriptionsBeforeOpen);
  });

  it("lets the select portal consume Escape before the dialog closes", async () => {
    const { getApuAddResourceTrigger, getByText, getInputByValue, queryByText, queryPortaledOptionByText } = await renderEditor({
      budget: createBudgetWithItem(),
      resourcesCatalog: [createResource()],
    });

    await act(async () => {
      getInputByValue("Partida demo").focus();
    });

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, ctrlKey: true, key: "Enter" }));
    });

    await act(async () => {
      getApuAddResourceTrigger().click();
    });

    expect(queryPortaledOptionByText("MAT-01 - Arena fina")).toBeTruthy();

    await act(async () => {
      dispatchKey(document.activeElement, "Escape");
    });

    expect(queryPortaledOptionByText("MAT-01 - Arena fina")).toBeNull();
    expect(getByText("Editor APU")).toBeTruthy();

    await act(async () => {
      dispatchKey(document.activeElement, "Escape");
    });

    expect(queryByText("Editor APU")).toBeNull();
  });

  it("keeps excel view mode available to portaled APU select content inside the dialog", async () => {
    const { getApuAddResourceTrigger, getButtonByText, getInputByValue, getPortaledSelectContent } = await renderEditor({
      budget: createBudgetWithItem(),
      resourcesCatalog: [createResource()],
    });

    await act(async () => {
      getButtonByText("Tipo Excel").click();
    });

    await act(async () => {
      getInputByValue("Partida demo").focus();
    });

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, ctrlKey: true, key: "Enter" }));
    });

    await act(async () => {
      getApuAddResourceTrigger().click();
    });

    expect(getPortaledSelectContent().dataset.viewMode).toBe("excel");
  });

  it("resets the add-resource picker after insertion so the same resource can be selected again", async () => {
    const { getApuAddResourceTrigger, getInputByValue, getPortaledOptionByText, getResourceRowCount } = await renderEditor({
      budget: createBudgetWithItem(),
      resourcesCatalog: [createResource()],
    });

    await act(async () => {
      getInputByValue("Partida demo").focus();
    });

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, ctrlKey: true, key: "Enter" }));
    });

    const picker = getApuAddResourceTrigger();
    expect(getResourceRowCount()).toBe(0);

    await act(async () => {
      picker.click();
    });

    await act(async () => {
      getPortaledOptionByText("MAT-01 - Arena fina").click();
    });

    expect(getResourceRowCount()).toBe(1);
    expect(picker.textContent).toContain("Agregar insumo desde el catalogo");

    await act(async () => {
      picker.click();
    });

    await act(async () => {
      getPortaledOptionByText("MAT-01 - Arena fina").click();
    });

    expect(getResourceRowCount()).toBe(2);
  });

  it("uses tighter excel mode density in budget cells and summary panel", async () => {
    const { getButtonByText, getEditorRoot, getHeaderByText, getSummaryPanel, getTableSurface } = await renderEditor({
      budget: createBudgetWithItem(),
    });

    await act(async () => {
      getButtonByText("Comodo").click();
    });

    await act(async () => {
      getButtonByText("Tipo Excel").click();
    });

    expect(getEditorRoot().dataset.densityMode).toBe("compact");
    expect(getTableSurface().dataset.densityMode).toBe("compact");
    expect(getSummaryPanel().dataset.densityMode).toBe("compact");
    expect(getHeaderByText("Codigo").className).toContain("budget-sticky-header");
    expect(getButtonByText("Compacto").getAttribute("aria-pressed")).toBe("true");
    expect(getButtonByText("Comodo").getAttribute("aria-pressed")).toBe("false");
  });

  it("keeps Task 4 shortcuts scoped to the editor when focus leaves the editor context", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ optimisticBudgets: [] }),
    } as Response);

    const { getByText, getInputByValue, getOutsideFocusTarget, getOrderedItemDescriptions } = await renderEditor({
      budget: createBudgetWithTwoItems(),
    });

    await act(async () => {
      const input = getInputByValue("Partida demo");
      input.focus();
    });

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, altKey: true, key: "ArrowDown" }));
    });

    expect(getOrderedItemDescriptions()).toEqual(["Partida secundaria", "Partida demo"]);

    await act(async () => {
      getOutsideFocusTarget().focus();
    });

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, ctrlKey: true, key: "Enter" }));
      window.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, ctrlKey: true, key: "s" }));
      window.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, altKey: true, key: "ArrowUp" }));
    });

    expect(() => getByText("Editor APU")).toThrow();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(getOrderedItemDescriptions()).toEqual(["Partida secundaria", "Partida demo"]);
  });
});

async function renderEditor(options?: { budget?: BudgetRecord; resourcesCatalog?: ResourceRecord[] }) {
  const nextContainer = document.createElement("div");
  document.body.appendChild(nextContainer);
  activeContainer = nextContainer;

  const root = createRoot(nextContainer);
  (nextContainer as HTMLDivElement & { __root?: typeof root }).__root = root;

  await act(async () => {
    root.render(
      <BudgetViewModeProvider>
        <BudgetEditor
          budget={options?.budget ?? createBudget()}
          partidasCatalog={[]}
          projectName="Proyecto Demo"
          resourcesCatalog={options?.resourcesCatalog ?? []}
        />
      </BudgetViewModeProvider>,
    );
  });

  return {
    host: nextContainer.firstElementChild as HTMLDivElement,
    getButtonByText: (text: string) => {
      const matcher = new RegExp(`^${text}$`);
      const element = [...document.body.querySelectorAll("button")].find((candidate) => matcher.test(candidate.textContent ?? ""));

      if (!(element instanceof HTMLButtonElement)) {
        throw new Error(`Missing button: ${text}`);
      }

      return element;
    },
    getByText: (text: string) => {
      const element = [...document.body.querySelectorAll("*")].find((candidate) => candidate.textContent?.trim() === text);

      if (!(element instanceof HTMLElement)) {
        throw new Error(`Missing element: ${text}`);
      }

      return element;
    },
    getPortaledOptionByText: (text: string) => {
      const element = [...document.body.querySelectorAll("[role='option']")].find((candidate) => candidate.textContent?.trim() === text);

      if (!(element instanceof HTMLElement)) {
        throw new Error(`Missing portaled option: ${text}`);
      }

      return element;
    },
    queryPortaledOptionByText: (text: string) => {
      const element = [...document.body.querySelectorAll("[role='option']")].find((candidate) => candidate.textContent?.trim() === text);
      return element instanceof HTMLElement ? element : null;
    },
    getPortaledSelectContent: () => {
      const element = document.body.querySelector(".ui-select-content");

      if (!(element instanceof HTMLDivElement)) {
        throw new Error("Missing portaled select content");
      }

      return element;
    },
    queryByText: (text: string) => {
      const element = [...document.body.querySelectorAll("*")].find((candidate) => candidate.textContent?.trim() === text);
      return element instanceof HTMLElement ? element : null;
    },
    getButtonByLabel: (label: string) => {
      const element = [...nextContainer.querySelectorAll("button")].find((candidate) => candidate.getAttribute("aria-label") === label);

      if (!(element instanceof HTMLButtonElement)) {
        throw new Error(`Missing labeled button: ${label}`);
      }

      return element;
    },
    getHeaderByText: (text: string) => {
      const matcher = new RegExp(`^${text}$`);
      const element = [...document.body.querySelectorAll("th")].find((candidate) => matcher.test(candidate.textContent ?? ""));

      if (!(element instanceof HTMLTableCellElement)) {
        throw new Error(`Missing header: ${text}`);
      }

      return element;
    },
    getApuHeaderByText: (text: string) => {
      const matcher = new RegExp(`^${text}$`);
      const element = [...document.body.querySelectorAll("th")].find((candidate) => matcher.test(candidate.textContent ?? ""));

      if (!(element instanceof HTMLTableCellElement)) {
        throw new Error(`Missing APU header: ${text}`);
      }

      return element;
    },
    getApuSheetPanel: () => {
      const element = document.body.querySelector("[data-testid='apu-editor-sheet-panel']");

      if (!(element instanceof HTMLDivElement)) {
        throw new Error("Missing APU sheet panel");
      }

      return element;
    },
    getApuAddResourceTrigger: () => {
      const element = document.body.querySelector("[data-testid='apu-add-resource-select']");

      if (!(element instanceof HTMLButtonElement)) {
        throw new Error("Missing APU add-resource trigger");
      }

      return element;
    },
    getApuPerformanceInput: () => {
      const element = document.body.querySelector("[data-testid='apu-performance-input']");

      if (!(element instanceof HTMLInputElement)) {
        throw new Error("Missing APU performance input");
      }

      return element;
    },
    getInputByValue: (value: string) => {
      const element = [...document.body.querySelectorAll("input")].find((candidate) => candidate.value === value);

      if (!(element instanceof HTMLInputElement)) {
        throw new Error(`Missing input with value: ${value}`);
      }

      return element;
    },
    getResourceRowCount: () =>
      [...document.body.querySelectorAll("button")].filter((candidate) => candidate.textContent?.trim() === "Quitar").length,
    getEditorRoot: () => {
      const element = nextContainer.querySelector("[data-view-mode-scope='budget-flow']");

      if (!(element instanceof HTMLDivElement)) {
        throw new Error("Missing budget editor root");
      }

      return element;
    },
    getSummaryPanel: () => {
      const element = nextContainer.querySelector("[data-testid='budget-summary-panel']");

      if (!(element instanceof HTMLElement)) {
        throw new Error("Missing budget summary panel");
      }

      return element;
    },
    getTableSurface: () => {
      const element = nextContainer.querySelector("[data-testid='budget-table-surface']");

      if (!(element instanceof HTMLDivElement)) {
        throw new Error("Missing budget table surface");
      }

      return element;
    },
    getOrderedItemDescriptions: () =>
      [...nextContainer.querySelectorAll("input")]
        .map((candidate) => candidate.value)
        .filter((value) => value === "Partida demo" || value === "Partida secundaria"),
    getOutsideFocusTarget: () => {
      let element = document.querySelector("[data-testid='outside-focus-target']");
      if (!(element instanceof HTMLButtonElement)) {
        element = document.createElement("button");
        element.type = "button";
        element.textContent = "Fuera del editor";
        element.setAttribute("data-testid", "outside-focus-target");
        document.body.appendChild(element);
      }

      return element;
    },
  };
}

function createBudget(): BudgetRecord {
  return {
    id: "budget-1",
    projectId: "project-1",
    parentBudgetId: null,
    kind: "SUB_BUDGET",
    name: "Presupuesto de prueba",
    currency: "PEN",
    igvRate: 0.18,
    generalExpensesRate: 0.1,
    utilityRate: 0.08,
    totalDirectCost: 0,
    totalGeneralExpenses: 0,
    totalUtility: 0,
    totalTax: 0,
    totalAmount: 0,
    levels: [],
    items: [],
  };
}

function createBudgetWithItem(): BudgetRecord {
  return {
    ...createBudget(),
    totalDirectCost: 100,
    totalGeneralExpenses: 10,
    totalUtility: 8,
    totalTax: 21.24,
    totalAmount: 139.24,
    items: [
      {
        id: "item-1",
        budgetId: "budget-1",
        levelId: null,
        code: "IT-1",
        description: "Partida demo",
        unit: "m2",
        quantity: 5,
        unitPrice: 20,
        partial: 100,
        sortOrder: 1,
        apu: {
          id: "apu-1",
          budgetItemId: "item-1",
          name: "Partida demo",
          unit: "m2",
          performance: 1,
          totalUnitCost: 20,
          resources: [],
        },
      },
    ],
  };
}

function createBudgetWithItemWithoutApu(): BudgetRecord {
  return {
    ...createBudget(),
    totalDirectCost: 60,
    totalGeneralExpenses: 6,
    totalUtility: 4.8,
    totalTax: 12.74,
    totalAmount: 83.54,
    items: [
      {
        id: "item-2",
        budgetId: "budget-1",
        levelId: null,
        code: "IT-2",
        description: "Partida sin APU",
        unit: "m2",
        quantity: 3,
        unitPrice: 20,
        partial: 60,
        sortOrder: 1,
        apu: null,
      },
    ],
  };
}

function createBudgetWithTwoItems(): BudgetRecord {
  return {
    ...createBudgetWithItem(),
    items: [
      createBudgetWithItem().items[0]!,
      {
        id: "item-3",
        budgetId: "budget-1",
        levelId: null,
        code: "IT-3",
        description: "Partida secundaria",
        unit: "m2",
        quantity: 2,
        unitPrice: 30,
        partial: 60,
        sortOrder: 2,
        apu: {
          id: "apu-3",
          budgetItemId: "item-3",
          name: "Partida secundaria",
          unit: "m2",
          performance: 1,
          totalUnitCost: 30,
          resources: [],
        },
      },
    ],
  };
}

function countViewModeAnchors(host: HTMLDivElement) {
  return [host, ...host.querySelectorAll<HTMLElement>("[data-view-mode]")].filter((element) => element.hasAttribute("data-view-mode")).length;
}

function createResource(): ResourceRecord {
  return {
    id: "resource-1",
    code: "MAT-01",
    description: "Arena fina",
    category: "MATERIAL" as const,
    unit: "m3",
    unitPrice: 15.5,
    currency: "PEN",
  };
}

function setInputValue(input: HTMLInputElement, value: string) {
  const descriptor = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value");
  descriptor?.set?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

function dispatchKey(target: Element | null, key: string, options?: Pick<KeyboardEventInit, "shiftKey">) {
  target?.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key, ...options }));
}
