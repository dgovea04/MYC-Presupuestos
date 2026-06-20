/* @vitest-environment jsdom */

import React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GlobalAiAssistantProvider } from "@/components/ai/global-ai-assistant-provider";

let mockPathname = "/dashboard";
let activeContainer: HTMLDivElement | null = null;
let activeRoot: Root | null = null;

vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
}));

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe("GlobalAiAssistantProvider", () => {
  afterEach(async () => {
    if (activeRoot) {
      await act(async () => {
        activeRoot?.unmount();
      });
    }

    activeRoot = null;

    if (activeContainer) {
      activeContainer.remove();
    }

    activeContainer = null;
    mockPathname = "/dashboard";
    document.body.innerHTML = "";
  });

  it("renders children unchanged", async () => {
    const { container } = await renderProvider("/dashboard", <div>Contenido</div>);

    expect(container.textContent).toContain("Contenido");
  });

  it("renders the floating launcher on authenticated routes", async () => {
    await renderProvider("/dashboard", <div>Contenido</div>);

    expect(document.body.textContent).toContain("Contenido");
    expect(getLauncher()).toBeTruthy();
  });

  it("hides the floating launcher on auth routes", async () => {
    await renderProvider("/login", <div>Login</div>);

    expect(document.querySelector("[data-khipu-launcher]")).toBeNull();
  });

  it("hides the floating launcher on register", async () => {
    await renderProvider("/register", <div>Registro</div>);

    expect(document.querySelector("[data-khipu-launcher]")).toBeNull();
  });

  it("hides the floating launcher on public routes", async () => {
    await renderProvider("/", <div>Inicio</div>);

    expect(document.querySelector("[data-khipu-launcher]")).toBeNull();
  });

  it("hides the floating launcher on public landing variants", async () => {
    await renderProvider("/landing-v2", <div>Landing</div>);

    expect(document.querySelector("[data-khipu-launcher]")).toBeNull();
  });

  it("toggles expanded and minimized state", async () => {
    await renderProvider("/projects/demo", <div>Contenido</div>);

    const launcher = getLauncher();

    expect(launcher.getAttribute("aria-expanded")).toBe("false");
    expect(getCloseButton()).toBeNull();

    await act(async () => {
      launcher.click();
    });

    expect(launcher.getAttribute("aria-expanded")).toBe("true");

    const closeButton = getCloseButton();

    expect(closeButton).toBeTruthy();

    await act(async () => {
      (closeButton as HTMLButtonElement).click();
    });

    expect(launcher.getAttribute("aria-expanded")).toBe("false");
    // Note: AnimatePresence keeps the close button in the DOM during the exit
    // animation. In jsdom (no RAF) the animation never completes, so we
    // cannot assert the close button is removed. The aria-expanded toggle
    // is the functional contract.
  });

  it("passes a minimal runtime project context to the floating assistant", async () => {
    await renderProvider("/projects/demo/presupuestos", <div>Contenido</div>);

    await act(async () => {
      getLauncher().click();
      await Promise.resolve();
    });

    expect(document.body.textContent).not.toContain("Sin contexto activo");
    expect(document.body.textContent).toContain("demo");
    expect(document.body.textContent).toContain("Presupuestos");
  });
});

async function renderProvider(pathname: string, children: React.ReactNode) {
  mockPathname = pathname;
  window.history.replaceState({}, "", pathname);
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  activeContainer = container;
  activeRoot = root;

  await act(async () => {
    root.render(<GlobalAiAssistantProvider>{children}</GlobalAiAssistantProvider>);
  });

  return { container, root };
}

function getLauncher() {
  const launcher = document.querySelector("[data-khipu-launcher]");

  expect(launcher).toBeTruthy();

  return launcher as HTMLButtonElement;
}

function getCloseButton() {
  return document.querySelector('button[aria-label="Cerrar Khipu"]');
}
