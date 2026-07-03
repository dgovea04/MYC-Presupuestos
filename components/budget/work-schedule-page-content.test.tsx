/* @vitest-environment jsdom */

import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WorkSchedulePageContent } from "@/components/budget/work-schedule-page-content";
import { FormattingSettingsProvider } from "@/components/providers/formatting-settings-provider";
import { AppViewModeProvider } from "@/components/view-mode/app-view-mode-provider";
import type { UserSettingsRecord } from "@/types/settings";
import type { WorkScheduleViewRecord } from "@/types/work-schedule";

let activeContainer: HTMLDivElement | null = null;
let lastCreatedBlob: Blob | null = null;
let lastDownloadName = "";
let clickCount = 0;
const fetchMock = vi.fn();

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe("WorkSchedulePageContent", () => {
  beforeEach(() => {
    lastCreatedBlob = null;
    lastDownloadName = "";
    clickCount = 0;

    vi.stubGlobal(
      "URL",
      Object.assign({}, globalThis.URL, {
        createObjectURL: vi.fn((blob: Blob) => {
          lastCreatedBlob = blob;
          return "blob:mock-work-schedule";
        }),
        revokeObjectURL: vi.fn(),
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();

    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation(((tagName: string, options?: ElementCreationOptions) => {
      const element = originalCreateElement(tagName, options);
      if (tagName.toLowerCase() === "a") {
        const anchor = element as HTMLAnchorElement;
        vi.spyOn(anchor, "click").mockImplementation(() => {
          lastDownloadName = anchor.download;
          clickCount += 1;
        });
      }

      return element;
    }) as typeof document.createElement);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    window.localStorage.clear();
    document.documentElement.style.removeProperty("--work-schedule-timeline-panel-width");

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
  });

  it("renders grouped sub budgets and opens the side editor for a partida", async () => {
    const { clickByText, getByText, getByTestId, getAllByTestId } = await renderContent();

    expect(getByText("Arquitectura")).toBeTruthy();
    expect(getByText("Estructuras")).toBeTruthy();
    expect(getByText("2 periodos")).toBeTruthy();
    const segments = getAllByTestId("work-schedule-bar-segment-item-1");
    expect(segments).toHaveLength(2);
    expect(segments[0]?.getAttribute("title")).toContain("03/2026");
    expect(segments[0]?.getAttribute("title")).toContain("60.0000%");
    expect(segments[0]?.getAttribute("title")).toContain("S/ 600.00");
    expect(getAllByTestId("work-schedule-month-band")).toHaveLength(2);
    expect(getByText("03/2026")).toBeTruthy();
    expect(getByText("04/2026")).toBeTruthy();
    expect(getByText("Leyenda de segmentos")).toBeTruthy();

    await act(async () => {
      clickByText("Editar");
    });

    expect(getByTestId("work-schedule-editor-panel")).toBeTruthy();
    expect(getByText("Distribucion mensual")).toBeTruthy();
  });

  it("keeps empty sub budget groups visible in the cronograma overview", async () => {
    const view = createView();
    const { getByText } = await renderWithView(
      {
        ...view,
        groups: [
          ...view.groups,
          {
            subBudgetId: "sub-empty",
            subBudgetName: "Instalaciones Electricas",
            totalAmount: 0,
            lines: [],
            rows: [],
          },
        ],
      },
      createSettings(),
    );

    expect(getByText("SP: Instalaciones Electricas")).toBeTruthy();
  });

  it("shows the CPM critical path only when the user enables it", async () => {
    const { clickByText, getByText, queryByText, getByTestId, getTimelineRowByLineId } = await renderContent();

    expect(queryByText("1 partidas criticas")).toBeNull();
    expect(queryByText("38 dias CPM")).toBeNull();
    expect(queryByText("Critica")).toBeNull();
    expect(getByTestId("work-schedule-table-row-item-1").getAttribute("data-critical")).toBe("false");
    expect(getTimelineRowByLineId("item-1").getAttribute("data-critical")).toBe("false");
    expect(getByText("Mostrar ruta critica")).toBeTruthy();

    await act(async () => {
      clickByText("Mostrar ruta critica");
    });

    expect(getByText("1 partidas criticas")).toBeTruthy();
    expect(getByText("38 dias CPM")).toBeTruthy();
    expect(getByText("Ocultar ruta critica")).toBeTruthy();
    expect(getByTestId("work-schedule-critical-badge-item-1")).toBeTruthy();
    expect(getByTestId("work-schedule-table-row-item-1").getAttribute("data-critical")).toBe("true");
    expect(getByTestId("work-schedule-table-row-item-2").getAttribute("data-critical")).toBe("false");
    expect(getTimelineRowByLineId("item-2").getAttribute("data-critical")).toBe("false");
    expect(getTimelineRowByLineId("item-1").getAttribute("data-critical")).toBe("true");
    expect(window.localStorage.getItem("work-schedule-critical-path-visibility:budget-1")).toBe("true");
  });

  it("switches to the resource calendar view", async () => {
    const { clickByText, getByText } = await renderContent();

    await act(async () => {
      clickByText("Calendario de insumos");
    });

    expect(getByText("Cemento")).toBeTruthy();
    expect(getByText("PEON")).toBeTruthy();
  });

  it("loads a segmented valuation slice for oversized schedules", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        periods: [{ year: 2030, month: 1, key: "2030-01" }],
        rows: [
          {
            budgetItemId: "item-1",
            itemCode: "01.01",
            description: "Trazo y replanteo",
            unit: "GLB",
            quantity: 1,
            unitPrice: 1000,
            partial: 1000,
            subBudgetName: "Estructuras",
            rowTotal: 1000,
            periodAmounts: { "2030-01": 1000 },
          },
        ],
        availableRange: {
          fromPeriodKey: "2030-01",
          toPeriodKey: "2035-12",
        },
        selectedRange: {
          fromPeriodKey: "2030-01",
          toPeriodKey: "2030-01",
        },
        isPartial: true,
      }),
    });

    const { clickByText, getByText, getInputByLabel } = await renderWithView(createOversizedSegmentedView(), createSettings());

    await act(async () => {
      clickByText("Calendario valorizado");
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/budgets/budget-1/work-schedule/valuation-calendar?from=2030-01&to=2030-12",
    );
    expect(getByText("Trazo y replanteo")).toBeTruthy();
    expect(getInputByLabel("Rango mensual").value).toBe("2030-01");
  });

  it("uses date pickers for start and end dates and recalculates duration automatically", async () => {
    const { clickByText, getInputByLabel } = await renderContent();

    await act(async () => {
      clickByText("Editar");
    });

    const startInput = getInputByLabel("Inicio");
    const endInput = getInputByLabel("Fin");
    const durationInput = getInputByLabel("Duracion");

    expect(startInput.getAttribute("type")).toBe("date");
    expect(endInput.getAttribute("type")).toBe("date");
    expect(durationInput.getAttribute("readonly")).not.toBeNull();

    await act(async () => {
      setInputValue(startInput, "2026-03-10");
    });

    await act(async () => {
      setInputValue(endInput, "2026-03-20");
    });

    expect(getInputByLabel("Duracion").value).toBe("11");
  });

  it("defaults the cronograma crew to 1 and recalculates duration when the user edits it", async () => {
    const { clickByText, getInputByLabel } = await renderContent();

    await act(async () => {
      clickByText("Editar");
    });

    const crewInput = getInputByLabel("Cuadrilla");
    const durationInput = getInputByLabel("Duracion");

    expect(crewInput.value).toBe("1");
    expect(durationInput.value).toBe("14");

    await act(async () => {
      setInputValue(crewInput, "5");
    });

    expect(getInputByLabel("Duracion").value).toBe("1");
  });

  it("shows dependent successor start dates updated live before saving", async () => {
    const { getInputByLabel, getByTestId, getInputByValue } = await renderWithView(
      createViewWithDependencyPreview(),
      createSettings(),
    );

    await act(async () => {
      const editButton = document.querySelector("[aria-label='Editar Trazo y replanteo']");
      if (!(editButton instanceof HTMLButtonElement)) {
        throw new Error("Missing edit button for Trazo y replanteo");
      }

      editButton.click();
    });

    await act(async () => {
      setInputValue(getInputByLabel("Cuadrilla"), "5");
    });

    await act(async () => {
      getByTestId("work-schedule-inline-cell-startDate-item-2").click();
    });

    expect(getInputByValue("2026-03-02")).toBeTruthy();
  });

  it("recalculates the edited partida start date live when its predecessor changes", async () => {
    const { getInputByLabel } = await renderWithView(createViewWithDependencyPreview(), createSettings());

    await act(async () => {
      const editButton = document.querySelector("[aria-label='Editar Tarrajeo']");
      if (!(editButton instanceof HTMLButtonElement)) {
        throw new Error("Missing edit button for Tarrajeo");
      }

      editButton.click();
    });

    expect(getInputByLabel("Inicio").value).toBe("2026-03-06");

    await act(async () => {
      setInputValue(getInputByLabel("Predecesora"), "01.01FS+2d");
    });

    expect(getInputByLabel("Inicio").value).toBe("2026-03-08");
    expect(getInputByLabel("Fin").value).toBe("2026-03-10");
  });

  it("allows inline row editing and autosaves the line when leaving the row", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => createInitialData(),
    });

    const { getByTestId, getInputByValue } = await renderContent();

    await act(async () => {
      getByTestId("work-schedule-inline-cell-startDate-item-1").click();
    });

    const startInput = getInputByValue("2026-03-01");

    await act(async () => {
      setInputValue(startInput, "2026-03-10");
      startInput.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Enter" }));
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/budgets/budget-1/work-schedule", expect.objectContaining({
      method: "PATCH",
    }));
  });

  it("allows editing crew inline and persists the recalculated duration", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => createInitialData(),
    });

    const { getByTestId, getInputByValue } = await renderContent();

    await act(async () => {
      getByTestId("work-schedule-inline-cell-crew-item-2").click();
    });

    const crewInput = getInputByValue("1");

    await act(async () => {
      setInputValue(crewInput, "5");
      crewInput.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Enter" }));
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/budgets/budget-1/work-schedule",
      expect.objectContaining({
        method: "PATCH",
        body: expect.stringContaining("\"crew\":5"),
      }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/budgets/budget-1/work-schedule",
      expect.objectContaining({
        body: expect.stringContaining("\"durationDays\":1"),
      }),
    );
  });

  it("opens the intelligent schedule dialog and sends the base generation request", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        ...createInitialData(),
        generationSummary: {
          generatedCount: 2,
          pendingCount: 1,
          issues: [{ budgetItemId: "item-9", itemCode: "03.01", reason: "Pendiente" }],
        },
      }),
    });

    const { clickByText, getByText, getInputByLabel } = await renderContent();

    await act(async () => {
      clickByText("Generar cronograma inteligente");
    });

    expect(getByText("Cronograma inteligente")).toBeTruthy();

    await act(async () => {
      setInputValue(getInputByLabel("Fecha base"), "2026-06-01");
      clickByText("Generar base");
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/budgets/budget-1/work-schedule", expect.objectContaining({
      method: "POST",
    }));
  });

  it("shows review warnings in the page and before generating the intelligent schedule", async () => {
    const view = createView();
    view.reviewSummary = {
      warningCount: 2,
      warnings: [
        {
          code: "performance_default_one",
          label: "Partidas con rendimiento 1 detectadas. Esto suele indicar un posible error de importacion de Delphin.",
          count: 2,
          examples: [
            { budgetItemId: "item-1", itemCode: "01.01", description: "Trazo y replanteo", unit: "m2", performance: 1 },
          ],
        },
      ],
    };

    const { clickByText, getByText } = await renderWithView(view, createSettings());

    expect(getByText("Revision previa del cronograma")).toBeTruthy();
    expect(getByText("2 advertencias detectadas")).toBeTruthy();

    await act(async () => {
      clickByText("Generar cronograma inteligente");
    });

    expect(getByText("Revision previa recomendada")).toBeTruthy();
    expect(getByText("2 partidas afectadas.")).toBeTruthy();
  });

  it("proposes an end date automatically when the start date changes and the current end date is earlier", async () => {
    const { clickByText, getInputByLabel } = await renderContent();

    await act(async () => {
      clickByText("Editar");
    });

    const startInput = getInputByLabel("Inicio");
    const endInput = getInputByLabel("Fin");

    await act(async () => {
      setInputValue(startInput, "2026-04-02");
    });

    expect(getInputByLabel("Fin").value).toBe("2026-04-02");

    await act(async () => {
      setInputValue(endInput, "2026-04-05");
    });

    await act(async () => {
      setInputValue(startInput, "2026-04-10");
    });

    expect(getInputByLabel("Fin").value).toBe("2026-04-10");
    expect(getInputByLabel("Duracion").value).toBe("1");
  });

  it("proposes the first monthly distribution period from the selected start date", async () => {
    const { clickByText, getInputByLabel, getDistributionInput } = await renderContentWithoutSchedule();

    await act(async () => {
      clickByText("Editar");
    });

    await act(async () => {
      setInputValue(getInputByLabel("Inicio"), "2026-06-15");
    });

    expect(getDistributionInput(0, "Ano").value).toBe("2026");
    expect(getDistributionInput(0, "Mes").value).toBe("6");
    expect(getDistributionInput(0, "%").value).toBe("100");
  });

  it("proposes a multi-month distribution automatically when the selected range spans multiple months", async () => {
    const { clickByText, getInputByLabel, getDistributionInput } = await renderContentWithoutSchedule();

    await act(async () => {
      clickByText("Editar");
    });

    await act(async () => {
      setInputValue(getInputByLabel("Inicio"), "2026-06-15");
    });

    await act(async () => {
      setInputValue(getInputByLabel("Fin"), "2026-08-10");
    });

    expect(getDistributionInput(0, "Ano").value).toBe("2026");
    expect(getDistributionInput(0, "Mes").value).toBe("6");
    expect(getDistributionInput(0, "%").value).toBe("33.3333");

    expect(getDistributionInput(1, "Ano").value).toBe("2026");
    expect(getDistributionInput(1, "Mes").value).toBe("7");
    expect(getDistributionInput(1, "%").value).toBe("33.3333");

    expect(getDistributionInput(2, "Ano").value).toBe("2026");
    expect(getDistributionInput(2, "Mes").value).toBe("8");
    expect(getDistributionInput(2, "%").value).toBe("33.3334");
  });

  it("collapses and expands sub budget groups in both the table and the timeline", async () => {
    const { clickByText, getByText, queryByText, getAllByTestId } = await renderContent();

    expect(getByText("Tarrajeo")).toBeTruthy();
    expect(getAllByTestId("work-schedule-timeline-row")).toHaveLength(2);

    await act(async () => {
      clickByText("Contraer Arquitectura");
    });

    expect(queryByText("Tarrajeo")).toBeNull();
    expect(getAllByTestId("work-schedule-timeline-row")).toHaveLength(1);

    await act(async () => {
      clickByText("Expandir Arquitectura");
    });

    expect(getByText("Tarrajeo")).toBeTruthy();
    expect(getAllByTestId("work-schedule-timeline-row")).toHaveLength(2);
  });

  it("provides global controls to collapse and expand all sub budget groups", async () => {
    const { clickByText, queryByText, getAllByTestId, getByText } = await renderContent();

    await act(async () => {
      clickByText("Contraer todo");
    });

    expect(queryByText("Tarrajeo")).toBeNull();
    expect(queryByText("Trazo y replanteo")).toBeNull();
    expect(getAllByTestId("work-schedule-timeline-row")).toHaveLength(0);

    await act(async () => {
      clickByText("Expandir todo");
    });

    expect(getByText("Tarrajeo")).toBeTruthy();
    expect(getByText("Trazo y replanteo")).toBeTruthy();
    expect(getAllByTestId("work-schedule-timeline-row")).toHaveLength(2);
  });

  it("restores collapsed sub budget groups from local storage on load", async () => {
    window.localStorage.setItem(
      "work-schedule-collapsed-groups:budget-1",
      JSON.stringify({
        "sub-2": true,
      }),
    );

    const { queryByText, getByText, getAllByTestId } = await renderContent();

    expect(queryByText("Tarrajeo")).toBeNull();
    expect(getByText("Trazo y replanteo")).toBeTruthy();
    expect(getAllByTestId("work-schedule-timeline-row")).toHaveLength(1);
    expect(getByText("Expandir Arquitectura")).toBeTruthy();
  });

  it("restores the active module view from local storage on load", async () => {
    window.localStorage.setItem("work-schedule-active-view:budget-1", "resources");

    const { getByText, queryByText } = await renderContent();

    expect(getByText("Cemento")).toBeTruthy();
    expect(getByText("PEON")).toBeTruthy();
    expect(queryByText("Cronograma basico")).toBeNull();
  });

  it("restores the last edited partida from local storage on load", async () => {
    window.localStorage.setItem("work-schedule-editing-line:budget-1", "item-2");

    const { getByTestId, getByText } = await renderContent();

    expect(getByTestId("work-schedule-editor-panel")).toBeTruthy();
    expect(getByText("Programar partida")).toBeTruthy();
    expect(getByText("Tarrajeo")).toBeTruthy();
  });

  it("restores the horizontal scroll position of the cronograma from local storage on load", async () => {
    window.localStorage.setItem("work-schedule-overview-scroll:budget-1", "280");

    const { getByTestId } = await renderContent();

    expect(getByTestId("work-schedule-overview-scroll").scrollLeft).toBe(280);
  });

  it("restores and resizes the gantt overlay panel width", async () => {
    window.localStorage.setItem("work-schedule-overview-timeline-panel-width:budget-1", "760");

    const { getByTestId } = await renderContent();
    const panel = getByTestId("work-schedule-timeline-panel");
    const handle = getByTestId("work-schedule-timeline-resize-handle");

    expect(panel.style.width).toContain("--work-schedule-timeline-panel-width");
    expect(document.documentElement.style.getPropertyValue("--work-schedule-timeline-panel-width")).toBe("760px");

    await act(async () => {
      handle.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, clientX: 900 }));
      window.dispatchEvent(new MouseEvent("mousemove", { bubbles: true, clientX: 820 }));
      window.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    });

    expect(document.documentElement.style.getPropertyValue("--work-schedule-timeline-panel-width")).toBe("840px");
    expect(window.localStorage.getItem("work-schedule-overview-timeline-panel-width:budget-1")).toBe("840");
  });

  it("resets the gantt overlay panel width to 972px for a new project without stored width", async () => {
    document.documentElement.style.setProperty("--work-schedule-timeline-panel-width", "640px");

    await renderContent();

    expect(document.documentElement.style.getPropertyValue("--work-schedule-timeline-panel-width")).toBe("972px");
  });

  it("renders the gantt timeline using complete weeks at both ends", async () => {
    const { getAllByTestId } = await renderContentWithPartialWeekTimeline();

    expect(getAllByTestId("work-schedule-timeline-day-header")).toHaveLength(14);
    expect(getAllByTestId("work-schedule-month-band").length).toBeGreaterThan(0);
  });

  it("scales the gantt timeline with a zoom percentage between 10 and 500", async () => {
    const { getByTestId, getInputByLabel } = await renderContent();
    const scrollContainer = getByTestId("work-schedule-overview-scroll");
    const timelineContent = scrollContainer.firstElementChild;

    if (!(timelineContent instanceof HTMLElement)) {
      throw new Error("Missing timeline content");
    }

    expect(getInputByLabel("Zoom").value).toBe("100");
    const initialWidth = Number.parseFloat(timelineContent.style.width);

    await act(async () => {
      setInputValue(getInputByLabel("Zoom"), "200");
    });

    expect(getInputByLabel("Zoom").value).toBe("200");
    expect(Number.parseFloat(timelineContent.style.width)).toBeGreaterThan(initialWidth);
    expect(window.localStorage.getItem("work-schedule-overview-timeline-zoom:budget-1")).toBe("200");

    await act(async () => {
      setInputValue(getInputByLabel("Zoom"), "900");
    });

    expect(getInputByLabel("Zoom").value).toBe("500");

    await act(async () => {
      setInputValue(getInputByLabel("Zoom"), "1");
    });

    expect(getInputByLabel("Zoom").value).toBe("10");
  });

  it("syncs gantt row heights from the table rows", async () => {
    const { getByTestId, getTimelineRowByLineId } = await renderContent();

    const groupRow = getByTestId("work-schedule-table-group-row-sub-1");
    const lineRow = getByTestId("work-schedule-table-row-item-1");

    Object.defineProperty(groupRow, "offsetHeight", { configurable: true, value: 44 });
    Object.defineProperty(lineRow, "offsetHeight", { configurable: true, value: 86 });

    await act(async () => {
      window.dispatchEvent(new Event("resize"));
    });

    expect(getByTestId("work-schedule-timeline-group-row-sub-1").style.height).toBe("44px");
    expect(getTimelineRowByLineId("item-1").style.height).toBe("86px");
  });

  it("hides PU and Parcial by default in cronograma and allows showing them from the header", async () => {
    const { clickByText, queryByText, getByText } = await renderContent();

    expect(queryByText("PU")).toBeNull();
    expect(queryByText("Parcial")).toBeNull();
    expect(getByText("Mostrar PU y Parcial")).toBeTruthy();

    await act(async () => {
      clickByText("Mostrar PU y Parcial");
    });

    expect(getByText("PU")).toBeTruthy();
    expect(getByText("Parcial")).toBeTruthy();
    expect(getByText("Ocultar PU y Parcial")).toBeTruthy();
    expect(window.localStorage.getItem("work-schedule-overview-cost-columns:budget-1")).toBe("true");
  });

  it("removes the left panel rounding and uses a thinner resize handle in excel mode", async () => {
    const { getByTestId } = await renderWithView(createView(), createSettings({ defaultViewMode: "excel" }));

    expect(getByTestId("work-schedule-left-panel").className).toContain("rounded-none");
    expect(getByTestId("work-schedule-timeline-resize-handle").className).toContain("w-2");
  });

  it("jumps back to the cronograma range for the partida being edited", async () => {
    const { clickByText, getByTestId, getTimelineRowByLineId } = await renderContent();

    await act(async () => {
      clickByText("Editar");
    });

    const scrollContainer = getByTestId("work-schedule-overview-scroll");
    scrollContainer.scrollLeft = 0;

    await act(async () => {
      clickByText("Ir al cronograma");
    });

    expect(scrollContainer.scrollLeft).toBeGreaterThan(0);
    expect(getByTestId("work-schedule-table-row-item-2").getAttribute("data-highlighted")).toBe("true");
    expect(getTimelineRowByLineId("item-2").getAttribute("data-highlighted")).toBe("true");
    expect(getByTestId("work-schedule-active-badge-item-2")).toBeTruthy();
    expect(getByTestId("work-schedule-active-timeline-badge-item-2")).toBeTruthy();
  });

  it("navigates between partidas from the side editor", async () => {
    const { clickByText, getByText, queryByText, getByTestId, getTimelineRowByLineId } = await renderContent();

    await act(async () => {
      clickByText("Editar");
    });

    const scrollContainer = getByTestId("work-schedule-overview-scroll");
    scrollContainer.scrollLeft = 0;

    expect(getByText("Tarrajeo")).toBeTruthy();
    expect(queryByText("Trazo y replanteo")).toBeTruthy();

    await act(async () => {
      clickByText("Siguiente");
    });

    expect(getByText("Trazo y replanteo")).toBeTruthy();
    expect(scrollContainer.scrollLeft).toBeGreaterThan(0);
    expect(getByTestId("work-schedule-table-row-item-1").getAttribute("data-highlighted")).toBe("true");
    expect(getTimelineRowByLineId("item-1").getAttribute("data-highlighted")).toBe("true");

    await act(async () => {
      clickByText("Anterior");
    });

    expect(getByText("Tarrajeo")).toBeTruthy();
    expect(getByTestId("work-schedule-table-row-item-2").getAttribute("data-highlighted")).toBe("true");
    expect(getTimelineRowByLineId("item-2").getAttribute("data-highlighted")).toBe("true");
  });

  it("supports keyboard shortcuts to navigate between partidas from the side editor", async () => {
    const { clickByText, getInputByLabel } = await renderContent();

    await act(async () => {
      clickByText("Editar");
    });

    expect(getInputByLabel("Inicio").value).toBe("2026-03-08");

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", altKey: true, bubbles: true }));
    });

    expect(getInputByLabel("Inicio").value).toBe("2026-03-01");

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", altKey: true, bubbles: true }));
    });

    expect(getInputByLabel("Inicio").value).toBe("2026-03-08");
  });

  it("shows keyboard shortcut help inside the side editor", async () => {
    const { clickByText, getByText } = await renderContent();

    await act(async () => {
      clickByText("Editar");
    });

    expect(getByText("Atajos")).toBeTruthy();
    expect(getByText("Alt + Left: anterior")).toBeTruthy();
    expect(getByText("Alt + Right: siguiente")).toBeTruthy();
  });

  it("navigates only through visible partidas when groups are collapsed", async () => {
    window.localStorage.setItem(
      "work-schedule-collapsed-groups:budget-1",
      JSON.stringify({
        "sub-2": true,
      }),
    );
    window.localStorage.setItem("work-schedule-editing-line:budget-1", "item-1");

    const { getByText, getInputByLabel } = await renderContent();

    expect(getInputByLabel("Inicio").value).toBe("2026-03-01");
    expect((getByText("Anterior") as HTMLButtonElement).disabled).toBe(true);
    expect((getByText("Siguiente") as HTMLButtonElement).disabled).toBe(true);

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", altKey: true, bubbles: true }));
    });

    expect(getInputByLabel("Inicio").value).toBe("2026-03-01");
  });

  it("filters the cronograma to show only pending partidas", async () => {
    const { clickByText, queryByText, getByText, getAllByTestId } = await renderContentWithoutSchedule();

    await act(async () => {
      clickByText("Solo pendientes (1)");
    });

    expect(getByText("Tarrajeo")).toBeTruthy();
    expect(queryByText("Trazo y replanteo")).toBeNull();
    expect(getAllByTestId("work-schedule-timeline-row")).toHaveLength(1);
  });

  it("restores the overview filter from local storage on load", async () => {
    window.localStorage.setItem("work-schedule-overview-filter:budget-1", "pending");

    const { queryByText, getByText, getAllByTestId } = await renderContentWithoutSchedule();

    expect(getByText("Solo pendientes (1)")).toBeTruthy();
    expect(getByText("Tarrajeo")).toBeTruthy();
    expect(queryByText("Trazo y replanteo")).toBeNull();
    expect(getAllByTestId("work-schedule-timeline-row")).toHaveLength(1);
  });

  it("filters the cronograma to show only partidas with incomplete monthly distribution", async () => {
    const { clickByText, queryByText, getByText, getAllByTestId } = await renderContentWithIncompleteDistribution();

    await act(async () => {
      clickByText("Distribucion incompleta (1)");
    });

    expect(getByText("Tarrajeo")).toBeTruthy();
    expect(queryByText("Trazo y replanteo")).toBeNull();
    expect(getAllByTestId("work-schedule-timeline-row")).toHaveLength(1);
  });

  it("filters the cronograma to show only fully scheduled partidas", async () => {
    const { clickByText, queryByText, getByText, getAllByTestId } = await renderContentWithIncompleteDistribution();

    await act(async () => {
      clickByText("Solo programadas (1)");
    });

    expect(getByText("Trazo y replanteo")).toBeTruthy();
    expect(queryByText("Tarrajeo")).toBeNull();
    expect(getAllByTestId("work-schedule-timeline-row")).toHaveLength(1);
  });

  it("shows counters for each overview filter", async () => {
    const { getByText } = await renderContentWithIncompleteDistribution();

    expect(getByText("Solo pendientes (1)")).toBeTruthy();
    expect(getByText("Distribucion incompleta (1)")).toBeTruthy();
    expect(getByText("Solo programadas (1)")).toBeTruthy();
  });

  it("shows a summary strip with overview status counts", async () => {
    const { getByText } = await renderContentWithIncompleteDistribution();

    expect(getByText("Resumen rapido")).toBeTruthy();
    expect(getByText("Pendientes: 1")).toBeTruthy();
    expect(getByText("Distribucion incompleta: 1")).toBeTruthy();
    expect(getByText("Programadas: 1")).toBeTruthy();
  });

  it("applies the active filter to calendario valorizado and calendario de insumos", async () => {
    const { clickByText, queryByText, getByText } = await renderContentWithIncompleteDistribution();

    await act(async () => {
      clickByText("Distribucion incompleta (1)");
    });

    await act(async () => {
      clickByText("Calendario valorizado");
    });

    expect(getByText("Tarrajeo")).toBeTruthy();
    expect(queryByText("Trazo y replanteo")).toBeNull();

    await act(async () => {
      clickByText("Calendario de insumos");
    });

    expect(getByText("PEON")).toBeTruthy();
    expect(queryByText("Cemento")).toBeNull();
  });

  it("renders calendario valorizado as a compact single-line horizontally scrollable table", async () => {
    const { clickByText, getByTestId } = await renderContent();

    await act(async () => {
      clickByText("Calendario valorizado");
    });

    const scrollFrame = getByTestId("valuation-calendar-table-scroll");
    const table = scrollFrame.querySelector("table");
    const descriptionCell = scrollFrame.querySelector("tbody td:nth-child(2)");
    const amountCell = scrollFrame.querySelector("tbody td:nth-child(6)");

    expect(scrollFrame.className).toContain("overflow-x-auto");
    expect(table?.className).toContain("text-[11px]");
    expect(table?.getAttribute("style")).toContain("min-width");
    expect(descriptionCell?.className).toContain("whitespace-nowrap");
    expect(amountCell?.className).toContain("text-right");
    expect(amountCell?.className).toContain("whitespace-nowrap");
  });

  it("renders calendario de insumos as a compact single-line horizontally scrollable table", async () => {
    const { clickByText, getByTestId } = await renderContent();

    await act(async () => {
      clickByText("Calendario de insumos");
    });

    const scrollFrame = getByTestId("resource-calendar-table-scroll");
    const table = scrollFrame.querySelector("table");
    const descriptionCell = scrollFrame.querySelector("tbody td:nth-child(2)");
    const amountCell = scrollFrame.querySelector("tbody td:nth-child(6)");
    const periodCell = scrollFrame.querySelector("tbody td:nth-child(7)");

    expect(scrollFrame.className).toContain("overflow-x-auto");
    expect(table?.className).toContain("text-[11px]");
    expect(table?.getAttribute("style")).toContain("min-width");
    expect(descriptionCell?.className).toContain("whitespace-nowrap");
    expect(amountCell?.className).toContain("text-right");
    expect(periodCell?.className).toContain("whitespace-nowrap");
  });

  it("switches calendario de insumos between valued amounts and quantities", async () => {
    const { clickByText, getByText, getByTestId, queryByText } = await renderContent();

    await act(async () => {
      clickByText("Calendario de insumos");
    });

    const scrollFrame = getByTestId("resource-calendar-table-scroll");
    const getFirstPeriodCell = () => {
      const cell = scrollFrame.querySelector("tbody tr:first-child td:nth-child(7)");

      if (!(cell instanceof HTMLElement)) {
        throw new Error("Missing first period cell");
      }

      return cell;
    };

    expect(getByText("Valorizado")).toBeTruthy();
    expect(getByText("Cantidades")).toBeTruthy();
    expect(getFirstPeriodCell().textContent).toBe("S/ 240.00");

    await act(async () => {
      clickByText("Cantidades");
    });

    expect(getFirstPeriodCell().textContent).toBe("12.00");
    expect(queryByText("Mostrando cantidades mensuales programadas.")).toBeTruthy();
    expect(window.localStorage.getItem("work-schedule-resource-calendar-mode:budget-1")).toBe("quantities");
  });

  it("applies the active filter to curva s", async () => {
    const { clickByText, getByText, queryByText } = await renderContentWithIncompleteDistribution();

    await act(async () => {
      clickByText("Distribucion incompleta (1)");
    });

    await act(async () => {
      clickByText("Curva S");
    });

    expect(getByText("Curva S basica")).toBeTruthy();
    expect(getByText("S/ 200.00")).toBeTruthy();
    expect(queryByText("S/ 600.00")).toBeNull();
  });

  it("draws curva s as accumulated amount over time with labels at each point", async () => {
    const { clickByText, getByTestId, getByText } = await renderWithView(createViewWithMultiPointCurve(), createSettings());

    await act(async () => {
      clickByText("Curva S");
    });

    const chart = getByTestId("work-schedule-curve-chart");
    const line = getByTestId("work-schedule-curve-line");
    const points = chart.querySelectorAll("[data-testid='work-schedule-curve-point']");
    const labels = chart.querySelectorAll("[data-testid='work-schedule-curve-point-label']");

    expect(getByText("Monto acumulado")).toBeTruthy();
    expect(getByText("Tiempo")).toBeTruthy();
    expect(line.getAttribute("data-d")).toContain("L");
    expect(points).toHaveLength(3);
    expect(labels).toHaveLength(3);
    expect(chart.textContent).toContain("S/ 100.00");
    expect(chart.textContent).toContain("S/ 350.00");
    expect(chart.textContent).toContain("S/ 500.00");
  });

  it("shows an active filter indicator across derived views", async () => {
    const { clickByText, getByText } = await renderContentWithIncompleteDistribution();

    await act(async () => {
      clickByText("Distribucion incompleta (1)");
    });

    expect(getByText("Filtro activo: Distribucion incompleta")).toBeTruthy();

    await act(async () => {
      clickByText("Calendario valorizado");
    });

    expect(getByText("Filtro activo: Distribucion incompleta")).toBeTruthy();
  });

  it("clears the active filter from the header action", async () => {
    const { clickByText, getByText, queryByText } = await renderContentWithIncompleteDistribution();

    await act(async () => {
      clickByText("Distribucion incompleta (1)");
    });

    expect(getByText("Filtro activo: Distribucion incompleta")).toBeTruthy();

    await act(async () => {
      clickByText("Limpiar filtro");
    });

    expect(queryByText("Filtro activo: Distribucion incompleta")).toBeNull();
    expect(getByText("Tarrajeo")).toBeTruthy();
    expect(getByText("Trazo y replanteo")).toBeTruthy();
  });

  it("shows the active filter indicator inside derived calendar views", async () => {
    const { clickByText, getByText } = await renderContentWithIncompleteDistribution();

    await act(async () => {
      clickByText("Distribucion incompleta (1)");
    });

    await act(async () => {
      clickByText("Calendario valorizado");
    });

    expect(getByText("Filtro aplicado: Distribucion incompleta")).toBeTruthy();

    await act(async () => {
      clickByText("Calendario de insumos");
    });

    expect(getByText("Filtro aplicado: Distribucion incompleta")).toBeTruthy();
  });

  it("shows the active filter indicator inside curva s", async () => {
    const { clickByText, getByText } = await renderContentWithIncompleteDistribution();

    await act(async () => {
      clickByText("Distribucion incompleta (1)");
    });

    await act(async () => {
      clickByText("Curva S");
    });

    expect(getByText("Filtro aplicado: Distribucion incompleta")).toBeTruthy();
  });

  it("shows a unified xlsx export preferences bar only for derived calendar views", async () => {
    const { clickByText, getByText, queryByText } = await renderContent();

    await act(async () => {
      clickByText("Calendario valorizado");
    });

    expect(getByText("Preferencias de exportacion XLSX:")).toBeTruthy();
    expect(getByText("Calendario valorizado")).toBeTruthy();
    expect(getByText("Perfiles:")).toBeTruthy();
    expect(getByText("Minimo")).toBeTruthy();
    expect(getByText("Ejecutivo")).toBeTruthy();
    expect(getByText("Analitico")).toBeTruthy();
    expect(getByText("Alcance:")).toBeTruthy();
    expect(getByText("Solo detalle")).toBeTruthy();
    expect(getByText("Detalle + total")).toBeTruthy();
    expect(getByText("Detalle + subtotales + total")).toBeTruthy();
    expect(getByText("Se exportara calendario valorizado con detalle por partida, subtotales y total general.")).toBeTruthy();
    expect(getByText("Detalle")).toBeTruthy();
    expect(getByText("Incluye total")).toBeTruthy();
    expect(getByText("Incluye subtotales")).toBeTruthy();

    await act(async () => {
      clickByText("Minimo");
    });

    expect(getByText("Se exportara calendario valorizado con solo detalle por partida.")).toBeTruthy();
    expect(getByText("Solo detalle")).toBeTruthy();

    await act(async () => {
      clickByText("Calendario de insumos");
    });

    expect(getByText("Preferencias de exportacion XLSX:")).toBeTruthy();
    expect(getByText("Calendario de insumos")).toBeTruthy();
    expect(getByText("Analitico")).toBeTruthy();
    expect(getByText("Solo detalle")).toBeTruthy();
    expect(getByText("Detalle + total")).toBeTruthy();
    expect(getByText("Detalle + subtotales + total")).toBeTruthy();

    await act(async () => {
      clickByText("Curva S");
    });

    expect(getByText("Preferencias de exportacion XLSX:")).toBeTruthy();
    expect(getByText("Curva S")).toBeTruthy();
    expect(getByText("Minimo")).toBeTruthy();
    expect(getByText("Ejecutivo")).toBeTruthy();
    expect(getByText("Solo detalle")).toBeTruthy();
    expect(getByText("Detalle + total")).toBeTruthy();
    expect(queryByText("Analitico")).toBeNull();

    await act(async () => {
      clickByText("Cronograma");
    });

    expect(getByText("Preferencias de exportacion XLSX:")).toBeTruthy();
    expect(getByText("Paquete ejecutivo")).toBeTruthy();
    expect(getByText("Analitico")).toBeTruthy();
    expect(getByText("Detalle + subtotales + total")).toBeTruthy();
  });

  it("exports the active filtered curva s view as xlsx in detail-only mode when configured", async () => {
    const { clickByText, clickExportAction, queryByText } = await renderContentWithIncompleteDistribution();

    await act(async () => {
      clickByText("Distribucion incompleta (1)");
    });

    await act(async () => {
      clickByText("Curva S");
    });

    expect(queryByText("Solo detalle")).toBeTruthy();

    await act(async () => {
      clickByText("Solo detalle");
    });

    await act(async () => {
      await clickExportAction("Exportar XLSX");
    });

    await waitFor(() => clickCount > 0);

    const { default: ExcelJS } = await import("exceljs");
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await lastCreatedBlob!.arrayBuffer());

    const curveSheet = workbook.getWorksheet("Curva S");
    expect(curveSheet?.getCell("A4").value).toBe("03/2026");
    expect(curveSheet?.getCell("A6").value).toBeNull();
  });

  it("exports the active filtered calendario valorizado view as csv", async () => {
    const { clickByText, clickExportAction } = await renderContentWithIncompleteDistribution();

    await act(async () => {
      clickByText("Distribucion incompleta (1)");
    });

    await act(async () => {
      clickByText("Calendario valorizado");
    });

    await act(async () => {
      await clickExportAction("Exportar CSV");
    });

    expect(lastDownloadName).toContain("calendario-valorizado");
    expect(clickCount).toBe(1);
    expect(lastCreatedBlob).toBeTruthy();

    const csvContent = await lastCreatedBlob?.text();
    expect(csvContent).toContain("Item,Partida,Unidad,Metrado,PU,Parcial,03/2026,04/2026");
    expect(csvContent).toContain("02.01,Tarrajeo,M2,10.00,S/ 20.00,S/ 200.00,S/ 200.00,S/ 0.00");
    expect(csvContent).not.toContain("Trazo y replanteo");
  });

  it("exports the active filtered calendario valorizado view as xlsx", async () => {
    const { clickByText, clickExportAction } = await renderContentWithIncompleteDistribution();

    await act(async () => {
      clickByText("Distribucion incompleta (1)");
    });

    await act(async () => {
      clickByText("Calendario valorizado");
    });

    await act(async () => {
      await clickExportAction("Exportar XLSX");
    });

    await waitFor(() => clickCount > 0);

    expect(lastDownloadName).toContain("calendario-valorizado.xlsx");
    expect(lastCreatedBlob?.type).toBe("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");

    const { default: ExcelJS } = await import("exceljs");
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await lastCreatedBlob!.arrayBuffer());

    expect(workbook.worksheets.map((worksheet) => worksheet.name)).toEqual(["Calendario valorizado"]);

    const valuationSheet = workbook.getWorksheet("Calendario valorizado");
    expect(valuationSheet?.getCell("A1").value).toBe("PROGRAMACION DE OBRA - CALENDARIO VALORIZADO");
    expect(valuationSheet?.autoFilter).toBe("A3:H3");
    expect(valuationSheet?.getCell("A4").value).toBe("02.01");
    expect(valuationSheet?.getCell("D4").value).toBe(10);
    expect(valuationSheet?.getCell("D4").numFmt).toBe("#,##0.00");
    expect(valuationSheet?.getCell("G4").value).toBe(200);
    expect(valuationSheet?.getCell("G4").numFmt).toBe("S/ #,##0.00");
    expect(valuationSheet?.getCell("H4").value).toBe(0);
    expect(valuationSheet?.getCell("H4").numFmt).toBe("S/ #,##0.00");
    expect(valuationSheet?.getCell("B5").value).toBe("Subtotal Arquitectura");
    expect(valuationSheet?.getCell("G5").value).toBe(200);
    expect(valuationSheet?.getCell("H5").value).toBe(0);
    expect(valuationSheet?.getCell("B6").value).toBe("Total");
    expect(valuationSheet?.getCell("B6").border?.top?.style).toBe("medium");
  });

  it("exports the active filtered calendario valorizado view as xlsx in detail-only mode when configured", async () => {
    const { clickByText, clickExportAction, queryByText } = await renderContentWithIncompleteDistribution();

    await act(async () => {
      clickByText("Distribucion incompleta (1)");
    });

    await act(async () => {
      clickByText("Calendario valorizado");
    });

    expect(queryByText("Solo detalle")).toBeTruthy();

    await act(async () => {
      clickByText("Solo detalle");
    });

    await act(async () => {
      await clickExportAction("Exportar XLSX");
    });

    await waitFor(() => clickCount > 0);

    const { default: ExcelJS } = await import("exceljs");
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await lastCreatedBlob!.arrayBuffer());

    const valuationSheet = workbook.getWorksheet("Calendario valorizado");
    expect(valuationSheet?.getCell("B5").value).toBeNull();
  });

  it("exports the active filtered calendario de insumos view as xlsx", async () => {
    const { clickByText, clickExportAction } = await renderContentWithIncompleteDistribution();

    await act(async () => {
      clickByText("Distribucion incompleta (1)");
    });

    await act(async () => {
      clickByText("Calendario de insumos");
    });

    await act(async () => {
      await clickExportAction("Exportar XLSX");
    });

    await waitFor(() => clickCount > 0);

    expect(lastDownloadName).toContain("calendario-insumos.xlsx");
    expect(lastCreatedBlob?.type).toBe("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");

    const { default: ExcelJS } = await import("exceljs");
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await lastCreatedBlob!.arrayBuffer());

    expect(workbook.worksheets.map((worksheet) => worksheet.name)).toEqual(["Calendario de insumos"]);

    const resourcesSheet = workbook.getWorksheet("Calendario de insumos");
    expect(resourcesSheet?.getCell("A1").value).toBe("PROGRAMACION DE OBRA - CALENDARIO DE INSUMOS");
    expect(resourcesSheet?.getCell("A4").value).toBe(1);
    expect(resourcesSheet?.getCell("B4").value).toBe("PEON");
    expect(resourcesSheet?.getCell("D4").value).toBe(8);
    expect(resourcesSheet?.getCell("D4").numFmt).toBe("#,##0.00");
    expect(resourcesSheet?.getCell("H4").value).toBe(120);
    expect(resourcesSheet?.getCell("H4").numFmt).toBe("S/ #,##0.00");
    expect(resourcesSheet?.getCell("B5").value).toBe("Subtotal LAB");
    expect(resourcesSheet?.getCell("D5").value).toBe(8);
    expect(resourcesSheet?.getCell("H5").value).toBe(120);
    expect(resourcesSheet?.getCell("B6").value).toBe("Total");
    expect(resourcesSheet?.getCell("D6").value).toBe(8);
    expect(resourcesSheet?.getCell("H6").value).toBe(120);
  });

  it("exports the active filtered calendario de insumos view as xlsx in detail-only mode when configured", async () => {
    const { clickByText, clickExportAction, queryByText } = await renderContentWithIncompleteDistribution();

    await act(async () => {
      clickByText("Distribucion incompleta (1)");
    });

    await act(async () => {
      clickByText("Calendario de insumos");
    });

    expect(queryByText("Solo detalle")).toBeTruthy();

    await act(async () => {
      clickByText("Solo detalle");
    });

    await act(async () => {
      await clickExportAction("Exportar XLSX");
    });

    await waitFor(() => clickCount > 0);

    const { default: ExcelJS } = await import("exceljs");
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await lastCreatedBlob!.arrayBuffer());

    const resourcesSheet = workbook.getWorksheet("Calendario de insumos");
    expect(resourcesSheet?.getCell("B5").value).toBeNull();
  });

  it("exports the active filtered curva s view as xlsx", async () => {
    const { clickByText, clickExportAction } = await renderContentWithIncompleteDistribution();

    await act(async () => {
      clickByText("Distribucion incompleta (1)");
    });

    await act(async () => {
      clickByText("Curva S");
    });

    await act(async () => {
      await clickExportAction("Exportar XLSX");
    });

    await waitFor(() => clickCount > 0);

    expect(lastDownloadName).toContain("curva-s.xlsx");
    expect(lastCreatedBlob?.type).toBe("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");

    const { default: ExcelJS } = await import("exceljs");
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await lastCreatedBlob!.arrayBuffer());

    expect(workbook.worksheets.map((worksheet) => worksheet.name)).toEqual(["Curva S"]);

    const curveSheet = workbook.getWorksheet("Curva S");
    expect(curveSheet?.getCell("A1").value).toBe("PROGRAMACION DE OBRA - CURVA S");
    expect(curveSheet?.getCell("A4").value).toBe("03/2026");
    expect(curveSheet?.getCell("B4").value).toBe(200);
    expect(curveSheet?.getCell("B4").numFmt).toBe("S/ #,##0.00");
    expect(curveSheet?.getCell("D4").value).toBe(1);
    expect(curveSheet?.getCell("D4").numFmt).toBe("0.00%");
    expect(curveSheet?.getCell("A6").value).toBe("Total");
    expect(curveSheet?.getCell("B6").value).toBe(200);
    expect(curveSheet?.getCell("D6").value).toBe(1);
  });

  it("exports the filtered cronograma overview as csv", async () => {
    const { clickByText, clickExportAction } = await renderContentWithIncompleteDistribution();

    await act(async () => {
      clickByText("Distribucion incompleta (1)");
    });

    await act(async () => {
      await clickExportAction("Exportar CSV");
    });

    expect(lastDownloadName).toContain("cronograma");
    expect(clickCount).toBe(1);
    expect(lastCreatedBlob).toBeTruthy();

    const csvContent = await lastCreatedBlob?.text();
    expect(csvContent).toContain("Item,Partida,Duracion,Inicio,Fin,Predecesora,Cuadrilla,Unidad,Metrado,PU,Parcial");
    expect(csvContent).toContain("02.01,Tarrajeo,14,");
    expect(csvContent).toContain(",-,-,M2,10.00,S/ 20.00,S/ 200.00");
    expect(csvContent).not.toContain("Trazo y replanteo");
  });

  it("exports the filtered cronograma summary as csv by subbudget", async () => {
    const { clickByText, clickExportAction } = await renderContentWithIncompleteDistribution();

    await act(async () => {
      clickByText("Distribucion incompleta (1)");
    });

    await act(async () => {
      await clickExportAction("Exportar resumen CSV");
    });

    expect(lastDownloadName).toContain("resumen");
    expect(clickCount).toBe(1);
    expect(lastCreatedBlob).toBeTruthy();

    const csvContent = await lastCreatedBlob?.text();
    expect(csvContent).toContain("Subpresupuesto,Partidas,Programadas,Pendientes,Distribucion incompleta,Inicio,Fin,Total parcial");
    expect(csvContent).toContain("Arquitectura,1,0,1,1,");
    expect(csvContent).toContain(",S/ 200.00");
    expect(csvContent).not.toContain("Estructuras");
  });

  it("exports the filtered cronograma monthly summary as csv", async () => {
    const { clickByText, clickExportAction } = await renderContentWithIncompleteDistribution();

    await act(async () => {
      clickByText("Distribucion incompleta (1)");
    });

    await act(async () => {
      await clickExportAction("Exportar resumen mensual CSV");
    });

    expect(lastDownloadName).toContain("resumen-mensual");
    expect(clickCount).toBe(1);
    expect(lastCreatedBlob).toBeTruthy();

    const csvContent = await lastCreatedBlob?.text();
    expect(csvContent).toContain("Periodo,Partidas con monto,Programado mensual,Acumulado,% acumulado");
    expect(csvContent).toContain("03/2026,1,S/ 200.00,S/ 200.00,100.00%");
    expect(csvContent).toContain("04/2026,0,S/ 0.00,S/ 200.00,100.00%");
  });

  it("exports the filtered cronograma executive package as a combined csv", async () => {
    const { clickByText, clickExportAction } = await renderContentWithIncompleteDistribution();

    await act(async () => {
      clickByText("Distribucion incompleta (1)");
    });

    await act(async () => {
      await clickExportAction("Exportar paquete ejecutivo CSV");
    });

    expect(lastDownloadName).toContain("paquete-ejecutivo");
    expect(clickCount).toBe(1);
    expect(lastCreatedBlob).toBeTruthy();

    const csvContent = await lastCreatedBlob?.text();
    expect(csvContent).toContain("Paquete ejecutivo - Resumen por subpresupuesto");
    expect(csvContent).toContain("Subpresupuesto,Partidas,Programadas,Pendientes,Distribucion incompleta,Inicio,Fin,Total parcial");
    expect(csvContent).toContain("Arquitectura,1,0,1,1,");
    expect(csvContent).toContain("Paquete ejecutivo - Resumen mensual");
    expect(csvContent).toContain("Periodo,Partidas con monto,Programado mensual,Acumulado,% acumulado");
    expect(csvContent).toContain("03/2026,1,S/ 200.00,S/ 200.00,100.00%");
    expect(csvContent).not.toContain("Estructuras,1");
  });

  it("exports the filtered cronograma executive package as xlsx", async () => {
    const { clickByText, clickExportAction } = await renderContentWithIncompleteDistribution();

    await act(async () => {
      clickByText("Distribucion incompleta (1)");
    });

    await act(async () => {
      await clickExportAction("Exportar paquete ejecutivo XLSX");
    });

    await waitFor(() => clickCount > 0);

    expect(lastDownloadName).toContain("paquete-ejecutivo.xlsx");
    expect(clickCount).toBe(1);
    expect(lastCreatedBlob).toBeTruthy();
    expect(lastCreatedBlob?.type).toBe("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");

    const { default: ExcelJS } = await import("exceljs");
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await lastCreatedBlob!.arrayBuffer());

    expect(workbook.worksheets.map((worksheet) => worksheet.name)).toEqual([
      "Resumen subpresupuesto",
      "Resumen mensual",
      "Cronograma partidas",
    ]);

    const summarySheet = workbook.getWorksheet("Resumen subpresupuesto");
    const monthlySheet = workbook.getWorksheet("Resumen mensual");
    const overviewSheet = workbook.getWorksheet("Cronograma partidas");

    expect(summarySheet?.getCell("A1").value).toBe("PROGRAMACION DE OBRA - RESUMEN POR SUBPRESUPUESTO");
    expect(summarySheet?.autoFilter).toBe("A3:H3");
    expect(summarySheet?.getCell("A4").value).toBe("Arquitectura");
    expect(summarySheet?.getCell("B4").value).toBe(1);
    expect(summarySheet?.getCell("H4").value).toBe(200);
    expect(summarySheet?.getCell("H4").numFmt).toBe("S/ #,##0.00");
    expect(summarySheet?.getCell("A5").value).toBe("Total");
    expect(summarySheet?.getCell("H5").value).toBe(200);
    expect(summarySheet?.getCell("A5").border?.top?.style).toBe("medium");
    expect(monthlySheet?.getCell("A1").value).toBe("PROGRAMACION DE OBRA - RESUMEN MENSUAL");
    expect(monthlySheet?.getCell("A4").value).toBe("03/2026");
    expect(monthlySheet?.getCell("C4").value).toBe(200);
    expect(monthlySheet?.getCell("C4").numFmt).toBe("S/ #,##0.00");
    expect(monthlySheet?.getCell("E4").value).toBe(1);
    expect(monthlySheet?.getCell("E4").numFmt).toBe("0.00%");
    expect(monthlySheet?.getCell("A6").value).toBe("Total");
    expect(monthlySheet?.getCell("C6").value).toBe(200);
    expect(monthlySheet?.getCell("E6").value).toBe(1);
    expect(overviewSheet?.getCell("A1").value).toBe("PROGRAMACION DE OBRA - CRONOGRAMA DE PARTIDAS");
    expect(overviewSheet?.getCell("A4").value).toBe("02.01");
    expect(overviewSheet?.getCell("I4").value).toBe(10);
    expect(overviewSheet?.getCell("I4").numFmt).toBe("#,##0.00");
    expect(overviewSheet?.getCell("B5").value).toBe("Subtotal Arquitectura");
    expect(overviewSheet?.getCell("K5").value).toBe(200);
    expect(overviewSheet?.getCell("B6").value).toBe("Total");
    expect(overviewSheet?.getCell("K6").value).toBe(200);
  });
});

async function waitFor(predicate: () => boolean, timeoutMs = 4000) {
  const startedAt = Date.now();
  while (!predicate()) {
    if (Date.now() - startedAt > timeoutMs) {
      throw new Error("Timed out waiting for async condition.");
    }

    await new Promise((resolve) => window.setTimeout(resolve, 20));
  }
}

async function renderContent() {
  return renderWithView(createView(), createSettings());
}

async function renderContentWithoutSchedule() {
  return renderWithView(createViewWithoutSchedule(), createSettings());
}

async function renderContentWithIncompleteDistribution() {
  return renderWithView(createViewWithIncompleteDistribution(), createSettings());
}

async function renderContentWithPartialWeekTimeline() {
  return renderWithView(createViewWithPartialWeekTimeline(), createSettings());
}

async function renderWithView(view: WorkScheduleViewRecord, settings: UserSettingsRecord) {
  const nextContainer = document.createElement("div");
  document.body.appendChild(nextContainer);
  activeContainer = nextContainer;

  const root = createRoot(nextContainer);
  (nextContainer as HTMLDivElement & { __root?: typeof root }).__root = root;

  await act(async () => {
    root.render(
      <FormattingSettingsProvider settings={settings}>
        <AppViewModeProvider initialViewMode={settings.defaultViewMode}>
          <WorkSchedulePageContent initialData={view} />
        </AppViewModeProvider>
      </FormattingSettingsProvider>,
    );
  });

  await act(async () => {
    await Promise.resolve();
  });

  return {
    clickByText: (text: string) => {
      const element = findElementByText(text);
      if (!(element instanceof HTMLElement)) {
        throw new Error(`Missing clickable text: ${text}`);
      }

      element.click();
    },
    clickExportAction: async (text: string) => {
      const trigger = document.querySelector<HTMLButtonElement>("[aria-label='Abrir acciones de exportacion']");
      if (!trigger) {
        throw new Error("Missing export action trigger");
      }

      trigger.click();
      await Promise.resolve();

      const element = findElementByText(text);
      if (!(element instanceof HTMLElement)) {
        throw new Error(`Missing export action: ${text}`);
      }

      element.click();
    },
    getByText: (text: string) => {
      const element = findElementByText(text);
      if (!(element instanceof HTMLElement)) {
        throw new Error(`Missing text: ${text}`);
      }

      return element;
    },
    queryByText: (text: string) => {
      const element = findElementByText(text);
      return element instanceof HTMLElement ? element : null;
    },
    getByTestId: (testId: string) => {
      const element = document.querySelector(`[data-testid='${testId}']`);
      if (!(element instanceof HTMLElement)) {
        throw new Error(`Missing test id: ${testId}`);
      }

      return element;
    },
    getAllByTestId: (testId: string) => {
      return [...document.querySelectorAll(`[data-testid='${testId}']`)].filter(
        (element): element is HTMLElement => element instanceof HTMLElement,
      );
    },
    getTimelineRowByLineId: (lineId: string) => {
      const element = document.querySelector(`[data-testid='work-schedule-timeline-row'][data-line-id='${lineId}']`);
      if (!(element instanceof HTMLElement)) {
        throw new Error(`Missing timeline row for line: ${lineId}`);
      }

      return element;
    },
    getInputByLabel: (label: string) => {
      const labelElement = [...document.querySelectorAll("label")].find((candidate) =>
        candidate.textContent?.includes(label),
      );

      if (!(labelElement instanceof HTMLLabelElement)) {
        throw new Error(`Missing label: ${label}`);
      }

      const input = labelElement.querySelector("input");
      if (!(input instanceof HTMLInputElement)) {
        throw new Error(`Missing input for label: ${label}`);
      }

      return input;
    },
    getDistributionInput: (index: number, label: string) => {
      const groups = [...document.querySelectorAll("[data-testid='work-schedule-distribution-row']")];
      const row = groups[index];

      if (!(row instanceof HTMLElement)) {
        throw new Error(`Missing distribution row: ${index}`);
      }

      const labelElement = [...row.querySelectorAll("label")].find((candidate) =>
        candidate.textContent?.includes(label),
      );

      if (!(labelElement instanceof HTMLLabelElement)) {
        throw new Error(`Missing distribution label: ${label}`);
      }

      const input = labelElement.querySelector("input");
      if (!(input instanceof HTMLInputElement)) {
        throw new Error(`Missing distribution input: ${label}`);
      }

      return input;
    },
    getInputByValue: (value: string) => {
      const input = [...document.querySelectorAll("input")].find(
        (candidate) => candidate instanceof HTMLInputElement && candidate.value === value,
      );

      if (!(input instanceof HTMLInputElement)) {
        throw new Error(`Missing input with value: ${value}`);
      }

      return input;
    },
  };
}

function findElementByText(text: string) {
  const interactiveMatch = [...document.querySelectorAll("button, [role='button']")].find(
    (candidate) => candidate.textContent?.trim() === text,
  );

  if (interactiveMatch) {
    return interactiveMatch;
  }

  return [...document.querySelectorAll("h1, h2, h3, h4, h5, h6, p, span, td, th, div")].find(
    (candidate) => candidate.textContent?.trim() === text,
  );
}

function createSettings(overrides: Partial<UserSettingsRecord> = {}): UserSettingsRecord {
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
    ...overrides,
  };
}

function setInputValue(input: HTMLInputElement, value: string) {
  const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");
  descriptor?.set?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

function createView(): WorkScheduleViewRecord {
  const groups: WorkScheduleViewRecord["groups"] = [
      {
        subBudgetId: "sub-2",
        subBudgetName: "Arquitectura",
        totalAmount: 200,
        lines: [
          {
            scheduleItemId: "ws-2",
            budgetItemId: "item-2",
            itemCode: "02.01",
            description: "Tarrajeo",
            unit: "M2",
            quantity: 10,
            unitPrice: 20,
            partial: 200,
            subBudgetId: "sub-2",
            subBudgetName: "Arquitectura",
            startDate: "2026-03-08",
            endDate: "2026-03-21",
            durationDays: 14,
            crew: null,
            performance: 2,
            criticalPath: {
              earlyStartDay: 0,
              earlyFinishDay: 13,
              lateStartDay: 24,
              lateFinishDay: 37,
              totalSlackDays: 24,
              isCritical: false,
            },
            monthlyDistributions: [{ year: 2026, month: 3, percentage: 100 }],
            resources: [
              {
                resourceId: "res-2",
                code: "LAB-001",
                description: "PEON",
                unit: "HH",
                unitPrice: 15,
                totalQuantity: 8,
                totalCost: 120,
              },
            ],
          },
        ],
        rows: [],
      },
      {
        subBudgetId: "sub-1",
        subBudgetName: "Estructuras",
        totalAmount: 1000,
        lines: [
          {
            scheduleItemId: "ws-1",
            budgetItemId: "item-1",
            itemCode: "01.01",
            description: "Trazo y replanteo",
            unit: "GLB",
            quantity: 1,
            unitPrice: 1000,
            partial: 1000,
            subBudgetId: "sub-1",
            subBudgetName: "Estructuras",
            crew: 1,
            performance: 10,
            startDate: "2026-03-01",
            endDate: "2026-04-07",
            durationDays: 38,
            criticalPath: {
              earlyStartDay: 0,
              earlyFinishDay: 37,
              lateStartDay: 0,
              lateFinishDay: 37,
              totalSlackDays: 0,
              isCritical: true,
            },
            monthlyDistributions: [
              { year: 2026, month: 3, percentage: 60 },
              { year: 2026, month: 4, percentage: 40 },
            ],
            resources: [
              {
                resourceId: "res-1",
                code: "MAT-001",
                description: "Cemento",
                unit: "BLS",
                unitPrice: 20,
                totalQuantity: 12,
                totalCost: 240,
              },
            ],
          },
        ],
        rows: [],
      },
    ];

  for (const group of groups) {
    group.rows = group.lines.map((line) => ({ kind: "line", rowId: line.budgetItemId, line }));
  }

  return {
    budgetId: "budget-1",
    budgetName: "Presupuesto General",
    projectName: "Proyecto demo",
    currency: "PEN",
    groups,
    valuationCalendar: {
      periods: [
        { year: 2026, month: 3, key: "2026-03" },
        { year: 2026, month: 4, key: "2026-04" },
      ],
      rows: [
        {
          budgetItemId: "item-2",
          itemCode: "02.01",
          description: "Tarrajeo",
          unit: "M2",
          quantity: 10,
          unitPrice: 20,
          partial: 200,
          subBudgetName: "Arquitectura",
          rowTotal: 200,
          periodAmounts: {
            "2026-03": 200,
            "2026-04": 0,
          },
        },
        {
          budgetItemId: "item-1",
          itemCode: "01.01",
          description: "Trazo y replanteo",
          unit: "GLB",
          quantity: 1,
          unitPrice: 1000,
          partial: 1000,
          subBudgetName: "Estructuras",
          rowTotal: 1000,
          periodAmounts: {
            "2026-03": 600,
            "2026-04": 400,
          },
        },
      ],
    },
    resourceCalendar: {
      periods: [{ year: 2026, month: 3, key: "2026-03" }],
      rows: [
        {
          resourceId: "res-1",
          code: "MAT-001",
          description: "Cemento",
          unit: "BLS",
          quantity: 12,
          unitPrice: 20,
          partial: 240,
          periodQuantities: { "2026-03": 12 },
          periodAmounts: { "2026-03": 240 },
        },
        {
          resourceId: "res-2",
          code: "LAB-001",
          description: "PEON",
          unit: "HH",
          quantity: 8,
          unitPrice: 15,
          partial: 120,
          periodQuantities: { "2026-03": 8 },
          periodAmounts: { "2026-03": 120 },
        },
      ],
    },
    curveSeries: [
      {
        year: 2026,
        month: 3,
        key: "2026-03",
        monthlyAmount: 1200,
        accumulatedAmount: 1200,
        accumulatedPercentage: 100,
      },
    ],
    timeline: {
      startDate: "2026-03-01",
      endDate: "2026-04-07",
    },
    scale: {
      periodCount: 2,
      timelineDayCount: 38,
      canLoadDailyTimeline: true,
      canLoadDerivedCalendars: true,
      firstPeriodKey: "2026-03",
      lastPeriodKey: "2026-04",
    },
    criticalPath: {
      status: "calculated",
      projectDurationDays: 38,
      scheduledItemCount: 2,
      criticalItemCount: 1,
      issues: [],
    },
  };
}

function createOversizedSegmentedView(): WorkScheduleViewRecord {
  const view = createView();

  return {
    ...view,
    valuationCalendar: null,
    scale: {
      periodCount: 72,
      timelineDayCount: 2500,
      canLoadDailyTimeline: true,
      canLoadDerivedCalendars: false,
      firstPeriodKey: "2030-01",
      lastPeriodKey: "2035-12",
    },
  };
}

function createViewWithDependencyPreview(): WorkScheduleViewRecord {
  const view = createView();

  return {
    ...view,
    groups: rebuildTestWorkScheduleRows(
      view.groups.map((group) => ({
        ...group,
        lines: group.lines.map((line) => {
          if (line.budgetItemId === "item-1") {
            return {
              ...line,
              quantity: 10,
              performance: 2,
              crew: 1,
              startDate: "2026-03-01",
              endDate: "2026-03-05",
              durationDays: 5,
              monthlyDistributions: [{ year: 2026, month: 3, percentage: 100 }],
            };
          }

          if (line.budgetItemId === "item-2") {
            return {
              ...line,
              predecessor: "01.01FS",
              startDate: "2026-03-06",
              endDate: "2026-03-08",
              durationDays: 3,
              monthlyDistributions: [{ year: 2026, month: 3, percentage: 100 }],
            };
          }

          return line;
        }),
      })),
    ),
    timeline: {
      startDate: "2026-03-01",
      endDate: "2026-03-08",
    },
  };
}

function createViewWithoutSchedule(): WorkScheduleViewRecord {
  const view = createView();
  const groups = view.groups.map((group, groupIndex) => ({
    ...group,
    lines: group.lines.map((line, lineIndex) =>
      groupIndex === 0 && lineIndex === 0
        ? {
            ...line,
            startDate: null,
            endDate: null,
            durationDays: null,
            monthlyDistributions: [],
          }
        : line,
    ),
  }));

  return {
    ...view,
    groups: rebuildTestWorkScheduleRows(groups),
  };
}

function createViewWithPartialWeekTimeline(): WorkScheduleViewRecord {
  const view = createView();
  const groups = view.groups.map((group) => ({
    ...group,
    lines: group.lines.map((line) => ({
      ...line,
      startDate: line.budgetItemId === "item-1" ? "2026-03-03" : "2026-03-04",
      endDate: line.budgetItemId === "item-1" ? "2026-03-10" : "2026-03-05",
    })),
  }));

  return {
    ...view,
    groups: rebuildTestWorkScheduleRows(groups),
    timeline: {
      startDate: "2026-03-03",
      endDate: "2026-03-10",
    },
  };
}

function createViewWithIncompleteDistribution(): WorkScheduleViewRecord {
  const view = createView();
  const groups = view.groups.map((group, groupIndex) => ({
    ...group,
    lines: group.lines.map((line, lineIndex) =>
      groupIndex === 0 && lineIndex === 0
        ? {
            ...line,
            monthlyDistributions: [{ year: 2026, month: 3, percentage: 80 }],
          }
        : line,
    ),
  }));

  return {
    ...view,
    groups: rebuildTestWorkScheduleRows(groups),
  };
}

function createViewWithMultiPointCurve(): WorkScheduleViewRecord {
  const view = createView();

  return {
    ...view,
    valuationCalendar: {
      periods: [
        { year: 2026, month: 3, key: "2026-03" },
        { year: 2026, month: 4, key: "2026-04" },
        { year: 2026, month: 5, key: "2026-05" },
      ],
      rows: [
        {
          scheduleItemId: "ws-curve",
          budgetItemId: "item-curve",
          itemCode: "01.99",
          description: "Partida curva",
          unit: "GLB",
          quantity: 1,
          unitPrice: 500,
          partial: 500,
          subBudgetName: "General",
          rowTotal: 500,
          periodAmounts: {
            "2026-03": 100,
            "2026-04": 250,
            "2026-05": 150,
          },
        },
      ],
    },
    curveSeries: [
      {
        year: 2026,
        month: 3,
        key: "2026-03",
        monthlyAmount: 100,
        accumulatedAmount: 100,
        accumulatedPercentage: 20,
      },
      {
        year: 2026,
        month: 4,
        key: "2026-04",
        monthlyAmount: 250,
        accumulatedAmount: 350,
        accumulatedPercentage: 70,
      },
      {
        year: 2026,
        month: 5,
        key: "2026-05",
        monthlyAmount: 150,
        accumulatedAmount: 500,
        accumulatedPercentage: 100,
      },
    ],
  };
}

function rebuildTestWorkScheduleRows(groups: WorkScheduleViewRecord["groups"]) {
  return groups.map((group) => ({
    ...group,
    rows: group.lines.map((line) => ({ kind: "line" as const, rowId: line.budgetItemId, line })),
  }));
}
