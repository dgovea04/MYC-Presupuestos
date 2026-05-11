/* @vitest-environment jsdom */

import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BudgetFlow } from "@/components/budget/budget-flow";
import type { BudgetRecord } from "@/types/budget";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: vi.fn(),
  }),
}));

let activeContainer: HTMLDivElement | null = null;

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe("BudgetFlow", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(async () => {
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

  it("applies the route-level budget flow provider contract to the editor", async () => {
    const { host, getButtonByText, getByText, getEditorRoot } = await renderBudgetFlow();

    expect(host.dataset.viewMode).toBe("modern");
    expect(getByText("Vista moderna activa")).toBeTruthy();
    expect(getEditorRoot().className).toContain("budget-modern-flow");

    await act(async () => {
      getButtonByText("Tipo Excel").click();
    });

    expect(host.dataset.viewMode).toBe("excel");
    expect(getByText("Modo Excel activo")).toBeTruthy();
    expect(getEditorRoot().className).toContain("budget-excel-flow");
  });
});

async function renderBudgetFlow() {
  const nextContainer = document.createElement("div");
  document.body.appendChild(nextContainer);
  activeContainer = nextContainer;

  const root = createRoot(nextContainer);
  (nextContainer as HTMLDivElement & { __root?: typeof root }).__root = root;

  await act(async () => {
    root.render(<BudgetFlow budget={createBudget()} partidasCatalog={[]} projectName="Proyecto Demo" resourcesCatalog={[]} />);
  });

  return {
    host: nextContainer.firstElementChild as HTMLDivElement,
    getButtonByText: (text: string) => {
      const matcher = new RegExp(`^${text}$`);
      const element = [...nextContainer.querySelectorAll("button")].find((candidate) => matcher.test(candidate.textContent ?? ""));

      if (!(element instanceof HTMLButtonElement)) {
        throw new Error(`Missing button: ${text}`);
      }

      return element;
    },
    getByText: (text: string) => {
      const matcher = new RegExp(text);
      const element = [...nextContainer.querySelectorAll("*")].find((candidate) => matcher.test(candidate.textContent ?? ""));

      if (!(element instanceof HTMLElement)) {
        throw new Error(`Missing element: ${text}`);
      }

      return element;
    },
    getEditorRoot: () => {
      const element = nextContainer.querySelector("[data-view-mode-scope='budget-flow']");

      if (!(element instanceof HTMLDivElement)) {
        throw new Error("Missing budget editor root");
      }

      return element;
    },
  };
}

function createBudget(): BudgetRecord {
  return {
    id: "budget-1",
    projectId: "project-1",
    parentBudgetId: null,
    kind: "SUB_BUDGET",
    name: "Presupuesto de prueba",
    currency: "PEN",
    igvRate: 0.18,
    generalExpensesRate: 0.1,
    utilityRate: 0.08,
    totalDirectCost: 0,
    totalGeneralExpenses: 0,
    totalUtility: 0,
    totalTax: 0,
    totalAmount: 0,
    levels: [],
    items: [],
  };
}
