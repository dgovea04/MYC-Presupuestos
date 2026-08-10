// @vitest-environment jsdom

import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PolynomialMonomialsTable } from "@/components/budget/polynomial-monomials-table";
import type { PolynomialMonomialRecord } from "@/types/polynomial-formula";

const viewModeState: { isExcelMode: boolean } = { isExcelMode: false };

vi.mock("@/components/view-mode/app-view-mode-provider", () => ({
  useAppViewMode: () => ({ isExcelMode: viewModeState.isExcelMode }),
}));

afterEach(() => {
  cleanup();
  viewModeState.isExcelMode = false;
});

describe("PolynomialMonomialsTable", () => {
  it("renders an initial compact window and expands the remaining monomials on demand", () => {
    render(
      <PolynomialMonomialsTable
        monomials={createMonomials(15)}
        baseIndexOptions={[]}
        baseIndicesLoading={false}
        currencyDecimals={2}
        onChangeMonomial={vi.fn()}
      />,
    );

    expect(screen.getByText("12 de 15 monomios")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Mostrar todos (3 restantes)" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Ver 3 monomios mas" })).toBeTruthy();
    expect(screen.queryByDisplayValue("Monomio 15")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Mostrar todos (3 restantes)" }));

    expect(screen.getByText("15 de 15 monomios")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Mostrar menos" })).toBeTruthy();
    expect(screen.getByDisplayValue("Monomio 15")).toBeTruthy();
  });

  // ─── Excel mode density contract (Task 9) ──────────────────────

  it("wraps the monomial table in the Excel table frame when Excel mode is active", () => {
    viewModeState.isExcelMode = true;

    render(
      <PolynomialMonomialsTable
        monomials={createMonomials(3)}
        baseIndexOptions={[]}
        baseIndicesLoading={false}
        currencyDecimals={2}
        onChangeMonomial={vi.fn()}
      />,
    );

    const frame = screen.getByTestId("polynomial-monomials-table-frame");
    const className = frame.getAttribute("class") ?? "";
    expect(className.split(/\s+/)).toContain("rounded-none");
  });

  it("uses the modern rounded frame in modern mode", () => {
    viewModeState.isExcelMode = false;

    render(
      <PolynomialMonomialsTable
        monomials={createMonomials(3)}
        baseIndexOptions={[]}
        baseIndicesLoading={false}
        currencyDecimals={2}
        onChangeMonomial={vi.fn()}
      />,
    );

    const frame = screen.getByTestId("polynomial-monomials-table-frame");
    const className = frame.getAttribute("class") ?? "";
    expect(className.split(/\s+/)).toContain("rounded-2xl");
  });

  it("renders a compact base-index skeleton while INEI indices are loading", () => {
    render(
      <PolynomialMonomialsTable
        monomials={createMonomials(3)}
        baseIndexOptions={[]}
        baseIndicesLoading
        currencyDecimals={2}
        onChangeMonomial={vi.fn()}
      />,
    );

    const loadingRegion = screen.getByRole("status", { name: "Cargando indices INEI del mes base" });
    expect(loadingRegion.getAttribute("aria-busy")).toBe("true");
    expect(document.body.textContent).not.toContain("Cargando indices INEI del mes base...");
    expect(loadingRegion.querySelector(".animate-spin")).toBeFalsy();
  });
});

function createMonomials(count: number): PolynomialMonomialRecord[] {
  return Array.from({ length: count }, (_, index) => {
    const numericId = index + 1;

    return {
      id: `monomial-${numericId}`,
      formulaId: "formula-1",
      code: `M${numericId}`,
      name: `Monomio ${numericId}`,
      costGroupKey: "MATERIALS",
      amount: `${1000 + numericId}.0000`,
      coefficient: "0.067",
      baseIndexCode: "39",
      baseIndexName: "INDICE GENERAL DE PRECIOS AL CONSUMIDOR",
      baseIndexValue: "100.000",
      adjustmentIndexCode: null,
      adjustmentIndexName: null,
      adjustmentIndexValue: null,
      sortOrder: index,
      composition: [],
    };
  });
}
