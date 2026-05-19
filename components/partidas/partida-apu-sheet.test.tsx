/* @vitest-environment jsdom */

import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PartidaApuSheet } from "@/components/partidas/partida-apu-sheet";
import { FormattingSettingsProvider } from "@/components/providers/formatting-settings-provider";
import type { CatalogPartidaRecord } from "@/types/partida";
import type { UserSettingsRecord } from "@/types/settings";

let activeContainer: HTMLDivElement | null = null;

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe("PartidaApuSheet", () => {
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

  it("shows category summary cards and maps tools into equipment styling", async () => {
    const partida = createPartida();
    const { getByTestId, getIndicatorForRow } = await renderSheet(partida);

    expect(getByTestId("partida-apu-summary-card-EQUIPMENT").textContent).toContain("S/ 45.00");
    expect(getByTestId("partida-apu-summary-card-SUBPARTIDA").textContent).toContain("S/ 125.00");
    expect(getIndicatorForRow("row-tools").dataset.apuCategory).toBe("EQUIPMENT");
    expect(getIndicatorForRow("row-tools").className).toContain("bg-amber-50/90");
    expect(getIndicatorForRow("row-subpartida").dataset.apuCategory).toBe("SUBPARTIDA");
    expect(getIndicatorForRow("row-subpartida").className).toContain("bg-violet-50/90");
  });

  it("keeps the color indicator visible in readonly rows even without drag grip", async () => {
    const partida = createReadonlyPartida();
    const { getByTestId, getIndicatorForRow } = await renderSheet(partida);

    expect(getIndicatorForRow("row-labor").dataset.apuCategory).toBe("LABOR");
    expect(getIndicatorForRow("row-labor").className).toContain("bg-emerald-50/90");
    expect(getByTestId("partida-apu-add-resource-search").getAttribute("disabled")).not.toBeNull();
    expect(getByTestId("partida-apu-add-manual-row-button").getAttribute("disabled")).not.toBeNull();
  });

  it("uses the same editor base language as the budget APU and keeps search enabled for editable partidas", async () => {
    const partida = createPartida();
    const { getByTestId, getHeadingByText, getTextByExactMatch } = await renderSheet(partida);

    expect(getTextByExactMatch("Editor APU")).toBeTruthy();
    expect(getHeadingByText("Partida demo")).toBeTruthy();
    expect(getByTestId("partida-apu-add-resource-search").getAttribute("disabled")).toBeNull();
    expect(getByTestId("partida-apu-add-manual-row-button").getAttribute("disabled")).toBeNull();
  });

  it("closes when clicking outside the off-canvas", async () => {
    const onClose = vi.fn();
    const partida = createPartida();
    const { getByTestId } = await renderSheet(partida, { onClose });

    await act(async () => {
      getByTestId("partida-apu-overlay").click();
    });

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

async function renderSheet(partida: CatalogPartidaRecord, overrides?: { onClose?: () => void }) {
  const nextContainer = document.createElement("div");
  document.body.appendChild(nextContainer);
  activeContainer = nextContainer;

  const root = createRoot(nextContainer);
  (nextContainer as HTMLDivElement & { __root?: typeof root }).__root = root;

  await act(async () => {
    root.render(
      <FormattingSettingsProvider settings={createSettings()}>
        <PartidaApuSheet partida={partida} open onClose={overrides?.onClose ?? (() => undefined)} onChange={() => undefined} resourcesCatalog={[]} />
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
    getHeadingByText: (text: string) => {
      const element = [...document.querySelectorAll("h3")].find((candidate) => candidate.textContent?.trim() === text);
      if (!(element instanceof HTMLElement)) {
        throw new Error(`Missing heading: ${text}`);
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
    getIndicatorForRow: (rowId: string) => {
      const element = document.querySelector(`[data-testid='partida-apu-row-indicator-${rowId}']`);
      if (!(element instanceof HTMLElement)) {
        throw new Error(`Missing indicator: ${rowId}`);
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

function createPartida(): CatalogPartidaRecord {
  return {
    id: "partida-1",
    description: "Partida demo",
    unit: "m2",
    unitPrice: 0,
    currency: "PEN",
    source: "Catalogo editable",
    performance: 8,
    apuRows: [
      createPartidaRow("row-labor", "LABOR", 1.5, 20),
      createPartidaRow("row-material", "MATERIAL", 2, 15.5),
      createPartidaRow("row-equipment", "EQUIPMENT", 0.5, 80),
      createPartidaRow("row-tools", "TOOLS", 0.1, 50),
      createPartidaRow("row-subcontract", "SUBCONTRACT", 1, 200),
      createPartidaRow("row-subpartida", "SUBPARTIDA", 1, 125),
    ],
  };
}

function createReadonlyPartida(): CatalogPartidaRecord {
  return {
    ...createPartida(),
    source: "Catalogo de partidas precargado",
  };
}

function createPartidaRow(id: string, resourceType: string, quantity: number, unitPrice: number) {
  return {
    id,
    catalogPartidaId: "partida-1",
    description: id,
    unit: "glb",
    crew: null,
    quantity,
    unitPrice,
    subtotal: 0,
    resourceType,
    groupLabel: undefined,
    sortOrder: 0,
  };
}
