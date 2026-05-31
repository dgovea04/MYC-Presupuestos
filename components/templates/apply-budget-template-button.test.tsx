/* @vitest-environment jsdom */

import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApplyBudgetTemplateButton } from "@/components/templates/apply-budget-template-button";

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push }),
}));

let activeContainer: HTMLDivElement | null = null;

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe("ApplyBudgetTemplateButton", () => {
  beforeEach(() => {
    mocks.push.mockReset();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ id: "budget-created" }),
      })),
    );
  });

  afterEach(async () => {
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

  it("applies a template and navigates to the created budget", async () => {
    const { getButton, getInput, getSelect } = await renderButton();

    await act(async () => {
      getButton("Aplicar plantilla").click();
    });
    await act(async () => {
      setInputValue(getInput("Nombre del nuevo presupuesto"), "Arquitectura aplicada");
      setSelectValue(getSelect("Proyecto destino"), "project-2");
      getButton("Crear presupuesto").click();
    });

    expect(fetch).toHaveBeenCalledWith("/api/templates/budget/template-1/apply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId: "project-2",
        name: "Arquitectura aplicada",
      }),
    });
    expect(mocks.push).toHaveBeenCalledWith("/budgets/budget-created");
  });
});

async function renderButton() {
  const nextContainer = document.createElement("div");
  document.body.appendChild(nextContainer);
  activeContainer = nextContainer;

  const root = createRoot(nextContainer);
  (nextContainer as HTMLDivElement & { __root?: typeof root }).__root = root;

  await act(async () => {
    root.render(
      <ApplyBudgetTemplateButton
        templateId="template-1"
        defaultBudgetName="Arquitectura reusable"
        projects={[
          { id: "project-1", name: "Proyecto 1" },
          { id: "project-2", name: "Proyecto 2" },
        ]}
      />,
    );
  });

  return {
    getButton: (label: string) => {
      const button = [...document.body.querySelectorAll("button")].find((candidate) => candidate.textContent?.includes(label));
      if (!(button instanceof HTMLButtonElement)) {
        throw new Error(`Missing button: ${label}`);
      }
      return button;
    },
    getInput: (label: string) => {
      const input = document.body.querySelector(`input[aria-label="${label}"]`);
      if (!(input instanceof HTMLInputElement)) {
        throw new Error(`Missing input: ${label}`);
      }
      return input;
    },
    getSelect: (label: string) => {
      const select = document.body.querySelector(`select[aria-label="${label}"]`);
      if (!(select instanceof HTMLSelectElement)) {
        throw new Error(`Missing select: ${label}`);
      }
      return select;
    },
  };
}

function setInputValue(element: HTMLInputElement, value: string) {
  const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  valueSetter?.call(element, value);
  element.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: value }));
}

function setSelectValue(element: HTMLSelectElement, value: string) {
  const valueSetter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set;
  valueSetter?.call(element, value);
  element.dispatchEvent(new Event("change", { bubbles: true }));
}
