/* @vitest-environment jsdom */

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RiskVariableModal } from "@/components/risk/risk-variable-modal";
import type { RiskBudgetItem, RiskVariableRecord } from "@/types/risk";

describe("RiskVariableModal", () => {
  it("shows price-unit context and defaults to the item unit price", () => {
    render(
      <RiskVariableModal
        item={baseItem}
        onClose={vi.fn()}
        onSave={vi.fn(async () => undefined)}
        variable={null}
        variableType="UNIT_PRICE"
      />,
    );

    expect(screen.getByText("01.01 | Excavacion | Precio unitario")).toBeTruthy();
    expect(screen.getByText("Base actual: 125.5 (precio unitario)")).toBeTruthy();
    expect(screen.getAllByDisplayValue("125.5")).toHaveLength(3);
  });

  it("shows quantity context and defaults to the item base quantity", () => {
    render(
      <RiskVariableModal
        item={baseItem}
        onClose={vi.fn()}
        onSave={vi.fn(async () => undefined)}
        variable={null}
        variableType="QUANTITY"
      />,
    );

    expect(screen.getByText("01.01 | Excavacion | Cantidad")).toBeTruthy();
    expect(screen.getByText("Base actual: 8.75 (cantidad)")).toBeTruthy();
    expect(screen.getAllByDisplayValue("8.75")).toHaveLength(3);
  });

  it("saves the selected distribution type", async () => {
    const onSave = vi.fn<(variable: RiskVariableRecord) => Promise<void>>(async () => undefined);

    render(
      <RiskVariableModal
        item={baseItem}
        onClose={vi.fn()}
        onSave={onSave}
        variable={null}
        variableType="QUANTITY"
      />,
    );

    fireEvent.click(screen.getByRole("combobox", { name: "Distribucion" }));
    fireEvent.click(screen.getByRole("option", { name: "PERT" }));
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        distributionType: "PERT",
        variableType: "QUANTITY",
      }),
    );
  });

  it("shows helper text for uniform distributions", () => {
    render(
      <RiskVariableModal
        item={baseItem}
        onClose={vi.fn()}
        onSave={vi.fn(async () => undefined)}
        variable={null}
        variableType="QUANTITY"
      />,
    );

    fireEvent.click(screen.getByRole("combobox", { name: "Distribucion" }));
    fireEvent.click(screen.getByRole("option", { name: "Uniforme" }));

    expect(
      screen.getByText("Uniforme reparte la misma probabilidad entre el minimo y el maximo."),
    ).toBeTruthy();
  });

  it("supports duration context with an explicit base value override", () => {
    render(
      <RiskVariableModal
        baseValueLabel="duracion"
        baseValueOverride={12}
        item={baseItem}
        onClose={vi.fn()}
        onSave={vi.fn(async () => undefined)}
        variable={null}
        variableType="DURATION"
      />,
    );

    expect(screen.getByText("01.01 | Excavacion | Duracion")).toBeTruthy();
    expect(screen.getByText("Base actual: 12 (duracion)")).toBeTruthy();
    expect(screen.getAllByDisplayValue("12")).toHaveLength(3);
  });
});

const baseItem: RiskBudgetItem = {
  itemId: "item-1",
  budgetId: "budget-1",
  sourceBudgetName: "Estructuras",
  code: "01.01",
  description: "Excavacion",
  unit: "m3",
  baseQuantity: 8.75,
  unitPrice: 125.5,
  baseTotal: 1098.125,
  updatedAt: "2026-07-01T00:00:00.000Z",
};
