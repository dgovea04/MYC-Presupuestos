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
    expect(document.body.textContent).toContain("Khipu");
    expect(document.querySelector("[data-khipu-launcher]")).toBeTruthy();
  });

  it("hides the floating launcher on auth routes", async () => {
    await renderProvider("/login", <div>Login</div>);

    expect(document.querySelector("[data-khipu-launcher]")).toBeNull();
  });

  it("hides the floating launcher on register", async () => {
    await renderProvider("/register", <div>Registro</div>);

    expect(document.querySelector("[data-khipu-launcher]")).toBeNull();
  });

  it("toggles expanded and minimized state", async () => {
    await renderProvider("/dashboard", <div>Contenido</div>);

    const launcher = getLauncher();

    expect(document.body.textContent).not.toContain("Asistente tecnico");

    await act(async () => {
      launcher.click();
    });

    expect(document.body.textContent).toContain("Asistente tecnico");

    const closeButton = document.querySelector("[data-khipu-close]");

    expect(closeButton).toBeTruthy();

    await act(async () => {
      (closeButton as HTMLButtonElement).click();
    });

    expect(document.body.textContent).not.toContain("Asistente tecnico");
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
