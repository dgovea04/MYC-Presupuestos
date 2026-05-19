/* @vitest-environment jsdom */

import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { BudgetViewModeProvider, useBudgetViewMode } from "@/components/budget/view-mode-provider";
import { UnifiedIndexDictionaryPageContent } from "@/components/unified-indices/unified-index-dictionary-page-content";

let activeContainer: HTMLDivElement | null = null;

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe("UnifiedIndexDictionaryPageContent excel view mode", () => {
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

  it("uses the compact virtualized frame and filter summary in excel mode", async () => {
    const { getByTestId, getControl, getFrame } = await renderDictionaryTable();

    expect(getFrame().className).not.toContain("rounded-md");
    expect(getControl().className).not.toContain("rounded-md");

    await act(async () => {
      getByTestId("excel-mode-button").click();
    });

    expect(getFrame().className).toContain("rounded-none");
    expect(getFrame().className).toContain("border-transparent");
    expect(getFrame().className).toContain("shadow-none");
    expect(getControl().className).toContain("rounded-md");
  });
});

async function renderDictionaryTable() {
  const nextContainer = document.createElement("div");
  document.body.appendChild(nextContainer);
  activeContainer = nextContainer;

  const root = createRoot(nextContainer);
  (nextContainer as HTMLDivElement & { __root?: typeof root }).__root = root;

  await act(async () => {
    root.render(
      <BudgetViewModeProvider>
        <DictionaryModeHarness />
      </BudgetViewModeProvider>,
    );
  });

  return {
    getByTestId: (testId: string) => {
      const element = nextContainer.querySelector(`[data-testid="${testId}"]`);

      if (!(element instanceof HTMLButtonElement)) {
        throw new Error(`Missing element: ${testId}`);
      }

      return element;
    },
    getControl: () => {
      const element = nextContainer.querySelector("[data-testid='unified-index-dictionary-filter-summary']");

      if (!(element instanceof HTMLDivElement)) {
        throw new Error("Missing filter summary");
      }

      return element;
    },
    getFrame: () => {
      const element = nextContainer.querySelector("[data-testid='virtualized-table-frame']");

      if (!(element instanceof HTMLDivElement)) {
        throw new Error("Missing virtualized table frame");
      }

      return element;
    },
  };
}

function DictionaryModeHarness() {
  const { setViewMode } = useBudgetViewMode();

  return (
    <>
      <button data-testid="excel-mode-button" type="button" onClick={() => setViewMode("excel")}>
        Excel
      </button>
      <UnifiedIndexDictionaryPageContent
        rows={[
          {
            code: "04720",
            element: "Acero corrugado",
            note: "Varilla",
          },
        ]}
      />
    </>
  );
}
