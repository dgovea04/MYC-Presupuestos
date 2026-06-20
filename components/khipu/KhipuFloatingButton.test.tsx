/* @vitest-environment jsdom */

import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { KhipuFloatingButton } from "@/components/khipu/KhipuFloatingButton";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let activeContainer: HTMLDivElement | null = null;

afterEach(async () => {
  if (!activeContainer) return;

  const root = (activeContainer as HTMLDivElement & { __root?: ReturnType<typeof createRoot> }).__root;
  if (root) {
    await act(async () => root.unmount());
  }
  activeContainer.remove();
  activeContainer = null;
  document.body.innerHTML = "";
});

async function render(props: React.ComponentProps<typeof KhipuFloatingButton> = { open: false, onClick: vi.fn() }) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  activeContainer = container;

  const root = createRoot(container);
  (container as HTMLDivElement & { __root?: typeof root }).__root = root;

  await act(async () => root.render(<KhipuFloatingButton {...props} />));
  await act(async () => new Promise((r) => setTimeout(r, 0)));

  return container;
}

describe("KhipuFloatingButton", () => {
  it("renders a button with data-khipu-launcher attribute", async () => {
    const container = await render();
    const button = container.querySelector("[data-khipu-launcher]");
    expect(button).toBeTruthy();
  });

  it("sets aria-expanded=false when open is false", async () => {
    const container = await render({ open: false, onClick: vi.fn() });
    const button = container.querySelector("[data-khipu-launcher]") as HTMLButtonElement;
    expect(button.getAttribute("aria-expanded")).toBe("false");
  });

  it("sets aria-expanded=true when open is true", async () => {
    const container = await render({ open: true, onClick: vi.fn() });
    const button = container.querySelector("[data-khipu-launcher]") as HTMLButtonElement;
    expect(button.getAttribute("aria-expanded")).toBe("true");
  });

  it("shows aria-label 'Abrir Khipu' when closed", async () => {
    const container = await render({ open: false, onClick: vi.fn() });
    const button = container.querySelector("[data-khipu-launcher]") as HTMLButtonElement;
    expect(button.getAttribute("aria-label")).toBe("Abrir Khipu");
  });

  it("shows aria-label 'Cerrar Khipu' when open", async () => {
    const container = await render({ open: true, onClick: vi.fn() });
    const button = container.querySelector("[data-khipu-launcher]") as HTMLButtonElement;
    expect(button.getAttribute("aria-label")).toBe("Cerrar Khipu");
  });

  it("calls onClick when the button is clicked", async () => {
    const onClick = vi.fn();
    const container = await render({ open: false, onClick });

    const button = container.querySelector("[data-khipu-launcher]") as HTMLButtonElement;
    await act(async () => button.click());

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("renders the KhipuSymbol inside the button", async () => {
    const container = await render();
    const img = container.querySelector("img");
    expect(img).toBeTruthy();
    expect(img!.getAttribute("src")).toBe("/khipu-1.svg");
  });

  it("applies custom className", async () => {
    const container = await render({ open: false, onClick: vi.fn(), className: "my-position" });
    const outerDiv = container.firstElementChild as HTMLElement;
    expect(outerDiv.className).toContain("my-position");
    expect(outerDiv.className).toContain("relative");
  });

  it("wraps the button in a relative div", async () => {
    const container = await render();
    const outerDiv = container.firstElementChild as HTMLElement;
    expect(outerDiv.tagName).toBe("DIV");
    expect(outerDiv.className).toContain("relative");
  });

  it("renders a button of type 'button'", async () => {
    const container = await render();
    const button = container.querySelector("[data-khipu-launcher]") as HTMLButtonElement;
    expect(button.getAttribute("type")).toBe("button");
  });

  it("renders a circular button with rounded-[99px] class", async () => {
    const container = await render();
    const button = container.querySelector("[data-khipu-launcher]") as HTMLButtonElement;
    expect(button.className).toContain("rounded-[99px]");
  });

  it("renders with the h-15 and w-15 size classes", async () => {
    const container = await render();
    const button = container.querySelector("[data-khipu-launcher]") as HTMLButtonElement;
    expect(button.className).toContain("h-15");
    expect(button.className).toContain("w-15");
  });
});
