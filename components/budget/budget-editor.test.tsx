/* @vitest-environment jsdom */

import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { BudgetEditor } from "@/components/budget/budget-editor";
import { BudgetViewModeProvider } from "@/components/budget/view-mode-provider";
import type { BudgetRecord } from "@/types/budget";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: vi.fn(),
    push: vi.fn(),
  }),
}));

vi.mock("@/components/notes/notes-drawer", () => ({
  openNoteDraft: vi.fn(),
}));

let activeContainer: HTMLDivElement | null = null;
let originalScrollIntoView: typeof HTMLElement.prototype.scrollIntoView | undefined;

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe("BudgetEditor Khipu floating panel blur guard", () => {
  beforeAll(() => {
    originalScrollIntoView = HTMLElement.prototype.scrollIntoView;
    HTMLElement.prototype.scrollIntoView = () => undefined;
  });

  afterAll(() => {
    if (originalScrollIntoView) {
      HTMLElement.prototype.scrollIntoView = originalScrollIntoView;
      return;
    }
    Reflect.deleteProperty(HTMLElement.prototype, "scrollIntoView");
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

    document.querySelector("[data-khipu-panel]")?.remove();
    vi.restoreAllMocks();
  });

  it("does not clear activeRowId when focus moves to the Khipu floating panel", async () => {
    const fetcher = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ optimisticBudgets: [] }),
    } as Response);

    const { getButtonByText, getInputByValue, getOrderedInputValues, getKhipuPanelElement } =
      await renderEditor({
        budget: createBudgetWithTwoItems(),
      });

    // Focus the description input of "Partida demo" to simulate clicking its row
    const descriptionInput = getInputByValue("Partida demo");
    await act(async () => {
      descriptionInput.focus();
    });

    // Verify the row is active: Alt+ArrowDown moves the item down
    await act(async () => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", { bubbles: true, altKey: true, key: "ArrowDown" }),
      );
    });

    const afterFirstMove = getOrderedInputValues(["Partida demo", "Partida secundaria"]);
    expect(afterFirstMove).toEqual(["Partida secundaria", "Partida demo"]);

    // Focus the Khipu floating panel textarea. This triggers a real blur on
    // the budget input, whose capture phase fires onBlurCapture on the editor root.
    // Since relatedTarget has a [data-khipu-panel] ancestor, the guard should
    // prevent clearing activeRowId.
    const khipuTarget = getKhipuPanelElement();
    await act(async () => {
      khipuTarget.focus();
    });

    // Return focus to a non-row element inside the editor. The Alt+Arrow handler
    // requires isFocusedWithinEditor to be true, and getFocusedBudgetRowId returns
    // null (button is not a row), so it falls back to activeRowIdRef.current.
    // If the Khipu guard preserved activeRowId, the item should move.
    const saveButton = getButtonByText("Guardar");
    await act(async () => {
      saveButton.focus();
    });

    await act(async () => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", { bubbles: true, altKey: true, key: "ArrowUp" }),
      );
    });

    const afterSecondMove = getOrderedInputValues(["Partida demo", "Partida secundaria"]);
    expect(afterSecondMove).toEqual(["Partida demo", "Partida secundaria"]);

    // Sanity check: blur to a non-Khipu element DOES clear the selection.
    // After that, refocus inside the editor — Alt+Arrow should do nothing because
    // activeRowId was cleared by the non-guarded blur.
    const outsideElement = document.createElement("button");
    outsideElement.textContent = "Random outside element";
    document.body.appendChild(outsideElement);

    await act(async () => {
      outsideElement.focus();
    });

    await act(async () => {
      saveButton.focus();
    });

    await act(async () => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", { bubbles: true, altKey: true, key: "ArrowDown" }),
      );
    });

    const afterBlurOutside = getOrderedInputValues(["Partida demo", "Partida secundaria"]);
    expect(afterBlurOutside).toEqual(["Partida demo", "Partida secundaria"]);

    // Also verify no save was triggered
    expect(fetcher).not.toHaveBeenCalled();

    outsideElement.remove();
  });

  it("does clear activeRowId when focus moves to an unrelated element outside the editor", async () => {
    const { getButtonByText, getInputByValue, getOrderedInputValues } = await renderEditor({
      budget: createBudgetWithTwoItems(),
    });

    // Focus the description input of "Partida demo" to set an active row
    const descriptionInput = getInputByValue("Partida demo");
    await act(async () => {
      descriptionInput.focus();
    });

    // Verify row is active via Alt+ArrowDown
    await act(async () => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", { bubbles: true, altKey: true, key: "ArrowDown" }),
      );
    });

    const afterMove = getOrderedInputValues(["Partida demo", "Partida secundaria"]);
    expect(afterMove).toEqual(["Partida secundaria", "Partida demo"]);

    // Blur to an unrelated outside element (no data-khipu-panel)
    const outside = document.createElement("button");
    outside.textContent = "Outside";
    document.body.appendChild(outside);

    await act(async () => {
      outside.focus();
    });

    // Return focus to a non-row element inside the editor, then dispatch
    // Alt+ArrowDown. Since activeRowId was cleared, the fallback returns null
    // and the item should NOT move.
    const saveButton = getButtonByText("Guardar");
    await act(async () => {
      saveButton.focus();
    });

    await act(async () => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", { bubbles: true, altKey: true, key: "ArrowDown" }),
      );
    });

    const afterBlur = getOrderedInputValues(["Partida demo", "Partida secundaria"]);
    expect(afterBlur).toEqual(["Partida secundaria", "Partida demo"]);

    outside.remove();
  });
});

async function renderEditor(options?: { budget?: BudgetRecord }) {
  const nextContainer = document.createElement("div");
  document.body.appendChild(nextContainer);
  activeContainer = nextContainer;

  const root = createRoot(nextContainer);
  (nextContainer as HTMLDivElement & { __root?: typeof root }).__root = root;

  await act(async () => {
    root.render(
      <BudgetViewModeProvider>
        <BudgetEditor
          budget={options?.budget ?? createBudget()}
          partidasCatalog={[]}
          projectName="Proyecto Demo"
          resourcesCatalog={[]}
        />
      </BudgetViewModeProvider>,
    );
  });

  return {
    getButtonByText: (text: string) => {
      const matcher = new RegExp(`^${text}$`);
      const element = [...document.body.querySelectorAll("button")].find(
        (candidate) => matcher.test(candidate.textContent ?? ""),
      );
      if (!(element instanceof HTMLButtonElement)) {
        throw new Error(`Missing button: ${text}`);
      }
      return element;
    },
    getInputByValue: (value: string) => {
      const element = [...document.body.querySelectorAll("input")].find(
        (candidate) => candidate.value === value,
      );
      if (!(element instanceof HTMLInputElement)) {
        throw new Error(`Missing input with value: ${value}`);
      }
      return element;
    },
    getOrderedInputValues: (values: string[]) =>
      [...nextContainer.querySelectorAll("input")]
        .map((candidate) => candidate.value)
        .filter((value) => values.includes(value)),
    getKhipuPanelElement: () => {
      // Create a fresh Khipu panel mock positioned outside the editor tree
      const khipuPanel = document.createElement("div");
      khipuPanel.setAttribute("data-khipu-panel", "");
      khipuPanel.style.position = "fixed";
      khipuPanel.style.right = "1rem";
      khipuPanel.style.bottom = "1rem";
      khipuPanel.style.zIndex = "60";

      const khipuInput = document.createElement("textarea");
      khipuInput.placeholder = "Escribe tu consulta...";
      khipuInput.setAttribute("aria-label", "Enviar consulta");
      khipuPanel.appendChild(khipuInput);

      document.body.appendChild(khipuPanel);
      return khipuInput;
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

function createBudgetWithItem(): BudgetRecord {
  return {
    ...createBudget(),
    totalDirectCost: 100,
    totalGeneralExpenses: 10,
    totalUtility: 8,
    totalTax: 21.24,
    totalAmount: 139.24,
    items: [
      {
        id: "item-1",
        budgetId: "budget-1",
        levelId: null,
        code: "IT-1",
        description: "Partida demo",
        unit: "m2",
        quantity: 5,
        unitPrice: 20,
        partial: 100,
        sortOrder: 1,
        apu: {
          id: "apu-1",
          budgetItemId: "item-1",
          name: "Partida demo",
          unit: "m2",
          performance: 1,
          totalUnitCost: 20,
          resources: [],
        },
      },
    ],
  };
}

function createBudgetWithTwoItems(): BudgetRecord {
  return {
    ...createBudgetWithItem(),
    items: [
      createBudgetWithItem().items[0]!,
      {
        id: "item-3",
        budgetId: "budget-1",
        levelId: null,
        code: "IT-3",
        description: "Partida secundaria",
        unit: "m2",
        quantity: 2,
        unitPrice: 30,
        partial: 60,
        sortOrder: 2,
        apu: null,
      },
    ],
  };
}
