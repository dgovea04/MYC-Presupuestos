/* @vitest-environment jsdom */

import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SubBudgetCreateSheet } from "@/components/budget/sub-budget-create-sheet";

const refreshMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: refreshMock,
  }),
}));

vi.mock("@/components/view-mode/app-view-mode-provider", () => ({
  useAppViewMode: () => ({ isExcelMode: false }),
}));

vi.mock("@/components/providers/formatting-settings-provider", () => ({
  useFormattingSettings: () => ({ excelRowHeight: 52, excelShowFieldBorders: true }),
}));

let activeContainer: HTMLDivElement | null = null;

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe("SubBudgetCreateSheet", () => {
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

    vi.unstubAllGlobals();
    refreshMock.mockReset();
  });

  it("opens the off-canvas form and creates a sub budget under the general budget", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: "sub-new", name: "Instalaciones Mecanicas" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { getButton, getInput } = await renderSheet();

    await act(async () => {
      getButton("Nuevo Sub Presupuesto").click();
    });

    expect(document.body.textContent).toContain("Nuevo Sub Presupuesto");
    expect(document.body.textContent).toContain("Presupuesto General");

    await act(async () => {
      const nameInput = getInput("subBudgetName");
      nameInput.value = "Instalaciones Mecanicas";
      nameInput.dispatchEvent(new Event("input", { bubbles: true }));
    });

    await act(async () => {
      getButton("Crear Sub Presupuesto").click();
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/budgets",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: "project-1",
          parentBudgetId: "general-1",
          kind: "SUB_BUDGET",
          name: "Instalaciones Mecanicas",
          currency: "PEN",
          igvRate: 0.18,
          generalExpensesRate: 0.1,
          utilityRate: 0.08,
        }),
      }),
    );
    expect(refreshMock).toHaveBeenCalledTimes(1);
  });
});

async function renderSheet() {
  const nextContainer = document.createElement("div");
  document.body.appendChild(nextContainer);
  activeContainer = nextContainer;

  const root = createRoot(nextContainer);
  (nextContainer as HTMLDivElement & { __root?: typeof root }).__root = root;

  await act(async () => {
    root.render(
      <SubBudgetCreateSheet
        projectId="project-1"
        parentBudgetId="general-1"
        parentBudgetName="Presupuesto General"
        currency="PEN"
        igvRate={0.18}
        generalExpensesRate={0.1}
        utilityRate={0.08}
      />,
    );
  });

  return {
    getButton: (label: string) => {
      const button = Array.from(document.querySelectorAll("button")).find((element) => element.textContent?.includes(label));

      if (!(button instanceof HTMLButtonElement)) {
        throw new Error(`Missing button: ${label}`);
      }

      return button;
    },
    getInput: (id: string) => {
      const input = document.getElementById(id);

      if (!(input instanceof HTMLInputElement)) {
        throw new Error(`Missing input: ${id}`);
      }

      return input;
    },
  };
}
