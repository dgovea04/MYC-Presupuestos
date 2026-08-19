/* @vitest-environment jsdom */

import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BudgetFlowWrapper } from "@/components/budget/budget-flow-wrapper";
import type { BudgetRecord } from "@/types/budget";
import type { CatalogPartidaRecord } from "@/types/partida";

const budgetFlowMock = vi.hoisted(() => ({
  render: vi.fn(() => <div data-testid="budget-flow" />),
}));

vi.mock("@/components/budget/budget-flow", () => ({
  BudgetFlow: budgetFlowMock.render,
}));

let activeContainer: HTMLDivElement | null = null;

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe("BudgetFlowWrapper", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    budgetFlowMock.render.mockClear();
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

    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("reloads editor catalogs when the user returns from the partida generator", async () => {
    const initialPartida = createCatalogPartida("partida-inicial", "Partida inicial");
    const generatedPartida = createCatalogPartida("partida-generada", "Partida generada por similitud");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(createCatalogResponse([initialPartida]))
      .mockResolvedValueOnce(createCatalogResponse([initialPartida, generatedPartida]));
    vi.stubGlobal("fetch", fetchMock);

    await renderWrapper({ partidasCatalog: [initialPartida], catalogBudgetId: "budget-1" });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(600);
    });

    expect(readLatestPartidaDescriptions()).toEqual(["Partida inicial"]);

    await act(async () => {
      window.dispatchEvent(new Event("focus"));
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(readLatestPartidaDescriptions()).toEqual(["Partida inicial", "Partida generada por similitud"]);
  });
});

async function renderWrapper(props: Partial<React.ComponentProps<typeof BudgetFlowWrapper>> = {}) {
  const nextContainer = document.createElement("div");
  document.body.appendChild(nextContainer);
  activeContainer = nextContainer;

  const root = createRoot(nextContainer);
  (nextContainer as HTMLDivElement & { __root?: typeof root }).__root = root;

  await act(async () => {
    root.render(
      <BudgetFlowWrapper
        budget={createBudget()}
        partidasCatalog={[]}
        resourcesCatalog={[]}
        {...props}
      />,
    );
  });
}

function readLatestPartidaDescriptions() {
  const latestCall = budgetFlowMock.render.mock.calls.at(-1);
  const latestProps = latestCall?.[0] as { partidasCatalog?: CatalogPartidaRecord[] } | undefined;
  return latestProps?.partidasCatalog?.map((partida) => partida.description) ?? [];
}

function createCatalogResponse(partidasCatalog: CatalogPartidaRecord[]) {
  return {
    ok: true,
    json: async () => ({ partidasCatalog, resourcesCatalog: [] }),
  };
}

function createBudget(): BudgetRecord {
  return {
    id: "budget-1",
    projectId: "project-1",
    parentBudgetId: null,
    kind: "SUB_BUDGET",
    name: "Subpresupuesto",
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

function createCatalogPartida(id: string, description: string): CatalogPartidaRecord {
  return {
    id,
    code: id,
    description,
    unit: "m2",
    unitPrice: 10,
    performance: 1,
    performanceRate: "1 m2/dia",
    source: "Test",
    apuRows: [],
  };
}
