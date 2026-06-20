/* @vitest-environment jsdom */

import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { KhipuBadge } from "@/components/khipu/KhipuBadge";

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

async function render(props: React.ComponentProps<typeof KhipuBadge> = {}) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  activeContainer = container;

  const root = createRoot(container);
  (container as HTMLDivElement & { __root?: typeof root }).__root = root;

  await act(async () => root.render(<KhipuBadge {...props} />));
  await act(async () => new Promise((r) => setTimeout(r, 0)));

  return container;
}

describe("KhipuBadge", () => {
  it("renders the IA label text", async () => {
    const container = await render();
    expect(container.textContent).toContain("IA");
  });

  it("renders the KhipuSymbol by default (non-compact)", async () => {
    const container = await render();
    const img = container.querySelector("img");
    expect(img).toBeTruthy();
    expect(img!.getAttribute("src")).toBe("/khipu-1.svg");
    expect(img!.className).toContain("h-4");
    expect(img!.className).toContain("w-4");
  });

  it("renders a Sparkles icon instead of KhipuSymbol when compact=true", async () => {
    const container = await render({ compact: true });
    // In compact mode: no image, but a Sparkles SVG
    const img = container.querySelector("img");
    expect(img).toBeNull();

    const svg = container.querySelector("svg.lucide-sparkles");
    expect(svg).toBeTruthy();
    // In jsdom, SVG className returns SVGAnimatedString, so use getAttribute
    expect(svg!.getAttribute("class")).toContain("h-3");
    expect(svg!.getAttribute("class")).toContain("w-3");
  });

  it("applies light variant classes by default", async () => {
    const container = await render();
    const badge = container.firstElementChild as HTMLElement;
    expect(badge.className).toContain("border-cyan-200");
    expect(badge.className).toContain("bg-cyan-50");
    expect(badge.className).toContain("text-slate-900");
  });

  it("applies dark variant classes", async () => {
    const container = await render({ variant: "dark" });
    const badge = container.firstElementChild as HTMLElement;
    expect(badge.className).toContain("border-cyan-400/30");
    expect(badge.className).toContain("bg-white/10");
    expect(badge.className).toContain("text-cyan-200");
  });

  it("uses the KhipuSymbol with dark variant when variant=dark", async () => {
    const container = await render({ variant: "dark" });
    const span = container.querySelector("span");
    // The symbol is wrapped in a span with the navy background for dark variant
    const symbolSpan = span!.querySelector("span");
    expect(symbolSpan).toBeTruthy();
    // dark variant of KhipuSymbol wraps in a span with bg-[#0D134D]
    expect(symbolSpan!.className).toContain("bg-[#0D134D]");
  });

  it("merges custom className", async () => {
    const container = await render({ className: "ml-2 text-xs" });
    const badge = container.firstElementChild as HTMLElement;
    expect(badge.className).toContain("ml-2");
    expect(badge.className).toContain("text-xs");
    // Base classes still present
    expect(badge.className).toContain("rounded-full");
  });

  it("applies rounded-full class", async () => {
    const container = await render();
    const badge = container.firstElementChild as HTMLElement;
    expect(badge.className).toContain("rounded-full");
  });

  it("renders IA text after the icon", async () => {
    const container = await render();
    // The IA text is the last child text node inside the span
    expect(container.textContent?.trim()).toMatch(/IA$/);
  });
});
