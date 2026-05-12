/* @vitest-environment jsdom */

import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

vi.mock("@/lib/client/live-updates", () => ({
  broadcastAppDataChange: vi.fn(),
}));

vi.mock("@/components/ui/select", () => ({
  Select: ({
    children,
    defaultValue,
    id,
    name,
  }: {
    children: React.ReactNode;
    defaultValue?: string;
    id?: string;
    name?: string;
  }) => (
    <select defaultValue={defaultValue} id={id} name={name}>
      {children}
    </select>
  ),
}));

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

let activeContainer: HTMLDivElement | null = null;

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

import { BudgetForm } from "@/components/budget/budget-form";

describe("BudgetForm", () => {
  afterEach(async () => {
    vi.restoreAllMocks();

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

  it("renders suggested currency and rates from settings defaults", async () => {
    const { getInput, getSelect } = await renderForm(
      <BudgetForm
        projects={[{ id: "project-1", name: "Proyecto 1" }]}
        defaultProjectId="project-1"
        defaultCurrency="USD"
        defaultIgvRate={0.19}
        defaultGeneralExpensesRate={0.125}
        defaultUtilityRate={0.09}
      />,
    );

    expect(getSelect("currency").value).toBe("USD");
    expect(getInput("igvRate").value).toBe("0.19");
    expect(getInput("generalExpensesRate").value).toBe("0.125");
    expect(getInput("utilityRate").value).toBe("0.09");
  });

  it("allows three-decimal rate increments for persisted settings defaults", async () => {
    const { getInput } = await renderForm(
      <BudgetForm
        projects={[{ id: "project-1", name: "Proyecto 1" }]}
        defaultProjectId="project-1"
        defaultIgvRate={0.115}
        defaultGeneralExpensesRate={0.125}
        defaultUtilityRate={0.105}
      />,
    );

    expect(getInput("igvRate").step).toBe("0.001");
    expect(getInput("generalExpensesRate").step).toBe("0.001");
    expect(getInput("utilityRate").step).toBe("0.001");
    expect(getInput("igvRate").value).toBe("0.115");
    expect(getInput("generalExpensesRate").value).toBe("0.125");
    expect(getInput("utilityRate").value).toBe("0.105");
  });
});

async function renderForm(node: React.ReactNode) {
  const nextContainer = document.createElement("div");
  document.body.appendChild(nextContainer);
  activeContainer = nextContainer;

  const root = createRoot(nextContainer);
  (nextContainer as HTMLDivElement & { __root?: typeof root }).__root = root;

  await act(async () => {
    root.render(node);
  });

  return {
    getSelect: (id: string) => {
      const element = nextContainer.querySelector(`select#${id}`);

      if (!(element instanceof HTMLSelectElement)) {
        throw new Error(`Missing select ${id}`);
      }

      return element;
    },
    getInput: (id: string) => {
      const element = nextContainer.querySelector(`input#${id}`);

      if (!(element instanceof HTMLInputElement)) {
        throw new Error(`Missing input ${id}`);
      }

      return element;
    },
  };
}
