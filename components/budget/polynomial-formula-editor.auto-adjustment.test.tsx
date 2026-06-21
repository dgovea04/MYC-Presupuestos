// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PolynomialFormulaEditor } from "@/components/budget/polynomial-formula-editor";
import { FormattingSettingsProvider } from "@/components/providers/formatting-settings-provider";
import { AppViewModeProvider } from "@/components/view-mode/app-view-mode-provider";
import type { PolynomialFormulaSectionData } from "@/types/budget-sections";
import type { UserSettingsRecord } from "@/types/settings";

let root: Root | null = null;
let container: HTMLDivElement | null = null;

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
              adjustments={[]}
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

function section(): PolynomialFormulaSectionData {
  return {
    id: "polynomial",
    title: "Formula polinomica",
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
