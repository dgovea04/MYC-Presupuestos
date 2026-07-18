/* @vitest-environment jsdom */

import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  WorkSchedulePageContent,
  recalculateDraggedPredecessorString,
} from "@/components/budget/work-schedule-page-content";
import { FormattingSettingsProvider } from "@/components/providers/formatting-settings-provider";
import { AppViewModeProvider } from "@/components/view-mode/app-view-mode-provider";
import type { UserSettingsRecord } from "@/types/settings";
import type { WorkScheduleViewRecord } from "@/types/work-schedule";

let activeContainer: HTMLDivElement | null = null;
let lastCreatedBlob: Blob | null = null;
let lastDownloadName = "";
let clickCount = 0;
let originalScrollIntoView: typeof HTMLElement.prototype.scrollIntoView | undefined;
const fetchMock = vi.fn();

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

beforeAll(() => {
  originalScrollIntoView = HTMLElement.prototype.scrollIntoView;
  HTMLElement.prototype.scrollIntoView = () => undefined;
});

afterAll(() => {
  if (originalScrollIntoView) {
    HTMLElement.prototype.scrollIntoView = originalScrollIntoView;
    return;
  }

  Reflect.deleteProperty(HTMLElement.prototype, "scrollIntoView");
});

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

  it("updates the predecessor lag when a successor gantt bar is moved after its FS predecessor", () => {
    const moved = recalculateDraggedPredecessorString(
      "01.01FS",
      {
        itemCode: "01.02",
        startDate: "2026-03-08",
        endDate: "2026-03-10",
        durationDays: 3,
      },
      new Map([
        [
          "01.01",
          {
            budgetItemId: "item-1",
            itemCode: "01.01",
            description: "Predecesora",
            unit: "M2",
            quantity: 1,
            unitPrice: 1,
            partial: 1,
            subBudgetId: "sub-1",
            subBudgetName: "Estructuras",
            startDate: "2026-03-01",
            endDate: "2026-03-05",
            durationDays: 5,
            monthlyDistributions: [{ year: 2026, month: 3, percentage: 100 }],
          },
        ],
      ]),
    );

    expect(moved).toBe("01.01FS+2d");
  });

  it("updates the predecessor lag when a successor gantt bar is moved before its FS predecessor constraint", () => {
    const moved = recalculateDraggedPredecessorString(
      "01.01FS",
      {
        itemCode: "01.02",
        startDate: "2026-03-04",
        endDate: "2026-03-06",
        durationDays: 3,
      },
      new Map([
        [
          "01.01",
          {
            budgetItemId: "item-1",
            itemCode: "01.01",
            description: "Predecesora",
            unit: "M2",
            quantity: 1,
            unitPrice: 1,
            partial: 1,
            subBudgetId: "sub-1",
            subBudgetName: "Estructuras",
            startDate: "2026-03-01",
            endDate: "2026-03-05",
            durationDays: 5,
            monthlyDistributions: [{ year: 2026, month: 3, percentage: 100 }],
          },
        ],
      ]),
    );

    expect(moved).toBe("01.01FS-2d");
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

  // Partial-date guard in `handleActivateInlineRow`: trap pinned in `utils/edit-helpers.test.ts`.

  it("renders grouped sub budgets and opens the side editor for a partida", async () => {
    const { clickByText, getByText, getByTestId, getAllByTestId } = await renderContent();

    expect(getByText("Arquitectura")).toBeTruthy();
    expect(getByText("Estructuras")).toBeTruthy();
    expect(getByText("2 periodos")).toBeTruthy();
    const ganttBars = getAllByTestId("gantt-bar");
    expect(ganttBars.length).toBeGreaterThan(0);
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

  it("renders the Hito toggle button with the icon, label 'Hito', and title 'Marcar como hito' in the inactive state", async () => {
    await renderContent();

    const hitoButtons = Array.from(
      document.querySelectorAll<HTMLButtonElement>(
        'button[title="Marcar como hito"], button[title="Desmarcar como hito"]',
      ),
    );
    expect(hitoButtons.length).toBeGreaterThan(0);

    for (const button of hitoButtons) {
      // 1. Diamond icon is present as first child
      expect(button.querySelector("svg")).toBeTruthy();
      // 2. Visible label is the trimmed text "Hito"
      expect(button.textContent?.trim()).toBe("Hito");
    }

    // Default mocked view has no isMilestone=true lines, so every Hito button suggests marking
    expect(hitoButtons.every((button) => button.getAttribute("title") === "Marcar como hito")).toBe(true);
  });

  it("toggles the row's isMilestone through the Hito button and persists it via Enter", async () => {
    // Simulate server-side persistence: the mock echoes the PATCH body back as the
    // response payload so the rendered view reflects the toggled milestone after save.
    fetchMock.mockImplementation(async (_url, options) => {
      let responseData: WorkScheduleViewRecord = createView();
      if (options?.method === "PATCH" && typeof options.body === "string") {
        try {
          const parsed = JSON.parse(options.body) as
            | { budgetItemId?: string; isMilestone?: boolean }
            | undefined;
          if (parsed?.budgetItemId) {
            responseData = {
              ...responseData,
              // Rebuild rows from the updated lines so the rendered row points at the
              // freshly-toggled line (otherwise row.line still references the old one).
              groups: rebuildTestWorkScheduleRows(
                responseData.groups.map((group) => ({
                  ...group,
                  lines: group.lines.map((line) =>
                    line.budgetItemId === parsed.budgetItemId
                      ? { ...line, isMilestone: parsed.isMilestone ?? line.isMilestone }
                      : line,
                  ),
                })),
              ),
            };
          }
        } catch {
          // fall back to the default view below
        }
      }
      return { ok: true, json: async () => responseData };
    });

    await renderContent();

    // 1. Activate inline editing on item-1 by clicking the durationDays cell
    await act(async () => {
      const durationCell = document.querySelector(
        '[data-testid="work-schedule-inline-cell-durationDays-item-1"]',
      );
      if (!(durationCell instanceof HTMLElement)) {
        throw new Error("Missing durationDays cell for item-1");
      }
      durationCell.click();
    });

    // 2. The cell now renders an <input> that owns handleInlineKeyDown (Enter saves)
    const durationInput = document.querySelector<HTMLInputElement>(
      '[data-testid="work-schedule-inline-cell-durationDays-item-1"] input',
    );
    expect(durationInput).toBeTruthy();

    // 3. Click the Hito button on the same row to flip isMilestone in the active inline draft
    const hitoButton = document.querySelector<HTMLButtonElement>(
      '[data-testid="work-schedule-table-row-item-1"] button[title="Marcar como hito"]',
    );
    expect(hitoButton).toBeTruthy();

    await act(async () => {
      hitoButton!.click();
    });

    // Pre-save sanity: PATCH has not fired yet, so title is still bound to the line state.
    expect(
      document.querySelector(
        '[data-testid="work-schedule-table-row-item-1"] button[title="Marcar como hito"]',
      ),
    ).toBeTruthy();

    // 4. Dispatch Enter on the input → onInlineRowSave → PATCH with the toggled isMilestone
    await act(async () => {
      durationInput!.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Enter" }));
    });

    // 5. Verify the outgoing PATCH body carries the toggle
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/budgets/budget-1/work-schedule",
      expect.objectContaining({
        method: "PATCH",
        body: expect.stringContaining("\"isMilestone\":true"),
      }),
    );

    // 6. End-to-end flip verification: after the roundtrip, the rendered title is now
    //    "Desmarcar como hito" on the same row, with the same Diamond+Hito visual language.
    const flippedButton = document.querySelector<HTMLButtonElement>(
      '[data-testid="work-schedule-table-row-item-1"] button[title="Desmarcar como hito"]',
    );
    expect(flippedButton).toBeTruthy();
    expect(flippedButton?.querySelector("svg")).toBeTruthy();
    expect(flippedButton?.textContent?.trim()).toBe("Hito");
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

  it("shows schedule editor dates in Peruvian format with a calendar trigger", async () => {
    const { clickByText, getInputByLabel } = await renderContent();

    await act(async () => {
      clickByText("Editar");
    });

    const startInput = getInputByLabel("Inicio");
    const endInput = getInputByLabel("Fin");
    const startButton = startInput.parentElement?.querySelector("button");
    const endButton = endInput.parentElement?.querySelector("button");

    expect(startInput.getAttribute("type")).toBe("date");
    expect(endInput.getAttribute("type")).toBe("date");
    expect(startButton?.textContent).toMatch(/^\s*\d{2}\s+\D+2026/u);
    expect(endButton?.textContent).toMatch(/^\s*\d{2}\s+\D+2026/u);
    expect(startButton?.textContent).not.toMatch(/\d{2}\/\d{2}\/\d{4}/);
    expect(endButton?.textContent).not.toMatch(/\d{2}\/\d{2}\/\d{4}/);
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

  it("syncs the inline date input on re-activate after a predecessor cascade", async () => {
    const helpers = await renderWithView(
      createViewWithDependencyPreview(),
      createSettings(),
    );
    const { getByTestId } = helpers;
    const startCellB = getByTestId("work-schedule-inline-cell-startDate-item-2");

    // Step 1: Activate B by clicking its Inicio cell. A fresh draft is created
    // carrying B's initial startDate (2026-03-06) before any cascade.
    await act(async () => {
      startCellB.click();
    });

    const initialInputValue = (startCellB.querySelector('input[type="date"]') as HTMLInputElement | null)?.value;
    expect(initialInputValue).toBe("2026-03-06");

    // Step 2: Activate row A (predecessor) and extend its duration to 10 days.
    // `buildPreviewWorkScheduleView` cascades B's startDate forward to A.end + 1
    // (= 2026-03-11) inside presentationLines, but it must NOT mutate inlineDrafts.
    // Without the fix, B's draft still holds the original 2026-03-06.
    const durationCellA = getByTestId("work-schedule-inline-cell-durationDays-item-1");
    await act(async () => {
      durationCellA.click();
    });
    const durationInputA = durationCellA.querySelector('input') as HTMLInputElement;
    await act(async () => {
      setInputValue(durationInputA, "10");
    });

    // Step 3: Re-activate B by clicking its Inicio cell. This is the path the user
    // reported as broken. With the fix, handleActivateInlineRow merges the cascaded
    // startDate / endDate into the existing draft via updateEditableLineDates, so the
    // date picker rebinds to the cascaded value. Without the fix, the OLD draft wins
    // and the picker reopens at the stale 2026-03-06 even though the formatted cell
    // text already shows 2026-03-11.
    await act(async () => {
      startCellB.click();
    });
    const reboundInput = startCellB.querySelector('input[type="date"]') as HTMLInputElement | null;
    expect(reboundInput?.value).toBe("2026-03-11");
  });

  it("cascades successor dates into the editor sheet when its predecessor is edited", async () => {
    const helpers = await renderWithView(
      createViewWithDependencyPreview(),
      createSettings(),
    );
    const { getInputByLabel } = helpers;

    // Open the editor sheet for item-2 (successor of "01.01") via the same
    // aria-label-driven button click the original predecessor-cascade test
    // uses — `clickByText("Editar Tarrajeo")` does not match because the
    // button label and the partida name are rendered in different DOM nodes.
    await act(async () => {
      const editButton = document.querySelector("[aria-label='Editar Tarrajeo']");
      if (!(editButton instanceof HTMLButtonElement)) {
        throw new Error("Missing edit button for Tarrajeo");
      }
      editButton.click();
    });

    // Baseline: the editor sheet shows item-2's initial dates.
    expect(getInputByLabel("Inicio").value).toBe("2026-03-06");
    expect(getInputByLabel("Fin").value).toBe("2026-03-08");

    // Change the predecessor through the editor sheet's Predecesora input.
    // FS relation + 5d lag → B.start = A.end + 1 + 5 = 2026-03-11;
    // B.durationDays is preserved (3) so B.end = 2026-03-11 + 3 - 1 = 2026-03-13.
    //
    // Without the fix on `updateEditableLinePredecessor`, the date inputs
    // would stay at the baseline values because the helper never cascaded.
    setInputValue(getInputByLabel("Predecesora"), "01.01FS+5d");

    expect(getInputByLabel("Inicio").value).toBe("2026-03-11");
    expect(getInputByLabel("Fin").value).toBe("2026-03-13");
  });

  it("cascades successor dates into the inline row when its predecessor is edited", async () => {
    const helpers = await renderWithView(
      createViewWithDependencyPreview(),
      createSettings(),
    );
    const { getByTestId } = helpers;

    // Activate row item-2 inline by clicking its Inicio cell.
    const startCellB = getByTestId("work-schedule-inline-cell-startDate-item-2");
    await act(async () => {
      startCellB.click();
    });

    // Baseline assertion: the initial draft carries B.startDate = 2026-03-06.
    expect(
      (startCellB.querySelector('input[type="date"]') as HTMLInputElement | null)?.value,
    ).toBe("2026-03-06");

    // Edit the predecessor through the inline cell input. With the fix, this
    // both updates the predecessor field and recomputes the row's dates via
    // `updateEditableLinePredecessor → recalculateWorkScheduleLineFromReferences`.
    // Without the fix the date input would stay at 2026-03-06.
    const predecessorCellB = getByTestId("work-schedule-inline-cell-predecessor-item-2");
    await act(async () => {
      const predecessorInput = predecessorCellB.querySelector('input') as HTMLInputElement;
      setInputValue(predecessorInput, "01.01FS+5d");
    });

    expect(
      (startCellB.querySelector('input[type="date"]') as HTMLInputElement | null)?.value,
    ).toBe("2026-03-11");
  });

  it.each([
    ["SS", "2026-03-01", "2026-03-03"],
    ["FF", "2026-03-03", "2026-03-05"],
    ["SF", "2026-02-27", "2026-03-01"],
  ] as const)(
    "recalculates successor dates when an existing gantt dependency changes from FS to %s",
    async (relation, expectedStartDate, expectedEndDate) => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => createViewWithDependencyPreview(),
      });
      await renderWithView(createViewWithDependencyPreview(), createSettings());

      const dependencyHitPath = document.querySelector<SVGPathElement>(
        "svg path[stroke='transparent']",
      );
      if (!dependencyHitPath) {
        throw new Error("Missing editable dependency hit path");
      }

      await act(async () => {
        dependencyHitPath.dispatchEvent(new MouseEvent("click", { bubbles: true, clientX: 120, clientY: 80 }));
      });

      const relationButton = document.querySelector<HTMLButtonElement>(`[data-testid='edit-relation-${relation}']`);
      const saveButton = document.querySelector<HTMLButtonElement>("[data-testid='save-dependency-btn']");
      if (!relationButton || !saveButton) {
        throw new Error("Missing dependency edit controls");
      }

      await act(async () => {
        relationButton.click();
      });

      await act(async () => {
        saveButton.click();
        await Promise.resolve();
      });

      const patchCall = fetchMock.mock.calls.find(([, options]) => options?.method === "PATCH");
      const body = JSON.parse(String(patchCall?.[1]?.body)) as {
        predecessor?: string;
        startDate?: string;
        endDate?: string;
        durationDays?: number;
      };

      expect(body.predecessor).toBe(`01.01${relation}`);
      expect(body.startDate).toBe(expectedStartDate);
      expect(body.endDate).toBe(expectedEndDate);
      expect(body.durationDays).toBe(3);
    },
  );

  it("opens the intelligent schedule dialog and sends the base generation request with advanced options", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        ...createInitialData(),
        generationSummary: {
          generatedCount: 2,
          pendingCount: 1,
          issues: [{ budgetItemId: "item-9", itemCode: "03.01", reason: "Pendiente" }],
          appliedOptions: {
            strategy: "by_level",
            interSubBudgetParallelism: "parallel",
            levelLinkage: {
              "title-1": "parallel",
              "subtitle-1a": "parallel",
              "title-2": "parallel",
            },
            maxDurationDays: 10,
            similarityLagDays: 2,
          },
          highlights: ["Estrategia por niveles (titulos en paralelo)"],
        },
      }),
    });

    const { clickByText, getByText, getInputByLabel } = await renderWithView(createViewWithLevels(), createSettings());

    await act(async () => {
      clickByText("Generar cronograma inteligente");
    });

    expect(getByText("Cronograma inteligente")).toBeTruthy();
    expect(getByText("Previsualizacion de niveles")).toBeTruthy();
    expect(getByText("Estructuras")).toBeTruthy();

    await act(async () => {
      setInputValue(getInputByLabel("Fecha base"), "2026-06-01");
      setInputValue(getInputByLabel("Duracion maxima"), "10");
      setInputValue(getInputByLabel("Separacion por similitud"), "2");
      clickByText("Generar base");
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/budgets/budget-1/work-schedule", expect.objectContaining({
      method: "POST",
      body: expect.stringContaining("\"options\""),
    }));
    expect(fetchMock).toHaveBeenCalledWith("/api/budgets/budget-1/work-schedule", expect.objectContaining({
      body: expect.stringContaining("\"strategy\":\"by_level\""),
    }));
  });

  it("shows the by_front strategy option in the generation dialog", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => createInitialData(),
    });

    const { clickByText, getByText } = await renderWithView(createViewWithLevels(), createSettings());

    await act(async () => {
      clickByText("Generar cronograma inteligente");
    });

    expect(getByText("Cronograma inteligente")).toBeTruthy();

    const byFrontOption = document.querySelector('option[value="by_front"]');
    expect(byFrontOption).toBeTruthy();
    expect(byFrontOption?.textContent).toBe("Por frentes de obra");
  });

  it("renders the by_front keyword inputs after selecting the strategy", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ customPhaseKeywords: null }),
    });

    const { clickByText, getInputByLabel } = await renderWithView(createViewWithLevels(), createSettings());

    await act(async () => {
      clickByText("Generar cronograma inteligente");
    });

    await act(async () => {
      setInputValue(getInputByLabel("Fecha base"), "2026-06-01");
      clickByText("Por niveles");
    });

    await act(async () => {
      clickByText("Por frentes de obra");
    });

    expect(getInputByLabel("Preliminares")).toBeTruthy();
  });

  it("saves custom phase keywords when clicking Guardar configuracion", async () => {
    const { clickByText } = await openFrontsGenerationDialog();

    await act(async () => {
      clickByText("Guardar configuracion");
    });

    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(document.querySelector("p.text-emerald-600")?.textContent).toBe("Configuracion guardada correctamente.");

    const saveCall = fetchMock.mock.calls.find(
      ([url, options]) => url === "/api/budgets/budget-1/work-schedule/generation-settings" && options?.method === "PUT",
    );

    expect(saveCall).toBeDefined();
    const requestBody = JSON.parse(saveCall![1].body as string);
    expect(requestBody).toMatchObject({
      settings: {
        customPhaseKeywords: {
          preliminaries: ["limpieza", "replanteo"],
        },
      },
    });
  });

  it.each([
    { modifier: "Ctrl", modifierKey: "ctrlKey" as const },
    { modifier: "Cmd", modifierKey: "metaKey" as const },
  ])("saves custom phase keywords when pressing $modifier+S", async ({ modifierKey }) => {
    await openFrontsGenerationDialog();

    await act(async () => {
      (document.activeElement as HTMLElement | null)?.blur?.();
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "s", [modifierKey]: true, bubbles: true }));
    });

    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(document.querySelector("p.text-emerald-600")?.textContent).toBe("Configuracion guardada correctamente.");

    const saveCall = fetchMock.mock.calls.find(
      ([url, options]) => url === "/api/budgets/budget-1/work-schedule/generation-settings" && options?.method === "PUT",
    );

    expect(saveCall).toBeDefined();
    const requestBody = JSON.parse(saveCall![1].body as string);
    expect(requestBody).toMatchObject({
      settings: {
        customPhaseKeywords: {
          preliminaries: ["limpieza", "replanteo"],
        },
      },
    });
  });

  it("does not save custom phase keywords when pressing Ctrl+S while typing in an input", async () => {
    const { getInputByLabel } = await openFrontsGenerationDialog();

    const input = getInputByLabel("Preliminares");
    await act(async () => {
      setInputValue(input, "limpieza, replanteo");
      input.focus();
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "s", ctrlKey: true, bubbles: true }));
    });

    await new Promise((resolve) => setTimeout(resolve, 100));

    const saveCall = fetchMock.mock.calls.find(
      ([url, options]) => url === "/api/budgets/budget-1/work-schedule/generation-settings" && options?.method === "PUT",
    );

    expect(saveCall).toBeUndefined();
  });

  it.each([
    { label: "Ctrl+A", event: { key: "a", ctrlKey: true } },
    { label: "Ctrl+Shift+S", event: { key: "s", ctrlKey: true, shiftKey: true } },
    { label: "Ctrl+Alt+S", event: { key: "s", ctrlKey: true, altKey: true } },
    { label: "Cmd+Shift+S", event: { key: "s", metaKey: true, shiftKey: true } },
    { label: "S without modifier", event: { key: "s" } },
  ])("does not save custom phase keywords when pressing $label", async ({ event }) => {
    await openFrontsGenerationDialog();

    await act(async () => {
      (document.activeElement as HTMLElement | null)?.blur?.();
      document.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, ...event }));
    });

    await new Promise((resolve) => setTimeout(resolve, 100));

    const saveCall = fetchMock.mock.calls.find(
      ([url, options]) => url === "/api/budgets/budget-1/work-schedule/generation-settings" && options?.method === "PUT",
    );

    expect(saveCall).toBeUndefined();
  });

  it("saves custom phase keywords when pressing Ctrl+S while a button is focused", async () => {
    const { getByText } = await openFrontsGenerationDialog();

    await act(async () => {
      const button = getByText("Guardar configuracion");
      button.focus();
      expect(document.activeElement).toBe(button);
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "s", ctrlKey: true, bubbles: true }));
    });

    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(document.querySelector("p.text-emerald-600")?.textContent).toBe("Configuracion guardada correctamente.");

    const saveCall = fetchMock.mock.calls.find(
      ([url, options]) => url === "/api/budgets/budget-1/work-schedule/generation-settings" && options?.method === "PUT",
    );

    expect(saveCall).toBeDefined();
    const requestBody = JSON.parse(saveCall![1].body as string);
    expect(requestBody).toMatchObject({
      settings: {
        customPhaseKeywords: {
          preliminaries: ["limpieza", "replanteo"],
        },
      },
    });
  });

  it("shows an error message when saving custom phase keywords fails", async () => {
    const { clickByText, getByText } = await openFrontsGenerationDialog(async (url, options) => {
      if (url === "/api/budgets/budget-1/work-schedule/generation-settings") {
        if (options?.method === "PUT") {
          return { ok: false, json: async () => ({ error: "Error de prueba" }) };
        }

        return { ok: true, json: async () => ({ customPhaseKeywords: null }) };
      }

      return { ok: true, json: async () => createInitialData() };
    });

    await act(async () => {
      clickByText("Guardar configuracion");
    });

    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(getByText("Error de prueba")).toBeTruthy();
  });

  it("sends by_front strategy when selected", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => createInitialData(),
    });

    const { clickByText, getInputByLabel } = await renderWithView(createViewWithLevels(), createSettings());

    await act(async () => {
      clickByText("Generar cronograma inteligente");
    });

    await act(async () => {
      setInputValue(getInputByLabel("Fecha base"), "2026-06-01");
      clickByText("Por niveles");
    });

    await act(async () => {
      clickByText("Por frentes de obra");
    });

    await act(async () => {
      clickByText("Generar base");
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/budgets/budget-1/work-schedule", expect.objectContaining({
      body: expect.stringContaining("\"strategy\":\"by_front\""),
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

  it("allows marking affected partidas as reviewed before generating the intelligent schedule", async () => {
    const view = createView();
    view.reviewSummary = {
      warningCount: 1,
      warnings: [
        {
          code: "performance_default_one",
          label: "Partidas con rendimiento 1 detectadas. Esto suele indicar un posible error de importacion de Delphin.",
          count: 1,
          examples: [
            { budgetItemId: "item-1", itemCode: "01.01", description: "Trazo y replanteo", unit: "m2", performance: 1 },
          ],
        },
      ],
    };

    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        ...createInitialData(),
        reviewSummary: view.reviewSummary,
        generationSummary: {
          generatedCount: 2,
          pendingCount: 0,
          issues: [],
          appliedOptions: {
            strategy: "by_level",
            interSubBudgetParallelism: "independent",
            levelLinkage: null,
            maxDurationDays: null,
            similarityLagDays: 0,
          },
          highlights: [],
        },
      }),
    });

    const { clickByText, getByText, getInputByLabel, queryByText } = await renderWithView(view, createSettings());

    await act(async () => {
      clickByText("Generar cronograma inteligente");
    });

    expect(getByText("Revision previa recomendada")).toBeTruthy();

    await act(async () => {
      clickByText("Marcar como revisada");
    });

    expect(queryByText("01.01: Trazo y replanteo")).toBeNull();

    await act(async () => {
      setInputValue(getInputByLabel("Fecha base"), "2026-06-01");
      clickByText("Generar base");
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/budgets/budget-1/work-schedule", expect.objectContaining({
      body: expect.stringContaining("\"reviewedBudgetItemIds\":[\"item-1\"]"),
    }));
  });

  it("updates pending review counts in the page and dialog after marking partidas as reviewed", async () => {
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
            { budgetItemId: "item-2", itemCode: "01.02", description: "Excavacion manual", unit: "m3", performance: 1 },
          ],
        },
      ],
    };

    const { clickByText, getByText, queryByText } = await renderWithView(view, createSettings());

    expect(getByText("2 advertencias detectadas")).toBeTruthy();
    expect(getByText("2 partidas afectadas.")).toBeTruthy();

    await act(async () => {
      clickByText("Generar cronograma inteligente");
    });

    expect(getByText("2 partidas afectadas.")).toBeTruthy();

    await act(async () => {
      clickByText("Marcar como revisada");
    });

    expect(getByText("1 advertencias detectadas")).toBeTruthy();
    expect(getByText("1 partidas afectadas.")).toBeTruthy();
    expect(queryByText("01.01: Trazo y replanteo")).toBeNull();
    expect(getByText("01.02: Excavacion manual")).toBeTruthy();
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

  it("'Todo paralelo' sets all level toggles to parallel in the generation dialog tree preview", async () => {
    window.localStorage.setItem("work-schedule-generation-strategy:budget-1", "sequential");
    window.localStorage.removeItem("work-schedule-generation-level-linkage:budget-1");

    const { clickByText, getByText } = await renderWithView(createViewWithLevels(), createSettings());

    await act(async () => {
      clickByText("Generar cronograma inteligente");
    });

    // Tree preview should be visible
    expect(getByText("Previsualizacion de niveles")).toBeTruthy();
    expect(getByText("Estructuras")).toBeTruthy();

    // Toggle one level to "Encadenar" first
    const paraleloButtonsBefore = [...document.querySelectorAll("button")].filter(
      (btn) => btn.textContent?.trim() === "Paralelo",
    );
    if (paraleloButtonsBefore.length > 0) {
      await act(async () => {
        paraleloButtonsBefore[0].click();
      });
    }

    // Click "Todo paralelo"
    const todoParaleloBtn = [...document.querySelectorAll("button")].find(
      (btn) => btn.textContent?.trim() === "Todo paralelo",
    );
    expect(todoParaleloBtn instanceof HTMLButtonElement).toBe(true);

    await act(async () => {
      (todoParaleloBtn as HTMLButtonElement).click();
    });

    await act(async () => {
      await Promise.resolve();
    });

    // After "Todo paralelo", all level toggles should say "Paralelo"
    const paralelosAfter = [...document.querySelectorAll("button")].filter(
      (btn) => btn.textContent?.trim() === "Paralelo",
    );
    expect(paralelosAfter.length).toBe(3);
  });

  it("'Todo encadenar' sets all level toggles to chain in the generation dialog tree preview", async () => {
    window.localStorage.setItem("work-schedule-generation-strategy:budget-1", "sequential");
    window.localStorage.removeItem("work-schedule-generation-level-linkage:budget-1");

    const { clickByText, getByText } = await renderWithView(createViewWithLevels(), createSettings());

    await act(async () => {
      clickByText("Generar cronograma inteligente");
    });

    expect(getByText("Previsualizacion de niveles")).toBeTruthy();

    // Click "Todo encadenar"
    const todoEncadenarBtn = [...document.querySelectorAll("button")].find(
      (btn) => btn.textContent?.trim() === "Todo encadenar",
    );
    expect(todoEncadenarBtn instanceof HTMLButtonElement).toBe(true);

    await act(async () => {
      (todoEncadenarBtn as HTMLButtonElement).click();
    });

    await act(async () => {
      await Promise.resolve();
    });

    // All level toggles should now say "Encadenar"
    const encadenarAfter = [...document.querySelectorAll("button")].filter(
      (btn) => btn.textContent?.trim() === "Encadenar",
    );
    // Level toggle buttons (3 levels) plus "Todo encadenar" itself = 4+
    expect(encadenarAfter.length).toBe(3);
  });

  it("collapses and expands sub-budget levels in the generation dialog tree preview", async () => {
    window.localStorage.setItem("work-schedule-generation-strategy:budget-1", "sequential");
    window.localStorage.removeItem("work-schedule-generation-level-linkage:budget-1");

    const { clickByText, getByText, queryByText } = await renderWithView(createViewWithLevels(), createSettings());

    await act(async () => {
      clickByText("Generar cronograma inteligente");
    });

    expect(getByText("Previsualizacion de niveles")).toBeTruthy();

    // Levels should be visible initially
    expect(getByText("01.: Cimentacion")).toBeTruthy();
    expect(getByText("01.01: Cimiento corrido")).toBeTruthy();

    // Click Arquitectura sub-budget header to collapse (it has Cimentacion levels)
    const arquitecturaBtn = [...document.querySelectorAll("button")].find(
      (btn) => btn.textContent?.includes("Arquitectura") && btn.textContent?.includes("("),
    );
    expect(arquitecturaBtn instanceof HTMLButtonElement).toBe(true);

    await act(async () => {
      (arquitecturaBtn as HTMLButtonElement).click();
    });

    await act(async () => {
      await Promise.resolve();
    });

    // Levels should be hidden
    expect(queryByText("01.: Cimentacion")).toBeNull();
    expect(queryByText("01.01: Cimiento corrido")).toBeNull();

    // Click again to expand
    await act(async () => {
      (arquitecturaBtn as HTMLButtonElement).click();
    });

    await act(async () => {
      await Promise.resolve();
    });

    // Levels should be visible again
    expect(getByText("01.: Cimentacion")).toBeTruthy();
    expect(getByText("01.01: Cimiento corrido")).toBeTruthy();
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

function createInitialData(): WorkScheduleViewRecord {
  return createView();
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
      const editorPanel = document.querySelector("[data-testid='work-schedule-editor-panel']");
      const labels = editorPanel ? [...editorPanel.querySelectorAll("label")] : [...document.querySelectorAll("label")];
      const labelElement = labels.find((candidate) =>
        candidate.textContent?.trim().includes(label),
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
    aiProviderPreference: "auto",
    floatingKhipuProvider: "ollama",
    floatingKhipuWidth: 600,
    floatingKhipuHeight: 500,
    floatingKhipuFontSize: "normal",
    floatingKhipuPosition: "bottom-right",
    floatingKhipuTheme: "light",
    ...overrides,
  };
}

function setInputValue(input: HTMLInputElement, value: string) {
  const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");
  descriptor?.set?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

async function openFrontsGenerationDialog(
  fetchImplementation: (url: string, options?: RequestInit) => Promise<{ ok: boolean; json: () => Promise<unknown> }> = defaultGenerationSettingsFetch,
) {
  fetchMock.mockImplementation(fetchImplementation);

  const helpers = await renderWithView(createViewWithLevels(), createSettings());

  await act(async () => {
    helpers.clickByText("Generar cronograma inteligente");
  });

  await act(async () => {
    setInputValue(helpers.getInputByLabel("Fecha base"), "2026-06-01");
    helpers.clickByText("Por niveles");
  });

  await act(async () => {
    helpers.clickByText("Por frentes de obra");
  });

  await new Promise((resolve) => setTimeout(resolve, 50));

  await act(async () => {
    setInputValue(helpers.getInputByLabel("Preliminares"), "limpieza, replanteo");
  });

  return helpers;
}

function defaultGenerationSettingsFetch(url: string, options?: RequestInit) {
  if (url === "/api/budgets/budget-1/work-schedule/generation-settings") {
    if (options?.method === "PUT") {
      return Promise.resolve({ ok: true, json: async () => ({}) });
    }

    return Promise.resolve({ ok: true, json: async () => ({ customPhaseKeywords: null }) });
  }

  return Promise.resolve({ ok: true, json: async () => createInitialData() });
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

function createViewWithLevels(): WorkScheduleViewRecord {
  const view = createView();

  // Build level rows for the tree preview in the generation dialog
  const group1Levels = [
    { kind: "level" as const, rowId: "level-title-1", levelId: "title-1", levelType: "TITLE" as const, itemCode: "01.", description: "Cimentacion", childLineIds: ["item-1"] },
    { kind: "level" as const, rowId: "level-subtitle-1a", levelId: "subtitle-1a", levelType: "SUBTITLE" as const, itemCode: "01.01", description: "Cimiento corrido", childLineIds: ["item-1"] },
  ];
  const group2Levels = [
    { kind: "level" as const, rowId: "level-title-2", levelId: "title-2", levelType: "TITLE" as const, itemCode: "02.", description: "Revestimientos", childLineIds: ["item-2"] },
  ];

  const groups = view.groups.map((group, idx) => {
    const levelRows = idx === 0 ? group1Levels : group2Levels;
    const lineRows = group.lines.map((line) => ({ kind: "line" as const, rowId: line.budgetItemId, line }));
    return {
      ...group,
      rows: [...levelRows, ...lineRows] as WorkScheduleViewRecord["groups"][number]["rows"],
    };
  });

  return {
    ...view,
    groups,
    valuationCalendar: null,
    resourceCalendar: null,
    curveSeries: null,
  };
}

function rebuildTestWorkScheduleRows(groups: WorkScheduleViewRecord["groups"]) {
  return groups.map((group) => ({
    ...group,
    rows: group.lines.map((line) => ({ kind: "line" as const, rowId: line.budgetItemId, line })),
  }));
}
});
