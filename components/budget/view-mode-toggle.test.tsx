/* @vitest-environment jsdom */

import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { BudgetViewModeProvider } from "@/components/budget/view-mode-provider";
import { ViewModeToggle } from "@/components/budget/view-mode-toggle";

let activeContainer: HTMLDivElement | null = null;

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe("ViewModeToggle", () => {
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
  });

  it("switches between modern and excel labels inside the provider scope", async () => {
    const { host, getByText } = await renderToggle();

    expect(host.dataset.viewMode).toBe("modern");
    expect(getByText("Moderna").getAttribute("aria-pressed")).toBe("true");
    expect(getByText("Tipo Excel").getAttribute("aria-pressed")).toBe("false");

    await act(async () => {
      getByText("Tipo Excel").click();
    });

    expect(host.dataset.viewMode).toBe("excel");
    expect(getByText("Moderna").getAttribute("aria-pressed")).toBe("false");
    expect(getByText("Tipo Excel").getAttribute("aria-pressed")).toBe("true");
    expect(window.localStorage.getItem("app_view_mode")).toBe("excel");
  });
});

async function renderToggle() {
  const nextContainer = document.createElement("div");
  document.body.appendChild(nextContainer);
  activeContainer = nextContainer;

  const root = createRoot(nextContainer);
  (nextContainer as HTMLDivElement & { __root?: typeof root }).__root = root;

  await act(async () => {
    root.render(
      <BudgetViewModeProvider>
        <ViewModeToggle />
      </BudgetViewModeProvider>,
    );
  });

  return {
    host: nextContainer.firstElementChild as HTMLDivElement,
    getByText: (text: string) => {
      const matcher = new RegExp(`^${text}$`);
      const element = [...nextContainer.querySelectorAll("button")].find((candidate) => matcher.test(candidate.textContent ?? ""));

      if (!(element instanceof HTMLButtonElement)) {
        throw new Error(`Missing button: ${text}`);
      }

      return element;
    },
  };
}
