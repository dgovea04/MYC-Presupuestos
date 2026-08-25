/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PartidaOverview, type MetradoPartidaOption } from "@/components/metrados/MetradosDashboard";
import type { MetradoSheetRecord } from "@/types/metrado";

const partidas: MetradoPartidaOption[] = [
  { id: "item-1", projectId: "project-1", budgetId: "budget-1", code: "01.01", description: "Excavación manual", unit: "m3", quantity: 10 },
  { id: "item-2", projectId: "project-1", budgetId: "budget-1", code: "01.02", description: "Concreto armado", unit: "m3", quantity: 0 },
];

const advancedSheet = { id: "sheet-1", totalQuantity: 22, isActive: true, partidaLink: { budgetItemId: "item-2" } } as unknown as MetradoSheetRecord;

describe("PartidaOverview", () => {
  afterEach(() => cleanup());

  it("filters partidas and opens the selected sheet", () => {
    const onOpenPartida = vi.fn();

    const view = render(
      <PartidaOverview
        partidas={partidas}
        activeSheetByPartidaId={new Map([["item-2", advancedSheet]])}
        advancedQuantityOverrides={{}}
        search=""
        filter="all"
        onSearchChange={vi.fn()}
        onFilterChange={vi.fn()}
        onOpenPartida={onOpenPartida}
        onStartNewSheet={vi.fn()}
        onUpdateQuantity={vi.fn().mockResolvedValue(true)}
      />,
    );

    expect(screen.getByText("Excavación manual")).toBeTruthy();
    expect(screen.getByText("Concreto armado")).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Buscar partida"), { target: { value: "excavación" } });
    view.rerender(
      <PartidaOverview
        partidas={partidas.slice(0, 1)}
        activeSheetByPartidaId={new Map([["item-2", advancedSheet]])}
        advancedQuantityOverrides={{}}
        search="excavación"
        filter="all"
        onSearchChange={vi.fn()}
        onFilterChange={vi.fn()}
        onOpenPartida={onOpenPartida}
        onStartNewSheet={vi.fn()}
        onUpdateQuantity={vi.fn().mockResolvedValue(true)}
      />,
    );
    expect(screen.getAllByText("Excavación manual").length).toBeGreaterThan(0);
    expect(screen.queryByText("Concreto armado")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Abrir hoja" }));
    expect(onOpenPartida).toHaveBeenCalledWith(partidas[0]);
  });

  it("shows the latest advanced total supplied after saving", () => {
    render(
      <PartidaOverview
        partidas={partidas.slice(1)}
        activeSheetByPartidaId={new Map([["item-2", advancedSheet]])}
        advancedQuantityOverrides={{ "item-2": 27.75 }}
        search=""
        filter="all"
        onSearchChange={vi.fn()}
        onFilterChange={vi.fn()}
        onOpenPartida={vi.fn()}
        onStartNewSheet={vi.fn()}
        onUpdateQuantity={vi.fn().mockResolvedValue(true)}
      />,
    );

    const advancedQuantity = screen.getByLabelText("Metrado de Concreto armado");
    expect(advancedQuantity).toBeInstanceOf(HTMLButtonElement);
    expect(advancedQuantity.textContent).toBe("27.75");
    expect(screen.getByText("Avanzado")).toBeTruthy();
  });

  it("saves an inline manual quantity", async () => {
    const onUpdateQuantity = vi.fn().mockResolvedValue(true);

    render(
      <PartidaOverview
        partidas={partidas.slice(0, 1)}
        activeSheetByPartidaId={new Map()}
        advancedQuantityOverrides={{}}
        search=""
        filter="all"
        onSearchChange={vi.fn()}
        onFilterChange={vi.fn()}
        onOpenPartida={vi.fn()}
        onStartNewSheet={vi.fn()}
        onUpdateQuantity={onUpdateQuantity}
      />,
    );

    const input = screen.getAllByLabelText("Metrado de Excavación manual")[0]!;
    fireEvent.change(input, { target: { value: "12,50" } });
    fireEvent.blur(input);

    await waitFor(() => {
      expect(onUpdateQuantity).toHaveBeenCalledWith(partidas[0], "12,50");
    });
  });
});
