/* @vitest-environment jsdom */

import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { DatePreset } from "@/lib/resumen-date-presets";
import { DefaultPresetChip } from "@/components/presets/default-preset-chip";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const regularPreset: DatePreset = {
  id: "default-last-30-days",
  name: "Últimos 30 días",
  dateFrom: "2026-05-12",
  dateTo: "2026-06-11",
};

const customPreset: DatePreset = {
  id: "default-custom",
  name: "Personalizado",
  dateFrom: "",
  dateTo: "",
};

let activeContainer: HTMLDivElement | null = null;

afterEach(async () => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();

  if (activeContainer) {
    const root = (activeContainer as HTMLDivElement & { __root?: ReturnType<typeof createRoot> }).__root;
    if (root) {
      await act(async () => {
        root.unmount();
      });
    }
    activeContainer.remove();
    activeContainer = null;
  }
});

async function renderChip(overrideProps: Partial<{
  preset: DatePreset;
  index: number;
  isActive: boolean;
  onClick: (preset: DatePreset) => void;
}> = {}) {
  const props = {
    preset: regularPreset,
    index: 0,
    isActive: false,
    onClick: vi.fn(),
    ...overrideProps,
  };

  const container = document.createElement("div");
  document.body.appendChild(container);

  const root = createRoot(container);
  (container as HTMLDivElement & { __root?: ReturnType<typeof createRoot> }).__root = root;

  await act(async () => {
    root.render(<DefaultPresetChip {...props} />);
  });

  activeContainer = container;

  function getButton(): HTMLButtonElement {
    const btn = container.querySelector("button");
    if (!btn) throw new Error("Missing button");
    return btn;
  }

  function getKbd(): HTMLElement | null {
    return container.querySelector("kbd");
  }

  return { container, getButton, getKbd };
}

describe("DefaultPresetChip", () => {
  describe("rendering", () => {
    it("renders the preset name", async () => {
      const { getButton } = await renderChip();
      expect(getButton().textContent).toContain("Últimos 30 días");
    });

    it("renders a Sparkles icon for regular presets", async () => {
      const { container } = await renderChip();
      const sparklesIcon = container.querySelector("svg.lucide-sparkles");
      expect(sparklesIcon).toBeTruthy();
    });

    it("renders a Pen icon for the custom preset", async () => {
      const { container } = await renderChip({ preset: customPreset });
      const penIcon = container.querySelector("svg.lucide-pen");
      expect(penIcon).toBeTruthy();
    });

    it("renders the keyboard shortcut badge with Alt+{index+1}", async () => {
      const { getKbd } = await renderChip({ index: 2 });
      expect(getKbd()?.textContent).toBe("Alt+3");
    });

    it("renders Alt+4 for custom preset at index 3", async () => {
      const { getKbd } = await renderChip({ preset: customPreset, index: 3 });
      expect(getKbd()?.textContent).toBe("Alt+4");
    });

    it("has a title with preset name and keyboard shortcut", async () => {
      const { getButton } = await renderChip({ index: 1 });
      const title = getButton().getAttribute("title");
      expect(title).toBe("Últimos 30 días — Alt+2");
    });
  });

  describe("CSS classes", () => {
    it("has dashed border for the custom preset when not active", async () => {
      const { getButton } = await renderChip({ preset: customPreset, isActive: false });
      expect(getButton().className).toContain("border-dashed");
      expect(getButton().className).toContain("text-slate-500");
    });

    it("has active classes when isActive is true and it's a regular preset", async () => {
      const { getButton } = await renderChip({ isActive: true });
      expect(getButton().className).toContain("border-blue-200");
      expect(getButton().className).toContain("bg-blue-50");
      expect(getButton().className).toContain("text-blue-700");
    });

    it("does NOT have dashed border when active and it's a regular preset", async () => {
      const { getButton } = await renderChip({ isActive: true });
      expect(getButton().className).not.toContain("border-dashed");
    });

    it("has idle classes when not active and not custom", async () => {
      const { getButton } = await renderChip();
      expect(getButton().className).toContain("border-slate-200/80");
      expect(getButton().className).toContain("bg-slate-50/80");
      expect(getButton().className).toContain("text-slate-500");
      expect(getButton().className).toContain("hover:border-slate-300");
    });
  });

  describe("interaction", () => {
    it("calls onClick with the preset when clicked", async () => {
      const onClick = vi.fn();
      const { getButton } = await renderChip({ onClick });
      await act(async () => {
        getButton().click();
      });
      expect(onClick).toHaveBeenCalledWith(regularPreset);
    });

    it("calls onClick with the custom preset when clicked", async () => {
      const onClick = vi.fn();
      const { getButton } = await renderChip({ preset: customPreset, onClick });
      await act(async () => {
        getButton().click();
      });
      expect(onClick).toHaveBeenCalledWith(customPreset);
    });
  });
});
