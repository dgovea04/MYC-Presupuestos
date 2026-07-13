/* @vitest-environment jsdom */

import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

// Mock framer-motion so motion.div renders as a regular <div>
// Filter out animation-only props that React warns about on native HTML elements
const MOTION_PROPS = new Set([
  "layout", "layoutId", "layoutDependency",
  "initial", "animate", "exit", "whileHover", "whileTap", "whileFocus", "whileDrag", "whileInView",
  "transition", "variants",
  "onAnimationStart", "onAnimationComplete",
  "drag", "dragConstraints", "dragElastic", "dragMomentum", "dragPropagation",
]);

vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => {
      const htmlProps: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(props)) {
        if (!MOTION_PROPS.has(key)) {
          htmlProps[key] = value;
        }
      }
      return React.createElement("div", htmlProps, children);
    },
  },
}));

import type { DatePreset } from "@/lib/resumen-date-presets";
import { SavedPresetChip } from "@/components/presets/saved-preset-chip";
import { chipClassName } from "@/components/presets/saved-preset-chip";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const basePreset: DatePreset = {
  id: "preset-1",
  name: "Ene-Mar 2026",
  dateFrom: "2026-01-01",
  dateTo: "2026-03-31",
};

const defaultProps = {
  preset: basePreset,
  index: 0,
  presets: [basePreset],
  showDefaults: true,
  isActive: false,
  dragIndex: null,
  dropTargetIndex: null,
  onApply: vi.fn(),
  onDelete: vi.fn(),
  onDragIndexChange: vi.fn(),
  onDropTargetChange: vi.fn(),
  onReorder: vi.fn(),
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

async function renderChip(overrideProps: Partial<typeof defaultProps> = {}) {
  const props = { ...defaultProps, ...overrideProps };
  // Reset mocks for fresh tracking
  vi.clearAllMocks();

  const container = document.createElement("div");
  document.body.appendChild(container);

  const root = createRoot(container);
  (container as HTMLDivElement & { __root?: ReturnType<typeof createRoot> }).__root = root;

  await act(async () => {
    root.render(<SavedPresetChip {...props} />);
  });

  activeContainer = container;

  function getChip(): HTMLDivElement {
    const chip = container.querySelector<HTMLDivElement>("div[draggable]");
    if (!chip) throw new Error("Missing draggable chip div");
    return chip;
  }

  function getApplyButton(): HTMLButtonElement {
    const buttons = [...container.querySelectorAll("button")];
    // The apply button is the one with the Bookmark icon (name display)
    const btn = buttons.find(
      (b) => b.textContent?.includes(props.preset.name) && b.closest("div[draggable]"),
    );
    if (!btn) throw new Error("Missing apply button");
    return btn;
  }

  function getDeleteButton(): HTMLButtonElement {
    const btn = container.querySelector<HTMLButtonElement>("button[aria-label*='Eliminar']");
    if (!btn) throw new Error("Missing delete button");
    return btn;
  }

  function getKbd(): HTMLElement | null {
    return container.querySelector("kbd");
  }

  return { container, getChip, getApplyButton, getDeleteButton, getKbd };
}

describe("chipClassName", () => {
  it("returns idle classes when no state is active", () => {
    const result = chipClassName({ isDragging: false, isDropTarget: false, isActive: false });
    expect(result).toContain("border-slate-200");
    expect(result).toContain("bg-white");
    expect(result).not.toContain("opacity-50");
    expect(result).not.toContain("ring-1");
  });

  it("returns dragging classes when isDragging is true", () => {
    const result = chipClassName({ isDragging: true, isDropTarget: false, isActive: false });
    expect(result).toContain("border-blue-300");
    expect(result).toContain("opacity-50");
    expect(result).not.toContain("ring-1");
  });

  it("returns dropTarget classes when isDropTarget is true", () => {
    const result = chipClassName({ isDragging: false, isDropTarget: true, isActive: false });
    expect(result).toContain("border-blue-400");
    expect(result).toContain("ring-1");
    expect(result).toContain("ring-blue-300");
  });

  it("returns active classes when isActive is true", () => {
    const result = chipClassName({ isDragging: false, isDropTarget: false, isActive: true });
    expect(result).toContain("border-blue-200");
    expect(result).toContain("bg-blue-50");
    expect(result).toContain("text-blue-700");
  });

  it("prioritises dragging over dropTarget and active", () => {
    const result = chipClassName({ isDragging: true, isDropTarget: true, isActive: true });
    expect(result).toContain("border-blue-300");
    expect(result).toContain("opacity-50");
  });

  it("prioritises dropTarget over active", () => {
    const result = chipClassName({ isDragging: false, isDropTarget: true, isActive: true });
    expect(result).toContain("border-blue-400");
    expect(result).toContain("ring-1");
  });
});

describe("SavedPresetChip", () => {
  it("renders the preset name", async () => {
    const { getApplyButton } = await renderChip();
    expect(getApplyButton().textContent).toContain("Ene-Mar 2026");
  });

  it("renders the title with date range", async () => {
    const { getChip } = await renderChip();
    const title = getChip().getAttribute("title");
    expect(title).toContain("2026-01-01 → 2026-03-31");
    expect(title).toContain("Ene-Mar 2026");
  });

  describe("keyboard shortcut badge", () => {
    it("shows Alt+5 for index 0 when showDefaults is true (defaults visible)", async () => {
      const { getKbd } = await renderChip({ index: 0, showDefaults: true });
      expect(getKbd()?.textContent).toBe("Alt+5");
    });

    it("shows Alt+1 for index 0 when showDefaults is false", async () => {
      const { getKbd } = await renderChip({ index: 0, showDefaults: false });
      expect(getKbd()?.textContent).toBe("Alt+1");
    });

    it("shows Alt+7 for index 2 when showDefaults is true", async () => {
      const { getKbd } = await renderChip({ index: 2, showDefaults: true });
      expect(getKbd()?.textContent).toBe("Alt+7");
    });
  });

  it("calls onApply when clicking the preset button", async () => {
    const onApply = vi.fn();
    const { getApplyButton } = await renderChip({ onApply });
    await act(async () => {
      getApplyButton().click();
    });
    expect(onApply).toHaveBeenCalledWith(basePreset);
  });

  it("opens the delete confirmation dialog when clicking delete", async () => {
    const { getDeleteButton } = await renderChip();

    expect(document.body.textContent).not.toContain("Eliminar preset");

    await act(async () => {
      getDeleteButton().click();
    });

    expect(document.body.textContent).toContain("Eliminar preset");
    expect(document.body.textContent).toContain("Ene-Mar 2026");
    expect(document.body.textContent).toContain("Cancelar");
  });

  it("closes the delete dialog when clicking Cancelar", async () => {
    const { getDeleteButton } = await renderChip();

    await act(async () => {
      getDeleteButton().click();
    });

    expect(document.body.textContent).toContain("Eliminar preset");

    await act(async () => {
      const cancelButton = Array.from(document.querySelectorAll("button")).find(
        (b) => b.textContent?.trim() === "Cancelar",
      );
      cancelButton?.click();
    });

    expect(document.body.textContent).not.toContain("Eliminar preset");
  });

  it("calls onDelete with the preset id when confirming in the dialog", async () => {
    const onDelete = vi.fn();
    const { getDeleteButton } = await renderChip({ onDelete });

    await act(async () => {
      getDeleteButton().click();
    });

    expect(document.body.textContent).toContain("Eliminar preset");

    await act(async () => {
      const confirmButton = Array.from(document.querySelectorAll("button")).find(
        (b) => b.textContent?.includes("Eliminar preset"),
      );
      confirmButton?.click();
    });

    expect(onDelete).toHaveBeenCalledWith("preset-1");
    expect(document.body.textContent).not.toContain("Eliminar preset");
  });

  describe("drag & drop callbacks", () => {
    it("calls onDragIndexChange when drag starts", async () => {
      const onDragIndexChange = vi.fn();
      const { getChip } = await renderChip({ onDragIndexChange, index: 2 });

      await act(async () => {
        const event = new Event("dragstart", { bubbles: true, cancelable: true });
        Object.defineProperty(event, "dataTransfer", {
          value: { effectAllowed: "", setData: vi.fn() },
          writable: false,
        });
        getChip().dispatchEvent(event);
      });

      expect(onDragIndexChange).toHaveBeenCalledWith(2);
    });

    it("calls onDropTargetChange on dragover when target is different", async () => {
      const onDropTargetChange = vi.fn();
      const { getChip } = await renderChip({
        onDropTargetChange,
        dragIndex: 0,
        index: 2,
      });

      await act(async () => {
        const event = new Event("dragover", { bubbles: true, cancelable: true });
        Object.defineProperty(event, "dataTransfer", {
          value: { dropEffect: "" },
          writable: false,
        });
        getChip().dispatchEvent(event);
      });

      expect(onDropTargetChange).toHaveBeenCalledWith(2);
    });

    it("does NOT call onDropTargetChange on dragover when target is the drag source", async () => {
      const onDropTargetChange = vi.fn();
      const { getChip } = await renderChip({
        onDropTargetChange,
        dragIndex: 0,
        index: 0,
      });

      await act(async () => {
        const event = new Event("dragover", { bubbles: true, cancelable: true });
        Object.defineProperty(event, "dataTransfer", {
          value: { dropEffect: "" },
          writable: false,
        });
        getChip().dispatchEvent(event);
      });

      expect(onDropTargetChange).not.toHaveBeenCalled();
    });

    it("calls onReorder on drop", async () => {
      const onReorder = vi.fn();
      const presets: DatePreset[] = [
        { id: "p0", name: "Q1", dateFrom: "2026-01-01", dateTo: "2026-03-31" },
        { id: "p1", name: "Q2", dateFrom: "2026-04-01", dateTo: "2026-06-30" },
        { id: "p2", name: "Q3", dateFrom: "2026-07-01", dateTo: "2026-09-30" },
      ];

      const { getChip } = await renderChip({
        presets,
        index: 2, // drop on Q3
        dragIndex: 0, // dragging Q1
        onReorder,
      });

      await act(async () => {
        const event = new Event("drop", { bubbles: true, cancelable: true });
        Object.defineProperty(event, "dataTransfer", {
          value: {},
          writable: false,
        });
        getChip().dispatchEvent(event);
      });

      // Q1 should have moved to index 2: [Q2, Q3, Q1]
      expect(onReorder).toHaveBeenCalledOnce();
      const reordered = onReorder.mock.calls[0][0] as DatePreset[];
      expect(reordered).toHaveLength(3);
      expect(reordered[0].id).toBe("p1");
      expect(reordered[1].id).toBe("p2");
      expect(reordered[2].id).toBe("p0");
    });

    it("does NOT call onReorder on drop when dropping on self", async () => {
      const onReorder = vi.fn();
      const { getChip } = await renderChip({
        index: 0,
        dragIndex: 0,
        onReorder,
      });

      await act(async () => {
        const event = new Event("drop", { bubbles: true, cancelable: true });
        getChip().dispatchEvent(event);
      });

      expect(onReorder).not.toHaveBeenCalled();
    });

    it("calls clear handlers on dragend", async () => {
      const onDragIndexChange = vi.fn();
      const onDropTargetChange = vi.fn();
      const { getChip } = await renderChip({
        onDragIndexChange,
        onDropTargetChange,
        dragIndex: 0,
        dropTargetIndex: 1,
      });

      await act(async () => {
        getChip().dispatchEvent(new Event("dragend", { bubbles: true }));
      });

      expect(onDragIndexChange).toHaveBeenCalledWith(null);
      expect(onDropTargetChange).toHaveBeenCalledWith(null);
    });
  });

  describe("CSS class variants", () => {
    it("renders with idle classes by default", async () => {
      const { getChip } = await renderChip();
      const className = getChip().className;
      expect(className).toContain("border-slate-200");
      expect(className).toContain("bg-white");
    });

    it("renders with active classes when isActive is true", async () => {
      const { getChip } = await renderChip({ isActive: true });
      const className = getChip().className;
      expect(className).toContain("border-blue-200");
      expect(className).toContain("bg-blue-50");
    });

    it("renders with dragging classes when dragIndex matches", async () => {
      const { getChip } = await renderChip({ dragIndex: 0, index: 0 });
      const className = getChip().className;
      expect(className).toContain("border-blue-300");
      expect(className).toContain("opacity-50");
    });

    it("renders with dropTarget classes when dropTargetIndex matches", async () => {
      const { getChip } = await renderChip({
        dropTargetIndex: 1,
        index: 1,
        dragIndex: 0,
      });
      const className = getChip().className;
      expect(className).toContain("border-blue-400");
      expect(className).toContain("ring-1");
    });
  });

  describe("drag handle", () => {
    it("has a drag handle with the correct aria-label", async () => {
      const { container } = await renderChip();
      const handle = container.querySelector('[aria-label*="Arrastrar"]');
      expect(handle).toBeTruthy();
      expect(handle?.getAttribute("aria-label")).toBe('Arrastrar "Ene-Mar 2026"');
    });
  });
});
