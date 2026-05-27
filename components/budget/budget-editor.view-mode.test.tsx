/* @vitest-environment jsdom */

import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { BudgetEditor } from "@/components/budget/budget-editor";
import { BudgetViewModeProvider } from "@/components/budget/view-mode-provider";
import type { BudgetRecord } from "@/types/budget";
import type { CatalogPartidaRecord } from "@/types/partida";
import type { ResourceRecord } from "@/types/resource";

const notesMocks = vi.hoisted(() => ({
  openNoteDraft: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: vi.fn(),
  }),
}));

vi.mock("@/components/notes/notes-drawer", () => ({
  openNoteDraft: notesMocks.openNoteDraft,
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
    expect(getByText("Vista")).toBeTruthy();
    expect(getByText("Densidad")).toBeTruthy();
    expect(getEditorRoot().className).toContain("budget-modern-flow");
    expect(countViewModeAnchors(host)).toBe(1);

    await act(async () => {
      getButtonByText("Tipo Excel").click();
    });

    expect(host.dataset.viewMode).toBe("excel");
    expect(getByText("Vista")).toBeTruthy();
    expect(getByText("Densidad")).toBeTruthy();
    expect(getEditorRoot().className).toContain("budget-excel-flow");
    expect(countViewModeAnchors(host)).toBe(1);
  });

  it("tightens the table in excel mode while keeping the Ctrl+Enter path available for APU editing", async () => {
    const { getButtonByText, getHeaderByText, getInputByValue, getTableSurface } = await renderEditor({
      budget: createBudgetWithItem(),
    });

    await act(async () => {
      getButtonByText("Tipo Excel").click();
    });

    expect(getTableSurface().className).toContain("rounded-none");
    expect(getTableSurface().className).toContain("border-transparent");
    expect(getTableSurface().className).toContain("shadow-none");
    expect(getHeaderByText("Código").className).toContain("budget-sticky-header");

    await act(async () => {
      getInputByValue("Partida demo").focus();
    });

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, ctrlKey: true, key: "Enter" }));
    });
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

  it("opens a linked note draft from the item action menu", async () => {
    const { getButtonByLabel, getButtonByText } = await renderEditor({
      budget: createBudgetWithItem(),
    });

    await act(async () => {
      getButtonByLabel("Abrir acciones de la partida").click();
    });

    await act(async () => {
      getButtonByText("Nota").click();
    });

    expect(notesMocks.openNoteDraft).toHaveBeenCalledWith({
      projectId: "project-1",
      budgetId: "budget-1",
      budgetItemId: "item-1",
      budgetItemCode: "IT-1",
      budgetItemDescription: "Partida demo",
      sourcePath: "/budgets/budget-1",
    });
  });

  it("passes effective compact density to the APU sheet when excel mode forces compact", async () => {
    const { getApuSheetPanel, getButtonByText, getInputByValue } = await renderEditor({
      budget: createBudgetWithItem(),
    });

    await act(async () => {
      getButtonByText("Cómodo").click();
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
    expect(getApuSheetPanel().dataset.excelFieldBorderScope).toBe("apu-editor");
    expect(getApuSheetPanel().style.getPropertyValue("--excel-field-border-color")).toBe("#cbd5e1");
    expect(getApuSheetPanel().style.getPropertyValue("--excel-row-height")).toBe("52px");
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

    expect(document.activeElement?.textContent).toContain("Explicar partida");

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

  it("shows and hides the add-resource search suggestions with keyboard interaction", async () => {
    const { getApuAddResourceSearch, getInputByValue, queryByTextExact } = await renderEditor({
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
      getApuAddResourceSearch().focus();
    });

    expect(queryByTextExact("MAT-01 - Arena fina")).toBeTruthy();

    await act(async () => {
      dispatchKey(document.activeElement, "Escape");
    });

    expect(queryByTextExact("MAT-01 - Arena fina")).toBeNull();
  });

  it("shows the add-resource search immediately in excel mode", async () => {
    const { getApuAddResourceSearch, getButtonByText, getInputByValue, getByText } = await renderEditor({
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
      getApuAddResourceSearch().focus();
    });

    expect(getByText("MAT-01 - Arena fina")).toBeTruthy();
  });

  it("resets the add-resource search after insertion so the same resource can be selected again", async () => {
    const { getApuAddResourceSearch, getInputByValue, getByText, getResourceRowCount } = await renderEditor({
      budget: createBudgetWithItem(),
      resourcesCatalog: [createResource()],
    });

    await act(async () => {
      getInputByValue("Partida demo").focus();
    });

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, ctrlKey: true, key: "Enter" }));
    });

    const search = getApuAddResourceSearch();
    expect(getResourceRowCount()).toBe(0);

    await act(async () => {
      search.focus();
    });

    await act(async () => {
      getByText("MAT-01 - Arena fina").dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    });

    expect(getResourceRowCount()).toBe(1);
    expect(search.value).toBe("");

    await act(async () => {
      search.blur();
      search.focus();
    });

    await act(async () => {
      getByText("MAT-01 - Arena fina").dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    });

    expect(getResourceRowCount()).toBe(2);
  });

  it("lets a manual APU row assign its resource through the inline filtered search", async () => {
    const { getButtonByText, getInputByValue, getByText, getByTestIdPrefix } = await renderEditor({
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
      getButtonByText("Agregar fila manual").click();
    });

    await act(async () => {
      getByTestIdPrefix("apu-resource-picker-").dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    });

    const resourceSearchInput = getByTestIdPrefix("apu-resource-search-") as HTMLInputElement;

    await act(async () => {
      setInputValue(resourceSearchInput, "Arena");
    });

    await act(async () => {
      getByText("MAT-01 - Arena fina").click();
    });

    expect(getByText("MAT-01 - Arena fina")).toBeTruthy();
  });

  it("shows matching suggestions when reopening a resource field that already has a value", async () => {
    const { getButtonByText, getByText, getByTestIdPrefix, getInputByValue } = await renderEditor({
      budget: createBudgetWithItemAndResource(),
      resourcesCatalog: [createResource()],
    });

    await act(async () => {
      getInputByValue("Partida demo").focus();
    });

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, ctrlKey: true, key: "Enter" }));
    });

    await act(async () => {
      getByTestIdPrefix("apu-resource-picker-").dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    });

    expect(getByText("MAT-01 - Arena fina")).toBeTruthy();

    await act(async () => {
      getButtonByText("Cerrar").click();
    });
  });

  it("blocks saving when an APU contains a manual row without an assigned resource", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ optimisticBudgets: [] }),
    } as Response);

    const { getButtonByText, getInputByValue, getResourceRowCount, getByText } = await renderEditor({
      budget: createBudgetWithItem(),
    });

    await act(async () => {
      getInputByValue("Partida demo").focus();
    });

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, ctrlKey: true, key: "Enter" }));
    });

    await act(async () => {
      getButtonByText("Agregar fila manual").click();
    });

    expect(getResourceRowCount()).toBe(1);

    await act(async () => {
      getButtonByText("Cerrar").click();
    });

    await act(async () => {
      getButtonByText("Guardar").click();
    });

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(getByText("Asigna un insumo o elimina la fila manual vacia antes de guardar el APU.")).toBeTruthy();
  });

  it("surfaces the fetch failure message instead of leaving the header stuck in Guardando", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Network down"));

    const { getButtonByText, getInputByValue, getByText } = await renderEditor({
      budget: createBudgetWithItem(),
    });

    const descriptionInput = getInputByValue("Partida demo");

    await act(async () => {
      descriptionInput.focus();
      setInputValue(descriptionInput, "Partida demo actualizada");
      descriptionInput.blur();
    });

    await act(async () => {
      getButtonByText("Guardar").click();
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(getButtonByText("Guardar")).toBeTruthy();
    expect(getByText("Network down")).toBeTruthy();
  });

  it("keeps the selected catalog partida when adding a new item from the inline selector", async () => {
    const { getButtonByText, getByText, getInputByValue, getOutsideFocusTarget, queryByText } = await renderEditor({
      partidasCatalog: [createCatalogPartida()],
    });

    await act(async () => {
      getButtonByText("Agregar partida").click();
    });

    const input = getInputByValue("Nueva partida");

    await act(async () => {
      input.focus();
      setInputValue(input, "Excav");
    });

    await act(async () => {
      input.focus();
    });

    await act(async () => {
      getByText("Excavacion manual").dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    });

    await act(async () => {
      getOutsideFocusTarget().focus();
    });

    expect(getInputByValue("Excavacion manual")).toBeTruthy();
    expect(queryByText("Nueva partida")).toBeNull();
  });

  it("closes the inline catalog selector before showing the paste preview", async () => {
    const { getByText, getInputByValue, queryByText } = await renderEditor({
      budget: createBudgetWithTwoSectionItems(),
      partidasCatalog: [createCatalogPartida()],
    });

    const descriptionInput = getInputByValue("Partida demo");

    await act(async () => {
      descriptionInput.focus();
      setInputValue(descriptionInput, "Excav");
    });

    await act(async () => {
      dispatchPaste(descriptionInput, "IT-57\tPartida desde pegado\tm2\t6");
    });

    expect(queryByText("Excavacion manual")).toBeNull();
    expect(getByText("Revisa antes de importar")).toBeTruthy();
  });

  it("shows inline catalog suggestions for a complete partida name with technical specs", async () => {
    const { getByText, getInputByValue } = await renderEditor({
      budget: createBudgetWithTwoSectionItems(),
      partidasCatalog: [createCatalogPartida()],
    });

    const descriptionInput = getInputByValue("Partida demo");

    await act(async () => {
      descriptionInput.focus();
      setInputValue(descriptionInput, "EXCAVACION MANUAL H=1.00 EN TERRENO NORMAL");
    });

    await act(async () => {
      descriptionInput.focus();
    });

    expect(getByText("Excavacion manual")).toBeTruthy();
  });

  it("keeps inline catalog suggestions open when the description is refocused before the deferred close runs", async () => {
    const { getByText, getInputByValue, getOutsideFocusTarget } = await renderEditor({
      budget: createBudgetWithTwoSectionItems(),
      partidasCatalog: [createCatalogPartida()],
    });

    await act(async () => {
      const descriptionInput = getInputByValue("Partida demo");
      descriptionInput.focus();
      setInputValue(descriptionInput, "Excav");
    });

    await act(async () => {
      getOutsideFocusTarget().focus();
    });

    await act(async () => {
      getInputByValue("Excav").focus();
    });

    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 150));
    });

    expect(getByText("Excavacion manual")).toBeTruthy();
  });

  it("shows an empty inline catalog message when no similar partida is found", async () => {
    const { getByText, getInputByValue } = await renderEditor({
      budget: createBudgetWithTwoSectionItems(),
      partidasCatalog: [createCatalogPartida()],
    });

    await act(async () => {
      const descriptionInput = getInputByValue("Partida demo");
      descriptionInput.focus();
      setInputValue(descriptionInput, "Texto sin coincidencia tecnica");
    });

    expect(getByText("No se encontro ninguna partida similar.")).toBeTruthy();
  });

  it("does not start row drag when selecting text inside a focused level title field", async () => {
    const { getInputByValue } = await renderEditor({
      budget: createBudgetWithTitleAndSubtitle(),
    });

    const titleInput = getInputByValue("Obras preliminares");

    await act(async () => {
      titleInput.focus();
    });

    const titleRow = titleInput.closest("tr");
    expect(titleRow?.getAttribute("draggable")).toBe("false");

    const dragStartEvent = new Event("dragstart", { bubbles: true, cancelable: true });
    await act(async () => {
      titleInput.dispatchEvent(dragStartEvent);
    });
    expect(dragStartEvent.defaultPrevented).toBe(true);
  });

  it("shows a recommended suggestion in the paste preview when the pasted description is close to the catalog", async () => {
    const { getByText, getInputByValue } = await renderEditor({
      budget: createBudgetWithTwoSectionItems(),
      partidasCatalog: [createCatalogPartida()],
    });

    await act(async () => {
      dispatchPaste(getInputByValue("Partida demo"), "IT-57\tExcavacion en zanja\tm3\t6");
    });

    expect(getByText("Sugerencia recomendada")).toBeTruthy();
    expect(getByText("Excavacion manual")).toBeTruthy();
  });

  it("lets the user apply a suggested catalog partida before confirming the paste", async () => {
    const { getButtonByText, getInputByValue, getOrderedInputValues } = await renderEditor({
      budget: createBudgetWithTwoSectionItems(),
      partidasCatalog: [createCatalogPartida()],
    });

    await act(async () => {
      dispatchPaste(getInputByValue("Partida demo"), "IT-58\tExcavacion en zanja\tm3\t6");
    });

    await act(async () => {
      getButtonByText("Aplicar sugerencia").click();
    });

    await act(async () => {
      getButtonByText("Confirmar importación").click();
    });

    expect(getOrderedInputValues(["Partida demo", "Excavacion manual", "Partida secundaria"])).toEqual([
      "Partida demo",
      "Excavacion manual",
      "Partida secundaria",
    ]);
  });

  it("uses the nearest visible title or subtitle context when adding an item from the header action", async () => {
    const { getButtonByText, getInputByValue } = await renderEditor({
      budget: createBudgetWithTitleAndSubtitle(),
    });

    await act(async () => {
      getButtonByText("Agregar partida").click();
    });

    const input = getInputByValue("Nueva partida");
    const paddingWrapper = input.closest("div[style]");

    expect(paddingWrapper?.getAttribute("style")).toContain("padding-left: 36px");
  });

  it("anchors a header subtitle under the nearest title context", async () => {
    const { getButtonByText, getInputByValue } = await renderEditor({
      budget: createBudgetWithTitleOnly(),
    });

    await act(async () => {
      getInputByValue("Obras preliminares").focus();
    });

    await act(async () => {
      getButtonByText("Agregar subtítulo").click();
    });

    const input = getInputByValue("Nuevo subtítulo");
    const paddingWrapper = input.parentElement;

    expect(paddingWrapper?.getAttribute("style")).toContain("padding-left: 18px");
  });

  it("inserts a header item immediately after the active item in the same section", async () => {
    const { getButtonByText, getInputByValue, getOrderedInputValues } = await renderEditor({
      budget: createBudgetWithTwoSectionItems(),
    });

    await act(async () => {
      getInputByValue("Partida demo").focus();
    });

    await act(async () => {
      getButtonByText("Agregar partida").click();
    });

    expect(getOrderedInputValues(["Partida demo", "Nueva partida", "Partida secundaria"])).toEqual([
      "Partida demo",
      "Nueva partida",
      "Partida secundaria",
    ]);
  });

  it("inserts a header title after the active title section instead of sending it to the end", async () => {
    const { getButtonByText, getInputByValue, getOrderedInputValues } = await renderEditor({
      budget: createBudgetWithTwoTitles(),
    });

    await act(async () => {
      getInputByValue("Movimiento de tierras").focus();
    });

    await act(async () => {
      getButtonByText("Agregar título").click();
    });

    expect(getOrderedInputValues(["Obras preliminares", "Nuevo título", "Instalaciones"])).toEqual([
      "Obras preliminares",
      "Nuevo título",
      "Instalaciones",
    ]);
  });

  it("inserts catalog items from the header target right after the active item", async () => {
    const { getButtonByText, getInputByValue, getOrderedInputValues } = await renderEditor({
      budget: createBudgetWithTwoSectionItems(),
      partidasCatalog: [createCatalogPartida()],
    });

    await act(async () => {
      getInputByValue("Partida demo").focus();
    });

    await act(async () => {
      getButtonByText("Desde catálogo").click();
    });

    await act(async () => {
      getButtonByText("Insertar").click();
    });

    expect(getOrderedInputValues(["Partida demo", "Excavacion manual", "Partida secundaria"])).toEqual([
      "Partida demo",
      "Excavacion manual",
      "Partida secundaria",
    ]);
  });

  it("inserts excel import rows from the header target right after the active item", async () => {
    const { getButtonByText, getInputByValue, getOrderedInputValues, getTextarea } = await renderEditor({
      budget: createBudgetWithTwoSectionItems(),
    });

    await act(async () => {
      getInputByValue("Partida demo").focus();
    });

    await act(async () => {
      getButtonByText("Importar Excel").click();
    });

    await act(async () => {
      setTextareaValue(getTextarea(), "IT-77\tPartida importada\tm2\t12");
    });

    await act(async () => {
      getButtonByText("Revisar importación").click();
    });

    await act(async () => {
      getButtonByText("Confirmar importación").click();
    });

    expect(getOrderedInputValues(["Partida demo", "Partida importada", "Partida secundaria"])).toEqual([
      "Partida demo",
      "Partida importada",
      "Partida secundaria",
    ]);
  });

  it("defaults guided paste over an item to insert below instead of replacing the active row", async () => {
    const { getButtonByText, getInputByValue, getOrderedInputValues, getSelectByLabel } = await renderEditor({
      budget: createBudgetWithTwoSectionItems(),
    });

    await act(async () => {
      dispatchPaste(getInputByValue("Partida demo"), "IT-55\tPartida guiada\tm2\t8");
    });

    expect(getSelectByLabel("Acción al aplicar").value).toBe("insert-below");

    await act(async () => {
      getButtonByText("Confirmar importación").click();
    });

    expect(getOrderedInputValues(["Partida demo", "Partida guiada", "Partida secundaria"])).toEqual([
      "Partida demo",
      "Partida guiada",
      "Partida secundaria",
    ]);
  });

  it("allows switching guided paste to replace the current row", async () => {
    const { getButtonByText, getInputByValue, getOrderedInputValues, getSelectByLabel } = await renderEditor({
      budget: createBudgetWithTwoSectionItems(),
    });

    await act(async () => {
      dispatchPaste(getInputByValue("Partida demo"), "IT-56\tPartida reemplazo\tm2\t9");
    });

    await act(async () => {
      setSelectValue(getSelectByLabel("Acción al aplicar"), "replace-current");
    });

    await act(async () => {
      getButtonByText("Confirmar importación").click();
    });

    expect(getOrderedInputValues(["Partida reemplazo", "Partida secundaria"])).toEqual([
      "Partida reemplazo",
      "Partida secundaria",
    ]);
  });

  it("shows the detected guided paste mode and lets the user change it", async () => {
    const { getByText, getInputByValue, getSelectByLabel } = await renderEditor({
      budget: createBudgetWithTwoSectionItems(),
    });

    await act(async () => {
      dispatchPaste(getInputByValue("Partida demo"), "01\tOBRAS PRELIMINARES\n01.01\tTrazo y replanteo\tm2\t10");
    });

    expect(getByText("Jerárquico por código")).toBeTruthy();
    expect(getSelectByLabel("Modo de importación").value).toBe("structured-by-code");

    await act(async () => {
      setSelectValue(getSelectByLabel("Modo de importación"), "flat");
    });

    expect(getSelectByLabel("Modo de importación").value).toBe("flat");
  });

  it("disables confirmation when guided paste finds blocking errors and still shows warnings", async () => {
    const { getByText, getButtonByText, getInputByValue } = await renderEditor({
      budget: createBudgetWithTwoSectionItems(),
    });

    await act(async () => {
      dispatchPaste(getInputByValue("Partida demo"), "IT-99\tPartida sin unidad\t\t4\nIT-100\tPartida invalida\tm2\tabc");
    });

    expect(getByText("Aviso: La fila parece una partida pero no tiene unidad.")).toBeTruthy();
    expect(getByText("Error: La fila tiene un metrado invalido y no puede importarse.")).toBeTruthy();
    expect(getButtonByText("Confirmar importación").hasAttribute("disabled")).toBe(true);
  });

  it("shows budget quality warnings in rows and in the summary panel when a partida has no useful PU", async () => {
    const { getByText, getSummaryPanel } = await renderEditor({
      budget: createBudgetWithItemWithoutUsefulPu(),
    });

    expect(getByText("Sin PU")).toBeTruthy();
    expect(getByText("Sin APU")).toBeTruthy();
    expect(getByText("Partidas sin PU útil")).toBeTruthy();
    expect(getSummaryPanel().textContent).toContain("1");

    const row = getByText("Sin PU").closest("tr");
    expect(row?.className).toContain("rose");
    expect(row?.className).not.toContain("amber-50/70");
  });

  it("opens a linked note draft when the Sin PU badge is clicked", async () => {
    const { getButtonByText } = await renderEditor({
      budget: createBudgetWithItemWithoutUsefulPu(),
    });

    await act(async () => {
      getButtonByText("Sin PU").click();
    });

    expect(notesMocks.openNoteDraft).toHaveBeenCalledWith({
      projectId: "project-1",
      budgetId: "budget-1",
      budgetItemId: "item-warning-1",
      budgetItemCode: "IT-W1",
      budgetItemDescription: "Partida sin PU útil",
      sourcePath: "/budgets/budget-1",
      initialBody: "Revisar precio unitario de la partida IT-W1 - Partida sin PU útil.",
    });
  });

  it("shows a floating item note preview when hovering the Sin PU badge", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        notes: [
          {
            id: "note-1",
            body: "Validar precio unitario antes de cerrar el presupuesto.",
            priority: "HIGH",
            status: "OPEN",
            sourcePath: "/budgets/budget-1",
            createdAt: "2026-05-27T10:00:00.000Z",
            updatedAt: "2026-05-27T10:00:00.000Z",
          },
        ],
      }),
    } as Response);
    const { getButtonByText, getByText } = await renderEditor({
      budget: createBudgetWithItemWithoutUsefulPu(),
    });

    await act(async () => {
      getButtonByText("Sin PU").dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
    });

    expect(fetchSpy).toHaveBeenCalledWith("/api/notes?status=OPEN&budgetItemId=item-warning-1");
    expect(getByText("Validar precio unitario antes de cerrar el presupuesto.")).toBeTruthy();
  });

  it("explains when title and subtitle were inferred by pattern for text-only guided paste", async () => {
    const { getByText, getInputByValue } = await renderEditor({
      budget: createBudgetWithTwoSectionItems(),
    });

    await act(async () => {
      dispatchPaste(
        getInputByValue("Partida demo"),
        ["OBRAS PRELIMINARES", "MOVIMIENTO DE TIERRAS", "Excavacion manual\tm3\t5"].join("\n"),
      );
    });

    expect(getByText("Inferido por patrón: primer texto del bloque.")).toBeTruthy();
    expect(getByText("Inferido por patrón: texto inmediato después del título.")).toBeTruthy();
  });

  it("accepts decimal metrado typed with comma before saving", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ optimisticBudgets: [] }),
    } as Response);

    const { getButtonByText, getInputByValue } = await renderEditor({
      budget: createBudgetWithItem(),
    });

    const quantityInput = getInputByValue("5");

    await act(async () => {
      quantityInput.focus();
      setInputValue(quantityInput, "1,25");
      quantityInput.blur();
    });

    await act(async () => {
      getButtonByText("Guardar").click();
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [, requestInit] = fetchSpy.mock.calls[0] ?? [];
    const body = typeof requestInit?.body === "string" ? JSON.parse(requestInit.body) : null;
    const updatedItem = body?.items?.update?.find((item: { id: string }) => item.id === "item-1");

    expect(updatedItem?.changes?.quantity).toBe(1.25);
  });

  it("opens a system confirmation popup and keeps the sub budget intact when cancelled", async () => {
    const { getButtonByLabel, getButtonByText, getByTestId, getOrderedInputValues } = await renderEditor({
      budget: createBudgetWithTwoSectionItems(),
    });

    await act(async () => {
      getButtonByLabel("Abrir acciones globales del sub presupuesto").click();
    });

    await act(async () => {
      getButtonByText("Limpiar sub presupuesto").click();
    });

    expect(getByTestId("clear-sub-budget-dialog").textContent).toContain("Limpiar sub presupuesto");

    await act(async () => {
      getButtonByText("Cancelar").click();
    });

    expect(getOrderedInputValues(["Obras preliminares", "Movimiento de tierras", "Partida demo", "Partida secundaria"])).toEqual([
      "Obras preliminares",
      "Movimiento de tierras",
      "Partida demo",
      "Partida secundaria",
    ]);
  });

  it("clears all inserted rows after confirming in the system popup and sends delete operations on save", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ optimisticBudgets: [] }),
    } as Response);

    const { getButtonByLabel, getButtonByText, getByTestId, getOrderedInputValues, queryByText } = await renderEditor({
      budget: createBudgetWithTwoSectionItems(),
    });

    await act(async () => {
      getButtonByLabel("Abrir acciones globales del sub presupuesto").click();
    });

    await act(async () => {
      getButtonByText("Limpiar sub presupuesto").click();
    });

    expect(getByTestId("clear-sub-budget-dialog").textContent).toContain("Partidas a eliminar");

    await act(async () => {
      getButtonByText("Sí, eliminar todo").click();
    });

    expect(queryByText("Limpiar sub presupuesto")).toBeNull();
    expect(getOrderedInputValues(["Obras preliminares", "Movimiento de tierras", "Partida demo", "Partida secundaria"])).toEqual([]);

    await act(async () => {
      getButtonByText("Guardar").click();
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [, requestInit] = fetchSpy.mock.calls[0] ?? [];
    const body = typeof requestInit?.body === "string" ? JSON.parse(requestInit.body) : null;

    expect(body?.levels?.delete).toEqual(["level-title-1", "level-subtitle-1"]);
    expect(body?.items?.delete).toEqual(["item-1", "item-2"]);
  });

  it("repositions the item actions menu upward when the trigger is near the bottom edge", async () => {
    const originalInnerHeight = window.innerHeight;
    const originalInnerWidth = window.innerWidth;

    try {
      Object.defineProperty(window, "innerHeight", { configurable: true, value: 800 });
      Object.defineProperty(window, "innerWidth", { configurable: true, value: 1280 });

      const { getButtonByLabel, getByText } = await renderEditor({
        budget: createBudgetWithItem(),
      });

      const actionButton = getButtonByLabel("Abrir acciones de la partida");
      vi.spyOn(actionButton, "getBoundingClientRect").mockReturnValue({
        x: 1160,
        y: 760,
        top: 760,
        right: 1192,
        bottom: 792,
        left: 1160,
        width: 32,
        height: 32,
        toJSON: () => ({}),
      });

      await act(async () => {
        actionButton.click();
      });

      expect(getByText("Duplicar partida")).toBeTruthy();

      const menu = document.body.querySelector("[data-item-action-menu]");
      expect(menu).toBeTruthy();
      expect(Number.parseFloat((menu as HTMLElement).style.top)).toBeLessThan(760);
    } finally {
      Object.defineProperty(window, "innerHeight", { configurable: true, value: originalInnerHeight });
      Object.defineProperty(window, "innerWidth", { configurable: true, value: originalInnerWidth });
    }
  });

  it("uses tighter excel mode density in budget cells and summary panel", async () => {
    const { getButtonByText, getEditorRoot, getHeaderByText, getSummaryPanel, getTableSurface } = await renderEditor({
      budget: createBudgetWithItem(),
    });

    await act(async () => {
      getButtonByText("Cómodo").click();
    });

    await act(async () => {
      getButtonByText("Tipo Excel").click();
    });

    expect(getEditorRoot().dataset.densityMode).toBe("compact");
    expect(getTableSurface().dataset.densityMode).toBe("compact");
    expect(getSummaryPanel().dataset.densityMode).toBe("compact");
    expect(getHeaderByText("Código").className).toContain("budget-sticky-header");
    expect(getButtonByText("Compacto").getAttribute("aria-pressed")).toBe("true");
    expect(getButtonByText("Cómodo").getAttribute("aria-pressed")).toBe("false");
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

  it("moves items with Alt+Arrow within the same visible section even when global item sort is interleaved", async () => {
    const { getInputByValue, getOrderedInputValues } = await renderEditor({
      budget: createBudgetWithInterleavedSectionItems(),
    });

    await act(async () => {
      getInputByValue("Partida demo").focus();
    });

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, altKey: true, key: "ArrowDown" }));
    });

    expect(getOrderedInputValues(["Partida demo", "Partida secundaria", "Partida otra seccion"])).toEqual([
      "Partida secundaria",
      "Partida demo",
      "Partida otra seccion",
    ]);
  });

  it("offers AI actions from the item action menu", async () => {
    const { getButtonByLabel, getByText } = await renderEditor({
      budget: createBudgetWithItem(),
    });

    await act(async () => {
      getButtonByLabel("Abrir acciones de la partida").click();
    });

    expect(getByText("Explicar partida con IA")).toBeTruthy();
    expect(getByText("Autocompletar descripcion")).toBeTruthy();
    expect(getByText("Sugerir APU")).toBeTruthy();
  });

  it("offers a visible budget review action and sends the enriched budget context to IA", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        answer: "Se encontraron partidas por revisar.",
        model: "llama3.1",
        requestedModel: "llama3.1",
        fallbackUsed: false,
        warnings: [],
        structuredData: {
          answer: "Se encontraron partidas por revisar.",
          findings: [
            {
              severity: "high",
              type: "duplicate",
              description: "Partidas de concreto similares con unidades distintas.",
              impact: "Puede duplicar metrados o distorsionar el costo directo.",
              recommendedAction: "Comparar alcance, unidad y metrado antes de aprobar.",
            },
          ],
          assumptions: ["Revision basada en el presupuesto visible."],
        },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const { getButtonByText, getByTestId, getByText } = await renderEditor({
      budget: createBudgetWithDuplicateReviewSignals(),
    });

    await act(async () => {
      getButtonByText("Revisar Presupuesto").click();
    });

    const requestBody = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)) as {
      budgetSummary: string;
      context: { project?: string; module?: string; activeTable?: string };
    };

    expect(fetchMock).toHaveBeenCalledWith("/api/ai/review", expect.objectContaining({ method: "POST" }));
    expect(requestBody.budgetSummary).toContain("Presupuesto: Presupuesto Demo");
    expect(requestBody.budgetSummary).toContain("Duplicados potenciales");
    expect(requestBody.budgetSummary).toContain("Unidades poco especificas o sospechosas");
    expect(requestBody.context).toMatchObject({
      project: "Proyecto Demo",
      module: "Editor de presupuesto",
      activeTable: "Presupuesto",
    });
    expect(getByText("Revision IA del presupuesto")).toBeTruthy();
    expect(getByText("Partidas de concreto similares con unidades distintas.")).toBeTruthy();
    expect(getByTestId("ai-budget-review-scroll-area").className).toContain("overflow-y-auto");
  });

  it("previews AI autocomplete before applying a description to the budget item", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        answer: "Partida demo mejorada tecnicamente",
        model: "llama3.1",
        requestedModel: "mistral",
        fallbackUsed: true,
        warnings: ["mistral no instalado"],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const { getButtonByLabel, getButtonByText, getByText, getInputByValue } = await renderEditor({
      budget: createBudgetWithItem(),
    });

    await act(async () => {
      getButtonByLabel("Abrir acciones de la partida").click();
    });

    await act(async () => {
      getButtonByText("Autocompletar descripcion").click();
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/ai/autocomplete",
      expect.objectContaining({
        method: "POST",
      }),
    );
    expect(getByText("Sugerencia IA")).toBeTruthy();
    expect(getByText("Partida demo mejorada tecnicamente")).toBeTruthy();
    expect(getByText("Fallback activo")).toBeTruthy();

    await act(async () => {
      getButtonByText("Aplicar texto").click();
    });

    expect(getInputByValue("Partida demo mejorada tecnicamente")).toBeTruthy();
  });

});

async function renderEditor(options?: { budget?: BudgetRecord; partidasCatalog?: CatalogPartidaRecord[]; resourcesCatalog?: ResourceRecord[] }) {
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
          partidasCatalog={options?.partidasCatalog ?? []}
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
    getByTestId: (testId: string) => {
      const element = document.body.querySelector(`[data-testid='${testId}']`);

      if (!(element instanceof HTMLElement)) {
        throw new Error(`Missing test id: ${testId}`);
      }

      return element;
    },
    getByTestIdPrefix: (testIdPrefix: string) => {
      const element = document.body.querySelector(`[data-testid^='${testIdPrefix}']`);

      if (!(element instanceof HTMLElement)) {
        throw new Error(`Missing test id prefix: ${testIdPrefix}`);
      }

      return element;
    },
    queryByText: (text: string) => {
      const element = [...document.body.querySelectorAll("*")].find((candidate) => candidate.textContent?.trim() === text);
      return element instanceof HTMLElement ? element : null;
    },
    queryByTextExact: (text: string) => {
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
    getApuAddResourceSearch: () => {
      const element = document.body.querySelector("[data-testid='apu-add-resource-search']");

      if (!(element instanceof HTMLInputElement)) {
        throw new Error("Missing APU add-resource search");
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
    getTextarea: () => {
      const element = document.body.querySelector("textarea");

      if (!(element instanceof HTMLTextAreaElement)) {
        throw new Error("Missing textarea");
      }

      return element;
    },
    getSelectByLabel: (label: string) => {
      const candidate = [...document.body.querySelectorAll("label")].find((element) => element.textContent?.includes(label));
      const element = candidate?.querySelector("select");

      if (!(element instanceof HTMLSelectElement)) {
        throw new Error(`Missing select with label: ${label}`);
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
    getOrderedInputValues: (values: string[]) =>
      [...nextContainer.querySelectorAll("input")]
        .map((candidate) => candidate.value)
        .filter((value) => values.includes(value)),
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

function createBudgetWithDuplicateReviewSignals(): BudgetRecord {
  return {
    ...createBudget(),
    name: "Presupuesto Demo",
    totalDirectCost: 12900,
    totalGeneralExpenses: 1290,
    totalUtility: 1032,
    totalTax: 2739.96,
    totalAmount: 17961.96,
    items: [
      {
        id: "item-review-1",
        budgetId: "budget-1",
        levelId: null,
        code: "01.01",
        description: "Concreto f'c=210 kg/cm2",
        unit: "m3",
        quantity: 10,
        unitPrice: 420,
        partial: 4200,
        sortOrder: 1,
        apu: null,
      },
      {
        id: "item-review-2",
        budgetId: "budget-1",
        levelId: null,
        code: "01.02",
        description: "concreto fc 210 kg cm2",
        unit: "glb",
        quantity: 1,
        unitPrice: 8700,
        partial: 8700,
        sortOrder: 2,
        apu: null,
      },
    ],
  };
}

function createBudgetWithItemAndResource(): BudgetRecord {
  const resource = createResource();

  return {
    ...createBudget(),
    totalDirectCost: 77.5,
    totalGeneralExpenses: 7.75,
    totalUtility: 6.2,
    totalTax: 16.46,
    totalAmount: 107.91,
    items: [
      {
        id: "item-1",
        budgetId: "budget-1",
        levelId: null,
        code: "IT-1",
        description: "Partida demo",
        unit: "m2",
        quantity: 5,
        unitPrice: 15.5,
        partial: 77.5,
        sortOrder: 1,
        apu: {
          id: "apu-1",
          budgetItemId: "item-1",
          name: "Partida demo",
          unit: "m2",
          performance: 1,
          totalUnitCost: 15.5,
          resources: [
            {
              id: "apu-resource-1",
              apuId: "apu-1",
              resourceId: resource.id,
              resourceType: resource.category,
              crew: null,
              quantity: 1,
              unitPrice: resource.unitPrice,
              subtotal: resource.unitPrice,
              resource,
            },
          ],
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

function createBudgetWithItemWithoutUsefulPu(): BudgetRecord {
  return {
    ...createBudget(),
    items: [
      {
        id: "item-warning-1",
        budgetId: "budget-1",
        levelId: null,
        code: "IT-W1",
        description: "Partida sin PU útil",
        unit: "m2",
        quantity: 3,
        unitPrice: 0,
        partial: 0,
        sortOrder: 1,
        apu: null,
      },
    ],
  };
}

function createCatalogPartida(): CatalogPartidaRecord {
  return {
    id: "catalog-1",
    description: "Excavacion manual",
    unit: "m3",
    unitPrice: 125.5,
    currency: "PEN",
    performance: 4,
    performanceUnit: "m3",
    performanceRate: "4.000 m3/DIA",
    apuRows: [],
  };
}

function createBudgetWithTitleAndSubtitle(): BudgetRecord {
  return {
    ...createBudget(),
    levels: [
      {
        id: "level-title-1",
        budgetId: "budget-1",
        parentId: null,
        type: "TITLE",
        code: "01",
        name: "Obras preliminares",
        sortOrder: 1,
      },
      {
        id: "level-subtitle-1",
        budgetId: "budget-1",
        parentId: "level-title-1",
        type: "SUBTITLE",
        code: "01.01",
        name: "Movimiento de tierras",
        sortOrder: 2,
      },
    ],
    items: [],
  };
}

function createBudgetWithTitleOnly(): BudgetRecord {
  return {
    ...createBudget(),
    levels: [
      {
        id: "level-title-1",
        budgetId: "budget-1",
        parentId: null,
        type: "TITLE",
        code: "01",
        name: "Obras preliminares",
        sortOrder: 1,
      },
    ],
    items: [],
  };
}

function createBudgetWithTwoSectionItems(): BudgetRecord {
  return {
    ...createBudget(),
    levels: [
      {
        id: "level-title-1",
        budgetId: "budget-1",
        parentId: null,
        type: "TITLE",
        code: "01",
        name: "Obras preliminares",
        sortOrder: 1,
      },
      {
        id: "level-subtitle-1",
        budgetId: "budget-1",
        parentId: "level-title-1",
        type: "SUBTITLE",
        code: "01.01",
        name: "Movimiento de tierras",
        sortOrder: 2,
      },
    ],
    items: [
      {
        ...createBudgetWithItem().items[0]!,
        id: "item-1",
        levelId: "level-subtitle-1",
        description: "Partida demo",
        sortOrder: 1,
      },
      {
        ...createBudgetWithItem().items[0]!,
        id: "item-2",
        levelId: "level-subtitle-1",
        description: "Partida secundaria",
        sortOrder: 2,
      },
    ],
  };
}

function createBudgetWithTwoTitles(): BudgetRecord {
  return {
    ...createBudget(),
    levels: [
      {
        id: "level-title-1",
        budgetId: "budget-1",
        parentId: null,
        type: "TITLE",
        code: "01",
        name: "Obras preliminares",
        sortOrder: 1,
      },
      {
        id: "level-subtitle-1",
        budgetId: "budget-1",
        parentId: "level-title-1",
        type: "SUBTITLE",
        code: "01.01",
        name: "Movimiento de tierras",
        sortOrder: 2,
      },
      {
        id: "level-title-2",
        budgetId: "budget-1",
        parentId: null,
        type: "TITLE",
        code: "02",
        name: "Instalaciones",
        sortOrder: 3,
      },
    ],
    items: [],
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

function createBudgetWithInterleavedSectionItems(): BudgetRecord {
  return {
    ...createBudget(),
    levels: [
      {
        id: "level-title-1",
        budgetId: "budget-1",
        parentId: null,
        type: "TITLE",
        code: "01",
        name: "Obras preliminares",
        sortOrder: 1,
      },
      {
        id: "level-subtitle-1",
        budgetId: "budget-1",
        parentId: "level-title-1",
        type: "SUBTITLE",
        code: "01.01",
        name: "Movimiento de tierras",
        sortOrder: 2,
      },
      {
        id: "level-title-2",
        budgetId: "budget-1",
        parentId: null,
        type: "TITLE",
        code: "02",
        name: "Instalaciones",
        sortOrder: 3,
      },
      {
        id: "level-subtitle-2",
        budgetId: "budget-1",
        parentId: "level-title-2",
        type: "SUBTITLE",
        code: "02.01",
        name: "Electricas",
        sortOrder: 4,
      },
    ],
    items: [
      {
        ...createBudgetWithItem().items[0]!,
        id: "item-1",
        levelId: "level-subtitle-1",
        description: "Partida demo",
        sortOrder: 1,
      },
      {
        ...createBudgetWithItem().items[0]!,
        id: "item-2",
        levelId: "level-subtitle-2",
        description: "Partida otra seccion",
        sortOrder: 2,
      },
      {
        ...createBudgetWithItem().items[0]!,
        id: "item-3",
        levelId: "level-subtitle-1",
        description: "Partida secundaria",
        sortOrder: 3,
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

function setTextareaValue(textarea: HTMLTextAreaElement, value: string) {
  const descriptor = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value");
  descriptor?.set?.call(textarea, value);
  textarea.dispatchEvent(new Event("input", { bubbles: true }));
  textarea.dispatchEvent(new Event("change", { bubbles: true }));
}

function setSelectValue(select: HTMLSelectElement, value: string) {
  const descriptor = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, "value");
  descriptor?.set?.call(select, value);
  select.dispatchEvent(new Event("change", { bubbles: true }));
}

function dispatchPaste(input: HTMLInputElement, text: string) {
  const event = new Event("paste", { bubbles: true, cancelable: true }) as Event & {
    clipboardData: { getData: (type: string) => string };
  };
  event.clipboardData = {
    getData: (type: string) => (type === "text" ? text : ""),
  };

  input.dispatchEvent(event);
}

function dispatchKey(target: Element | null, key: string, options?: Pick<KeyboardEventInit, "shiftKey">) {
  target?.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key, ...options }));
}
