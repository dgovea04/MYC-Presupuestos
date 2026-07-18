/* @vitest-environment jsdom */

import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RiskAnalysisDashboard } from "@/components/risk/risk-analysis-dashboard";
import {
  MONTE_CARLO_ITERATIONS,
  type RiskAnalysisPayload,
  type RiskSimulationSummary,
  type RiskVariableSuggestion,
} from "@/types/risk";

const { runRiskSimulationWorkerMock } = vi.hoisted(() => ({
  runRiskSimulationWorkerMock: vi.fn(),
}));

vi.mock("@/lib/risk/monte-carlo-worker-client", () => ({
  runRiskSimulationWorker: runRiskSimulationWorkerMock,
}));

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

vi.mock("@/components/risk/tornado-chart", () => ({
  TornadoChart: (props: { rows?: Array<unknown> }) =>
    React.createElement(
      "div",
      null,
      props.rows?.length ? "Tornado con datos" : "Activa variables para ver sensibilidad.",
    ),
}));

vi.mock("@/components/risk/box-plot-chart", () => ({
  BoxPlotChart: (props: { result?: unknown }) =>
    React.createElement(
      "div",
      null,
      props.result ? "Box plot con datos" : "Ejecuta una simulacion para ver el box plot.",
    ),
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
  beforeEach(() => {
    runRiskSimulationWorkerMock.mockReset();
    vi.restoreAllMocks();
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
  });

  it("renders risk dashboard without simulation results", async () => {
    const { getByText } = await renderRiskAnalysisDashboard();

    expect(getByText("Riesgos Monte Carlo")).toBeTruthy();
    expect(getByText("Excavacion")).toBeTruthy();
    expect(getByText("Cantidad")).toBeTruthy();
    expect(getByText("Precio unitario")).toBeTruthy();
    expect(getByText("Ejecuta una simulacion para ver el histograma.")).toBeTruthy();
    expect(getByText("Promedio")).toBeTruthy();
    expect(getByText("Mediana")).toBeTruthy();
    expect(getByText("Asimetria")).toBeTruthy();
    expect(getByText("Correlaciones")).toBeTruthy();
    expect(getByText("Este analisis de riesgo no tiene un cronograma general vinculado para cruzar ruta critica y variables.")).toBeTruthy();
    expect(getByText("Activa variables para ver sensibilidad.")).toBeTruthy();
    expect(getByText("Ejecuta una simulacion para ver el box plot.")).toBeTruthy();
  });

  it("collapses the whole quality panel by default and expands it on demand", async () => {
    const { container, getByLabelText, getByTestId } = await renderRiskAnalysisDashboard();

    const qualityPanel = getByTestId("risk-validation-panel");
    expect(qualityPanel.getAttribute("data-collapsed")).toBe("true");
    expect(container.textContent).not.toContain("Control de calidad");
    expect(container.textContent).not.toContain("Variables listas para simulacion.");

    await act(async () => {
      getByLabelText("Expandir control de calidad").click();
    });

    expect(qualityPanel.getAttribute("data-collapsed")).toBe("false");
    expect(container.textContent).toContain("Control de calidad");
    expect(container.textContent).toContain("Variables listas para simulacion.");
  });

  it("persists the worker summary payload after a successful simulation", async () => {
    const summary = createSimulationSummary();
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ ...summary, id: "run-1", createdAt: "2026-07-02T00:00:00.000Z" }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    runRiskSimulationWorkerMock.mockImplementation(
      ({ onResult }: { onResult: (result: RiskSimulationSummary) => void }) => {
        onResult(summary);
        return { cancel: () => undefined };
      },
    );

    const { getByText } = await renderRiskAnalysisDashboard(createPayloadWithVariable());

    await act(async () => {
      getByText("Ejecutar simulacion").click();
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/budgets/budget-1/risk-analysis/runs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(summary),
    });
  });

  it("shows the api error when persisting a completed simulation fails", async () => {
    const summary = createSimulationSummary();
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ error: "La simulacion no corresponde al presupuesto seleccionado." }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    runRiskSimulationWorkerMock.mockImplementation(
      ({ onResult }: { onResult: (result: RiskSimulationSummary) => void }) => {
        onResult(summary);
        return { cancel: () => undefined };
      },
    );

    const { container, getByText } = await renderRiskAnalysisDashboard(createPayloadWithVariable());

    await act(async () => {
      getByText("Ejecutar simulacion").click();
      await Promise.resolve();
    });

    expect(container.textContent).toContain("La simulacion no corresponde al presupuesto seleccionado.");
  });

  it("requests Khipu risk suggestions for review", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ suggestions: [createSuggestion()] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { container, getByText } = await renderRiskAnalysisDashboard();

    await act(async () => {
      getByText("Sugerir variables").click();
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/budgets/budget-1/risk-analysis/suggestions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ strategy: "balanced", maxSuggestions: 12 }),
    });
    expect(container.textContent).toContain("Partida de alto impacto.");
  });

  it("does not render stale Khipu suggestions after switching to a newer budget request", async () => {
    const staleSuggestionsResponse = createDeferred<Response>();
    const currentSuggestionsResponse = createDeferred<Response>();
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockReturnValueOnce(staleSuggestionsResponse.promise)
      .mockReturnValueOnce(currentSuggestionsResponse.promise);
    vi.stubGlobal("fetch", fetchMock);

    const { container, getByText, rerender } = await renderRiskAnalysisDashboard();

    await act(async () => {
      getByText("Sugerir variables").click();
    });

    await rerender(createPayload("budget-2"));

    await act(async () => {
      getByText("Sugerir variables").click();
    });

    await act(async () => {
      currentSuggestionsResponse.resolve(
        new Response(JSON.stringify({ suggestions: [createSuggestion("current-suggestion", "budget-2", "Sugerencia vigente.")] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
      await currentSuggestionsResponse.promise;
    });

    expect(container.textContent).toContain("Sugerencia vigente.");

    await act(async () => {
      staleSuggestionsResponse.resolve(
        new Response(JSON.stringify({ suggestions: [createSuggestion("stale-suggestion", "budget-1", "Sugerencia obsoleta.")] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
      await staleSuggestionsResponse.promise;
    });

    expect(container.textContent).toContain("Sugerencia vigente.");
    expect(container.textContent).not.toContain("Sugerencia obsoleta.");
  });

  it("saves accepted Khipu suggestions as an approved agent scenario without running simulation", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ suggestions: [createSuggestion()] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: "scenario-1", budgetId: "budget-1", name: "Escenario Khipu aprobado" }), {
          status: 201,
          headers: { "Content-Type": "application/json" },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const { getByText } = await renderRiskAnalysisDashboard();

    await act(async () => {
      getByText("Sugerir variables").click();
      await Promise.resolve();
    });
    await act(async () => {
      getByText("Guardar escenario aprobado").click();
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenLastCalledWith("/api/budgets/budget-1/risk-analysis/scenarios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Escenario Khipu aprobado",
        description: "Variables de riesgo revisadas y aprobadas desde Khipu.",
        source: "AGENT",
        status: "APPROVED",
        variables: [
          {
            id: "suggestion-1",
            budgetItemId: "item-1",
            variableType: "QUANTITY",
            distributionType: "PERT",
            minimum: 9.5,
            mostLikely: 10,
            maximum: 11,
            enabled: true,
            source: "HEURISTIC",
            confidence: 0.8,
            rationale: "Partida de alto impacto.",
          },
        ],
        correlations: [],
      }),
    });
    expect(runRiskSimulationWorkerMock).not.toHaveBeenCalled();
  });
});

async function renderRiskAnalysisDashboard(payload: RiskAnalysisPayload = createPayload()) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  activeContainer = container;

  const root = createRoot(container);
  (container as HTMLDivElement & { __root?: typeof root }).__root = root;

  await act(async () => {
    root.render(<RiskAnalysisDashboard currencyDecimals={2} payload={payload} />);
  });

  // Flush useEffect from the mocked next/dynamic wrapper so dynamic imports resolve
  await act(async () => {
    await Promise.resolve();
  });

  return {
    container,
    rerender: async (nextPayload: RiskAnalysisPayload) => {
      await act(async () => {
        root.render(<RiskAnalysisDashboard currencyDecimals={2} payload={nextPayload} />);
      });

      await act(async () => {
        await Promise.resolve();
      });
    },
    getByText: (text: string) => {
      const element = [...container.querySelectorAll("*")].find((candidate) => candidate.textContent === text);

      if (!(element instanceof HTMLElement)) {
        throw new Error(`Missing element: ${text}`);
      }

      return element;
    },
    getByLabelText: (text: string) => {
      const element = [...container.querySelectorAll("*")].find(
        (candidate) => candidate.getAttribute("aria-label") === text,
      );

      if (!(element instanceof HTMLElement)) {
        throw new Error(`Missing element by label: ${text}`);
      }

      return element;
    },
    getByTestId: (testId: string) => {
      const element = container.querySelector(`[data-testid="${testId}"]`);

      if (!(element instanceof HTMLElement)) {
        throw new Error(`Missing test id: ${testId}`);
      }

      return element;
    },
  };
}

function createPayload(budgetId = "budget-1"): RiskAnalysisPayload {
  return {
    budget: {
      id: budgetId,
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
    correlations: [],
    latestRun: null,
  };
}

function createPayloadWithVariable(): RiskAnalysisPayload {
  return {
    ...createPayload(),
    variables: [
      {
        id: "var-1",
        budgetId: "budget-1",
        budgetItemId: "item-1",
        variableType: "QUANTITY",
        distributionType: "TRIANGULAR",
        minimum: 8,
        mostLikely: 10,
        maximum: 12,
        enabled: true,
      },
    ],
  };
}

function createSimulationSummary(): RiskSimulationSummary {
  return {
    budgetId: "budget-1",
    iterations: MONTE_CARLO_ITERATIONS,
    baseTotal: 1000,
    mean: 1035,
    median: 1030,
    variance: 225,
    standardDeviation: 15,
    skewness: 0.2,
    kurtosis: -0.1,
    p10: 980,
    p50: 1030,
    p80: 1080,
    p90: 1100,
    p95: 1120,
    histogramBins: [{ min: 980, max: 1020, midpoint: 1000, frequency: 2500, probability: 0.25 }],
    sCurvePoints: [
      { cost: 980, cumulativeProbability: 0.1 },
      { cost: 1030, cumulativeProbability: 0.5 },
      { cost: 1120, cumulativeProbability: 0.95 },
    ],
    scheduleDuration: null,
  };
}

function createSuggestion(id = "suggestion-1", budgetId = "budget-1", reason = "Partida de alto impacto."): RiskVariableSuggestion {
  return {
    id,
    budgetId,
    budgetItemId: "item-1",
    variableType: "QUANTITY",
    distributionType: "PERT",
    minimum: 9.5,
    mostLikely: 10,
    maximum: 11,
    confidence: 0.8,
    reason,
    source: "HEURISTIC",
    impactScore: 1000,
  };
}

function createDeferred<T>() {
  let resolvePromise: (value: T) => void = () => undefined;
  let rejectPromise: (reason?: unknown) => void = () => undefined;
  const promise = new Promise<T>((resolve, reject) => {
    resolvePromise = resolve;
    rejectPromise = reject;
  });

  return {
    promise,
    reject: rejectPromise,
    resolve: resolvePromise,
  };
}
