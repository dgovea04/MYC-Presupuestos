/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RiskVariablesTable } from "@/components/risk/risk-variables-table";
import type { RiskBudgetItem, RiskVariableRecord } from "@/types/risk";

describe("RiskVariablesTable", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders one consolidated row per item with both variable summaries", () => {
    render(
      <RiskVariablesTable
        currency="PEN"
        currencyDecimals={2}
        items={[baseItem]}
        onEditVariable={vi.fn()}
        variables={createVariables()}
      />,
    );

    expect(screen.getAllByText("Distribucion").length).toBeGreaterThan(0);
    expect(screen.getByText("Resumen")).toBeTruthy();
    expect(screen.getAllByText("Triangular").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Normal").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Cantidad").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Precio unitario").length).toBeGreaterThan(0);
    expect(screen.getByText("8.0000 / 10.0000 / 12.0000")).toBeTruthy();
    expect(screen.getByText("20.0000 / 25.0000 / 30.0000")).toBeTruthy();
    expect(screen.getAllByText("Activa").length).toBeGreaterThan(0);
    expect(screen.getByText("1 de 1 filas")).toBeTruthy();
  });

  it("shows placeholders for both variables when an item has no risk configuration", () => {
    render(
      <RiskVariablesTable
        currency="PEN"
        currencyDecimals={2}
        items={[baseItem]}
        onEditVariable={vi.fn()}
        variables={[]}
      />,
    );

    expect(screen.getAllByText("-").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Sin variable").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Configura una variable para definir el rango.").length).toBeGreaterThan(0);
    expect(screen.getByText("1 de 1 filas")).toBeTruthy();
  });

  it("filters the consolidated rows by state, variable type, and distribution", () => {
    render(
      <RiskVariablesTable
        currency="PEN"
        currencyDecimals={2}
        items={[baseItem]}
        onEditVariable={vi.fn()}
        variables={createVariables()}
      />,
    );

    fireEvent.click(screen.getByRole("combobox", { name: "Filtrar por estado" }));
    fireEvent.click(screen.getByRole("option", { name: "Inactivas" }));

    expect(screen.getAllByText("Inactiva").length).toBeGreaterThan(0);
    expect(screen.queryByText("8.0000 / 10.0000 / 12.0000")).toBeNull();
    expect(screen.getByText("1 de 1 filas")).toBeTruthy();

    fireEvent.click(screen.getByRole("combobox", { name: "Filtrar por tipo" }));
    fireEvent.click(screen.getByRole("option", { name: "Precio unitario" }));

    expect(screen.getAllByText("Precio unitario").length).toBeGreaterThan(0);
    expect(screen.queryByText("8.0000 / 10.0000 / 12.0000")).toBeNull();

    fireEvent.click(screen.getByRole("combobox", { name: "Filtrar por distribucion" }));
    fireEvent.click(screen.getByRole("option", { name: "Normal" }));

    expect(screen.getAllByText("Normal").length).toBeGreaterThan(0);
    expect(screen.queryByText("8.0000 / 10.0000 / 12.0000")).toBeNull();
    expect(screen.getByText("20.0000 / 25.0000 / 30.0000")).toBeTruthy();
  });

  it("exposes separate edit actions for quantity and unit price in the same row", () => {
    const onEditVariable = vi.fn();

    render(
      <RiskVariablesTable
        currency="PEN"
        currencyDecimals={2}
        items={[baseItem]}
        onEditVariable={onEditVariable}
        variables={createVariables()}
      />,
    );

    const row = screen.getAllByText("Excavacion")[0]?.closest("tr");
    expect(row).toBeTruthy();

    const scopedRow = within(row!);

    fireEvent.click(scopedRow.getByRole("button", { name: "Editar cantidad" }));
    fireEvent.click(scopedRow.getByRole("button", { name: "Editar precio unitario" }));

    expect(onEditVariable).toHaveBeenNthCalledWith(1, "item-1:QUANTITY");
    expect(onEditVariable).toHaveBeenNthCalledWith(2, "item-1:UNIT_PRICE");
  });
});

const baseItem: RiskBudgetItem = {
  itemId: "item-1",
  budgetId: "budget-1",
  sourceBudgetName: "Estructuras",
  code: "01.01",
  description: "Excavacion",
  unit: "m3",
  baseQuantity: 10,
  unitPrice: 25,
  baseTotal: 250,
  updatedAt: "2026-07-01T00:00:00.000Z",
};

function createVariables(): RiskVariableRecord[] {
  return [
    {
      id: "risk-1",
      budgetId: "budget-1",
      budgetItemId: "item-1",
      variableType: "QUANTITY",
      distributionType: "TRIANGULAR",
      minimum: 8,
      mostLikely: 10,
      maximum: 12,
      enabled: true,
    },
    {
      id: "risk-2",
      budgetId: "budget-1",
      budgetItemId: "item-1",
      variableType: "UNIT_PRICE",
      distributionType: "NORMAL",
      minimum: 20,
      mostLikely: 25,
      maximum: 30,
      enabled: false,
    },
  ];
}
