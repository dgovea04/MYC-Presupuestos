/* @vitest-environment jsdom */

import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { KhipuQuickActions, type KhipuQuickAction } from "@/components/khipu/KhipuQuickActions";
import { Search } from "lucide-react";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let activeContainer: HTMLDivElement | null = null;

afterEach(async () => {
  if (!activeContainer) return;

  const root = (activeContainer as HTMLDivElement & { __root?: ReturnType<typeof createRoot> }).__root;
  if (root) {
    await act(async () => root.unmount());
  }
  activeContainer.remove();
  activeContainer = null;
  document.body.innerHTML = "";
});

async function render(props: React.ComponentProps<typeof KhipuQuickActions> = {}) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  activeContainer = container;

  const root = createRoot(container);
  (container as HTMLDivElement & { __root?: typeof root }).__root = root;

  await act(async () => root.render(<KhipuQuickActions {...props} />));
  await act(async () => new Promise((r) => setTimeout(r, 0)));

  return container;
}

describe("KhipuQuickActions", () => {
  it("renders 6 default action buttons", async () => {
    const container = await render();
    const buttons = container.querySelectorAll("button");
    expect(buttons.length).toBe(6);
  });

  it("renders all default action labels", async () => {
    const container = await render();
    const text = container.textContent ?? "";
    expect(text).toContain("Analizar presupuesto");
    expect(text).toContain("Revisar APU");
    expect(text).toContain("Comparar alternativas");
    expect(text).toContain("Optimizar costos");
    expect(text).toContain("Generar reporte");
    expect(text).toContain("Detectar inconsistencias");
  });

  it("renders all default action descriptions", async () => {
    const container = await render();
    const text = container.textContent ?? "";
    expect(text).toContain("Detecta partidas que requieren revisión.");
    expect(text).toContain("Evalúa insumos, rendimientos y coherencia técnica.");
    expect(text).toContain("Compara soluciones y escenarios de costo.");
    expect(text).toContain("Sugiere alternativas para reducir costos.");
    expect(text).toContain("Resume observaciones para el equipo técnico.");
    expect(text).toContain("Identifica posibles errores en cantidades y unidades.");
  });

  it("renders an icon (SVG) inside each action button", async () => {
    const container = await render();
    const buttons = container.querySelectorAll("button");
    buttons.forEach((button) => {
      const svg = button.querySelector("svg");
      expect(svg).toBeTruthy();
    });
  });

  it("accepts custom actions prop and renders those instead", async () => {
    const customActions: KhipuQuickAction[] = [
      {
        id: "custom-1",
        label: "Acción personalizada",
        description: "Descripción personalizada.",
        icon: Search,
        onSelect: () => {},
      },
    ];

    const container = await render({ actions: customActions });
    expect(container.querySelectorAll("button").length).toBe(1);
    expect(container.textContent).toContain("Acción personalizada");
    expect(container.textContent).toContain("Descripción personalizada.");
  });

  it("calls onSelect when an action button is clicked", async () => {
    const onSelect = vi.fn();
    const customActions: KhipuQuickAction[] = [
      {
        id: "click-test",
        label: "Click me",
        description: "Desc",
        icon: Search,
        onSelect,
      },
    ];

    const container = await render({ actions: customActions });
    const button = container.querySelector("button")!;

    await act(async () => button.click());
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it("preserves default actions when no actions prop is provided", async () => {
    const container = await render();
    const buttons = container.querySelectorAll("button");
    expect(buttons.length).toBe(6);
  });

  it("applies custom className to the grid container", async () => {
    const container = await render({ className: "my-grid" });
    const outerDiv = container.firstElementChild as HTMLElement;
    expect(outerDiv.className).toContain("my-grid");
    // Grid classes still present
    expect(outerDiv.className).toContain("grid");
    expect(outerDiv.className).toContain("sm:grid-cols-2");
  });

  it("provides focus-visible styles via className on buttons", async () => {
    const container = await render();
    const button = container.querySelector("button")!;
    expect(button.className).toContain("focus-visible:outline-none");
    expect(button.className).toContain("focus-visible:ring-2");
  });

  it("renders the icon inside a rounded span with cyan background", async () => {
    const container = await render();
    const iconWrappers = container.querySelectorAll("button > span:first-child");
    iconWrappers.forEach((wrapper) => {
      expect(wrapper.className).toContain("rounded-xl");
      expect(wrapper.className).toContain("bg-[var(--app-primary-muted)]");
      expect(wrapper.className).toContain("text-cyan-600");
    });
  });
});
