/* @vitest-environment jsdom */

import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SaveBudgetTemplateButton } from "@/components/budget/save-budget-template-button";

let activeContainer: HTMLDivElement | null = null;

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe("SaveBudgetTemplateButton", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ id: "template-1" }),
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

  it("posts the selected budget as a user template", async () => {
    const { getButton, getInput, getTextarea } = await renderButton();

    await act(async () => {
      getButton("Guardar como plantilla").click();
    });

    await act(async () => {
      setInputValue(getInput("Nombre de plantilla"), "Arquitectura validada");
      setInputValue(getTextarea("Descripcion"), "Base revisada para obras similares.");
      getButton("Guardar plantilla").click();
    });

    expect(fetch).toHaveBeenCalledWith("/api/templates/budget", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        budgetId: "budget-1",
        name: "Arquitectura validada",
        description: "Base revisada para obras similares.",
      }),
    });
    expect(document.body.textContent).toContain("Plantilla guardada");
    expect(document.body.innerHTML).toContain('href="/templates"');
  });

  it("shows the API error without closing the dialog", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        json: async () => ({ error: "No se encontro el presupuesto para crear la plantilla" }),
      })),
    );
    const { getButton } = await renderButton();

    await act(async () => {
      getButton("Guardar como plantilla").click();
    });
    await act(async () => {
      getButton("Guardar plantilla").click();
    });

    expect(document.body.textContent).toContain("No se encontro el presupuesto para crear la plantilla");
    expect(document.body.textContent).toContain("Guardar plantilla");
  });
});

async function renderButton() {
  const nextContainer = document.createElement("div");
  document.body.appendChild(nextContainer);
  activeContainer = nextContainer;

  const root = createRoot(nextContainer);
  (nextContainer as HTMLDivElement & { __root?: typeof root }).__root = root;

  await act(async () => {
    root.render(<SaveBudgetTemplateButton budgetId="budget-1" budgetName="Arquitectura" />);
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

function setInputValue(element: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const prototype = element instanceof HTMLInputElement ? HTMLInputElement.prototype : HTMLTextAreaElement.prototype;
  const valueSetter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
  valueSetter?.call(element, value);
  element.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: value }));
}
