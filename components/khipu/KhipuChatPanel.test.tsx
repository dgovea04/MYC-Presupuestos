/* @vitest-environment jsdom */

import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { KhipuChatPanel } from "@/components/khipu/KhipuChatPanel";

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

async function render(props: React.ComponentProps<typeof KhipuChatPanel> = {}) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  activeContainer = container;

  const root = createRoot(container);
  (container as HTMLDivElement & { __root?: typeof root }).__root = root;

  await act(async () => root.render(<KhipuChatPanel {...props} />));
  await act(async () => new Promise((r) => setTimeout(r, 0)));

  return container;
}

describe("KhipuChatPanel", () => {
  it("renders children inside the panel body", async () => {
    const container = await render({ children: <p>Contenido del chat</p> });
    expect(container.textContent).toContain("Contenido del chat");
  });

  it("renders the header with Khipu IA title", async () => {
    const container = await render({ children: null });
    expect(container.textContent).toContain("Khipu IA");
  });

  it("renders the header subtitle", async () => {
    const container = await render({ children: null });
    expect(container.textContent).toContain("Tu asistente en MC Presupuestos");
  });

  it("renders the KhipuSymbol in the header", async () => {
    const container = await render({ children: null });
    const img = container.querySelector("img");
    expect(img).toBeTruthy();
    expect(img!.getAttribute("src")).toBe("/khipu-1.svg");
    expect(img!.className).toContain("h-9");
    expect(img!.className).toContain("w-9");
  });

  it("does not render a close button when onClose is not provided", async () => {
    const container = await render({ children: null });
    const closeButton = container.querySelector('[aria-label="Cerrar Khipu"]');
    expect(closeButton).toBeNull();
  });

  it("renders a close button when onClose is provided", async () => {
    const container = await render({ children: null, onClose: vi.fn() });
    const closeButton = container.querySelector('[aria-label="Cerrar Khipu"]');
    expect(closeButton).toBeTruthy();
  });

  it("calls onClose when the close button is clicked", async () => {
    const onClose = vi.fn();
    const container = await render({ children: null, onClose });

    const closeButton = container.querySelector('[aria-label="Cerrar Khipu"]') as HTMLButtonElement;
    await act(async () => closeButton.click());

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does not render an expand button when onExpand is not provided", async () => {
    const container = await render({ children: null });
    const expandButton = container.querySelector('[aria-label="Expandir"]');
    expect(expandButton).toBeNull();
  });

  it("renders an expand button when onExpand is provided", async () => {
    const container = await render({ children: null, onExpand: vi.fn() });
    const expandButton = container.querySelector('[aria-label="Expandir"]');
    expect(expandButton).toBeTruthy();
  });

  it("calls onExpand when the expand button is clicked", async () => {
    const onExpand = vi.fn();
    const container = await render({ children: null, onExpand });

    const expandButton = container.querySelector('[aria-label="Expandir"]') as HTMLButtonElement;
    await act(async () => expandButton.click());

    expect(onExpand).toHaveBeenCalledTimes(1);
  });

  it("shows aria-label 'Minimizar' when expanded=true", async () => {
    const container = await render({ children: null, onExpand: vi.fn(), expanded: true });
    const expandButton = container.querySelector('[aria-label="Minimizar"]');
    expect(expandButton).toBeTruthy();
  });

  it("applies the h-full class when expanded=true", async () => {
    const container = await render({ children: null, expanded: true });
    const outerDiv = container.firstElementChild as HTMLElement;
    expect(outerDiv.className).toContain("h-full");
  });

  it("does not apply h-full when expanded=false", async () => {
    const container = await render({ children: null, expanded: false });
    const outerDiv = container.firstElementChild as HTMLElement;
    expect(outerDiv.className).not.toContain("h-full");
  });

  it("merges custom className", async () => {
    const container = await render({ children: null, className: "my-panel" });
    const outerDiv = container.firstElementChild as HTMLElement;
    expect(outerDiv.className).toContain("my-panel");
    // Base classes still present
    expect(outerDiv.className).toContain("rounded-3xl");
  });

  it("applies custom inline style", async () => {
    const container = await render({ children: null, style: { width: "400px", maxHeight: "600px" } });
    const outerDiv = container.firstElementChild as HTMLElement;
    expect(outerDiv.style.width).toBe("400px");
    expect(outerDiv.style.maxHeight).toBe("600px");
  });

  it("renders both close and expand buttons simultaneously", async () => {
    const container = await render({ children: null, onClose: vi.fn(), onExpand: vi.fn() });
    expect(container.querySelector('[aria-label="Expandir"]')).toBeTruthy();
    expect(container.querySelector('[aria-label="Cerrar Khipu"]')).toBeTruthy();
  });

  it("sets data-khipu-close attribute on the close button", async () => {
    const container = await render({ children: null, onClose: vi.fn() });
    const closeButton = container.querySelector("[data-khipu-close]");
    expect(closeButton).toBeTruthy();
  });

  // ─── Theme tests ────────────────────────────────────────────

  describe("dark theme", () => {
    it("applies dark container classes when theme=dark", async () => {
      const container = await render({ children: null, theme: "dark" });
      const outerDiv = container.firstElementChild as HTMLElement;
      expect(outerDiv.className).toContain("bg-slate-900");
      expect(outerDiv.className).toContain("border-slate-700");
      expect(outerDiv.className).toContain("shadow-slate-950/40");
    });

    it("applies dark header border when theme=dark", async () => {
      const container = await render({ children: null, theme: "dark" });
      const header = container.querySelector("header") as HTMLElement;
      expect(header).toBeTruthy();
      expect(header.className).toContain("border-slate-800");
    });

    it("uses light text for title in dark theme", async () => {
      const container = await render({ children: null, theme: "dark" });
      // The title "Khipu IA" is a <p> inside the header
      const titleEl = [...container.querySelectorAll("p")].find(
        (el) => el.textContent === "Khipu IA",
      ) as HTMLElement;
      expect(titleEl).toBeTruthy();
      expect(titleEl.className).toContain("text-slate-100");
    });

    it("uses muted text for subtitle in dark theme", async () => {
      const container = await render({ children: null, theme: "dark" });
      const subtitleEl = [...container.querySelectorAll("p")].find(
        (el) => el.textContent === "Tu asistente en MC Presupuestos",
      ) as HTMLElement;
      expect(subtitleEl).toBeTruthy();
      expect(subtitleEl.className).toContain("text-slate-400");
    });

    it("does NOT contain light container classes when theme=dark", async () => {
      const container = await render({ children: null, theme: "dark" });
      const outerDiv = container.firstElementChild as HTMLElement;
      expect(outerDiv.className).not.toContain("bg-white");
      expect(outerDiv.className).not.toContain("border-slate-200");
    });

    it("applies dark text to body when theme=dark", async () => {
      const container = await render({ children: <p>Mensaje</p>, theme: "dark" });
      const bodyDiv = container.querySelector('[class*="overflow-y-auto"]') as HTMLElement;
      expect(bodyDiv).toBeTruthy();
      expect(bodyDiv.className).toContain("text-slate-100");
    });
  });

  describe("light theme (default)", () => {
    it("applies light container classes by default (no theme prop)", async () => {
      const container = await render({ children: null });
      const outerDiv = container.firstElementChild as HTMLElement;
      expect(outerDiv.className).toContain("bg-white");
      expect(outerDiv.className).toContain("border-slate-200");
      expect(outerDiv.className).toContain("shadow-slate-900/10");
    });

    it("applies light header border by default", async () => {
      const container = await render({ children: null });
      const header = container.querySelector("header") as HTMLElement;
      expect(header).toBeTruthy();
      expect(header.className).toContain("border-slate-100");
    });

    it("does NOT contain dark container classes when theme=light", async () => {
      const container = await render({ children: null, theme: "light" });
      const outerDiv = container.firstElementChild as HTMLElement;
      expect(outerDiv.className).not.toContain("bg-slate-900");
      expect(outerDiv.className).not.toContain("border-slate-700");
    });
  });

  // ─── Theme toggle button tests ──────────────────────────────

  describe("theme toggle button", () => {
    it("does not render toggle when onToggleTheme is not provided", async () => {
      const container = await render({ children: null });
      const toggle = container.querySelector('[aria-label="Cambiar a tema oscuro"]');
      expect(toggle).toBeNull();
    });

    it("renders toggle with Moon icon when onToggleTheme is provided and theme is light (default)", async () => {
      const container = await render({ children: null, onToggleTheme: vi.fn() });
      const toggle = container.querySelector('[aria-label="Cambiar a tema oscuro"]');
      expect(toggle).toBeTruthy();
      // Moon icon renders as SVG
      expect(toggle!.querySelector("svg")).toBeTruthy();
    });

    it("calls onToggleTheme when toggle is clicked", async () => {
      const onToggleTheme = vi.fn();
      const container = await render({ children: null, onToggleTheme });

      const toggle = container.querySelector('[aria-label="Cambiar a tema oscuro"]') as HTMLButtonElement;
      await act(async () => toggle.click());

      expect(onToggleTheme).toHaveBeenCalledTimes(1);
    });

    it("renders toggle with Sun icon when theme is dark", async () => {
      const container = await render({ children: null, theme: "dark", onToggleTheme: vi.fn() });
      const toggle = container.querySelector('[aria-label="Cambiar a tema claro"]');
      expect(toggle).toBeTruthy();
      // Sun icon renders as SVG
      expect(toggle!.querySelector("svg")).toBeTruthy();
    });

    it("uses dark aria-label when theme is dark", async () => {
      const container = await render({ children: null, theme: "dark", onToggleTheme: vi.fn() });
      // In dark mode, shows "Cambiar a tema claro" (switch to light)
      const toggleLight = container.querySelector('[aria-label="Cambiar a tema claro"]');
      expect(toggleLight).toBeTruthy();
      // Should NOT show the light-mode label
      const toggleDark = container.querySelector('[aria-label="Cambiar a tema oscuro"]');
      expect(toggleDark).toBeNull();
    });

    it("calls onToggleTheme when dark toggle is clicked", async () => {
      const onToggleTheme = vi.fn();
      const container = await render({ children: null, theme: "dark", onToggleTheme });

      const toggle = container.querySelector('[aria-label="Cambiar a tema claro"]') as HTMLButtonElement;
      await act(async () => toggle.click());

      expect(onToggleTheme).toHaveBeenCalledTimes(1);
    });

    it("renders toggle alongside close and expand buttons", async () => {
      const container = await render({
        children: null,
        onToggleTheme: vi.fn(),
        onClose: vi.fn(),
        onExpand: vi.fn(),
      });
      expect(container.querySelector('[aria-label="Cambiar a tema oscuro"]')).toBeTruthy();
      expect(container.querySelector('[aria-label="Expandir"]')).toBeTruthy();
      expect(container.querySelector('[aria-label="Cerrar Khipu"]')).toBeTruthy();
    });
  });

  // ─── CSS transition tests ───────────────────────────────────

  describe("CSS transitions", () => {
    it("includes transition-all on the container for smooth theme switch", async () => {
      const container = await render({ children: null });
      const outerDiv = container.firstElementChild as HTMLElement;
      expect(outerDiv.className).toContain("transition-all");
      expect(outerDiv.className).toContain("duration-300");
    });

    it("includes transition-colors on the header", async () => {
      const container = await render({ children: null });
      const header = container.querySelector("header") as HTMLElement;
      expect(header).toBeTruthy();
      expect(header.className).toContain("transition-colors");
      expect(header.className).toContain("duration-300");
    });

    it("includes transition-colors on the body", async () => {
      const container = await render({ children: <p>test</p> });
      const bodyDiv = container.querySelector('[class*="overflow-y-auto"]') as HTMLElement;
      expect(bodyDiv).toBeTruthy();
      expect(bodyDiv.className).toContain("transition-colors");
      expect(bodyDiv.className).toContain("duration-300");
    });
  });
});
