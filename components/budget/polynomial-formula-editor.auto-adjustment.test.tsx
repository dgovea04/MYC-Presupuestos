// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PolynomialFormulaEditor } from "@/components/budget/polynomial-formula-editor";
import { FormattingSettingsProvider } from "@/components/providers/formatting-settings-provider";
import { AppViewModeProvider } from "@/components/view-mode/app-view-mode-provider";
import type { PolynomialFormulaSectionData } from "@/types/budget-sections";
import type { UserSettingsRecord } from "@/types/settings";

let root: Root | null = null;
let container: HTMLDivElement | null = null;

beforeEach(() => {
  vi.useRealTimers();
});

afterEach(() => {
  if (root) {
    act(() => root?.unmount());
  }
  container?.remove();
  document.body.innerHTML = "";
  root = null;
  container = null;
  vi.restoreAllMocks();
});

describe("PolynomialFormulaEditor automatic adjustment", () => {
  it("previews the final proposal before replacing editable monomials", async () => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(new Response(JSON.stringify([]), { status: 200 }))));

    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root?.render(
        <FormattingSettingsProvider settings={settings()}>
          <AppViewModeProvider initialViewMode="modern">
            <PolynomialFormulaEditor
              section={section()}
              canUsePolynomialAdjustments={false}
            />
          </AppViewModeProvider>
        </FormattingSettingsProvider>,
      );
    });

    await act(async () => undefined);

    const autoButton = getButton("Aplicar ajuste automatico");

    await act(async () => {
      autoButton.click();
    });

    expect(document.body.textContent).toContain("Ajuste automatico de formula");
    expect(document.body.textContent).toContain("6 actuales");
    expect(document.body.textContent).toContain("5 propuestos");
    expect(document.body.querySelector("[data-testid='polynomial-auto-adjustment-scroll-area']")?.className).toContain("overflow-y-auto");
    expect(document.body.querySelector("[data-testid='polynomial-auto-adjustment-dialog-viewport']")?.className).toContain("overflow-hidden");
    expect(container.textContent).toContain("PI");

    await act(async () => {
      getButton("Cancelar").click();
    });

    expect(document.body.textContent).not.toContain("Ajuste automatico de formula");
    expect(container.textContent).toContain("PI");

    await act(async () => {
      getButton("Aplicar ajuste automatico").click();
    });
    await act(async () => {
      getButton("Aplicar propuesta").click();
    });

    expect(document.body.textContent).not.toContain("Ajuste automatico de formula");
    expect(container.textContent).not.toContain("PI");
    expect(container.textContent).toContain("5 monomios");
    expect(container.textContent).toContain("Ajuste automatico aplicado");
  });

  it("does not calculate K automatically before the user requests it", async () => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-15T12:00:00.000Z"));
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);

      if (url.includes("/api/unified-indices")) {
        return Promise.resolve(
          new Response(
            JSON.stringify([
              { code: "47", name: "Mano de obra", value: "105" },
              { code: "54", name: "Pintura", value: "106" },
              { code: "21", name: "Cemento", value: "107" },
              { code: "3", name: "Acero", value: "108" },
              { code: "16", name: "Acabados", value: "109" },
              { code: "39", name: "Indice general", value: "110" },
            ]),
            { status: 200 },
          ),
        );
      }

      if (url.includes("/api/polynomial-formulas/formula-1/calculate")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              kRaw: "1.0123",
              kRounded: "1.012",
              terms: [
                {
                  name: "Mano de obra",
                  coefficient: "0.250",
                  baseIndexValue: "100",
                  adjustmentIndexValue: "105",
                  ratio: "1.0500",
                  partial: "0.2625",
                },
              ],
            }),
            { status: 200 },
          ),
        );
      }

      return Promise.resolve(new Response(JSON.stringify([]), { status: 200 }));
    });
    vi.stubGlobal("fetch", fetchMock);

    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root?.render(
        <FormattingSettingsProvider settings={settings()}>
          <AppViewModeProvider initialViewMode="modern">
            <PolynomialFormulaEditor
              section={section()}
              canUsePolynomialAdjustments
            />
          </AppViewModeProvider>
        </FormattingSettingsProvider>,
      );
    });

    await act(async () => undefined);

    expect(
      fetchMock.mock.calls.some(
        ([input, init]) => String(input).includes("/calculate") || init?.method === "POST",
      ),
    ).toBe(false);

    const calculateButton = getButton("Calcular K");
    expect(calculateButton.disabled).toBe(false);

    expect(document.body.textContent).toContain("Calcular K");
  });

  it("loads adjustment history only after the user opens it", async () => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);

      if (url.includes("/api/unified-indices")) {
        return Promise.resolve(new Response(JSON.stringify([]), { status: 200 }));
      }

      if (url.includes("/api/polynomial-formulas/formula-1/adjustments")) {
        return Promise.resolve(
          new Response(
            JSON.stringify([
              {
                id: "adj-1",
                formulaId: "formula-1",
                month: 1,
                year: 2026,
                originalAmount: "100000.00",
                kRounded: "1.012",
                adjustedAmount: "101200.00",
                adjustmentAmount: "1200.00",
                terms: [],
                createdAt: "2026-01-15T00:00:00.000Z",
              },
            ]),
            { status: 200 },
          ),
        );
      }

      return Promise.resolve(new Response(JSON.stringify([]), { status: 200 }));
    });
    vi.stubGlobal("fetch", fetchMock);

    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root?.render(
        <FormattingSettingsProvider settings={settings()}>
          <AppViewModeProvider initialViewMode="modern">
            <PolynomialFormulaEditor
              section={section()}
              canUsePolynomialAdjustments
            />
          </AppViewModeProvider>
        </FormattingSettingsProvider>,
      );
    });

    await act(async () => undefined);

    expect(fetchMock.mock.calls.some(([input]) => String(input).includes("/adjustments"))).toBe(false);

    await act(async () => {
      getButton("Mostrar historial").click();
    });

    expect(fetchMock.mock.calls.some(([input]) => String(input).includes("/adjustments"))).toBe(true);
  });

  it("reuses cached history when the same sub budget editor remounts", async () => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);

      if (url.includes("/api/unified-indices")) {
        return Promise.resolve(new Response(JSON.stringify([]), { status: 200 }));
      }

      if (url.includes("/api/polynomial-formulas/formula-1/adjustments")) {
        return Promise.resolve(
          new Response(
            JSON.stringify([
              {
                id: "adj-1",
                formulaId: "formula-1",
                month: 1,
                year: 2026,
                originalAmount: "100000.00",
                kRounded: "1.012",
                adjustedAmount: "101200.00",
                adjustmentAmount: "1200.00",
                terms: [],
                createdAt: "2026-01-15T00:00:00.000Z",
              },
            ]),
            { status: 200 },
          ),
        );
      }

      return Promise.resolve(new Response(JSON.stringify([]), { status: 200 }));
    });
    vi.stubGlobal("fetch", fetchMock);

    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    const remountSection = section("Formula remount cache");

    await renderEditor(remountSection);
    await act(async () => undefined);

    await act(async () => {
      getButton("Mostrar historial").click();
    });

    expect(countAdjustmentRequests(fetchMock)).toBe(1);
    expect(container.textContent).toContain("101,200.00");

    act(() => root?.unmount());
    container.remove();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    await renderEditor(remountSection);
    await act(async () => undefined);

    expect(container.textContent).toContain("101,200.00");
    expect(countAdjustmentRequests(fetchMock)).toBe(1);
    expect(getButton("Ocultar historial")).toBeTruthy();
  });

  it("reuses the cached formula draft and base indices when the same sub budget editor remounts", async () => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);

      if (url.includes("/api/unified-indices")) {
        return Promise.resolve(
          new Response(
            JSON.stringify([{ code: "47", name: "Mano de obra", value: "105" }]),
            { status: 200 },
          ),
        );
      }

      return Promise.resolve(new Response(JSON.stringify([]), { status: 200 }));
    });
    vi.stubGlobal("fetch", fetchMock);

    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    const remountSection = section("Formula local cache");
    remountSection.formula.baseMonth = 12;
    remountSection.formula.baseYear = 2035;

    await renderEditor(remountSection);
    await act(async () => undefined);

    const formulaNameInput = getInputByValue("Formula");

    await act(async () => {
      setNativeInputValue(formulaNameInput, "Formula editada localmente");
      formulaNameInput.dispatchEvent(new Event("input", { bubbles: true }));
    });

    expect(formulaNameInput.value).toBe("Formula editada localmente");
    expect(countUnifiedIndexRequests(fetchMock)).toBe(1);

    act(() => root?.unmount());
    container.remove();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    await renderEditor(remountSection);
    await act(async () => undefined);

    expect(getInputByValue("Formula editada localmente").value).toBe("Formula editada localmente");
    expect(countUnifiedIndexRequests(fetchMock)).toBe(1);
  });

  it("reuses the cached K preview when the same sub budget editor remounts", async () => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);

      if (url.includes("/api/unified-indices")) {
        return Promise.resolve(
          new Response(
            JSON.stringify([
              { code: "47", name: "Mano de obra", value: "105" },
              { code: "54", name: "Pintura", value: "106" },
              { code: "21", name: "Cemento", value: "107" },
              { code: "3", name: "Acero", value: "108" },
              { code: "16", name: "Acabados", value: "109" },
              { code: "39", name: "Indice general", value: "110" },
            ]),
            { status: 200 },
          ),
        );
      }

      if (url.includes("/api/polynomial-formulas/formula-1/calculate")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              kRaw: "1.0123",
              kRounded: "1.012",
              terms: [
                {
                  name: "Mano de obra",
                  coefficient: "0.250",
                  baseIndexValue: "100",
                  adjustmentIndexValue: "105",
                  ratio: "1.0500",
                  partial: "0.2625",
                },
              ],
            }),
            { status: 200 },
          ),
        );
      }

      return Promise.resolve(new Response(JSON.stringify([]), { status: 200 }));
    });
    vi.stubGlobal("fetch", fetchMock);

    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    const remountSection = section("Formula k cache");
    remountSection.formula.baseMonth = 11;
    remountSection.formula.baseYear = 2036;

    await renderEditor(remountSection);
    await act(async () => undefined);

    await act(async () => {
      getButton("Calcular K").click();
    });
    await act(async () => undefined);

    expect(container.textContent).toContain("K redondeado");
    expect(container.textContent).toContain("1.012");
    expect(countCalculateRequests(fetchMock)).toBe(1);

    act(() => root?.unmount());
    container.remove();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    await renderEditor(remountSection);
    await act(async () => undefined);

    expect(container.textContent).toContain("K redondeado");
    expect(container.textContent).toContain("1.012");
    expect(countCalculateRequests(fetchMock)).toBe(1);
  });
});

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

function getButton(text: string) {
  const button = [...document.body.querySelectorAll("button")].find((candidate) =>
    candidate.textContent?.includes(text),
  );

  if (!(button instanceof HTMLButtonElement)) {
    throw new Error(`Missing button: ${text}`);
  }

  return button;
}

function getInputByValue(value: string) {
  const input = [...document.body.querySelectorAll("input")].find((candidate) => candidate.value === value);

  if (!(input instanceof HTMLInputElement)) {
    throw new Error(`Missing input value: ${value}`);
  }

  return input;
}

function setNativeInputValue(input: HTMLInputElement, value: string) {
  const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");

  descriptor?.set?.call(input, value);
}

function countAdjustmentRequests(fetchMock: ReturnType<typeof vi.fn>) {
  return fetchMock.mock.calls.filter(([input]) => String(input).includes("/adjustments")).length;
}

function countUnifiedIndexRequests(fetchMock: ReturnType<typeof vi.fn>) {
  return fetchMock.mock.calls.filter(([input]) => String(input).includes("/api/unified-indices")).length;
}

function countCalculateRequests(fetchMock: ReturnType<typeof vi.fn>) {
  return fetchMock.mock.calls.filter(([input]) => String(input).includes("/calculate")).length;
}

async function renderEditor(nextSection: PolynomialFormulaSectionData = section()) {
  await act(async () => {
    root?.render(
      <FormattingSettingsProvider settings={settings()}>
        <AppViewModeProvider initialViewMode="modern">
          <PolynomialFormulaEditor
            section={nextSection}
            canUsePolynomialAdjustments
          />
        </AppViewModeProvider>
      </FormattingSettingsProvider>,
    );
  });
}

function settings(): UserSettingsRecord {
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
    defaultSubBudgetNames: ["Estructuras", "Arquitectura"],
  };
}

function section(title = "Formula polinomica"): PolynomialFormulaSectionData {
  return {
    id: "polynomial",
    title,
    budgetId: "budget-1",
    currency: "PEN",
    coefficients: [],
    summary: {
      hasFormula: true,
      monomialCount: 6,
      totalBaseAmount: "1000.0000",
      status: "DRAFT",
    },
    formula: {
      id: "formula-1",
      budgetId: "budget-1",
      name: "Formula",
      baseMonth: 1,
      baseYear: 2026,
      totalBaseAmount: "1000.0000",
      status: "DRAFT",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      monomials: [
        {
          id: "mo",
          formulaId: "formula-1",
          code: "MO",
          name: "Mano de obra",
          costGroupKey: "LABOR",
          amount: "250.0000",
          coefficient: "0.250",
          baseIndexCode: "47",
          baseIndexName: "Mano de obra",
          baseIndexValue: "100",
          adjustmentIndexCode: null,
          adjustmentIndexName: null,
          adjustmentIndexValue: null,
          sortOrder: 0,
          composition: [],
        },
        {
          id: "paint",
          formulaId: "formula-1",
          code: "PI",
          name: "Pintura",
          costGroupKey: "MATERIALS",
          amount: "30.0000",
          coefficient: "0.030",
          baseIndexCode: "54",
          baseIndexName: "Pintura",
          baseIndexValue: "100",
          adjustmentIndexCode: null,
          adjustmentIndexName: null,
          adjustmentIndexValue: null,
          sortOrder: 1,
          composition: [
            {
              id: "paint-component",
              monomialId: "paint",
              amount: "30.0000",
              unifiedIndexCode: "54",
              unifiedIndexName: "Pintura",
              iuFamily: "FINISHES",
              participationPercentage: "1",
              coefficientContribution: "0.030",
            },
          ],
        },
        {
          id: "cement",
          formulaId: "formula-1",
          code: "CE",
          name: "Cemento",
          costGroupKey: "MATERIALS",
          amount: "140.0000",
          coefficient: "0.140",
          baseIndexCode: "21",
          baseIndexName: "Cemento",
          baseIndexValue: "100",
          adjustmentIndexCode: null,
          adjustmentIndexName: null,
          adjustmentIndexValue: null,
          sortOrder: 2,
          composition: [
            {
              id: "cement-component",
              monomialId: "cement",
              amount: "140.0000",
              unifiedIndexCode: "21",
              unifiedIndexName: "Cemento",
              iuFamily: "CEMENT",
              participationPercentage: "1",
              coefficientContribution: "0.140",
            },
          ],
        },
        {
          id: "steel",
          formulaId: "formula-1",
          code: "AC",
          name: "Acero",
          costGroupKey: "MATERIALS",
          amount: "110.0000",
          coefficient: "0.110",
          baseIndexCode: "3",
          baseIndexName: "Acero",
          baseIndexValue: "100",
          adjustmentIndexCode: null,
          adjustmentIndexName: null,
          adjustmentIndexValue: null,
          sortOrder: 3,
          composition: [
            {
              id: "steel-component",
              monomialId: "steel",
              amount: "110.0000",
              unifiedIndexCode: "3",
              unifiedIndexName: "Acero",
              iuFamily: "STEEL",
              participationPercentage: "1",
              coefficientContribution: "0.110",
            },
          ],
        },
        {
          id: "finish",
          formulaId: "formula-1",
          code: "AC",
          name: "Acabados",
          costGroupKey: "MATERIALS",
          amount: "320.0000",
          coefficient: "0.320",
          baseIndexCode: "16",
          baseIndexName: "Acabados",
          baseIndexValue: "100",
          adjustmentIndexCode: null,
          adjustmentIndexName: null,
          adjustmentIndexValue: null,
          sortOrder: 4,
          composition: [
            {
              id: "finish-component",
              monomialId: "finish",
              amount: "320.0000",
              unifiedIndexCode: "16",
              unifiedIndexName: "Acabados",
              iuFamily: "FINISHES",
              participationPercentage: "1",
              coefficientContribution: "0.320",
            },
          ],
        },
        {
          id: "gg",
          formulaId: "formula-1",
          code: "GG",
          name: "Gastos generales",
          costGroupKey: "GENERAL_EXPENSES_PROFIT",
          amount: "150.0000",
          coefficient: "0.150",
          baseIndexCode: "39",
          baseIndexName: "Indice general",
          baseIndexValue: "100",
          adjustmentIndexCode: null,
          adjustmentIndexName: null,
          adjustmentIndexValue: null,
          sortOrder: 5,
          composition: [],
        },
      ],
    },
  };
}
