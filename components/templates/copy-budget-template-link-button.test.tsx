/* @vitest-environment jsdom */

import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CopyBudgetTemplateLinkButton } from "@/components/templates/copy-budget-template-link-button";

let activeContainer: HTMLDivElement | null = null;

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe("CopyBudgetTemplateLinkButton", () => {
  beforeEach(() => {
    Object.defineProperty(window, "location", {
      configurable: true,
      value: new URL("https://myc.test/templates/budget/template-1"),
    });
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: vi.fn(async () => undefined),
      },
    });
  });

  afterEach(async () => {
    vi.useRealTimers();

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

  it("copies the absolute budget template detail link", async () => {
    vi.useFakeTimers();
    const { getButton } = await renderButton();

    await act(async () => {
      getButton("Copiar enlace").click();
    });

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("https://myc.test/templates/budget/template-1");
    expect(getButton("Copiado")).toBeTruthy();

    await act(async () => {
      vi.advanceTimersByTime(1600);
    });

    expect(getButton("Copiar enlace")).toBeTruthy();
  });

  it("shows a visible error when the link cannot be copied", async () => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: vi.fn(async () => {
          throw new Error("Clipboard denied");
        }),
      },
    });
    const { getButton } = await renderButton();

    await act(async () => {
      getButton("Copiar enlace").click();
    });

    expect(document.body.textContent).toContain("No se pudo copiar el enlace");
    expect(document.body.querySelector('[role="alert"]')?.textContent).toBe("No se pudo copiar el enlace");
    expect(getButton("Copiar enlace")).toBeTruthy();
  });

  it("shows a visible error when clipboard access is unavailable", async () => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: undefined,
    });
    const { getButton } = await renderButton();

    await act(async () => {
      getButton("Copiar enlace").click();
    });

    expect(document.body.textContent).toContain("No se pudo copiar el enlace");
    expect(document.body.querySelector('[role="alert"]')?.textContent).toBe("No se pudo copiar el enlace");
    expect(getButton("Copiar enlace")).toBeTruthy();
  });

  it("clears a previous copy error after a successful retry", async () => {
    const writeText = vi
      .fn<(_: string) => Promise<void>>()
      .mockRejectedValueOnce(new Error("Clipboard denied"))
      .mockResolvedValueOnce(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    const { getButton } = await renderButton();

    await act(async () => {
      getButton("Copiar enlace").click();
    });

    expect(document.body.textContent).toContain("No se pudo copiar el enlace");

    await act(async () => {
      getButton("Copiar enlace").click();
    });

    expect(writeText).toHaveBeenCalledTimes(2);
    expect(document.body.textContent).not.toContain("No se pudo copiar el enlace");
    expect(getButton("Copiado")).toBeTruthy();
  });
});

async function renderButton() {
  const nextContainer = document.createElement("div");
  document.body.appendChild(nextContainer);
  activeContainer = nextContainer;

  const root = createRoot(nextContainer);
  (nextContainer as HTMLDivElement & { __root?: typeof root }).__root = root;

  await act(async () => {
    root.render(<CopyBudgetTemplateLinkButton templateId="template-1" />);
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
