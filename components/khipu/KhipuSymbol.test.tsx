/* @vitest-environment jsdom */

import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { KhipuSymbol } from "@/components/khipu/KhipuSymbol";

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

async function render(props: React.ComponentProps<typeof KhipuSymbol> = {}) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  activeContainer = container;

  const root = createRoot(container);
  (container as HTMLDivElement & { __root?: typeof root }).__root = root;

  await act(async () => root.render(<KhipuSymbol {...props} />));
  await act(async () => new Promise((r) => setTimeout(r, 0)));

  return container;
}

describe("KhipuSymbol", () => {
  it("renders an img element with the correct src", async () => {
    const container = await render();
    const img = container.querySelector("img");
    expect(img).toBeTruthy();
    expect(img!.getAttribute("src")).toBe("/khipu-1.svg");
  });

  it("sets aria-hidden=true on the default variant img", async () => {
    const container = await render();
    const img = container.querySelector("img");
    expect(img!.getAttribute("aria-hidden")).toBe("true");
  });

  it("applies default className via cn()", async () => {
    const container = await render({ className: "h-9 w-9" });
    const img = container.querySelector("img");
    expect(img!.className).toContain("h-9");
    expect(img!.className).toContain("w-9");
  });

  it("default variant renders a plain img without wrapper", async () => {
    const container = await render();
    // default should be an img direct child, no span wrapper beyond the container
    const img = container.querySelector("img");
    expect(img!.parentElement).toBe(container);
  });

  it("dark variant wraps the img in a span with navy background", async () => {
    const container = await render({ variant: "dark" });
    const span = container.querySelector("span");
    expect(span).toBeTruthy();
    expect(span!.className).toContain("rounded-xl");
    expect(span!.className).toContain("bg-[#0D134D]");

    const img = span!.querySelector("img");
    expect(img).toBeTruthy();
    expect(img!.getAttribute("src")).toBe("/khipu-1.svg");
    expect(img!.className).toContain("brightness-[1.6]");
    expect(img!.className).toContain("contrast-[1.15]");
  });

  it("mono variant applies grayscale class to the img", async () => {
    const container = await render({ variant: "mono" });
    const img = container.querySelector("img");
    expect(img!.className).toContain("grayscale");
  });

  it("mono variant still renders as a plain img", async () => {
    const container = await render({ variant: "mono" });
    const img = container.querySelector("img");
    expect(img!.parentElement).toBe(container);
  });

  it("merges className with dark variant span", async () => {
    const container = await render({ variant: "dark", className: "my-custom-class" });
    const span = container.querySelector("span")!;
    expect(span.className).toContain("my-custom-class");
    expect(span.className).toContain("rounded-xl");
  });
});
