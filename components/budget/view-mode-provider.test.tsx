/* @vitest-environment jsdom */

import React, { act } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BudgetViewModeProvider, useBudgetViewMode } from "@/components/budget/view-mode-provider";

let activeContainer: HTMLDivElement | null = null;

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe("BudgetViewModeProvider", () => {
  afterEach(async () => {
    window.localStorage.clear();

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

    vi.restoreAllMocks();
  });

  it("reads stored excel mode on mount and updates data-view-mode", async () => {
    window.localStorage.setItem("app_view_mode", "excel");

    const { host } = await renderWithProvider(<Probe />);

    expect(host.dataset.viewMode).toBe("excel");
    expect(host.querySelector("[data-probe-mode]")?.textContent).toBe("excel");
  });

  it("setViewMode persists changes and updates the DOM", async () => {
    const setItemSpy = vi.spyOn(Storage.prototype, "setItem");
    const { host, getByTestId } = await renderWithProvider(<ModeSwitcher />);

    await flushEffects();

    await act(async () => {
      getByTestId("excel-button").click();
    });

    expect(host.dataset.viewMode).toBe("excel");
    expect(setItemSpy).toHaveBeenCalledWith("app_view_mode", "excel");
    expect(window.localStorage.getItem("app_view_mode")).toBe("excel");
  });

  it("falls back safely when storage access fails through the provider path", async () => {
    const getItemSpy = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    const setItemSpy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });

    const { host, getByTestId } = await renderWithProvider(<ModeSwitcher />);

    await flushEffects();

    expect(host.dataset.viewMode).toBe("modern");
    expect(getItemSpy).toHaveBeenCalled();

    await act(async () => {
      getByTestId("excel-button").click();
    });

    expect(host.dataset.viewMode).toBe("excel");
    expect(setItemSpy).toHaveBeenCalled();
  });

  it("throws when useBudgetViewMode is used outside the provider", async () => {
    const boundaryContainer = document.createElement("div");
    const root = createRoot(boundaryContainer);
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    flushSync(() => {
      root.render(
        <HookGuardBoundary>
          <OrphanProbe />
        </HookGuardBoundary>,
      );
    });

    expect(boundaryContainer.textContent).toContain("useBudgetViewMode must be used within BudgetViewModeProvider");

    root.unmount();
    consoleErrorSpy.mockRestore();
  });
});

async function renderWithProvider(node: React.ReactNode) {
  const nextContainer = document.createElement("div");
  document.body.appendChild(nextContainer);
  activeContainer = nextContainer;

  const root = createRoot(nextContainer);
  (nextContainer as HTMLDivElement & { __root?: typeof root }).__root = root;

  await act(async () => {
    root.render(<BudgetViewModeProvider>{node}</BudgetViewModeProvider>);
  });

  return {
    host: nextContainer.firstElementChild as HTMLDivElement,
    getByTestId: (testId: string) => {
      const element = nextContainer.querySelector(`[data-testid="${testId}"]`);

      if (!(element instanceof HTMLElement)) {
        throw new Error(`Missing element: ${testId}`);
      }

      return element;
    },
  };
}

async function flushEffects() {
  await act(async () => {
    await Promise.resolve();
  });
}

function Probe() {
  const { viewMode } = useBudgetViewMode();

  return <span data-probe-mode>{viewMode}</span>;
}

function ModeSwitcher() {
  const { setViewMode, viewMode } = useBudgetViewMode();

  return (
    <button data-testid="excel-button" data-current-mode={viewMode} onClick={() => setViewMode("excel")} type="button">
      Excel
    </button>
  );
}

function OrphanProbe() {
  useBudgetViewMode();

  return <span>unreachable</span>;
}

class HookGuardBoundary extends React.Component<{ children: React.ReactNode }, { message: string | null }> {
  override state = { message: null };

  static override getDerivedStateFromError(error: Error) {
    return { message: error.message };
  }

  override render() {
    if (this.state.message) {
      return <span data-testid="hook-guard-error">{this.state.message}</span>;
    }

    return this.props.children;
  }
}
