/* @vitest-environment jsdom */

import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SubBudgetDeleteButton } from "@/components/budget/sub-budget-delete-button";

const refreshMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: refreshMock,
  }),
}));

let activeContainer: HTMLDivElement | null = null;

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe("SubBudgetDeleteButton", () => {
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

  it("opens the delete popup, deletes the sub budget, and refreshes the current route", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { clickButton } = await renderButton();

    await act(async () => {
      clickButton("Eliminar");
    });

    expect(document.body.textContent).toContain("Eliminar Sub Presupuesto");
    expect(document.body.textContent).toContain("Arquitectura");
    expect(document.body.textContent).toContain("partidas, APU y datos asociados");

    await act(async () => {
      clickButton("Eliminar Sub Presupuesto");
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/budgets/sub-1", { method: "DELETE" });
    expect(refreshMock).toHaveBeenCalledTimes(1);
  });
});

async function renderButton() {
  const nextContainer = document.createElement("div");
  document.body.appendChild(nextContainer);
  activeContainer = nextContainer;

  const root = createRoot(nextContainer);
  (nextContainer as HTMLDivElement & { __root?: typeof root }).__root = root;

  await act(async () => {
    root.render(<SubBudgetDeleteButton subBudgetId="sub-1" subBudgetName="Arquitectura" />);
  });

  return {
    clickButton: (label: string) => {
      const button = Array.from(document.querySelectorAll("button")).find((element) => element.textContent?.includes(label));

      if (!(button instanceof HTMLButtonElement)) {
        throw new Error(`Missing button: ${label}`);
      }

      button.click();
    },
  };
}
