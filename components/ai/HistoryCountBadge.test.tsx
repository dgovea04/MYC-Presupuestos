/* @vitest-environment jsdom */

import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { HistoryCountBadge } from "@/components/ai/HistoryCountBadge";

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let activeContainer: HTMLDivElement | null = null;

afterEach(async () => {
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
  document.body.innerHTML = "";
});

async function render(props: React.ComponentProps<typeof HistoryCountBadge>) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  activeContainer = container;

  const root = createRoot(container);
  (container as HTMLDivElement & { __root?: typeof root }).__root = root;

  await act(async () => {
    root.render(<HistoryCountBadge {...props} />);
  });

  return container;
}

describe("HistoryCountBadge", () => {
  it("renders the count as text content", async () => {
    const container = await render({ count: 7 });
    expect(container.textContent).toContain("7");
  });

  it("renders the count as the only child text", async () => {
    const container = await render({ count: 42 });
    // The span should contain exactly "42" and no extra text
    expect(container.textContent?.trim()).toBe("42");
  });

  it("applies base rounded-full classes even without a custom className", async () => {
    const container = await render({ count: 3 });
    const span = container.querySelector("span");
    expect(span).toBeTruthy();
    expect(span!.className).toContain("rounded-full");
    expect(span!.className).toContain("bg-[var(--app-surface-muted)]");
    expect(span!.className).toContain("tabular-nums");
  });

  it("merges a custom className via cn()", async () => {
    const container = await render({ className: "ml-2 text-[11px]", count: 5 });
    const span = container.querySelector("span");
    expect(span).toBeTruthy();
    expect(span!.className).toContain("ml-2");
    expect(span!.className).toContain("text-[11px]");
    // Base classes still present
    expect(span!.className).toContain("rounded-full");
  });

  it("renders zero correctly", async () => {
    const container = await render({ count: 0 });
    expect(container.textContent?.trim()).toBe("0");
  });
});
