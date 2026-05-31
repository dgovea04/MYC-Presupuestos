/* @vitest-environment jsdom */

import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { EditBudgetTemplateButton } from "@/components/templates/edit-budget-template-button";

const mocks = vi.hoisted(() => ({
  refresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}));

let activeContainer: HTMLDivElement | null = null;

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe("EditBudgetTemplateButton", () => {
  beforeEach(() => {
    mocks.refresh.mockReset();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ id: "template-1", name: "Arquitectura costa" }),
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

  it("updates template metadata and refreshes the page", async () => {
    const { getButton, getInput, getTextarea } = await renderButton();

    await act(async () => {
      getButton("Editar").click();
    });
    await act(async () => {
      setInputValue(getInput("Nombre de plantilla"), "Arquitectura costa");
      setTextareaValue(getTextarea("Descripcion"), "Base ajustada");
      getButton("Guardar cambios").click();
    });

    expect(fetch).toHaveBeenCalledWith("/api/templates/budget/template-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Arquitectura costa",
        description: "Base ajustada",
      }),
    });
    expect(mocks.refresh).toHaveBeenCalled();
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
      <EditBudgetTemplateButton
        templateId="template-1"
        initialName="Arquitectura reusable"
        initialDescription="Base inicial"
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
    getTextarea: (label: string) => {
      const textarea = document.body.querySelector(`textarea[aria-label="${label}"]`);
      if (!(textarea instanceof HTMLTextAreaElement)) {
        throw new Error(`Missing textarea: ${label}`);
      }
      return textarea;
    },
  };
}

function setInputValue(element: HTMLInputElement, value: string) {
  const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  valueSetter?.call(element, value);
  element.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: value }));
}

function setTextareaValue(element: HTMLTextAreaElement, value: string) {
  const valueSetter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
  valueSetter?.call(element, value);
  element.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: value }));
}
