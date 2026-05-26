/* @vitest-environment jsdom */

import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { RiskAnalysisDashboard } from "@/components/risk/risk-analysis-dashboard";
import type { RiskAnalysisPayload } from "@/types/risk";

let activeContainer: HTMLDivElement | null = null;

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe("RiskAnalysisDashboard", () => {
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
  });

  it("renders risk dashboard without simulation results", async () => {
    const { getByText } = await renderRiskAnalysisDashboard();

    expect(getByText("Riesgos Monte Carlo")).toBeTruthy();
    expect(getByText("Excavacion")).toBeTruthy();
    expect(getByText("Ejecuta una simulacion para ver el histograma.")).toBeTruthy();
  });
});

async function renderRiskAnalysisDashboard() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  activeContainer = container;

  const root = createRoot(container);
  (container as HTMLDivElement & { __root?: typeof root }).__root = root;

  await act(async () => {
    root.render(<RiskAnalysisDashboard currencyDecimals={2} payload={createPayload()} />);
  });

  return {
    getByText: (text: string) => {
      const element = [...container.querySelectorAll("*")].find((candidate) => candidate.textContent === text);

      if (!(element instanceof HTMLElement)) {
        throw new Error(`Missing element: ${text}`);
      }

      return element;
    },
  };
}

function createPayload(): RiskAnalysisPayload {
  return {
    budget: {
      id: "budget-1",
      projectId: "project-1",
      name: "Presupuesto General",
      kind: "GENERAL",
      currency: "PEN",
      baseTotal: 1000,
    },
    items: [
      {
        itemId: "item-1",
        budgetId: "child-1",
        sourceBudgetName: "Estructuras",
        code: "01.01",
        description: "Excavacion",
        unit: "m3",
        baseQuantity: 10,
        unitPrice: 100,
        baseTotal: 1000,
      },
    ],
    variables: [],
    latestRun: null,
  };
}
