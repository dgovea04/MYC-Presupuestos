/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SimulationToolbar } from "@/components/risk/simulation-toolbar";

describe("SimulationToolbar", () => {
  afterEach(() => {
    cleanup();
  });

  it("disables PDF export until there is a saved run", () => {
    renderToolbar({ lastRunAt: null });

    expect(screen.getByRole("button", { name: "Exportar PDF" }).hasAttribute("disabled")).toBe(true);
  });

  it("enables PDF export when a simulation exists", () => {
    const onExportPdf = vi.fn();
    renderToolbar({ lastRunAt: "2026-07-01T00:00:00.000Z", onExportPdf });

    const button = screen.getByRole("button", { name: "Exportar PDF" });
    expect(button.hasAttribute("disabled")).toBe(false);

    fireEvent.click(button);
    expect(onExportPdf).toHaveBeenCalledTimes(1);
  });
});

function renderToolbar({
  lastRunAt,
  onExportPdf = vi.fn(),
}: {
  lastRunAt: string | null;
  onExportPdf?: () => void;
}) {
  render(
    <SimulationToolbar
      baseTotal="S/ 1,000.00"
      budgetKind="GENERAL"
      budgetName="Presupuesto General"
      enabledVariables={2}
      error=""
      itemCount={8}
      lastRunAt={lastRunAt}
      onExportPdf={onExportPdf}
      onRunSimulation={vi.fn()}
      progress={0}
      status="idle"
    />,
  );
}
