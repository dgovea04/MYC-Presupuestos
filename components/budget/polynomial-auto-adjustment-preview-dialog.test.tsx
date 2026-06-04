// @vitest-environment jsdom

import React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PolynomialAutoAdjustmentPreviewDialog } from "@/components/budget/polynomial-auto-adjustment-preview-dialog";
import type { FinalAdjustmentResult } from "@/lib/polynomial-formula/final-adjustment-types";
import type { PolynomialMonomialRecord } from "@/types/polynomial-formula";

describe("PolynomialAutoAdjustmentPreviewDialog", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("renders counts and merge explanation, then applies when allowed", async () => {
    const onApply = vi.fn();
    const onClose = vi.fn();

    await renderDialog({
      open: true,
      preview: createPreview(),
      onApply,
      onClose,
    });

    expect(getText("Ajuste automatico de formula")).toBeTruthy();
    expect(getText("4 actuales")).toBeTruthy();
    expect(getText("3 propuestos")).toBeTruthy();
    expect(getText("Pintura se agrupa en Acabados por familia compatible.")).toBeTruthy();
    expect(getText("BA")).toBeTruthy();
    expect(getText("Acabados")).toBeTruthy();
    expect(getText("0.120")).toBeTruthy();

    await act(async () => {
      getButton("Aplicar propuesta").click();
    });

    expect(onApply).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("disables apply and shows error diagnostics in rose styling when blocked", async () => {
    await renderDialog({
      open: true,
      preview: createPreview({
        canApply: false,
        diagnostics: [
          {
            code: "LOW_COEFFICIENT_UNRESOLVED",
            severity: "ERROR",
            message: "Coeficiente bajo sin resolver",
          },
        ],
      }),
      onApply: vi.fn(),
      onClose: vi.fn(),
    });

    const applyButton = getButton("Aplicar propuesta");
    const errorDiagnostic = getText("Coeficiente bajo sin resolver");

    expect(applyButton.disabled).toBe(true);
    expect(errorDiagnostic.className).toContain("text-rose-700");
  });

  async function renderDialog(props: React.ComponentProps<typeof PolynomialAutoAdjustmentPreviewDialog>) {
    await act(async () => {
      root.render(<PolynomialAutoAdjustmentPreviewDialog {...props} />);
    });
  }
});

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

function getButton(text: string) {
  const button = [...document.querySelectorAll("button")].find((candidate) => candidate.textContent?.includes(text));

  if (!(button instanceof HTMLButtonElement)) {
    throw new Error(`Missing button: ${text}`);
  }

  return button;
}

function getText(text: string) {
  const element = [...document.querySelectorAll("button, h1, h2, p, th, td, li")].find((candidate) =>
    candidate.textContent?.includes(text),
  );

  if (!(element instanceof HTMLElement)) {
    throw new Error(`Missing text: ${text}`);
  }

  return element;
}

function createMonomial(input: {
  id: string;
  code: string;
  name: string;
  coefficient: string;
}): PolynomialMonomialRecord {
  return {
    id: input.id,
    formulaId: "formula-1",
    code: input.code,
    name: input.name,
    costGroupKey: "MATERIALS",
    amount: "100.0000",
    coefficient: input.coefficient,
    baseIndexCode: input.code,
    baseIndexName: input.name,
    baseIndexValue: "100",
    adjustmentIndexCode: null,
    adjustmentIndexName: null,
    adjustmentIndexValue: null,
    sortOrder: 0,
    composition: [],
  };
}

function createPreview(
  overrides?: Partial<FinalAdjustmentResult>,
): FinalAdjustmentResult {
  return {
    originalMonomials: [
      createMonomial({ id: "mo", code: "MO", name: "Mano de obra", coefficient: "0.390" }),
      createMonomial({ id: "ce", code: "CE", name: "Cemento", coefficient: "0.240" }),
      createMonomial({ id: "pi", code: "PI", name: "Pintura", coefficient: "0.030" }),
      createMonomial({ id: "gg", code: "GG", name: "Gastos generales", coefficient: "0.340" }),
    ],
    finalMonomials: [
      createMonomial({ id: "mo", code: "MO", name: "Mano de obra", coefficient: "0.390" }),
      createMonomial({ id: "ba", code: "BA", name: "Acabados", coefficient: "0.120" }),
      createMonomial({ id: "gg", code: "GG", name: "Gastos generales", coefficient: "0.490" }),
    ],
    mergePlan: [
      {
        targetMonomialId: "ba",
        sourceMonomialIds: ["pi"],
        reason: "COMPATIBLE_FAMILY",
        explanation: "Pintura se agrupa en Acabados por familia compatible.",
      },
    ],
    diagnostics: [
      {
        code: "LOW_COEFFICIENT_MERGED",
        severity: "INFO",
        message: "Se resolvio el coeficiente minimo.",
      },
    ],
    canApply: true,
    ...overrides,
  };
}
