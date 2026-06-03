/* @vitest-environment jsdom */

import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DuplicateBudgetTemplateButton } from "@/components/templates/duplicate-budget-template-button";

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }),
}));

let activeContainer: HTMLDivElement | null = null;

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe("DuplicateBudgetTemplateButton", () => {
  beforeEach(() => {
    mocks.push.mockReset();
    mocks.refresh.mockReset();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ id: "template-copy", name: "Arquitectura copia" }),
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

  it("duplicates a template and navigates to the copy", async () => {
    const { getButton, getInput, getTextarea } = await renderButton();

    await act(async () => {
      getButton("Duplicar").click();
    });
    expect(fetch).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain("Original");
    expect(document.body.textContent).toContain("Arquitectura reusable");

    await act(async () => {
      setInputValue(getInput("Nombre de la copia"), "Arquitectura reutilizable - oficina");
      setTextareaValue(getTextarea("Descripcion de la copia"), "Base inicial ajustada");
      getButton("Crear copia").click();
    });

    expect(fetch).toHaveBeenCalledWith("/api/templates/budget/template-1/duplicate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Arquitectura reutilizable - oficina",
        description: "Base inicial ajustada",
      }),
    });
    expect(mocks.push).toHaveBeenCalledWith("/templates/budget/template-copy");
    expect(mocks.refresh).toHaveBeenCalled();
  });

  it("shows the API error without closing the dialog", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        json: async () => ({ error: "Nombre duplicado" }),
      })),
    );
    const { getButton } = await renderButton();

    await act(async () => {
      getButton("Duplicar").click();
    });

    await act(async () => {
      getButton("Crear copia").click();
    });

    expect(document.body.textContent).toContain("Nombre duplicado");
    expect(document.body.textContent).toContain("Duplicar plantilla");
    expect(getButton("Crear copia").disabled).toBe(false);
    expect(mocks.push).not.toHaveBeenCalled();
    expect(mocks.refresh).not.toHaveBeenCalled();
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
      <DuplicateBudgetTemplateButton
        templateId="template-1"
        templateName="Arquitectura reusable"
        templateDescription="Base inicial"
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
