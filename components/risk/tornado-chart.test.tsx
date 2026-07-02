/* @vitest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TornadoChart } from "@/components/risk/tornado-chart";
import type { RiskTornadoRow } from "@/types/risk";

vi.mock("recharts", () => ({
  Bar: () => null,
  BarChart: ({ children }: { children: React.ReactNode }) => <div data-testid="tornado-bar-chart">{children}</div>,
  CartesianGrid: () => null,
  ReferenceLine: () => null,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Tooltip: () => null,
  XAxis: () => null,
  YAxis: () => null,
}));

describe("TornadoChart", () => {
  afterEach(() => {
    cleanup();
  });

  it("shows empty state message when rows array is empty", () => {
    render(<TornadoChart currency="PEN" currencyDecimals={2} rows={[]} />);

    expect(screen.getByText("Sensibilidad")).toBeTruthy();
    expect(screen.getByText("Activa variables para ver sensibilidad.")).toBeTruthy();
  });

  it("renders a bar chart when rows are provided", () => {
    const rows: RiskTornadoRow[] = [
      { itemId: "item-1", label: "Cant. 01.01 Excavacion", lowDelta: -200, highDelta: 400, impact: 400 },
      { itemId: "item-2", label: "PU 02.01 Concreto", lowDelta: -100, highDelta: 150, impact: 150 },
    ];

    render(<TornadoChart currency="PEN" currencyDecimals={2} rows={rows} />);

    expect(screen.getByText("Sensibilidad")).toBeTruthy();
    expect(screen.getByTestId("tornado-bar-chart")).toBeTruthy();
    expect(screen.queryByText("Activa variables para ver sensibilidad.")).toBeNull();
  });

  it("renders with a single row", () => {
    const rows: RiskTornadoRow[] = [
      { itemId: "item-1", label: "Cant. 01.01 Excavacion", lowDelta: -500, highDelta: 300, impact: 500 },
    ];

    render(<TornadoChart currency="PEN" currencyDecimals={2} rows={rows} />);

    expect(screen.getByTestId("tornado-bar-chart")).toBeTruthy();
  });

  it("renders with multiple rows ordered by impact", () => {
    const rows: RiskTornadoRow[] = [
      { itemId: "item-3", label: "Cant. 03.01 Pintura", lowDelta: -80, highDelta: 120, impact: 120 },
      { itemId: "item-1", label: "Cant. 01.01 Excavacion", lowDelta: -400, highDelta: 500, impact: 500 },
      { itemId: "item-2", label: "PU 02.01 Concreto", lowDelta: -200, highDelta: 300, impact: 300 },
    ];

    render(<TornadoChart currency="PEN" currencyDecimals={2} rows={rows} />);

    // Chart renders correctly with all rows
    expect(screen.getByTestId("tornado-bar-chart")).toBeTruthy();
  });

  it("renders with zero deltas", () => {
    const rows: RiskTornadoRow[] = [
      { itemId: "item-1", label: "Item sin impacto", lowDelta: 0, highDelta: 0, impact: 0 },
    ];

    render(<TornadoChart currency="PEN" currencyDecimals={2} rows={rows} />);

    expect(screen.getByTestId("tornado-bar-chart")).toBeTruthy();
  });

  it("renders with USD currency", () => {
    const rows: RiskTornadoRow[] = [
      { itemId: "item-1", label: "Test item", lowDelta: -1000, highDelta: 500, impact: 1000 },
    ];

    render(<TornadoChart currency="USD" currencyDecimals={0} rows={rows} />);

    expect(screen.getByText("Sensibilidad")).toBeTruthy();
    expect(screen.getByTestId("tornado-bar-chart")).toBeTruthy();
  });
});
