/* @vitest-environment jsdom */

import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RiskAnalysisDashboard } from "@/components/risk/risk-analysis-dashboard";
import type { RiskAnalysisPayload } from "@/types/risk";

// Mock dynamically imported chart modules so they resolve synchronously
vi.mock("@/components/risk/histogram-chart", () => ({
  HistogramChart: (props: Record<string, unknown>) =>
    React.createElement(
      "div",
      null,
      props.result ? "Chart with data" : "Ejecuta una simulacion para ver el histograma.",
    ),
}));

vi.mock("@/components/risk/s-curve-chart", () => ({
  SCurveChart: () => React.createElement("div", null, "Curva S placeholder"),
}));

// Mock next/dynamic to synchronously render components via useEffect+useState
vi.mock("next/dynamic", () => ({
  default: (importFn: () => Promise<React.ComponentType | { default: React.ComponentType }>) => {
    const DynamicWrapper = (props: Record<string, unknown>) => {
      const [Comp, setComp] = React.useState<React.ComponentType | null>(null);
      React.useEffect(() => {
        let cancelled = false;
        importFn().then((mod) => {
          if (cancelled) return;
          const component =
            typeof mod === "function"
              ? mod
              : (mod as { default: React.ComponentType }).default ??
                (Object.values(mod as Record<string, React.ComponentType>)[0] as React.ComponentType);
          setComp(() => component);
        });
        return () => {
          cancelled = true;
        };
      }, []);
      return Comp ? React.createElement(Comp, props) : null;
    };
    DynamicWrapper.displayName = "DynamicMock";
    return DynamicWrapper;
  },
}));

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

  // Flush useEffect from the mocked next/dynamic wrapper so dynamic imports resolve
  await act(async () => {
    await Promise.resolve();
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
