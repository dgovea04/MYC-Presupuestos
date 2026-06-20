/* @vitest-environment jsdom */

import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { KhipuLogo } from "@/components/khipu/KhipuLogo";

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

async function render(props: React.ComponentProps<typeof KhipuLogo> = {}) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  activeContainer = container;

  const root = createRoot(container);
  (container as HTMLDivElement & { __root?: typeof root }).__root = root;

  await act(async () => root.render(<KhipuLogo {...props} />));
  await act(async () => new Promise((r) => setTimeout(r, 0)));

  return container;
}

describe("KhipuLogo", () => {
  it("renders the Khipu title text", async () => {
    const container = await render();
    expect(container.textContent).toContain("Khipu");
  });

  it("shows the subtitle by default", async () => {
    const container = await render();
    expect(container.textContent).toContain("Asistente IA de MC Presupuestos");
  });

  it("hides the subtitle when showSubtitle=false", async () => {
    const container = await render({ showSubtitle: false });
    expect(container.textContent).toContain("Khipu");
    expect(container.textContent).not.toContain("Asistente IA de MC Presupuestos");
  });

  it("renders the KhipuSymbol inside the logo", async () => {
    const container = await render();
    const img = container.querySelector("img");
    expect(img).toBeTruthy();
    expect(img!.getAttribute("src")).toBe("/khipu-1.svg");
  });

  it("applies default md size classes to the symbol", async () => {
    const container = await render({ size: "md" });
    const img = container.querySelector("img")!;
    expect(img.className).toContain("h-9");
    expect(img.className).toContain("w-9");
  });

  it("applies sm size classes to the symbol", async () => {
    const container = await render({ size: "sm" });
    const img = container.querySelector("img")!;
    expect(img.className).toContain("h-7");
    expect(img.className).toContain("w-7");
  });

  it("applies lg size classes to the symbol", async () => {
    const container = await render({ size: "lg" });
    const img = container.querySelector("img")!;
    expect(img.className).toContain("h-12");
    expect(img.className).toContain("w-12");
  });

  it("renders the title with font-display class", async () => {
    const container = await render();
    const title = container.querySelector("p");
    expect(title!.className).toContain("font-display");
  });

  it("merges custom className on the outer container", async () => {
    const container = await render({ className: "my-logo-wrapper" });
    // The outer div should contain the custom class
    const outerDiv = container.firstElementChild as HTMLElement;
    expect(outerDiv.className).toContain("my-logo-wrapper");
  });

  it("renders subtitle with khipu-muted text color", async () => {
    const container = await render();
    const paragraphs = container.querySelectorAll("p");
    // The subtitle is the second paragraph
    const subtitle = paragraphs[1];
    expect(subtitle.className).toContain("text-khipu-muted");
  });

  it("applies subtitle font size for sm variant", async () => {
    const container = await render({ size: "sm" });
    const paragraphs = container.querySelectorAll("p");
    const subtitle = paragraphs[1];
    expect(subtitle.className).toContain("text-[10px]");
  });

  it("applies subtitle font size for md variant", async () => {
    const container = await render({ size: "md" });
    const paragraphs = container.querySelectorAll("p");
    const subtitle = paragraphs[1];
    expect(subtitle.className).toContain("text-[11px]");
  });

  it("applies subtitle font size for lg variant", async () => {
    const container = await render({ size: "lg" });
    const paragraphs = container.querySelectorAll("p");
    const subtitle = paragraphs[1];
    expect(subtitle.className).toContain("text-xs");
  });

  it("applies title font size for sm variant", async () => {
    const container = await render({ size: "sm" });
    const paragraphs = container.querySelectorAll("p");
    const title = paragraphs[0];
    expect(title.className).toContain("text-base");
  });

  it("applies title font size for lg variant", async () => {
    const container = await render({ size: "lg" });
    const paragraphs = container.querySelectorAll("p");
    const title = paragraphs[0];
    expect(title.className).toContain("text-2xl");
  });
});
