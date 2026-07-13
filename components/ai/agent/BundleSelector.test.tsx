/* @vitest-environment jsdom */

import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BundleSelector } from "@/components/ai/agent/BundleSelector";
import type { BundleSlug } from "@/components/ai/agent/BundleConfig";

// ─── Mocks ───────────────────────────────────────────────────────────────────

vi.mock("@/lib/utils", () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(" "),
}));

vi.mock("@/components/khipu/KhipuSymbol", () => ({
  KhipuSymbol: ({ className }: { className?: string }) => (
    <span data-testid="khipu-symbol" className={className}>MC</span>
  ),
}));

vi.mock("lucide-react", () => ({
  CheckCircle2: () => <span data-testid="icon-check">✓</span>,
}));

// Mock BundleConfig to control test data
vi.mock("./BundleConfig", () => ({
  BUNDLE_CONFIG: [
    {
      slug: "asistente-general",
      bundleSlug: "khipu-agent",
      name: "Asistente General",
      description: "Acceso completo",
      icon: () => <span data-testid="icon-bundle-0">★</span>,
      color: "from-blue-500 to-blue-600",
      borderColor: "border-blue-200",
      bgLight: "bg-blue-50",
      textColor: "text-blue-700",
    },
    {
      slug: "crear-presupuesto-base",
      bundleSlug: "budget-agent",
      name: "Presupuestos",
      description: "Crear presupuestos",
      icon: () => <span data-testid="icon-bundle-1">$</span>,
      color: "from-emerald-500 to-emerald-600",
      borderColor: "border-emerald-200",
      bgLight: "bg-emerald-50",
      textColor: "text-emerald-700",
    },
    {
      slug: "optimizar-apu",
      bundleSlug: "apu-agent",
      name: "APU",
      description: "Optimizar APU",
      icon: () => <span data-testid="icon-bundle-2">📊</span>,
      color: "from-purple-500 to-purple-600",
      borderColor: "border-purple-200",
      bgLight: "bg-purple-50",
      textColor: "text-purple-700",
    },
  ] as const,
}));

describe("BundleSelector", () => {
  afterEach(() => {
    vi.clearAllMocks();
    cleanup();
  });

  it("renders the title and description", () => {
    render(<BundleSelector selected={null} onSelect={() => {}} />);

    expect(screen.getByText("Khipu Agente")).toBeTruthy();
    expect(
      screen.getByText("Elige una especialidad para enfocar al asistente en tu tipo de tarea"),
    ).toBeTruthy();
  });

  it("renders the KhipuSymbol", () => {
    render(<BundleSelector selected={null} onSelect={() => {}} />);

    expect(screen.getByTestId("khipu-symbol")).toBeTruthy();
  });

  it("renders all bundle cards", () => {
    render(<BundleSelector selected={null} onSelect={() => {}} />);

    expect(screen.getByText("Asistente General")).toBeTruthy();
    expect(screen.getByText("Presupuestos")).toBeTruthy();
    expect(screen.getByText("APU")).toBeTruthy();
  });

  it("renders bundle descriptions", () => {
    render(<BundleSelector selected={null} onSelect={() => {}} />);

    expect(screen.getByText("Acceso completo")).toBeTruthy();
    expect(screen.getByText("Crear presupuestos")).toBeTruthy();
    expect(screen.getByText("Optimizar APU")).toBeTruthy();
  });

  it("calls onSelect when a bundle card is clicked", async () => {
    const onSelect = vi.fn();
    render(<BundleSelector selected={null} onSelect={onSelect} />);

    await userEvent.click(screen.getByText("Presupuestos"));

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith("crear-presupuesto-base");
  });

  it("shows check icon on the active bundle", () => {
    render(<BundleSelector selected="optimizar-apu" onSelect={() => {}} />);

    // Check icon should appear inside the active bundle
    const checks = screen.getAllByTestId("icon-check");
    expect(checks.length).toBeGreaterThan(0);
  });

  it("does not show check icon when no bundle is selected", () => {
    render(<BundleSelector selected={null} onSelect={() => {}} />);

    expect(screen.queryByTestId("icon-check")).toBeNull();
  });

  it("applies active styling to the selected bundle", () => {
    const { container } = render(<BundleSelector selected="crear-presupuesto-base" onSelect={() => {}} />);

    // Active bundle should have the border-emerald-200 class
    const buttons = container.querySelectorAll("button");
    const activeButton = Array.from(buttons).find((btn) =>
      btn.textContent?.includes("Presupuestos"),
    );
    expect(activeButton).toBeTruthy();
    expect(activeButton!.className).toContain("border-emerald-200");
    expect(activeButton!.className).toContain("ring-2");
  });

  it("applies default styling to non-selected bundles", () => {
    const { container } = render(<BundleSelector selected="optimizar-apu" onSelect={() => {}} />);

    const buttons = container.querySelectorAll("button");
    const inactiveButton = Array.from(buttons).find((btn) =>
      btn.textContent?.includes("Presupuestos"),
    );
    expect(inactiveButton).toBeTruthy();
    expect(inactiveButton!.className).not.toContain("ring-2");
  });

  it("renders all bundle cards as buttons", () => {
    const { container } = render(<BundleSelector selected={null} onSelect={() => {}} />);

    const buttons = container.querySelectorAll("button");
    expect(buttons.length).toBe(3);
  });
});
