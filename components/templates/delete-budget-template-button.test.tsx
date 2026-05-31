/* @vitest-environment jsdom */

import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DeleteBudgetTemplateButton } from "@/components/templates/delete-budget-template-button";

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }),
}));

let activeContainer: HTMLDivElement | null = null;

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe("DeleteBudgetTemplateButton", () => {
  beforeEach(() => {
    mocks.push.mockReset();
    mocks.refresh.mockReset();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ ok: true }),
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

  it("deletes a template and returns to the template library", async () => {
    const { getButton } = await renderButton();

    await act(async () => {
      getButton("Eliminar").click();
    });
    await act(async () => {
      getButton("Eliminar plantilla").click();
    });

    expect(fetch).toHaveBeenCalledWith("/api/templates/budget/template-1", {
      method: "DELETE",
    });
    expect(mocks.push).toHaveBeenCalledWith("/templates");
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
    root.render(<DeleteBudgetTemplateButton templateId="template-1" templateName="Arquitectura reusable" />);
  });

  return {
    getButton: (label: string) => {
      const button = [...document.body.querySelectorAll("button")].find((candidate) => candidate.textContent?.includes(label));
      if (!(button instanceof HTMLButtonElement)) {
        throw new Error(`Missing button: ${label}`);
      }
      return button;
    },
  };
}
