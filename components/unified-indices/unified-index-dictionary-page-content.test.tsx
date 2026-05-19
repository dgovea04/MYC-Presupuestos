/* @vitest-environment jsdom */

import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";

import { UnifiedIndexDictionaryPageContent } from "@/components/unified-indices/unified-index-dictionary-page-content";
import type { UnifiedIndexDictionaryRow } from "@/types/unified-index";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let activeContainer: HTMLDivElement | null = null;

afterEach(async () => {
  if (!activeContainer) {
    return;
  }

  const root = (activeContainer as HTMLDivElement & { __root?: ReturnType<typeof createRoot> }).__root;
  if (root) {
    await act(async () => {
      root.unmount();
    });
  }

  activeContainer.remove();
  activeContainer = null;
});

describe("UnifiedIndexDictionaryPageContent", () => {
  it("filters by elemento, nota, and codigo while staying read-only", async () => {
    const rows: UnifiedIndexDictionaryRow[] = [
      { code: "66", element: "Accesorio PVC-U para redes de agua", note: null },
      { code: "3", element: "Acero corrugado ASTM A496", note: null },
      { code: "93", element: "Agua", note: "1/" },
    ];

    const container = await renderNode(<UnifiedIndexDictionaryPageContent rows={rows} />);

    expect(container.textContent).toContain("3 elementos visibles");
    expect(container.textContent).toContain("Accesorio PVC-U para redes de agua");
    expect(container.textContent).toContain("Acero corrugado ASTM A496");
    expect(container.textContent).toContain("Agua");
    expect(container.textContent).not.toContain("Editar");
    expect(container.textContent).not.toContain("Crear");

    const input = container.querySelector("input");
    if (!input) {
      throw new Error("Search input was not rendered");
    }

    await act(async () => {
      setInputValue(input, "1/");
      await Promise.resolve();
    });

    expect(container.textContent).toContain("1 elemento visible");
    expect(container.textContent).toContain("Agua");
    expect(container.textContent).not.toContain("Acero corrugado ASTM A496");
  });
});

async function renderNode(node: React.ReactNode) {
  activeContainer = document.createElement("div");
  document.body.appendChild(activeContainer);

  const root = createRoot(activeContainer);
  (activeContainer as HTMLDivElement & { __root?: ReturnType<typeof createRoot> }).__root = root;

  await act(async () => {
    root.render(node);
  });

  return activeContainer;
}

function setInputValue(input: HTMLInputElement, value: string) {
  const descriptor = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value");
  descriptor?.set?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}
