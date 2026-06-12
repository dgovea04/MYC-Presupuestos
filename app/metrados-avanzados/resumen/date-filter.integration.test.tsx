/* @vitest-environment jsdom */

import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock next/navigation
const mockPush = vi.fn();
const mockSearchParams = {
  get: vi.fn((key: string) => {
    if (key === "projectId") return "test-project-123";
    return null;
  }),
  set: vi.fn(),
  delete: vi.fn(),
  toString: vi.fn(() => "projectId=test-project-123"),
  [Symbol.iterator]: function* () {
    yield* [];
  },
  size: 0,
  entries: vi.fn(),
  forEach: vi.fn(),
  has: vi.fn(() => false),
  keys: vi.fn(),
  values: vi.fn(),
  getAll: vi.fn(() => []),
  sort: vi.fn(),
};

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => mockSearchParams,
}));

// Mock framer-motion for SavedPresetChip
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

import { ResumenDateFilter } from "@/app/metrados-avanzados/resumen/date-filter";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const PROJECT_ID = "test-project-123";
const PRESETS_KEY = "myc-metrado-date-presets-" + PROJECT_ID;

let activeContainer: HTMLDivElement | null = null;

beforeEach(() => {
  window.localStorage.clear();
  vi.clearAllMocks();
});

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

async function renderFilter(overrides?: {
  activeDateFrom?: string;
  activeDateTo?: string;
  filteredCount?: number;
}) {
  const props = {
    projectId: PROJECT_ID,
    activeDateFrom: overrides?.activeDateFrom ?? "2026-01-01",
    activeDateTo: overrides?.activeDateTo ?? "2026-03-31",
    filteredCount: overrides?.filteredCount ?? 5,
  };

  const container = document.createElement("div");
  document.body.appendChild(container);

  const root = createRoot(container);
  (container as HTMLDivElement & { __root?: ReturnType<typeof createRoot> }).__root = root;

  await act(async () => {
    root.render(<ResumenDateFilter {...props} />);
  });

  activeContainer = container;

  function getSavedPresetChips(): HTMLDivElement[] {
    return [...container.querySelectorAll<HTMLDivElement>("div[draggable]")];
  }

  function getButtonByText(pattern: RegExp): HTMLButtonElement | null {
    return [...container.querySelectorAll("button")].find((b) => pattern.test(b.textContent ?? "")) ?? null;
  }

  function getInputByPlaceholder(pattern: RegExp): HTMLInputElement | null {
    const input = [...container.querySelectorAll("input")].find(
      (i) => pattern.test(i.getAttribute("placeholder") ?? ""),
    );
    return input ?? null;
  }

  function getDeleteButtons(): HTMLButtonElement[] {
    return [...container.querySelectorAll<HTMLButtonElement>('button[aria-label*="Eliminar"]')];
  }

  return {
    container,
    getSavedPresetChips,
    getButtonByText,
    getInputByPlaceholder,
    getDeleteButtons,
  };
}

async function unmountContainer(container: HTMLDivElement): Promise<void> {
  const root = (container as HTMLDivElement & { __root?: ReturnType<typeof createRoot> }).__root;
  if (root) {
    await act(async () => {
      root.unmount();
    });
  }
  container.remove();
}

describe("ResumenDateFilter integration", () => {
  it("saves a preset and persists it to localStorage", async () => {
    const { getButtonByText, getInputByPlaceholder } = await renderFilter();

    // "Guardar preset" should be visible since we have active filters
    const saveBtn = getButtonByText(/Guardar preset/);
    expect(saveBtn).toBeTruthy();

    // Click "Guardar preset"
    await act(async () => {
      saveBtn!.click();
    });

    // Save form should appear with input
    const nameInput = getInputByPlaceholder(/Nombre del preset/);
    expect(nameInput).toBeTruthy();

    // Type a name (using native value setter like user-settings-form.test.tsx does)
    await act(async () => {
      const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      if (valueSetter) {
        valueSetter.call(nameInput, "Q1 2026");
      }
      nameInput!.dispatchEvent(new Event("input", { bubbles: true }));
    });

    // Click "Guardar" button
    const guardarBtn = getButtonByText(/^Guardar$/);
    expect(guardarBtn).toBeTruthy();

    await act(async () => {
      guardarBtn!.click();
    });

    // After saving:
    // 1. The save form should be gone
    expect(getInputByPlaceholder(/Nombre del preset/)).toBeNull();

    // 2. The preset should be in localStorage
    const stored = JSON.parse(window.localStorage.getItem(PRESETS_KEY) ?? "[]");
    expect(stored).toHaveLength(1);
    expect(stored[0].name).toBe("Q1 2026");
    expect(stored[0].dateFrom).toBe("2026-01-01");
    expect(stored[0].dateTo).toBe("2026-03-31");

    // 3. The preset chip should be visible in the DOM
    const chips = activeContainer!.querySelectorAll("div[draggable]");
    expect(chips.length).toBe(1);
    expect(chips[0].textContent).toContain("Q1 2026");
  });

  it("loads presets from localStorage on mount", async () => {
    // Pre-populate localStorage with presets
    const existingPresets = [
      { id: "p1", name: "Q1 2026", dateFrom: "2026-01-01", dateTo: "2026-03-31" },
      { id: "p2", name: "Q2 2026", dateFrom: "2026-04-01", dateTo: "2026-06-30" },
    ];
    window.localStorage.setItem(PRESETS_KEY, JSON.stringify(existingPresets));

    const { getSavedPresetChips } = await renderFilter();

    const chips = getSavedPresetChips();
    expect(chips).toHaveLength(2);
    expect(chips[0].textContent).toContain("Q1 2026");
    expect(chips[1].textContent).toContain("Q2 2026");
  });

  it("reorders presets via drag & drop and persists the new order", async () => {
    // Pre-populate with 3 presets
    const initialPresets = [
      { id: "p1", name: "Primero", dateFrom: "2026-01-01", dateTo: "2026-01-31" },
      { id: "p2", name: "Segundo", dateFrom: "2026-02-01", dateTo: "2026-02-28" },
      { id: "p3", name: "Tercero", dateFrom: "2026-03-01", dateTo: "2026-03-31" },
    ];
    window.localStorage.setItem(PRESETS_KEY, JSON.stringify(initialPresets));

    const { getSavedPresetChips } = await renderFilter();

    // Verify initial order
    let chips = getSavedPresetChips();
    expect(chips).toHaveLength(3);
    expect(chips[0].textContent).toContain("Primero");
    expect(chips[1].textContent).toContain("Segundo");
    expect(chips[2].textContent).toContain("Tercero");

    // Simulate drag & drop: drag "Primero" (index 0) onto "Tercero" (index 2)
    await act(async () => {
      // dragstart on the first chip
      const dragStartEvent = new Event("dragstart", { bubbles: true, cancelable: true });
      Object.defineProperty(dragStartEvent, "dataTransfer", {
        value: { effectAllowed: "move", setData: vi.fn() },
        writable: false,
      });
      chips[0].dispatchEvent(dragStartEvent);
    });

    // dragover on the third chip
    await act(async () => {
      const dragOverEvent = new Event("dragover", { bubbles: true, cancelable: true });
      Object.defineProperty(dragOverEvent, "dataTransfer", {
        value: { dropEffect: "move" },
        writable: false,
      });
      chips[2].dispatchEvent(dragOverEvent);
    });

    // drop on the third chip
    await act(async () => {
      const dropEvent = new Event("drop", { bubbles: true, cancelable: true });
      Object.defineProperty(dropEvent, "dataTransfer", {
        value: {},
        writable: false,
      });
      chips[2].dispatchEvent(dropEvent);
    });

    // dragend to clean up
    await act(async () => {
      chips[0].dispatchEvent(new Event("dragend", { bubbles: true }));
    });

    // Verify DOM order: Tercero should now be at index 0, Primero at index 2
    chips = activeContainer!.querySelectorAll("div[draggable]");
    expect(chips[0].textContent).toContain("Segundo");
    expect(chips[1].textContent).toContain("Tercero");
    expect(chips[2].textContent).toContain("Primero");

    // Verify localStorage was updated
    const stored = JSON.parse(window.localStorage.getItem(PRESETS_KEY) ?? "[]");
    expect(stored).toHaveLength(3);
    expect(stored[0].id).toBe("p2"); // Segundo
    expect(stored[1].id).toBe("p3"); // Tercero
    expect(stored[2].id).toBe("p1"); // Primero
  });

  it("deletes a preset and updates localStorage", async () => {
    // Pre-populate with 2 presets
    const initialPresets = [
      { id: "p1", name: "Q1 2026", dateFrom: "2026-01-01", dateTo: "2026-03-31" },
      { id: "p2", name: "Q2 2026", dateFrom: "2026-04-01", dateTo: "2026-06-30" },
    ];
    window.localStorage.setItem(PRESETS_KEY, JSON.stringify(initialPresets));

    const { getDeleteButtons } = await renderFilter();

    // Should have 2 delete buttons (one per preset)
    const deleteBtns = getDeleteButtons();
    expect(deleteBtns).toHaveLength(2);

    // Delete the first preset
    await act(async () => {
      deleteBtns[0]!.click();
    });

    // Verify DOM: only 1 chip left
    const chips = activeContainer!.querySelectorAll("div[draggable]");
    expect(chips).toHaveLength(1);
    expect(chips[0].textContent).toContain("Q2 2026");

    // Verify localStorage: only 1 preset left
    const stored = JSON.parse(window.localStorage.getItem(PRESETS_KEY) ?? "[]");
    expect(stored).toHaveLength(1);
    expect(stored[0].id).toBe("p2");
  });

  it("persists presets across component unmount and remount (save → unmount → remount → verify)", async () => {
    const { getButtonByText, getInputByPlaceholder, container: firstContainer } = await renderFilter();

    // Save a preset
    await act(async () => {
      getButtonByText(/Guardar preset/)!.click();
    });

    const nameInput = getInputByPlaceholder(/Nombre del preset/);
    expect(nameInput).toBeTruthy();

    await act(async () => {
      const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      if (valueSetter) {
        valueSetter.call(nameInput, "Cross-mount");
      }
      nameInput!.dispatchEvent(new Event("input", { bubbles: true }));
    });

    await act(async () => {
      getButtonByText(/^Guardar$/)!.click();
    });

    // Verify localStorage has the preset
    expect(JSON.parse(window.localStorage.getItem(PRESETS_KEY) ?? "[]")).toHaveLength(1);

    // Unmount the first instance
    await unmountContainer(firstContainer);

    // Mount a fresh instance — renderFilter creates a new container
    const { getSavedPresetChips } = await renderFilter();

    // Verify the preset loaded from localStorage
    const chips = getSavedPresetChips();
    expect(chips).toHaveLength(1);
    expect(chips[0].textContent).toContain("Cross-mount");
  });

  describe("keyboard shortcuts", () => {
    it("Alt+1 applies the first default preset (Últimos 30 días)", async () => {
      await renderFilter({
        activeDateFrom: "",
        activeDateTo: "",
        filteredCount: 0,
      });

      await act(async () => {
        document.dispatchEvent(
          new KeyboardEvent("keydown", { key: "1", altKey: true, bubbles: true, cancelable: true }),
        );
      });

      // Should have navigated to the preset's date range
      expect(mockPush).toHaveBeenCalledWith(expect.stringContaining("dateFrom="));
      expect(mockPush).toHaveBeenCalledWith(expect.stringContaining("dateTo="));
    });

    it("Alt+2 applies the second default preset (Este mes)", async () => {
      await renderFilter({
        activeDateFrom: "",
        activeDateTo: "",
        filteredCount: 0,
      });

      await act(async () => {
        document.dispatchEvent(
          new KeyboardEvent("keydown", { key: "2", altKey: true, bubbles: true, cancelable: true }),
        );
      });

      expect(mockPush).toHaveBeenCalledWith(expect.stringContaining("dateFrom="));
      expect(mockPush).toHaveBeenCalledWith(expect.stringContaining("dateTo="));
    });

    it("Alt+4 applies the custom preset (Personalizado) without navigation", async () => {
      await renderFilter({
        activeDateFrom: "",
        activeDateTo: "",
        filteredCount: 0,
      });

      // The custom preset clears inputs and focuses them, no navigation
      await act(async () => {
        document.dispatchEvent(
          new KeyboardEvent("keydown", { key: "4", altKey: true, bubbles: true, cancelable: true }),
        );
      });

      // Custom preset has empty dates and does NOT call applyFilter, so no push
      expect(mockPush).not.toHaveBeenCalled();
    });

    it("Alt+5 applies the first saved preset when defaults are visible", async () => {
      // Pre-populate with 2 saved presets
      const savedPresets = [
        { id: "s1", name: "Saved A", dateFrom: "2026-05-01", dateTo: "2026-05-31" },
        { id: "s2", name: "Saved B", dateFrom: "2026-06-01", dateTo: "2026-06-30" },
      ];
      window.localStorage.setItem(PRESETS_KEY, JSON.stringify(savedPresets));

      await renderFilter({
        activeDateFrom: "",
        activeDateTo: "",
        filteredCount: 0,
      });

      // Alt+5 → allPresets[5-1] = allPresets[4] = first saved preset (after 4 defaults)

      await act(async () => {
        document.dispatchEvent(
          new KeyboardEvent("keydown", { key: "5", altKey: true, bubbles: true, cancelable: true }),
        );
      });

      // Should navigate to Saved A's date range
      expect(mockPush).toHaveBeenCalledWith(expect.stringContaining("dateFrom=2026-05-01"));
      expect(mockPush).toHaveBeenCalledWith(expect.stringContaining("dateTo=2026-05-31"));
    });

    it("Alt+1 applies the first saved preset when defaults are hidden", async () => {
      // Pre-populate with 2 saved presets
      const savedPresets = [
        { id: "s1", name: "First", dateFrom: "2026-07-01", dateTo: "2026-07-31" },
        { id: "s2", name: "Second", dateFrom: "2026-08-01", dateTo: "2026-08-31" },
      ];
      window.localStorage.setItem(PRESETS_KEY, JSON.stringify(savedPresets));

      await renderFilter({
        activeDateFrom: "",
        activeDateTo: "",
        filteredCount: 0,
      });

      // Hide defaults first — allPresets = [...defaultPresets, ...presets] initially
      // After hiding: allPresets = [...presets] (only saved presets)
      const toggleBtn = activeContainer!.querySelector('button[title*="Ocultar"]');
      expect(toggleBtn).toBeTruthy();

      await act(async () => {
        toggleBtn!.click();
      });

      mockPush.mockClear();

      // Now defaults are hidden. AllPresets = [...presets] = [SavedFirst, SavedSecond]
      // Alt+1 → allPresets[0] = first saved preset
      await act(async () => {
        document.dispatchEvent(
          new KeyboardEvent("keydown", { key: "1", altKey: true, bubbles: true, cancelable: true }),
        );
      });

      expect(mockPush).toHaveBeenCalledWith(expect.stringContaining("dateFrom=2026-07-01"));
      expect(mockPush).toHaveBeenCalledWith(expect.stringContaining("dateTo=2026-07-31"));
    });

    it("Alt+0 clears the filter", async () => {
      await renderFilter();

      // Initially we have activeDateFrom=2026-01-01 and activeDateTo=2026-03-31
      // Clear buttons should be visible
      const clearButton = activeContainer!.querySelector('button[title*="Limpiar"]');
      expect(clearButton).toBeTruthy();

      await act(async () => {
        document.dispatchEvent(
          new KeyboardEvent("keydown", { key: "0", altKey: true, bubbles: true, cancelable: true }),
        );
      });

      // Should navigate with empty dates (clearing the filter)
      expect(mockPush).toHaveBeenCalledWith(
        expect.not.stringContaining("dateFrom="),
      );
      expect(mockPush).toHaveBeenCalledWith(
        expect.stringContaining("projectId=test-project-123"),
      );
    });

    it("does nothing on Alt+9 when no preset at that index", async () => {
      await renderFilter({
        activeDateFrom: "",
        activeDateTo: "",
        filteredCount: 0,
      });

      mockPush.mockClear();

      await act(async () => {
        document.dispatchEvent(
          new KeyboardEvent("keydown", { key: "9", altKey: true, bubbles: true, cancelable: true }),
        );
      });

      // No preset at index 9, nothing should happen
      expect(mockPush).not.toHaveBeenCalled();
    });

    it("ignores non-Alt keydowns", async () => {
      await renderFilter({
        activeDateFrom: "",
        activeDateTo: "",
        filteredCount: 0,
      });

      await act(async () => {
        document.dispatchEvent(
          new KeyboardEvent("keydown", { key: "1", altKey: false, bubbles: true, cancelable: true }),
        );
      });

      // Without Alt, should not trigger any navigation
      expect(mockPush).not.toHaveBeenCalled();
    });
  });

  it("toggles default presets visibility", async () => {
    const { container, getButtonByText } = await renderFilter({
      activeDateFrom: "",
      activeDateTo: "",
      filteredCount: 0,
    });

    // The default presets should be visible initially
    const toggleBtn = getButtonByText(/Ocultar|Mostrar/);
    expect(toggleBtn).toBeTruthy();
    expect(toggleBtn!.textContent).toContain("Ocultar");

    // Default presets should be in the DOM
    const defaultButtons = [...container.querySelectorAll("button")].filter(
      (b) => b.textContent?.includes("Últimos 30 días") || b.textContent?.includes("Este mes"),
    );
    expect(defaultButtons.length).toBeGreaterThan(0);

    // Click toggle to hide
    await act(async () => {
      toggleBtn!.click();
    });

    // Now default presets should be hidden
    const hiddenDefaults = [...container.querySelectorAll("button")].filter(
      (b) => b.textContent?.includes("Últimos 30 días") || b.textContent?.includes("Este mes"),
    );
    expect(hiddenDefaults.length).toBe(0);

    // Toggle text should have changed
    expect(toggleBtn!.textContent).toContain("Mostrar");

    // Preference persisted to localStorage
    expect(window.localStorage.getItem("myc-metrado-show-defaults-" + PROJECT_ID)).toBe("false");
  });
});
